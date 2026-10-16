-- =============================================================================
-- Cats + "phone as tracker" for app testing before collar hardware exists.
--
--   * Every device is a pet (cat by default) with a name and map colour.
--   * kind = 'phone': a virtual tracker created from the app. The phone reports
--     its own GPS through report_phone_location(), authenticated by the user's
--     session (no certificates). Same ingest path, same geofencing, same RLS.
--   * last_lat / last_lng are generated columns so Realtime payloads carry
--     plain numbers the mobile app can use directly.
-- =============================================================================

create type public.tracker_kind as enum ('collar', 'phone');
create type public.pet_species  as enum ('cat', 'dog', 'other');

alter table public.devices
  add column kind      public.tracker_kind not null default 'collar',
  add column species   public.pet_species  not null default 'cat',
  add column color     text not null default '#F59E0B'
                         check (color ~ '^#[0-9A-Fa-f]{6}$'),
  add column last_lat  double precision
                         generated always as (extensions.st_y(last_location::extensions.geometry)) stored,
  add column last_lng  double precision
                         generated always as (extensions.st_x(last_location::extensions.geometry)) stored;

-- Owners may also set the cat's species and colour.
grant update (display_name, report_interval_s, species, color) on public.devices to authenticated;

-- -----------------------------------------------------------------------------
-- Create a phone tracker for a new cat (owned by the caller, active at once).
-- -----------------------------------------------------------------------------
create or replace function public.create_phone_tracker(
  p_name  text,
  p_color text default '#F59E0B'
)
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
  if (select count(*) from public.devices where owner_id = v_uid) >= 20 then
    raise exception 'too many trackers' using errcode = '54000';
  end if;

  insert into public.devices (device_uid, kind, owner_id, status, display_name, color, claimed_at)
  values ('ph-' || replace(gen_random_uuid()::text, '-', ''), 'phone', v_uid, 'active',
          trim(p_name), coalesce(p_color, '#F59E0B'), now())
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- A phone reports a fix for one of the caller's phone trackers.
-- Re-uses ingest_telemetry, so de-duplication, geofencing and history are the
-- same as for collars. Rate-limited to one fix per 5 s per tracker.
-- -----------------------------------------------------------------------------
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

  if v_dev.last_seen_at is not null and v_dev.last_seen_at > now() - interval '5 seconds' then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  return public.ingest_telemetry(
    v_dev.device_uid, p_lat, p_lng,
    least(greatest(coalesce(p_accuracy_m, 0), 0), 100000)::real,
    coalesce(p_battery_pct, 0)::smallint,
    null,
    -- phone clocks drift and can be set by hand: never trust "the future"
    least(coalesce(p_recorded_at, now()), now()));
end;
$$;

-- -----------------------------------------------------------------------------
-- Circle geofence ("home zone"), as Traccar's UI does with turf/circle.
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
security definer            -- needs to seed geofence_state (no API access)
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_dev  public.devices%rowtype;
  v_area extensions.geography;
  v_id   uuid;
begin
  select * into v_dev from public.devices where id = p_device_id and owner_id = v_uid;
  if not found then
    raise exception 'device not found' using errcode = 'P0002';
  end if;
  if p_radius_m is null or p_radius_m not between 10 and 5000 then
    raise exception 'radius must be 10-5000 m' using errcode = '22023';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 64 then
    raise exception 'name must be 1-64 characters' using errcode = '22023';
  end if;

  v_area := extensions.st_buffer(
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    p_radius_m, 'quad_segs=16');

  insert into public.geofences (owner_id, device_id, name, area, alert_on_enter)
  values (v_uid, p_device_id, trim(p_name), v_area, p_alert_on_enter)
  returning id into v_id;

  -- Seed the current side of the fence, so the very first exit raises an
  -- alert instead of merely initialising state.
  if v_dev.last_location is not null then
    insert into public.geofence_state (device_id, geofence_id, inside, changed_at)
    values (p_device_id, v_id, extensions.st_covers(v_area, v_dev.last_location), now());
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Read helpers returning plain numbers (no PostGIS parsing in the app).
-- security invoker => the caller's RLS policies decide what is visible.
-- -----------------------------------------------------------------------------
create or replace function public.get_pet_track(p_device_id uuid, p_since timestamptz)
returns table (recorded_at timestamptz, lat double precision, lng double precision,
               accuracy_m real, battery_pct smallint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.recorded_at,
         extensions.st_y(t.location::extensions.geometry),
         extensions.st_x(t.location::extensions.geometry),
         t.accuracy_m, t.battery_pct
    from public.telemetry t
   where t.device_id = p_device_id
     and t.recorded_at >= p_since
   order by t.recorded_at
   limit 5000;
$$;

create or replace function public.get_pet_geofences(p_device_id uuid)
returns table (id uuid, name text, center_lat double precision, center_lng double precision,
               radius_m double precision, alert_on_enter boolean, alert_on_exit boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.name,
         extensions.st_y(extensions.st_centroid(g.area::extensions.geometry)),
         extensions.st_x(extensions.st_centroid(g.area::extensions.geometry)),
         sqrt(extensions.st_area(g.area) / pi()),
         g.alert_on_enter, g.alert_on_exit
    from public.geofences g
   where g.device_id = p_device_id or g.device_id is null
   order by g.created_at;
$$;

revoke execute on function public.create_phone_tracker(text, text) from public, anon;
revoke execute on function public.report_phone_location(uuid, float8, float8, real, smallint, timestamptz) from public, anon;
revoke execute on function public.create_circle_geofence(uuid, text, float8, float8, float8, boolean) from public, anon;
revoke execute on function public.get_pet_track(uuid, timestamptz) from public, anon;
revoke execute on function public.get_pet_geofences(uuid) from public, anon;

grant execute on function public.create_phone_tracker(text, text) to authenticated;
grant execute on function public.report_phone_location(uuid, float8, float8, real, smallint, timestamptz) to authenticated;
grant execute on function public.create_circle_geofence(uuid, text, float8, float8, float8, boolean) to authenticated;
grant execute on function public.get_pet_track(uuid, timestamptz) to authenticated;
grant execute on function public.get_pet_geofences(uuid) to authenticated;
