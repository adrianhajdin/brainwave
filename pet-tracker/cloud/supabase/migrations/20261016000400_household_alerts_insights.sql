-- =============================================================================
-- Households (sharing), lost mode, night watch, low-battery & zone push alerts,
-- cat photos, heatmap and activity estimates.
--
-- Sharing model: a household is "everything an owner has". Members (invited
-- with a one-time code) can see all of the owner's cats - including cats added
-- later - receive the same alerts and switch lost mode on/off. Only the owner
-- can edit, delete or hand over cats.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Household membership
-- -----------------------------------------------------------------------------
create table public.household_members (
  owner_id    uuid not null references auth.users (id) on delete cascade,
  member_id   uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (owner_id, member_id),
  constraint household_not_self check (owner_id <> member_id)
);
create index household_members_member_idx on public.household_members (member_id);

create table public.household_invites (
  code        text primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days'
);
create index household_invites_owner_idx on public.household_invites (owner_id);

alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
revoke all on public.household_members, public.household_invites from anon, authenticated;

-- Owners whose cats the caller may see: themselves + households they joined.
create or replace function public.viewable_owner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
  union all
  select owner_id from public.household_members where member_id = auth.uid();
$$;

revoke execute on function public.viewable_owner_ids() from public, anon;
grant execute on function public.viewable_owner_ids() to authenticated;

-- Read access for household members (write policies stay owner-only).
drop policy devices_select_own on public.devices;
create policy devices_select_household on public.devices
  for select to authenticated
  using (owner_id in (select public.viewable_owner_ids()));

drop policy telemetry_select_own on public.telemetry;
create policy telemetry_select_household on public.telemetry
  for select to authenticated
  using (owner_id in (select public.viewable_owner_ids()));

create policy geofences_select_household on public.geofences
  for select to authenticated
  using (owner_id in (select public.viewable_owner_ids()));

drop policy geofence_events_select_own on public.geofence_events;
create policy geofence_events_select_household on public.geofence_events
  for select to authenticated
  using (owner_id in (select public.viewable_owner_ids()));

-- Invite codes: 8 characters from an unambiguous alphabet (~40 bits), single
-- use, 7 days, max 5 open invites per owner.
create or replace function public.create_household_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.household_invites where expires_at < now();
  if (select count(*) from public.household_invites where owner_id = v_uid) >= 5 then
    raise exception 'too many open invites' using errcode = '54000';
  end if;

  select string_agg(substr(v_alpha, 1 + (get_byte(b, i) % 32), 1), '')
    into v_code
    from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) i;

  insert into public.household_invites (code, owner_id) values (v_code, v_uid);
  return v_code;
end;
$$;

create or replace function public.accept_household_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.household_invites
   where code = upper(replace(trim(p_code), '-', ''))
     and expires_at > now()
  returning owner_id into v_owner;

  if v_owner is null then
    raise exception 'invalid or expired invite code' using errcode = 'P0002';
  end if;
  if v_owner = v_uid then
    raise exception 'you cannot join your own household' using errcode = '22023';
  end if;

  insert into public.household_members (owner_id, member_id)
  values (v_owner, v_uid)
  on conflict do nothing;

  return v_owner;
end;
$$;

