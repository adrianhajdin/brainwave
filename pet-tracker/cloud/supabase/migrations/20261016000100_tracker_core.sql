-- =============================================================================
-- Pet tracker: core schema (devices, telemetry, geofences)
--
-- Design notes
--   * Device identity == MQTT client id == TLS client-certificate CN
--     (`device_uid`). The ingest path trusts the broker-authenticated identity,
--     never a `device_id` field inside the payload.
--   * Telemetry rows carry a snapshot of `owner_id`, so when a device changes
--     hands the new owner can never see the previous owner's location history
--     (GDPR art. 5(1)(b)/(c) - purpose limitation & minimisation).
--   * Secrets (claim-code hash) live in the non-exposed `private` schema so the
--     `devices` table can be read with `select *` from the apps.
--   * All writes from devices go through ONE security-definer function
--     (`ingest_telemetry`) executed by a least-privilege role.
-- =============================================================================

create extension if not exists postgis  with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.device_status as enum (
  'provisioned',  -- built & flashed in the factory, not yet claimed
  'active',       -- claimed by an end user
  'suspended',    -- blocked by ops (stolen, abuse, compromised credentials)
  'retired'       -- end of life; credentials revoked at the broker
);

create type public.geofence_transition as enum ('enter', 'exit');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- devices
-- -----------------------------------------------------------------------------
create table public.devices (
  id                 uuid primary key default gen_random_uuid(),
  device_uid         text not null unique
                       check (device_uid ~ '^[A-Za-z0-9_-]{3,64}$'),
  imei               text unique check (imei ~ '^[0-9]{15}$'),
  owner_id           uuid references auth.users (id) on delete set null,
  display_name       text check (char_length(display_name) <= 64),
  status             public.device_status not null default 'provisioned',
  fw_version         text check (char_length(fw_version) <= 32),
  report_interval_s  integer not null default 900
                       check (report_interval_s between 300 and 86400),
  last_seen_at       timestamptz,
  last_fix_at        timestamptz,
  last_location      extensions.geography(Point, 4326),
  last_accuracy_m    real,
  last_battery_pct   smallint check (last_battery_pct between 0 and 100),
  claimed_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint devices_active_has_owner
    check (status <> 'active' or owner_id is not null)
);

create index devices_owner_idx on public.devices (owner_id);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

-- When the owner disappears (account deletion => FK "set null", or release),
-- reset the device so the next owner never sees the previous owner's data.
create or replace function public.devices_reset_on_owner_clear()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is null and old.owner_id is not null then
    new.status           := case when old.status = 'active' then 'provisioned'::public.device_status else old.status end;
    new.claimed_at       := null;
    new.display_name     := null;
    new.last_seen_at     := null;
    new.last_fix_at      := null;
    new.last_location    := null;
    new.last_accuracy_m  := null;
    new.last_battery_pct := null;
  end if;
  return new;
end;
$$;

create trigger devices_reset_on_owner_clear
  before update of owner_id on public.devices
  for each row execute function public.devices_reset_on_owner_clear();

comment on column public.devices.device_uid is
  'Equals the MQTT client id and the CN of the device X.509 certificate.';

-- Factory secrets: never exposed through the Data API.
create table private.device_secrets (
  device_id        uuid primary key references public.devices (id) on delete cascade,
  claim_code_hash  text not null   -- bcrypt (pgcrypto crypt/gen_salt('bf'))
);

-- -----------------------------------------------------------------------------
-- telemetry
-- -----------------------------------------------------------------------------
create table public.telemetry (
  id           bigint generated always as identity primary key,
  device_id    uuid not null references public.devices (id) on delete cascade,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  recorded_at  timestamptz not null,               -- GNSS UTC time of the fix
  received_at  timestamptz not null default now(), -- server time
  location     extensions.geography(Point, 4326) not null,
  accuracy_m   real not null check (accuracy_m >= 0 and accuracy_m <= 100000),
  battery_pct  smallint not null check (battery_pct between 0 and 100),
  seq          integer check (seq >= 0),
  -- QoS 1 means "at least once": duplicates are dropped by this key.
  constraint telemetry_device_recorded_uk unique (device_id, recorded_at)
);

