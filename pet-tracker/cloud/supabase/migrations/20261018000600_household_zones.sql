-- =============================================================================
-- Household home zones.
--
-- A zone can now belong to a household: it applies to every cat in that
-- household, whoever owns the cat, and everyone in the household can add or
-- delete it. Zones for a single cat stay possible.
--
-- Existing "all my cats" zones move to the household that holds most of the
-- owner's cats (the household created for them by 20261018000500).
-- =============================================================================

alter table public.geofences
  add column household_id uuid references public.households (id) on delete cascade,
  add constraint geofences_household_or_device check (household_id is null or device_id is null);
create index geofences_household_idx on public.geofences (household_id);

update public.geofences g
   set household_id = (
         select d.household_id
           from public.devices d
          where d.owner_id = g.owner_id and d.household_id is not null
          group by d.household_id
          order by count(*) desc, d.household_id
          limit 1)
 where g.device_id is null and g.household_id is null;

-- -----------------------------------------------------------------------------
-- Who sees and changes zones
-- -----------------------------------------------------------------------------
create or replace function public.my_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_memberships where user_id = (select auth.uid());
$$;
revoke execute on function public.my_household_ids() from public, anon;
grant execute on function public.my_household_ids() to authenticated;

-- Household zones: its members, and anyone who sees one of its cats (sitters).
drop policy geofences_select_viewable on public.geofences;
create policy geofences_select_viewable on public.geofences
  for select to authenticated
  using (
    (household_id is null
     and owner_id in (select d.owner_id from public.devices d where d.id in (select public.viewable_device_ids()))
     and (device_id is null or device_id in (select public.viewable_device_ids())))
    or household_id in (select public.my_household_ids())
    or household_id in (select d.household_id from public.devices d where d.id in (select public.viewable_device_ids())));

-- Direct writes stay limited to your own zones, for your own cats or your own households.
drop policy geofences_owner_all on public.geofences;
create policy geofences_owner_all on public.geofences
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (device_id is null
         or exists (select 1 from public.devices d where d.id = device_id and d.owner_id = (select auth.uid())))
    and (household_id is null or household_id in (select public.my_household_ids())));