-- Everyone in the caller's households, with e-mail addresses for display.
create or replace function public.list_household()
returns table (owner_id uuid, member_id uuid, email text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  -- members of my household
  select m.owner_id, m.member_id, u.email::text, 'member'
    from public.household_members m
    join auth.users u on u.id = m.member_id
   where m.owner_id = auth.uid()
  union all
  -- households I joined (show the owner)
  select m.owner_id, m.owner_id, u.email::text, 'owner'
    from public.household_members m
    join auth.users u on u.id = m.owner_id
   where m.member_id = auth.uid();
$$;

create or replace function public.remove_household_member(p_member_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.household_members
   where owner_id = auth.uid() and member_id = p_member_id;
$$;

create or replace function public.leave_household(p_owner_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.household_members
   where owner_id = p_owner_id and member_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Cat settings: lost mode, night watch, photo, low-battery state
-- -----------------------------------------------------------------------------
alter table public.devices
  add column lost_mode           boolean  not null default false,
  add column lost_mode_since     timestamptz,
  add column night_mode          boolean  not null default false,
  add column night_start_min     smallint not null default 1260 check (night_start_min between 0 and 1439), -- 21:00
  add column night_end_min       smallint not null default 420  check (night_end_min between 0 and 1439),   -- 07:00
  add column night_interval_s    integer  not null default 300  check (night_interval_s between 60 and 3600),
  add column timezone            text     not null default 'Europe/Amsterdam'
                                   check (char_length(timezone) <= 64),
  add column photo_path          text check (char_length(photo_path) <= 200),
  add column low_battery_alerted boolean  not null default false;

grant update (night_mode, night_start_min, night_end_min, night_interval_s, timezone, photo_path)
  on public.devices to authenticated;

-- Lost mode may be switched by the owner AND household members (emergency).
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
     and owner_id in (select public.viewable_owner_ids());
  if not found then
    raise exception 'cat not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Unknown phone battery no longer reads as 0 % (would fire low-battery alerts).
create or replace function public.report_phone_location(
  p_device_id    uuid,
  p_lat          double precision,
  p_lng          double precision,
  p_accuracy_m   real,
  p_battery_pct  smallint default null,
  p_recorded_at  timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dev public.devices%rowtype;
begin
  select * into v_dev
    from public.devices
   where id = p_device_id and owner_id = auth.uid() and kind = 'phone';
  if not found then
    raise exception 'tracker not found' using errcode = 'P0002';
  end if;

  -- Lost mode reports every 15 s; normal phone testing at most every 5 s.
  if v_dev.last_seen_at is not null and v_dev.last_seen_at > now() - interval '5 seconds' then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  return public.ingest_telemetry(
    v_dev.device_uid, p_lat, p_lng,
    least(greatest(coalesce(p_accuracy_m, 0), 0), 100000)::real,
    coalesce(p_battery_pct, v_dev.last_battery_pct, 100)::smallint,
    null,
    least(coalesce(p_recorded_at, now()), now()));
end;
$$;

-- -----------------------------------------------------------------------------
-- Collar configuration downlink (lost mode, night watch, interval)
--   Changes are announced with pg_notify('device_config', …); the ingest
--   worker LISTENs and publishes a retained QoS 1 message to
--   pt/v1/<device_uid>/down/config, which the collar receives on its next wake.
-- -----------------------------------------------------------------------------
create or replace function public.device_config_json(p_dev public.devices)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with tz as (
    select (extract(epoch from (now() at time zone p_dev.timezone) - (now() at time zone 'UTC')) / 60)::int as offset_min
  )
  select jsonb_build_object(
    'interval_s',  p_dev.report_interval_s,
    'lost_mode',   p_dev.lost_mode,
    'night_mode',  p_dev.night_mode,
    -- collars run on UTC; the window is re-sent daily so DST changes apply
    'night_start_utc_min', ((p_dev.night_start_min - tz.offset_min) % 1440 + 1440) % 1440,
    'night_end_utc_min',   ((p_dev.night_end_min   - tz.offset_min) % 1440 + 1440) % 1440,
    'night_interval_s', p_dev.night_interval_s)
  from tz;
$$;

create or replace function public.devices_notify_config()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'collar' and new.owner_id is not null then
    perform pg_notify('device_config', jsonb_build_object(
      'device_uid', new.device_uid,
      'config', public.device_config_json(new))::text);
  end if;
  return null;
end;
$$;

create trigger devices_notify_config
  after update of lost_mode, night_mode, night_start_min, night_end_min,
                  night_interval_s, report_interval_s, timezone
  on public.devices
  for each row
  when (old is distinct from new)
  execute function public.devices_notify_config();

-- Re-announce every collar's config (daily via pg_cron: keeps the UTC night
-- window right across DST changes).
create or replace function public.republish_device_configs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  d public.devices;
begin
  for d in select * from public.devices where kind = 'collar' and owner_id is not null and status = 'active' loop
    perform pg_notify('device_config', jsonb_build_object(
      'device_uid', d.device_uid, 'config', public.device_config_json(d))::text);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.republish_device_configs() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Push notifications: outbox + device tokens
--   Rows in notification_outbox are delivered by the `send-push` Edge Function
--   (Database Webhook on INSERT) to the owner and all household members.
-- -----------------------------------------------------------------------------
create table public.push_tokens (
  token       text primary key check (char_length(token) <= 255),
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

create type public.notification_kind as enum ('zone_exit', 'zone_enter', 'low_battery', 'lost_mode');

create table public.notification_outbox (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  device_id   uuid references public.devices (id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  attempts    smallint not null default 0,
  last_error  text
);
create index notification_outbox_pending_idx on public.notification_outbox (created_at) where sent_at is null;
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;

-- Push targets for an owner: owner + household members.
create or replace function public.push_recipients(p_owner_id uuid)
returns table (token text, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select t.token, t.user_id
    from public.push_tokens t
   where t.user_id = p_owner_id
      or t.user_id in (select member_id from public.household_members where owner_id = p_owner_id);
$$;
revoke execute on function public.push_recipients(uuid) from public, anon, authenticated;

create or replace function public.cat_name(p_device_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(display_name, 'Your cat') from public.devices where id = p_device_id;
$$;

-- Zone alerts
create or replace function public.geofence_events_enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zone text;
begin
  if not new.notify then
    return null;
  end if;
  select name into v_zone from public.geofences where id = new.geofence_id;
  insert into public.notification_outbox (owner_id, device_id, kind, title, body)
  values (
    new.owner_id, new.device_id,
    case when new.transition = 'exit' then 'zone_exit' else 'zone_enter' end::public.notification_kind,
    case when new.transition = 'exit'
         then public.cat_name(new.device_id) || ' left ' || coalesce(v_zone, 'a zone')
         else public.cat_name(new.device_id) || ' is back in ' || coalesce(v_zone, 'a zone') end,
    case when new.transition = 'exit'
         then 'Tap to see where ' || public.cat_name(new.device_id) || ' is now.'
         else 'All good - ' || public.cat_name(new.device_id) || ' came home.' end);
  return null;
end;
$$;

create trigger geofence_events_enqueue_push
  after insert on public.geofence_events
  for each row execute function public.geofence_events_enqueue_push();

-- Low battery (alert once below 20 %, re-arm above 30 %) and lost-mode alerts.
create or replace function public.devices_battery_and_lost_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    return new;
  end if;

  if new.last_battery_pct is not null and new.last_battery_pct between 1 and 19
     and not old.low_battery_alerted then
    new.low_battery_alerted := true;
    insert into public.notification_outbox (owner_id, device_id, kind, title, body)
    values (new.owner_id, new.id, 'low_battery',
            coalesce(new.display_name, 'Your cat') || '''s tracker battery is low',
            'Battery at ' || new.last_battery_pct || ' %. Charge it soon so you don''t lose track.');
  elsif new.last_battery_pct is not null and new.last_battery_pct >= 30 then
    new.low_battery_alerted := false;
  end if;

  if new.lost_mode and not old.lost_mode then
    insert into public.notification_outbox (owner_id, device_id, kind, title, body)
    values (new.owner_id, new.id, 'lost_mode',
            'Lost mode on for ' || coalesce(new.display_name, 'your cat'),
            'Positions now update as often as possible. Open the app to follow live.');
  end if;

  return new;
end;
$$;

create trigger devices_battery_and_lost_alerts
  before update of last_battery_pct, lost_mode on public.devices
  for each row execute function public.devices_battery_and_lost_alerts();

-- -----------------------------------------------------------------------------
-- Insights: heatmap + activity (security invoker => household RLS applies)
-- -----------------------------------------------------------------------------

-- Dwell-time heatmap: each fix is weighted by how long the cat stayed there
-- (time to the next fix, capped at 30 min), binned on a metric grid.
create or replace function public.get_pet_heatmap(
  p_device_id uuid,
  p_since     timestamptz,
  p_cell_m    double precision default 25
)
returns table (lat double precision, lng double precision, weight_s double precision, fixes integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with pts as (
    select t.location::extensions.geometry as g,
           least(extract(epoch from coalesce(lead(t.recorded_at) over w, now()) - t.recorded_at), 1800) as dwell
      from public.telemetry t
     where t.device_id = p_device_id
       and t.recorded_at >= p_since
       and t.accuracy_m <= 100
    window w as (order by t.recorded_at)
  ),
  cells as (
    select extensions.st_snaptogrid(extensions.st_transform(g, 3857),
                                    greatest(p_cell_m, 5), greatest(p_cell_m, 5)) as c,
           dwell
      from pts
  )
  select extensions.st_y(extensions.st_transform(c, 4326)),
         extensions.st_x(extensions.st_transform(c, 4326)),
         sum(dwell)::float8,
         count(*)::int
    from cells
   group by c
   order by 3 desc
   limit 400;
$$;

-- Daily activity estimate from positions (a collar's accelerometer can refine
-- this later). Jitter is ignored: a hop only counts if it is larger than the
-- combined GPS uncertainty.
create or replace function public.get_pet_activity(p_device_id uuid, p_days integer default 7)
returns table (
  day             date,
  distance_m      double precision,
  active_minutes  double precision,
  roam_radius_m   double precision,
  night_share     double precision,
  fixes           integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with dev as (
    select coalesce(d.timezone, 'Europe/Amsterdam') as tz, d.night_start_min, d.night_end_min
      from public.devices d where d.id = p_device_id
  ),
  home as (
    select extensions.st_centroid(g.area::extensions.geometry)::extensions.geography as c
      from public.geofences g
     where g.device_id = p_device_id or (g.device_id is null and g.owner_id = (select owner_id from public.devices where id = p_device_id))
     order by g.created_at
     limit 1
  ),
  seg as (
    select t.recorded_at,
           (t.recorded_at at time zone (select tz from dev))                         as local_ts,
           t.location,
           extensions.st_distance(t.location, lag(t.location) over w)               as hop_m,
           greatest(t.accuracy_m, lag(t.accuracy_m) over w, 10)                      as noise_m,
           extract(epoch from t.recorded_at - lag(t.recorded_at) over w)             as dt_s
      from public.telemetry t
     where t.device_id = p_device_id
       and t.recorded_at >= now() - make_interval(days => greatest(1, least(p_days, 31)))
    window w as (order by t.recorded_at)
  ),
  moves as (
    select local_ts::date as day,
           local_ts,
           location,
           -- night window may wrap midnight (21:00-07:00) or not (01:00-05:00)
           (select case when d.night_start_min > d.night_end_min
                        then mod_min >= d.night_start_min or mod_min < d.night_end_min
                        else mod_min >= d.night_start_min and mod_min < d.night_end_min end
              from dev d) as is_night,
           case when hop_m > noise_m and dt_s > 0 and dt_s <= 3600 then hop_m else 0 end as moved_m,
           case when hop_m > noise_m and dt_s > 0 and dt_s <= 3600 then least(dt_s, 900) else 0 end as moving_s
      from (select seg.*, (extract(hour from local_ts) * 60 + extract(minute from local_ts))::int as mod_min from seg) seg
  )
  select m.day,
         sum(m.moved_m)::float8,
         (sum(m.moving_s) / 60.0)::float8,
         max(extensions.st_distance(m.location, (select c from home)))::float8,
         case when sum(m.moved_m) > 0 then
           (coalesce(sum(m.moved_m) filter (where m.is_night), 0) / sum(m.moved_m))::float8
         end,
         count(*)::int
    from moves m
   group by m.day
   order by m.day;
$$;

revoke execute on function public.create_household_invite()        from public, anon;
revoke execute on function public.accept_household_invite(text)    from public, anon;
revoke execute on function public.list_household()                 from public, anon;
revoke execute on function public.remove_household_member(uuid)    from public, anon;
revoke execute on function public.leave_household(uuid)            from public, anon;
revoke execute on function public.set_lost_mode(uuid, boolean)     from public, anon;
revoke execute on function public.register_push_token(text, text)  from public, anon;
revoke execute on function public.unregister_push_token(text)      from public, anon;
revoke execute on function public.get_pet_heatmap(uuid, timestamptz, float8) from public, anon;
revoke execute on function public.get_pet_activity(uuid, integer)  from public, anon;

grant execute on function public.create_household_invite()        to authenticated;
grant execute on function public.accept_household_invite(text)    to authenticated;
grant execute on function public.list_household()                 to authenticated;
grant execute on function public.remove_household_member(uuid)    to authenticated;
grant execute on function public.leave_household(uuid)            to authenticated;
grant execute on function public.set_lost_mode(uuid, boolean)     to authenticated;
grant execute on function public.register_push_token(text, text)  to authenticated;
grant execute on function public.unregister_push_token(text)      to authenticated;
grant execute on function public.get_pet_heatmap(uuid, timestamptz, float8) to authenticated;
grant execute on function public.get_pet_activity(uuid, integer)  to authenticated;

-- -----------------------------------------------------------------------------
-- Cat photos (Supabase Storage, private bucket)
--   Path: <owner_id>/<device_id>.jpg - the owner writes, household reads.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cat-photos', 'cat-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy cat_photos_read_household on storage.objects
  for select to authenticated
  using (bucket_id = 'cat-photos'
         and ((storage.foldername(name))[1])::uuid in (select public.viewable_owner_ids()));

create policy cat_photos_insert_owner on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cat-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy cat_photos_update_owner on storage.objects
  for update to authenticated
  using (bucket_id = 'cat-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy cat_photos_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id = 'cat-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Server-side callers (Edge Functions run as service_role, pg_cron as postgres)
grant execute on function public.push_recipients(uuid)       to service_role;
grant execute on function public.republish_device_configs()  to service_role;

-- Re-send collar configs daily so the UTC night-watch window follows DST
-- (only if pg_cron is enabled: Database -> Extensions -> pg_cron).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pet-tracker-republish-collar-config', '7 2 * * *',
                          'select public.republish_device_configs();');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Zones: several per cat, or one for all cats of the household (device null).
-- -----------------------------------------------------------------------------
create or replace function public.create_circle_geofence(
  p_device_id  uuid,
  p_name       text,
  p_lat        double precision,
  p_lng        double precision,
  p_radius_m   double precision,
  p_alert_on_enter boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_area extensions.geography;
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_device_id is not null
     and not exists (select 1 from public.devices where id = p_device_id and owner_id = v_uid) then
    raise exception 'device not found' using errcode = 'P0002';
  end if;
  if p_radius_m is null or p_radius_m not between 10 and 5000 then
    raise exception 'radius must be 10-5000 m' using errcode = '22023';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 64 then
    raise exception 'name must be 1-64 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.geofences where owner_id = v_uid) >= 50 then
    raise exception 'too many zones' using errcode = '54000';
  end if;

  v_area := extensions.st_buffer(
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    p_radius_m, 'quad_segs=16');

  insert into public.geofences (owner_id, device_id, name, area, alert_on_enter)
  values (v_uid, p_device_id, trim(p_name), v_area, p_alert_on_enter)
  returning id into v_id;

  -- Seed each affected cat's current side of the fence, so the very first
  -- exit raises an alert instead of merely initialising state.
  insert into public.geofence_state (device_id, geofence_id, inside, changed_at)
  select d.id, v_id, extensions.st_covers(v_area, d.last_location), now()
    from public.devices d
   where d.owner_id = v_uid
     and d.last_location is not null
     and (p_device_id is null or d.id = p_device_id);

  return v_id;
end;
$$;

drop function public.get_pet_geofences(uuid);
create function public.get_pet_geofences(p_device_id uuid)
returns table (id uuid, name text, center_lat double precision, center_lng double precision,
               radius_m double precision, alert_on_enter boolean, alert_on_exit boolean, all_cats boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.name,
         extensions.st_y(extensions.st_centroid(g.area::extensions.geometry)),
         extensions.st_x(extensions.st_centroid(g.area::extensions.geometry)),
         sqrt(extensions.st_area(g.area) / pi()),
         g.alert_on_enter, g.alert_on_exit, g.device_id is null
    from public.geofences g
   where g.device_id = p_device_id
      or (g.device_id is null
          and g.owner_id = (select d.owner_id from public.devices d where d.id = p_device_id))
   order by g.created_at;
$$;
revoke execute on function public.get_pet_geofences(uuid) from public, anon;
grant execute on function public.get_pet_geofences(uuid) to authenticated;