create index telemetry_owner_time_idx  on public.telemetry (owner_id, recorded_at desc);
create index telemetry_location_gix    on public.telemetry using gist (location);
create index telemetry_received_brin   on public.telemetry using brin (received_at);

-- -----------------------------------------------------------------------------
-- geofences
-- -----------------------------------------------------------------------------
create table public.geofences (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  device_id       uuid references public.devices (id) on delete cascade, -- null = all my devices
  name            text not null check (char_length(name) between 1 and 64),
  area            extensions.geography(Polygon, 4326) not null,
  alert_on_exit   boolean not null default true,
  alert_on_enter  boolean not null default false,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 100 m^2 .. 100 km^2 keeps polygons meaningful and cheap to evaluate
  constraint geofences_area_size
    check (extensions.st_area(area) between 100 and 100000000)
);

create index geofences_owner_idx on public.geofences (owner_id);
create index geofences_area_gix  on public.geofences using gist (area);

create trigger geofences_set_updated_at
  before update on public.geofences
  for each row execute function public.set_updated_at();

-- Last known inside/outside state per (device, geofence); internal only.
create table public.geofence_state (
  device_id    uuid not null references public.devices (id) on delete cascade,
  geofence_id  uuid not null references public.geofences (id) on delete cascade,
  inside       boolean not null,
  changed_at   timestamptz not null,
  primary key (device_id, geofence_id)
);

create table public.geofence_events (
  id            bigint generated always as identity primary key,
  device_id     uuid not null references public.devices (id) on delete cascade,
  geofence_id   uuid not null references public.geofences (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  transition    public.geofence_transition not null,
  notify        boolean not null,
  telemetry_id  bigint references public.telemetry (id) on delete set null,
  location      extensions.geography(Point, 4326) not null,
  occurred_at   timestamptz not null
);

create index geofence_events_owner_time_idx on public.geofence_events (owner_id, occurred_at desc);

-- =============================================================================
-- Functions
-- =============================================================================

-- Factory / provisioning backend only (service_role).
create or replace function public.provision_device(
  p_device_uid  text,
  p_imei        text,
  p_claim_code  text,
  p_fw_version  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if char_length(p_claim_code) < 10 then
    raise exception 'claim code must have >= 10 characters (>= 50 bits entropy)'
      using errcode = '22023';
  end if;

  insert into public.devices (device_uid, imei, fw_version)
  values (p_device_uid, p_imei, p_fw_version)
  returning id into v_id;

  insert into private.device_secrets (device_id, claim_code_hash)
  values (v_id, extensions.crypt(p_claim_code, extensions.gen_salt('bf', 10)));

  return v_id;
end;
$$;

-- End user claims a device with the code printed on the label / QR code.
-- A single generic error avoids leaking which device ids exist.
create or replace function public.claim_device(p_device_uid text, p_claim_code text)
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

  update public.devices d
     set owner_id   = v_uid,
         status     = 'active',
         claimed_at = now()
    from private.device_secrets s
   where s.device_id = d.id
     and d.device_uid = p_device_uid
     and d.owner_id is null
     and d.status = 'provisioned'
     and s.claim_code_hash = extensions.crypt(p_claim_code, s.claim_code_hash)
  returning d.id into v_id;

  if v_id is null then
    raise exception 'invalid device or claim code' using errcode = 'P0002';
  end if;

  return v_id;
end;
$$;

-- Owner hands the device back (sale, gift, RMA). Erases the owner's history
-- for that device so the next owner starts from a clean slate.
create or replace function public.release_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform 1 from public.devices
   where id = p_device_id and owner_id = v_uid
     for update;
  if not found then
    raise exception 'device not found' using errcode = 'P0002';
  end if;

  delete from public.geofence_events where device_id = p_device_id and owner_id = v_uid;
  delete from public.geofence_state  where device_id = p_device_id;
  delete from public.geofences       where device_id = p_device_id and owner_id = v_uid;
  delete from public.telemetry       where device_id = p_device_id and owner_id = v_uid;

  -- devices_reset_on_owner_clear wipes status / last_* fields.
  update public.devices set owner_id = null where id = p_device_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- The ONLY write path for device data.
--   * Called by the ingest worker / edge function after schema validation.
--   * `p_device_uid` MUST come from the authenticated MQTT identity (topic /
--     client id enforced by the broker policy), not from the JSON body.
--   * Row-locks the device so concurrent deliveries for one device serialise,
--     which keeps geofence state transitions consistent.
--   * Returns notifications for the caller to fan out (push / e-mail).
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
     where g.owner_id = v_dev.owner_id
       and g.enabled
       and (g.device_id is null or g.device_id = v_dev.id)
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

-- =============================================================================
-- Row Level Security & privileges
-- =============================================================================
alter table public.devices          enable row level security;
alter table public.telemetry        enable row level security;
alter table public.geofences        enable row level security;
alter table public.geofence_state   enable row level security;
alter table public.geofence_events  enable row level security;
alter table private.device_secrets  enable row level security;

-- Supabase grants ALL on new public tables to anon/authenticated by default;
-- start from zero and grant back only what the apps need.
revoke all on public.devices, public.telemetry, public.geofences,
              public.geofence_state, public.geofence_events
  from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

-- devices: owners read their devices; may only rename / change interval.
grant select on public.devices to authenticated;
grant update (display_name, report_interval_s) on public.devices to authenticated;

create policy devices_select_own on public.devices
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy devices_update_own on public.devices
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- telemetry: owners read and may erase their own history (GDPR art. 17).
grant select, delete on public.telemetry to authenticated;

create policy telemetry_select_own on public.telemetry
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy telemetry_delete_own on public.telemetry
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- geofences: full CRUD on own rows, scoped to own devices.
grant select, insert, update, delete on public.geofences to authenticated;

create policy geofences_owner_all on public.geofences
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      device_id is null
      or exists (
        select 1 from public.devices d
         where d.id = device_id and d.owner_id = (select auth.uid())
      )
    )
  );

