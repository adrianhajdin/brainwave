-- =============================================================================
-- Households v2 and cat sitters.
--
-- Before: a "household" was everything one owner had, and every member saw all
-- of that owner's cats.
--
-- Now:
--   * A household is its own thing with a name ("Home", "Mum's place"). People
--     can be in several households; admins invite and remove members.
--   * Each cat belongs to at most one household (devices.household_id) or is
--     private. Everyone in that household sees it and gets its alerts.
--   * A cat sitter can follow one cat without joining a household, optionally
--     until a date (holiday cover). Owners can stop it at any time.
--   * Only the owner edits, moves or deletes a cat; household members and
--     sitters can see it, get alerts and switch lost mode.
--
-- Existing data: every owner gets a household ("<name>'s household") holding
-- their cats, with their current household members in it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 64),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.household_memberships (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_memberships_user_idx on public.household_memberships (user_id);

create table public.cat_sitters (
  device_id   uuid not null references public.devices (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  added_by    uuid references auth.users (id) on delete set null,
  until       timestamptz,  -- null: until the owner stops it
  created_at  timestamptz not null default now(),
  primary key (device_id, user_id)
);
create index cat_sitters_user_idx on public.cat_sitters (user_id);

create table public.invites (
  code          text primary key,
  kind          text not null check (kind in ('household', 'sitter')),
  household_id  uuid references public.households (id) on delete cascade,
  device_id     uuid references public.devices (id) on delete cascade,
  sitter_until  timestamptz,
  created_by    uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '7 days',
  check ((kind = 'household') = (household_id is not null)),
  check ((kind = 'sitter') = (device_id is not null))
);
create index invites_creator_idx on public.invites (created_by);

alter table public.households            enable row level security;
alter table public.household_memberships enable row level security;
alter table public.cat_sitters           enable row level security;
alter table public.invites               enable row level security;
-- Only reachable through the functions below.
revoke all on public.households, public.household_memberships, public.cat_sitters, public.invites
  from anon, authenticated;

alter table public.devices
  add column household_id uuid references public.households (id) on delete set null;
create index devices_household_idx on public.devices (household_id);

-- -----------------------------------------------------------------------------
-- Move existing data over
-- -----------------------------------------------------------------------------
insert into public.households (name, created_by)
select left(coalesce(initcap(split_part(u.email, '@', 1)), 'My') || '''s household', 64), o.owner_id
  from (select owner_id from public.devices where owner_id is not null
        union
        select owner_id from public.household_members) o
  join auth.users u on u.id = o.owner_id;

insert into public.household_memberships (household_id, user_id, role)
select id, created_by, 'admin' from public.households;

insert into public.household_memberships (household_id, user_id, role)
select h.id, m.member_id, 'member'
  from public.household_members m
  join public.households h on h.created_by = m.owner_id
on conflict do nothing;

update public.devices d
   set household_id = h.id
  from public.households h
 where h.created_by = d.owner_id;

-- New cats join the owner's first household (an admin one if there is one);
-- a released collar leaves its household.
create or replace function public.devices_default_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    new.household_id := null;
  elsif (tg_op = 'INSERT' and new.household_id is null)
     or (tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id) then
    new.household_id := (
      select m.household_id
        from public.household_memberships m
        join public.households h on h.id = m.household_id
       where m.user_id = new.owner_id
       order by (m.role = 'admin') desc, h.created_at
       limit 1);
  end if;
  return new;
end;
$$;

create trigger devices_default_household
  before insert or update of owner_id on public.devices
  for each row execute function public.devices_default_household();

-- -----------------------------------------------------------------------------
-- Who may see which cat
-- -----------------------------------------------------------------------------
create or replace function public.viewable_device_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.devices d where d.owner_id = auth.uid()
  union
  select d.id
    from public.devices d
    join public.household_memberships m on m.household_id = d.household_id
   where m.user_id = auth.uid()
  union
  select s.device_id
    from public.cat_sitters s
   where s.user_id = auth.uid() and (s.until is null or s.until > now());
$$;
revoke execute on function public.viewable_device_ids() from public, anon;
grant execute on function public.viewable_device_ids() to authenticated;

drop policy devices_select_household on public.devices;
create policy devices_select_viewable on public.devices
  for select to authenticated
  using (id in (select public.viewable_device_ids()));

-- History stays with the owner it was recorded for: after a collar changes
-- hands, the new owner's people do not see the previous owner's trail.
drop policy telemetry_select_household on public.telemetry;
create policy telemetry_select_viewable on public.telemetry
  for select to authenticated
  using ((device_id, owner_id) in (
    select d.id, d.owner_id from public.devices d where d.id in (select public.viewable_device_ids())));

drop policy geofence_events_select_household on public.geofence_events;
create policy geofence_events_select_viewable on public.geofence_events
  for select to authenticated
  using ((device_id, owner_id) in (
    select d.id, d.owner_id from public.devices d where d.id in (select public.viewable_device_ids())));

-- A cat's own zones, plus its owner's "all cats" zones.
drop policy geofences_select_household on public.geofences;
create policy geofences_select_viewable on public.geofences
  for select to authenticated
  using (
    owner_id in (select d.owner_id from public.devices d where d.id in (select public.viewable_device_ids()))
    and (device_id is null or device_id in (select public.viewable_device_ids())));

-- Photos are stored as <owner_id>/<device_id>-<timestamp>.jpg.
drop policy cat_photos_read_household on storage.objects;
create policy cat_photos_read_viewable on storage.objects
  for select to authenticated
  using (bucket_id = 'cat-photos'
         and left(split_part(name, '/', 2), 36) in (select v::text from public.viewable_device_ids() v));

-- Lost mode: owner, household members and sitters (it is an emergency switch).
create or replace function public.set_lost_mode(p_device_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.devices
     set lost_mode = p_on,
         lost_mode_since = case when p_on then coalesce(lost_mode_since, now()) else null end
   where id = p_device_id
     and id in (select public.viewable_device_ids());
  if not found then
    raise exception 'cat not found' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Households
-- -----------------------------------------------------------------------------
create or replace function public.is_household_admin(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.household_memberships
                  where household_id = p_household_id and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 64 then
    raise exception 'name must be 1-64 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.household_memberships where user_id = v_uid) >= 10 then
    raise exception 'you are in too many households' using errcode = '54000';
  end if;

  insert into public.households (name, created_by) values (trim(p_name), v_uid) returning id into v_id;
  insert into public.household_memberships (household_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;

create or replace function public.rename_household(p_household_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_admin(p_household_id) then
    raise exception 'only household admins can do this' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 64 then
    raise exception 'name must be 1-64 characters' using errcode = '22023';
  end if;
  update public.households set name = trim(p_name) where id = p_household_id;
end;
$$;

-- Cats in a deleted household become private to their owners (ON DELETE SET NULL).
create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_admin(p_household_id) then
    raise exception 'only household admins can do this' using errcode = '42501';
  end if;
  delete from public.households where id = p_household_id;
end;
$$;

-- Everyone's view of their households: name, my role, members and cat count.
create or replace function public.list_households()
returns table (household_id uuid, name text, my_role text, members jsonb, cat_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, me.role,
         (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'role', m.role)
                                    order by (m.role = 'admin') desc, m.created_at), '[]'::jsonb)
            from public.household_memberships m
            join auth.users u on u.id = m.user_id
           where m.household_id = h.id),
         (select count(*)::int from public.devices d where d.household_id = h.id)
    from public.household_memberships me
    join public.households h on h.id = me.household_id
   where me.user_id = auth.uid()
   order by h.created_at;
$$;

-- When someone leaves (or is removed), their own cats leave with them, and the
-- household never ends up without an admin while it still has members.
create or replace function public.household_after_member_left(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.devices set household_id = null
   where household_id = p_household_id and owner_id = p_user_id;

  if not exists (select 1 from public.household_memberships where household_id = p_household_id) then
    delete from public.households where id = p_household_id;
  elsif not exists (select 1 from public.household_memberships
                     where household_id = p_household_id and role = 'admin') then
    update public.household_memberships set role = 'admin'
     where (household_id, user_id) = (
       select household_id, user_id from public.household_memberships
        where household_id = p_household_id order by created_at limit 1);
  end if;
end;
$$;
revoke execute on function public.household_after_member_left(uuid, uuid) from public, anon, authenticated;

-- Same argument type as the old leave_household(p_owner_id uuid), so drop it first.
drop function public.leave_household(uuid);
create function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.household_memberships where household_id = p_household_id and user_id = auth.uid();
  if found then
    perform public.household_after_member_left(p_household_id, auth.uid());
  end if;
end;
$$;

create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_admin(p_household_id) then
    raise exception 'only household admins can do this' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'use leave_household to leave yourself' using errcode = '22023';
  end if;
  delete from public.household_memberships where household_id = p_household_id and user_id = p_user_id;
  if found then
    perform public.household_after_member_left(p_household_id, p_user_id);
  end if;
end;
$$;

-- Owner puts a cat in one of their households, or makes it private (null).
create or replace function public.set_cat_household(p_device_id uuid, p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.devices where id = p_device_id and owner_id = v_uid) then
    raise exception 'cat not found' using errcode = 'P0002';
  end if;
  if p_household_id is not null
     and not exists (select 1 from public.household_memberships
                      where household_id = p_household_id and user_id = v_uid) then
    raise exception 'you are not in that household' using errcode = '42501';
  end if;
  update public.devices set household_id = p_household_id where id = p_device_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cat sitters
-- -----------------------------------------------------------------------------
create or replace function public.list_cat_sitters(p_device_id uuid)
returns table (user_id uuid, email text, until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, u.email::text, s.until
    from public.cat_sitters s
    join auth.users u on u.id = s.user_id
    join public.devices d on d.id = s.device_id
   where s.device_id = p_device_id
     and d.owner_id = auth.uid()
     and (s.until is null or s.until > now())
   order by s.created_at;
$$;

-- The owner removes a sitter, or a sitter stops looking after the cat.
create or replace function public.remove_cat_sitter(p_device_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id <> auth.uid()
     and not exists (select 1 from public.devices where id = p_device_id and owner_id = auth.uid()) then
    raise exception 'cat not found' using errcode = 'P0002';
  end if;
  delete from public.cat_sitters where device_id = p_device_id and user_id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Invites: 8 characters from an unambiguous alphabet, single use, 7 days.
-- -----------------------------------------------------------------------------
create or replace function public.new_invite_code()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
    from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) i;
$$;
revoke execute on function public.new_invite_code() from public, anon, authenticated;

create or replace function public.check_invite_quota(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.invites where expires_at < now();
  if (select count(*) from public.invites where created_by = p_uid) >= 10 then
    raise exception 'too many open invites' using errcode = '54000';
  end if;
end;
$$;
revoke execute on function public.check_invite_quota(uuid) from public, anon, authenticated;

create or replace function public.create_household_invite(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.new_invite_code();
begin
  if not public.is_household_admin(p_household_id) then
    raise exception 'only household admins can invite' using errcode = '42501';
  end if;
  perform public.check_invite_quota(auth.uid());
  insert into public.invites (code, kind, household_id, created_by)
  values (v_code, 'household', p_household_id, auth.uid());
  return v_code;
end;
$$;

-- p_until: when the sitter's access ends (null = until the owner stops it).
create or replace function public.create_sitter_invite(p_device_id uuid, p_until timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.new_invite_code();
begin
  if not exists (select 1 from public.devices where id = p_device_id and owner_id = auth.uid()) then
    raise exception 'cat not found' using errcode = 'P0002';
  end if;
  if p_until is not null and (p_until <= now() or p_until > now() + interval '1 year') then
    raise exception 'end date must be within the next year' using errcode = '22023';
  end if;
  perform public.check_invite_quota(auth.uid());
  insert into public.invites (code, kind, device_id, sitter_until, created_by)
  values (v_code, 'sitter', p_device_id, p_until, auth.uid());
  return v_code;
end;
$$;

-- Accepts either kind of code. Returns what was joined, for the app's message.
create or replace function public.accept_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.invites
   where code = upper(replace(trim(p_code), '-', ''))
     and expires_at > now()
  returning * into v_inv;
  if v_inv.code is null then
    raise exception 'invalid or expired invite code' using errcode = 'P0002';
  end if;

  if v_inv.kind = 'household' then
    if exists (select 1 from public.household_memberships
                where household_id = v_inv.household_id and user_id = v_uid) then
      raise exception 'you are already in this household' using errcode = '22023';
    end if;
    insert into public.household_memberships (household_id, user_id, role)
    values (v_inv.household_id, v_uid, 'member');
    return jsonb_build_object('kind', 'household', 'id', v_inv.household_id,
                              'name', (select name from public.households where id = v_inv.household_id));
  end if;

  if exists (select 1 from public.devices where id = v_inv.device_id and owner_id = v_uid) then
    raise exception 'this is your own cat' using errcode = '22023';
  end if;
  if v_inv.sitter_until is not null and v_inv.sitter_until <= now() then
    raise exception 'this cat sitting period has already ended' using errcode = '22023';
  end if;
  insert into public.cat_sitters (device_id, user_id, added_by, until)
  values (v_inv.device_id, v_uid, v_inv.created_by, v_inv.sitter_until)
  on conflict (device_id, user_id) do update set until = excluded.until, added_by = excluded.added_by;
  return jsonb_build_object('kind', 'sitter', 'id', v_inv.device_id,
                            'name', (select coalesce(display_name, 'a cat') from public.devices where id = v_inv.device_id));
end;
$$;

-- How the caller sees each visible cat, for labels in the app.
create or replace function public.my_cat_access()
returns table (device_id uuid, access text, household_id uuid, household_name text, sitter_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id,
         case when d.owner_id = auth.uid() then 'owner'
              when m.user_id is not null then 'household'
              else 'sitter' end,
         d.household_id,
         h.name,
         s.until
    from public.devices d
    left join public.households h on h.id = d.household_id
    left join public.household_memberships m on m.household_id = d.household_id and m.user_id = auth.uid()
    left join public.cat_sitters s on s.device_id = d.id and s.user_id = auth.uid()
   where d.id in (select public.viewable_device_ids());
$$;

-- -----------------------------------------------------------------------------
-- Push: owner, everyone in the cat's household, and its current sitters.
-- -----------------------------------------------------------------------------
drop function public.push_recipients(uuid);
create function public.push_recipients(p_owner_id uuid, p_device_id uuid default null)
returns table (token text, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t.token, t.user_id
    from public.push_tokens t
   where t.user_id = p_owner_id
      or t.user_id in (
           select m.user_id
             from public.household_memberships m
             join public.devices d on d.household_id = m.household_id
            where d.id = p_device_id)
      or t.user_id in (
           select s.user_id from public.cat_sitters s
            where s.device_id = p_device_id and (s.until is null or s.until > now()));
$$;
revoke execute on function public.push_recipients(uuid, uuid) from public, anon, authenticated;
grant execute on function public.push_recipients(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Retire the owner-wide model
-- -----------------------------------------------------------------------------
drop function public.create_household_invite();
drop function public.accept_household_invite(text);
drop function public.list_household();
drop function public.remove_household_member(uuid);
drop function public.viewable_owner_ids();
drop table public.household_invites;
drop table public.household_members;

revoke execute on function public.is_household_admin(uuid)                  from public, anon;
revoke execute on function public.create_household(text)                    from public, anon;
revoke execute on function public.rename_household(uuid, text)              from public, anon;
revoke execute on function public.delete_household(uuid)                    from public, anon;
revoke execute on function public.list_households()                         from public, anon;
revoke execute on function public.leave_household(uuid)                     from public, anon;
revoke execute on function public.remove_household_member(uuid, uuid)       from public, anon;
revoke execute on function public.set_cat_household(uuid, uuid)             from public, anon;
revoke execute on function public.list_cat_sitters(uuid)                    from public, anon;
revoke execute on function public.remove_cat_sitter(uuid, uuid)             from public, anon;
revoke execute on function public.create_household_invite(uuid)             from public, anon;
revoke execute on function public.create_sitter_invite(uuid, timestamptz)   from public, anon;
revoke execute on function public.accept_invite(text)                       from public, anon;
revoke execute on function public.my_cat_access()                           from public, anon;

grant execute on function public.is_household_admin(uuid)                  to authenticated;
grant execute on function public.create_household(text)                    to authenticated;
grant execute on function public.rename_household(uuid, text)              to authenticated;
grant execute on function public.delete_household(uuid)                    to authenticated;
grant execute on function public.list_households()                         to authenticated;
grant execute on function public.leave_household(uuid)                     to authenticated;
grant execute on function public.remove_household_member(uuid, uuid)       to authenticated;
grant execute on function public.set_cat_household(uuid, uuid)             to authenticated;
grant execute on function public.list_cat_sitters(uuid)                    to authenticated;
grant execute on function public.remove_cat_sitter(uuid, uuid)             to authenticated;
grant execute on function public.create_household_invite(uuid)             to authenticated;
grant execute on function public.create_sitter_invite(uuid, timestamptz)   to authenticated;
grant execute on function public.accept_invite(text)                       to authenticated;
grant execute on function public.my_cat_access()                           to authenticated;
