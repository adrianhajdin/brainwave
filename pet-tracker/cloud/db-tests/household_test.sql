-- Tests for households, lost mode, alerts, collar config, insights and photos
-- (migration 20261016000400). Run with ./run.sh
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

-- Skip the 5 s phone rate limit between reports.
create or replace function pg_temp.age_last_seen() returns void
language sql security definer as $$ update public.devices set last_seen_at = now() - interval '1 minute' $$;

create or replace function pg_temp.outbox(p_kind text) returns bigint
language sql security definer as $$
  select count(*) from public.notification_outbox
   where kind::text = p_kind and device_id = current_setting('test.cat')::uuid $$;

grant execute on all functions in schema pg_temp to public;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'olga@example.nl'),
  ('22222222-0000-0000-0000-000000000002', 'mark@example.nl'),
  ('33333333-0000-0000-0000-000000000003', 'sam@example.nl');

-- --- Olga's cat -----------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
do $$ begin
  perform set_config('test.cat', public.create_phone_tracker('Minoes', '#F97316')::text, false);
end $$;
select public.report_phone_location(current_setting('test.cat')::uuid, 52.3790, 4.8995, 8::real, 80::smallint);
select public.create_circle_geofence(current_setting('test.cat')::uuid, 'Home', 52.3790, 4.8995, 100) is not null;

-- --- household invite -----------------------------------------------------------
do $$ begin perform set_config('test.code', public.create_household_invite(), false); end $$;
select pg_temp.check(current_setting('test.code') ~ '^[A-HJ-NP-Z2-9]{8}$', 'invite code is 8 unambiguous characters');
select pg_temp.expect_error($$select public.accept_household_invite(current_setting('test.code'))$$,
                            'owner cannot join own household');

set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.devices) = 0, 'mark sees no cats before joining');
select pg_temp.check(
  public.accept_household_invite(lower(substr(current_setting('test.code'), 1, 4)) || '-' || substr(current_setting('test.code'), 5))
    = '11111111-0000-0000-0000-000000000001',
  'mark joins with the code (case-insensitive, dash allowed)');
select pg_temp.check((select count(*) from public.devices) = 1, 'mark now sees olga''s cat');
select pg_temp.check((select count(*) from public.telemetry) >= 1, 'mark sees the cat''s location history');
select pg_temp.check((select count(*) from public.get_pet_geofences(current_setting('test.cat')::uuid)) = 1,
                     'mark sees the home zone');
update public.devices set display_name = 'Hacked';
select pg_temp.check((select display_name from public.devices) = 'Minoes', 'members cannot rename the cat');
select pg_temp.expect_error($$select public.report_phone_location(current_setting('test.cat')::uuid, 52.0, 4.0, 5::real)$$,
                            'members cannot report positions for the cat');
select pg_temp.check((select count(*) from public.list_household() where role = 'owner' and email = 'olga@example.nl') = 1,
                     'mark''s household list shows olga as owner');

-- lost mode by a member + alert
select public.set_lost_mode(current_setting('test.cat')::uuid, true);
select pg_temp.check((select lost_mode and lost_mode_since is not null from public.devices), 'member switches lost mode on');
select pg_temp.check(pg_temp.outbox('lost_mode') = 1, 'lost mode queues a push notification');
select public.register_push_token('ExponentPushToken[mark]', 'android');

set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select pg_temp.expect_error($$select public.accept_household_invite(current_setting('test.code'))$$,
                            'invite codes are single use');
select pg_temp.expect_error($$select public.set_lost_mode(current_setting('test.cat')::uuid, false)$$,
                            'outsiders cannot touch lost mode');
select pg_temp.check((select count(*) from public.get_pet_track(current_setting('test.cat')::uuid, now() - interval '1 day')) = 0,
                     'outsiders see no route');

-- --- alerts --------------------------------------------------------------------
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.register_push_token('ExponentPushToken[olga]', 'ios');
select pg_temp.check((select count(*) from public.list_household() where role = 'member' and email = 'mark@example.nl') = 1,
                     'olga''s household list shows mark');

select pg_temp.age_last_seen();
select public.report_phone_location(current_setting('test.cat')::uuid, 52.3791, 4.8996, 8::real, 15::smallint);
select pg_temp.age_last_seen();
select public.report_phone_location(current_setting('test.cat')::uuid, 52.3792, 4.8996, 8::real, 12::smallint);
select pg_temp.check(pg_temp.outbox('low_battery') = 1, 'one low-battery alert below 20 % (not repeated at 12 %)');
select pg_temp.age_last_seen();
select public.report_phone_location(current_setting('test.cat')::uuid, 52.3791, 4.8995, 8::real, null);
select pg_temp.check((select last_battery_pct from public.devices) = 12, 'unknown phone battery keeps the last value');
select pg_temp.age_last_seen();
select public.report_phone_location(current_setting('test.cat')::uuid, 52.3790, 4.8995, 8::real, 60::smallint);
select pg_temp.age_last_seen();
select public.report_phone_location(current_setting('test.cat')::uuid, 52.3790, 4.8996, 8::real, 9::smallint);
select pg_temp.check(pg_temp.outbox('low_battery') = 2, 'charging above 30 % re-arms the alert');