-- geofence_events: read-only history.
grant select, delete on public.geofence_events to authenticated;

create policy geofence_events_select_own on public.geofence_events
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy geofence_events_delete_own on public.geofence_events
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- geofence_state: internal, no policies => no access for API roles.

-- Functions: Postgres grants EXECUTE to PUBLIC by default; lock them down.
revoke execute on function public.provision_device(text, text, text, text)                         from public, anon, authenticated;
revoke execute on function public.claim_device(text, text)                                         from public, anon;
revoke execute on function public.release_device(uuid)                                             from public, anon;
revoke execute on function public.ingest_telemetry(text, float8, float8, real, smallint, integer, timestamptz) from public, anon, authenticated;

grant execute on function public.provision_device(text, text, text, text)  to service_role;
grant execute on function public.claim_device(text, text)                  to authenticated;
grant execute on function public.release_device(uuid)                      to authenticated;
grant execute on function public.ingest_telemetry(text, float8, float8, real, smallint, integer, timestamptz) to service_role;

-- Least-privilege role for the MQTT ingest worker. Created NOLOGIN here;
-- enable it out-of-band so the password never lands in git:
--   alter role telemetry_ingest with login password '<from secret manager>';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'telemetry_ingest') then
    create role telemetry_ingest nologin noinherit;
  end if;
end;
$$;

grant usage on schema public to telemetry_ingest;
grant execute on function public.ingest_telemetry(text, float8, float8, real, smallint, integer, timestamptz) to telemetry_ingest;

-- =============================================================================
-- Realtime: live map updates. RLS is enforced per subscriber.
-- =============================================================================
alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.geofence_events;
