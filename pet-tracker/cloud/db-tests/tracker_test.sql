-- Behavioural tests for the tracker schema. Run with ./run.sh
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.expect_error(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL: % (expected an error)', p_label;
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'ok   - % (%)', p_label, sqlerrm;
  when others then
    raise notice 'ok   - % (%)', p_label, sqlerrm;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok   - %', p_label;
end $$;

grant execute on all functions in schema pg_temp to public;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.nl'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.nl');

-- --- factory provisioning ---------------------------------------------------
set role service_role;
select pg_temp.check(public.provision_device('pt-351234567890123', '351234567890123', 'K7Q2-M9XW-4TZP') is not null,
                     'service_role provisions a device');
reset role;
do $$ begin
  perform set_config('test.dev_id', (select id::text from public.devices where device_uid = 'pt-351234567890123'), false);
  perform set_config('test.t0', now()::text, false);  -- fixed clock: psql autocommits each statement
end $$;

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect_error($$select public.provision_device('pt-x', null, 'AAAAAAAAAAAA')$$,
                            'end users cannot provision devices');

-- --- claiming ---------------------------------------------------------------
select pg_temp.expect_error($$select public.claim_device('pt-351234567890123', 'WRONG-CODE-0')$$,
                            'claim with wrong code is rejected');
select pg_temp.check(public.claim_device('pt-351234567890123', 'K7Q2-M9XW-4TZP') is not null,
                     'alice claims with the printed code');

set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.expect_error($$select public.claim_device('pt-351234567890123', 'K7Q2-M9XW-4TZP')$$,
                            'bob cannot claim an already-claimed device');

-- --- geofence (≈ 600 m square around Amsterdam Centraal) -------------------
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.geofences (device_id, name, area, alert_on_enter)
select id, 'Home',
       extensions.st_geogfromtext('POLYGON((4.895 52.376, 4.904 52.376, 4.904 52.382, 4.895 52.382, 4.895 52.376))'),
       true
  from public.devices where device_uid = 'pt-351234567890123';
select pg_temp.check((select count(*) from public.geofences) = 1, 'alice creates a geofence on her device');

set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.expect_error($$
  insert into public.geofences (device_id, name, area)
  values (current_setting('test.dev_id')::uuid, 'evil',
          extensions.st_geogfromtext('POLYGON((4.895 52.376, 4.904 52.376, 4.904 52.382, 4.895 52.382, 4.895 52.376))'))$$,
  'bob cannot attach a geofence to alice''s device (RLS with check)');

select pg_temp.expect_error($$select public.ingest_telemetry('pt-351234567890123', 52.379, 4.899, 5::real, 80::smallint, 1, current_setting('test.t0')::timestamptz)$$,
                            'authenticated users cannot call ingest_telemetry');
reset role;

-- --- ingest -----------------------------------------------------------------
set role telemetry_ingest;
select pg_temp.check(
  (public.ingest_telemetry('pt-351234567890123', 52.3790, 4.8995, 8::real, 91::smallint, 1, current_setting('test.t0')::timestamptz - interval '20 min')
     -> 'events') = '[]'::jsonb,
  'first fix inside only initialises geofence state');

select pg_temp.check(
  (public.ingest_telemetry('pt-351234567890123', 52.3900, 4.9200, 12::real, 90::smallint, 2, current_setting('test.t0')::timestamptz - interval '10 min')
     -> 'events' -> 0 ->> 'transition') = 'exit',
  'leaving the area yields an exit event');

select pg_temp.check(
  (public.ingest_telemetry('pt-351234567890123', 52.3900, 4.9200, 12::real, 90::smallint, 2, current_setting('test.t0')::timestamptz - interval '10 min')
     ->> 'status') = 'duplicate',
  'QoS1 redelivery is de-duplicated');

select pg_temp.check(
  (public.ingest_telemetry('pt-351234567890123', 52.3790, 4.8995, 8::real, 90::smallint, 3, current_setting('test.t0')::timestamptz - interval '15 min')
     -> 'events') = '[]'::jsonb,
  'out-of-order backlog fix does not drive geofence transitions');

-- 52.3825 is ~55 m north of the edge: outside, but within a 100 m accuracy circle.
select pg_temp.check(
  (public.ingest_telemetry('pt-351234567890123', 52.3825, 4.8995, 100::real, 89::smallint, 4, current_setting('test.t0')::timestamptz - interval '5 min')
     -> 'events') = '[]'::jsonb,
  'ambiguous fix (uncertainty straddles the edge) keeps previous state');

select pg_temp.check(
  (public.ingest_telemetry('pt-351234567890123', 52.3790, 4.8995, 6::real, 88::smallint, 5, current_setting('test.t0')::timestamptz)
     -> 'events' -> 0 ->> 'transition') = 'enter',
  'coming home yields an enter event (alert_on_enter)');

select pg_temp.check(
  (public.ingest_telemetry('pt-351234567890123', 52.3790, 4.8995, 6::real, 88::smallint, 6, current_setting('test.t0')::timestamptz + interval '1 hour')
     ->> 'status') = 'rejected_timestamp',
  'fixes from the future are rejected');

select pg_temp.check(
  (public.ingest_telemetry('pt-unknown', 52.3790, 4.8995, 6::real, 88::smallint, 1, current_setting('test.t0')::timestamptz) ->> 'status') = 'unknown_device',
  'unknown devices are rejected');

select pg_temp.expect_error($$select public.ingest_telemetry('pt-351234567890123', 91, 4.8995, 6::real, 88::smallint, 1, current_setting('test.t0')::timestamptz)$$,
                            'out-of-range latitude raises');
reset role;

-- --- what the apps can see ---------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from public.telemetry) = 5, 'alice sees her 5 fixes');
select pg_temp.check((select count(*) from public.geofence_events where notify) = 2, 'alice sees 2 notifying geofence events');
select pg_temp.check(
  (select extensions.st_y(last_location::extensions.geometry) from public.devices) = 52.3790,
  'devices.last_location tracks the newest fix');
select pg_temp.expect_error($$update public.devices set owner_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
                            'owners cannot reassign owner_id (column privileges)');
update public.devices set display_name = 'Bello';
select pg_temp.check((select display_name from public.devices) = 'Bello', 'owners can rename their device');
select pg_temp.expect_error($$select * from private.device_secrets$$, 'claim-code hashes are not reachable');

set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.telemetry) = 0, 'bob sees no telemetry');
select pg_temp.check((select count(*) from public.devices)   = 0, 'bob sees no devices');
reset role;

-- --- erasure ----------------------------------------------------------------
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from public.telemetry) = 0, 'account deletion erases location history');
select pg_temp.check(
  (select status = 'provisioned' and last_location is null and display_name is null from public.devices),
  'device is reset and claimable again after owner deletion');

set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.check(public.claim_device('pt-351234567890123', 'K7Q2-M9XW-4TZP') is not null,
                     'bob can claim the released device');
select public.release_device(id) from public.devices;
select pg_temp.check((select count(*) from public.devices) = 0, 'bob releases the device');
reset role;

\echo 'ALL TESTS PASSED'
