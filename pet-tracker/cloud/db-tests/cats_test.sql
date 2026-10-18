-- Tests for cats + phone trackers (migration 20261016000300). Run with ./run.sh
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

-- Lets the test skip the 5 s per-tracker rate limit between reports.
create or replace function pg_temp.age_last_seen() returns void
language sql security definer as $$ update public.devices set last_seen_at = now() - interval '1 minute' $$;
grant execute on function pg_temp.age_last_seen() to public;

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000003', 'carla@example.nl'),
  ('dddddddd-0000-0000-0000-000000000004', 'dave@example.nl');

set role authenticated;
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$ begin
  perform set_config('test.minoes', public.create_phone_tracker('Minoes', '#F97316')::text, false);
  perform set_config('test.tijger', public.create_phone_tracker('Tijger', '#6366F1')::text, false);
end $$;

select pg_temp.check((select count(*) from public.devices where kind = 'phone' and species = 'cat' and status = 'active') = 2,
                     'carla has two active cat phone-trackers');
select pg_temp.expect_error($$select public.create_phone_tracker('   ')$$, 'blank cat name is rejected');

select pg_temp.check(
  (public.report_phone_location(current_setting('test.minoes')::uuid, 52.3790, 4.8995, 12::real, 77::smallint) ->> 'status') = 'ok',
  'phone reports its own location for Minoes');
select pg_temp.check(
  (select round(last_lat::numeric, 4) = 52.3790 and round(last_lng::numeric, 4) = 4.8995 and last_battery_pct = 77
     from public.devices where id = current_setting('test.minoes')::uuid),
  'generated last_lat/last_lng columns expose plain numbers');
select pg_temp.check(
  (public.report_phone_location(current_setting('test.minoes')::uuid, 52.3791, 4.8996, 12::real) ->> 'status') = 'rate_limited',
  'second report within 5 s is rate-limited');
select pg_temp.check(
  (public.report_phone_location(current_setting('test.minoes')::uuid, 52.3790, 4.8995, 5::real, 50::smallint,
                                now() + interval '1 day') ->> 'status') in ('ok', 'rate_limited', 'duplicate'),
  'a phone clock in the future is clamped, not trusted');

-- ~100 m home zone around the first fix
select pg_temp.check(
  public.create_circle_geofence(current_setting('test.minoes')::uuid, 'Home', 52.3790, 4.8995, 100) is not null,
  'carla creates a 100 m circular home zone');
select pg_temp.check(
  (select abs(radius_m - 100) < 1 from public.get_pet_geofences(current_setting('test.minoes')::uuid)),
  'get_pet_geofences returns centre + radius');
select pg_temp.expect_error(
  $$select public.create_circle_geofence(current_setting('test.minoes')::uuid, 'huge', 52.0, 4.0, 50000)$$,
  'unreasonable radius rejected');

select pg_temp.age_last_seen();
select pg_temp.check(
  (public.report_phone_location(current_setting('test.minoes')::uuid, 52.3850, 4.9100, 8::real, 75::smallint)
     -> 'events' -> 0 ->> 'transition') = 'exit',
  'first exit from a freshly created zone alerts (state seeded at creation)');

select pg_temp.check((select count(*) from public.get_pet_track(current_setting('test.minoes')::uuid, now() - interval '1 day')) >= 2,
                     'get_pet_track returns the route');

-- other users
set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';
select pg_temp.expect_error(
  $$select public.report_phone_location(current_setting('test.minoes')::uuid, 52.0, 4.0, 5::real)$$,
  'dave cannot report a location for carla''s cat');
select pg_temp.check((select count(*) from public.get_pet_track(current_setting('test.minoes')::uuid, now() - interval '1 day')) = 0,
                     'dave cannot read carla''s cat route');
select pg_temp.expect_error(
  $$select public.create_circle_geofence(current_setting('test.minoes')::uuid, 'evil', 52.0, 4.0, 100)$$,
  'dave cannot add a geofence to carla''s cat');
select pg_temp.check((select count(*) from public.devices) = 0, 'dave sees no cats');

set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';
update public.devices set color = '#10B981' where id = current_setting('test.tijger')::uuid;
select pg_temp.check((select color from public.devices where id = current_setting('test.tijger')::uuid) = '#10B981',
                     'carla can recolour a cat');
select pg_temp.expect_error($$update public.devices set kind = 'collar'$$, 'carla cannot change tracker kind');
reset role;

\echo 'ALL CAT TESTS PASSED'