select pg_temp.age_last_seen();
select public.report_phone_location(current_setting('test.cat')::uuid, 52.3850, 4.9100, 8::real, 9::smallint);
select pg_temp.check(pg_temp.outbox('zone_exit') = 1, 'leaving home queues a "left Home" push');
reset role;
select pg_temp.check(
  (select title from public.notification_outbox where kind = 'zone_exit' and device_id = current_setting('test.cat')::uuid) = 'Minoes left Home',
  'push title names the cat and the zone');
select pg_temp.check(
  (select count(*) from public.push_recipients('11111111-0000-0000-0000-000000000001')) = 2,
  'alerts go to the owner and household members');

-- --- insights --------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check(
  (select count(*) > 0 and min(weight_s) >= 0 from public.get_pet_heatmap(current_setting('test.cat')::uuid, now() - interval '1 day')),
  'members get the dwell-time heatmap');
select pg_temp.check(
  (select distance_m > 500 and fixes >= 7 and roam_radius_m > 500
     from public.get_pet_activity(current_setting('test.cat')::uuid, 7)),
  'activity estimate: distance walked and roaming radius from home');

-- --- collar config downlink -------------------------------------------------------
reset role;
insert into public.devices (device_uid, kind, owner_id, status, display_name, timezone, night_mode)
values ('pt-351234567890999', 'collar', '11111111-0000-0000-0000-000000000001', 'active', 'Tijger', 'UTC', true);
select pg_temp.check(
  (select public.device_config_json(d) = '{"interval_s": 900, "lost_mode": false, "night_mode": true, "night_start_utc_min": 1260, "night_end_utc_min": 420, "night_interval_s": 300}'::jsonb
     from public.devices d where device_uid = 'pt-351234567890999'),
  'collar config payload (UTC)');
update public.devices set timezone = 'Asia/Kolkata' where device_uid = 'pt-351234567890999';
select pg_temp.check(
  (select (public.device_config_json(d) ->> 'night_start_utc_min')::int = 930
      and (public.device_config_json(d) ->> 'night_end_utc_min')::int = 90
     from public.devices d where device_uid = 'pt-351234567890999'),
  'night window converted from local time (UTC+5:30) to UTC');
select pg_temp.check(public.republish_device_configs() = 1, 'daily republish covers active collars only');

-- --- photos -------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into storage.objects (bucket_id, name) values ('cat-photos', '11111111-0000-0000-0000-000000000001/minoes.jpg');
select pg_temp.check(true, 'owner uploads a photo into their own folder');
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from storage.objects) = 1, 'household member can view the photo');
select pg_temp.expect_error(
  $$insert into storage.objects (bucket_id, name) values ('cat-photos', '11111111-0000-0000-0000-000000000001/evil.jpg')$$,
  'members cannot upload into the owner''s folder');
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) from storage.objects) = 0, 'outsiders cannot see the photo');

-- --- leaving -------------------------------------------------------------------------
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.remove_household_member('22222222-0000-0000-0000-000000000002');
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.devices) = 0, 'removed member loses access immediately');
reset role;

\echo 'ALL HOUSEHOLD TESTS PASSED'

-- --- zones for all cats --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
do $$ begin perform set_config('test.cat2', public.create_phone_tracker('Pluis', '#EC4899')::text, false); end $$;
select public.create_circle_geofence(null, 'Garden', 52.3790, 4.8995, 60) is not null;
select pg_temp.check(
  (select count(*) from public.get_pet_geofences(current_setting('test.cat2')::uuid) where all_cats and name = 'Garden') = 1,
  'a zone for all cats shows up for every cat');
select pg_temp.check(
  (select count(*) from public.get_pet_geofences(current_setting('test.cat')::uuid)) = 2,
  'a cat can have several zones (own Home + shared Garden)');
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select public.create_circle_geofence(null, 'Sams garden', 52.0, 4.0, 60) is not null;
select pg_temp.check(
  (select count(*) from public.get_pet_geofences(current_setting('test.cat')::uuid) where name = 'Sams garden') = 0,
  'other households'' all-cat zones never leak into this cat');
reset role;
\echo 'ALL ZONE TESTS PASSED'