-- -----------------------------------------------------------------------------
-- Creating, listing and deleting zones
-- -----------------------------------------------------------------------------
drop function public.create_circle_geofence(uuid, text, double precision, double precision, double precision, boolean);
create function public.create_circle_geofence(
  p_device_id      uuid,
  p_name           text,
  p_lat            double precision,
  p_lng            double precision,
  p_radius_m       double precision,
  p_alert_on_enter boolean default true,
  p_household_id   uuid default null
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
  if p_household_id is not null then
    if p_device_id is not null then
      raise exception 'a zone is for one cat or for a household, not both' using errcode = '22023';
    end if;
    if not exists (select 1 from public.household_memberships
                    where household_id = p_household_id and user_id = v_uid) then
      raise exception 'household not found' using errcode = 'P0002';
    end if;
    if (select count(*) from public.geofences where household_id = p_household_id) >= 20 then
      raise exception 'too many zones for this household' using errcode = '54000';
    end if;
  elsif p_device_id is not null
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

  insert into public.geofences (owner_id, device_id, household_id, name, area, alert_on_enter)
  values (v_uid, p_device_id, p_household_id, trim(p_name), v_area, p_alert_on_enter)
  returning id into v_id;

  -- Seed each affected cat's current side of the fence, so the very first
  -- exit raises an alert instead of merely initialising state.
  insert into public.geofence_state (device_id, geofence_id, inside, changed_at)
  select d.id, v_id, extensions.st_covers(v_area, d.last_location), now()
    from public.devices d
   where d.last_location is not null
     and case when p_household_id is not null then d.household_id = p_household_id
              else d.owner_id = v_uid and (p_device_id is null or d.id = p_device_id) end;

  return v_id;
end;
$$;
revoke execute on function public.create_circle_geofence(uuid, text, double precision, double precision, double precision, boolean, uuid) from public, anon;
grant execute on function public.create_circle_geofence(uuid, text, double precision, double precision, double precision, boolean, uuid) to authenticated;

-- Anyone in the household can remove its zones; other zones only their owner.
create or replace function public.delete_zone(p_zone_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.geofences g
   where g.id = p_zone_id
     and (g.owner_id = (select auth.uid())
          or g.household_id in (select public.my_household_ids()));
  if not found then
    raise exception 'zone not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.delete_zone(uuid) from public, anon;
grant execute on function public.delete_zone(uuid) to authenticated;

-- A cat's zones: its household's, its own, and its owner's old "all my cats"
-- zones. Security definer so it can name the household; access is checked here.
drop function public.get_pet_geofences(uuid);
create function public.get_pet_geofences(p_device_id uuid)
returns table (id uuid, name text, center_lat double precision, center_lng double precision,
               radius_m double precision, alert_on_enter boolean, alert_on_exit boolean, all_cats boolean,
               household_id uuid, household_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name,
         extensions.st_y(extensions.st_centroid(g.area::extensions.geometry)),
         extensions.st_x(extensions.st_centroid(g.area::extensions.geometry)),
         sqrt(extensions.st_area(g.area) / pi()),
         g.alert_on_enter, g.alert_on_exit, g.device_id is null,
         g.household_id, h.name
    from public.geofences g
    join public.devices d on d.id = p_device_id
    left join public.households h on h.id = g.household_id
   where d.id in (select public.viewable_device_ids())
     and (   (g.household_id is not null and g.household_id = d.household_id)
          or g.device_id = d.id
          or (g.device_id is null and g.household_id is null and g.owner_id = d.owner_id))
   order by (g.household_id is not null) desc, g.created_at;
$$;
revoke execute on function public.get_pet_geofences(uuid) from public, anon;
grant execute on function public.get_pet_geofences(uuid) to authenticated;

-- Zones of a household you are in (Settings).
create function public.get_household_zones(p_household_id uuid)
returns table (id uuid, name text, center_lat double precision, center_lng double precision,
               radius_m double precision, alert_on_enter boolean, alert_on_exit boolean, all_cats boolean,
               household_id uuid, household_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name,
         extensions.st_y(extensions.st_centroid(g.area::extensions.geometry)),
         extensions.st_x(extensions.st_centroid(g.area::extensions.geometry)),
         sqrt(extensions.st_area(g.area) / pi()),
         g.alert_on_enter, g.alert_on_exit, true,
         g.household_id, h.name
    from public.geofences g
    join public.households h on h.id = g.household_id
   where g.household_id = p_household_id
     and p_household_id in (select public.my_household_ids())
   order by g.created_at;
$$;
revoke execute on function public.get_household_zones(uuid) from public, anon;
grant execute on function public.get_household_zones(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Zone checks on every new position, and "home" for the activity card
-- -----------------------------------------------------------------------------
create or replace function public.ingest_telemetry(
  p_device_uid   text,
  p_lat          double precision,
  p_lng          double precision,
  p_accuracy_m   real,
  p_battery_pct  smallint,
  p_seq          integer     default null,
  p_recorded_at  timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dev     public.devices%rowtype;
  v_point   extensions.geography;
  v_ts      timestamptz := coalesce(p_recorded_at, now());
  v_tid     bigint;
  v_is_new  boolean;
  v_inside  boolean;
  v_notify  boolean;
  v_events  jsonb := '[]'::jsonb;
  r         record;
begin
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'coordinates out of range' using errcode = '22003';
  end if;

  -- Reject fixes from the future (bad RTC / replay with forged time) and
  -- anything older than the retention horizon.
  if v_ts > now() + interval '5 minutes' or v_ts < now() - interval '30 days' then
    return jsonb_build_object('status', 'rejected_timestamp');
  end if;

  select * into v_dev
    from public.devices
   where device_uid = p_device_uid
     for update;

  if not found then
    return jsonb_build_object('status', 'unknown_device');
  end if;

  if v_dev.status <> 'active' or v_dev.owner_id is null then
    -- Unclaimed / suspended devices: data is dropped, not stored.
    update public.devices set last_seen_at = now() where id = v_dev.id;
    return jsonb_build_object('status', 'inactive_device');
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  insert into public.telemetry
    (device_id, owner_id, recorded_at, location, accuracy_m, battery_pct, seq)
  values
    (v_dev.id, v_dev.owner_id, v_ts, v_point, p_accuracy_m, p_battery_pct, p_seq)
  on conflict (device_id, recorded_at) do nothing
  returning id into v_tid;

  if v_tid is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- Store-and-forward backlog can arrive out of order: only the newest fix
  -- moves "last location" and drives geofence transitions.
  v_is_new := v_dev.last_fix_at is null or v_ts >= v_dev.last_fix_at;

  update public.devices d
     set last_seen_at     = now(),
         last_battery_pct = p_battery_pct,
         last_fix_at      = case when v_is_new then v_ts           else d.last_fix_at     end,
         last_location    = case when v_is_new then v_point        else d.last_location   end,
         last_accuracy_m  = case when v_is_new then p_accuracy_m   else d.last_accuracy_m end
   where d.id = v_dev.id;

  if not v_is_new then
    return jsonb_build_object('status', 'ok', 'telemetry_id', v_tid, 'events', v_events);
  end if;

  for r in
    select g.id, g.name, g.alert_on_exit, g.alert_on_enter,
           extensions.st_covers(g.area, v_point)                                  as covered,
           extensions.st_dwithin(g.area, v_point, greatest(p_accuracy_m, 25)::float8) as near,
           s.inside                                                               as was_inside
      from public.geofences g
      left join public.geofence_state s
             on s.geofence_id = g.id and s.device_id = v_dev.id
     where g.enabled
       and (   (g.household_id is not null and g.household_id = v_dev.household_id)
            or (g.household_id is null and g.owner_id = v_dev.owner_id
                and (g.device_id is null or g.device_id = v_dev.id)))
  loop
    -- Accuracy-aware hysteresis: a fix whose uncertainty circle straddles
    -- the boundary keeps the previous state instead of flapping.
    v_inside := case
                  when r.covered  then true
                  when not r.near then false
                  else coalesce(r.was_inside, false)
                end;

    continue when r.was_inside is not distinct from v_inside;

    insert into public.geofence_state (device_id, geofence_id, inside, changed_at)
    values (v_dev.id, r.id, v_inside, v_ts)
    on conflict (device_id, geofence_id)
      do update set inside = excluded.inside, changed_at = excluded.changed_at;

    -- First observation only initialises state; it is not a transition.
    continue when r.was_inside is null;

    v_notify := (v_inside and r.alert_on_enter) or (not v_inside and r.alert_on_exit);

    insert into public.geofence_events
      (device_id, geofence_id, owner_id, transition, notify, telemetry_id, location, occurred_at)
    values
      (v_dev.id, r.id, v_dev.owner_id,
       case when v_inside then 'enter' else 'exit' end::public.geofence_transition,
       v_notify, v_tid, v_point, v_ts);

    if v_notify then
      v_events := v_events || jsonb_build_object(
        'geofence_id', r.id,
        'geofence_name', r.name,
        'transition', case when v_inside then 'enter' else 'exit' end);
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'telemetry_id', v_tid,
    'owner_id', v_dev.owner_id,
    'device_id', v_dev.id,
    'events', v_events);
end;
$$;

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
    -- The household's home first, then the cat's own zone, then an old
    -- "all my cats" zone.
    select extensions.st_centroid(g.area::extensions.geometry)::extensions.geography as c
      from public.geofences g, public.devices d
     where d.id = p_device_id
       and (   (g.household_id is not null and g.household_id = d.household_id)
            or g.device_id = d.id
            or (g.device_id is null and g.household_id is null and g.owner_id = d.owner_id))
     order by (g.household_id is not null) desc, (g.device_id is not null) desc, g.created_at
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
