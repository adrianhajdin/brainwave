-- Tests for household home zones (migration 20261018000600), run after
-- sharing_test.sql. Run with ./run.sh
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

-- Phone positions are rate limited to one per 5 s; tests step past that.
create or replace function pg_temp.age() returns void
language sql security definer as $$ update public.devices set last_seen_at = now() - interval '1 minute' $$;

create or replace function pg_temp.events(p_cat uuid, p_zone uuid, p_transition text) returns bigint
language sql security definer as $$
  select count(*) from public.geofence_events
   where device_id = p_cat and geofence_id = p_zone and transition::text = p_transition $$;

grant execute on all functions in schema pg_temp to public;

-- olga 1111 (Minoes, Pluis), mark 2222 (Bolt), sam 3333 (no cats yet)
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
do $$ begin
  perform set_config('test.house', public.create_household('Zone house')::text, false);
  perform set_config('test.minoes', (select id from public.devices where display_name = 'Minoes' and owner_id = auth.uid())::text, false);
  perform set_config('test.pluis', (select id from public.devices where display_name = 'Pluis' and owner_id = auth.uid())::text, false);
  perform set_config('test.code', public.create_household_invite(current_setting('test.house')::uuid), false);
end $$;
select public.set_cat_household(current_setting('test.minoes')::uuid, current_setting('test.house')::uuid);
select public.set_cat_household(current_setting('test.pluis')::uuid, null);

set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select public.accept_invite(current_setting('test.code'));
do $$ begin perform set_config('test.kees', public.create_phone_tracker('Kees', '#10B981')::text, false); end $$;
reset role;
select pg_temp.check(
  (select household_id from public.devices where id = current_setting('test.kees')::uuid) = current_setting('test.house')::uuid,
  'sam''s new cat goes into his household');

-- a member (not the admin) sets the household's home
set role authenticated;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
do $$ begin
  perform set_config('test.home',
    public.create_circle_geofence(null, 'Home', 52.3790, 4.8995, 40, true, current_setting('test.house')::uuid)::text, false);
end $$;
select pg_temp.expect_error(
  $$select public.create_circle_geofence(current_setting('test.kees')::uuid, 'x', 52.0, 4.0, 40, true, current_setting('test.house')::uuid)$$,
  'a zone is for one cat or for a household, not both');

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select pg_temp.check(
  (select count(*) = 1 and min(household_name) = 'Zone house' and bool_and(all_cats)
     from public.get_pet_geofences(current_setting('test.minoes')::uuid) where household_id is not null),
  'the household''s home shows up on olga''s cat, with the household name');
select pg_temp.check(
  (select count(*) from public.get_pet_geofences(current_setting('test.pluis')::uuid) where name = 'Home') = 0,
  'but not on her private cat');
select pg_temp.check(
  (select count(*) from public.get_household_zones(current_setting('test.house')::uuid)) = 1,
  'the household lists its zones');

-- outsiders
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.geofences where household_id = current_setting('test.house')::uuid) = 0,
                     'people outside the household don''t see its zones');
select pg_temp.expect_error(
  $$select public.create_circle_geofence(null, 'Mine now', 52.0, 4.0, 40, true, current_setting('test.house')::uuid)$$,
  'only members add zones to a household');
select pg_temp.expect_error(
  $$insert into public.geofences (owner_id, household_id, name, area)
    values (auth.uid(), current_setting('test.house')::uuid, 'sneaky',
            extensions.st_buffer(extensions.st_makepoint(4.0, 52.0)::extensions.geography, 40))$$,
  'not even by writing the table directly');

-- the zone works for everyone's cats in the household
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select pg_temp.age();
select public.report_phone_location(current_setting('test.minoes')::uuid, 52.3790, 4.8995, 8::real, 80::smallint);
select pg_temp.age();
select public.report_phone_location(current_setting('test.minoes')::uuid, 52.3850, 4.9100, 8::real, 80::smallint);
select pg_temp.age();
select public.report_phone_location(current_setting('test.pluis')::uuid, 52.3790, 4.8995, 8::real, 80::smallint);
select pg_temp.age();
select public.report_phone_location(current_setting('test.pluis')::uuid, 52.3850, 4.9100, 8::real, 80::smallint);
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select pg_temp.age();
select public.report_phone_location(current_setting('test.kees')::uuid, 52.3790, 4.8995, 8::real, 80::smallint);
select pg_temp.age();
select public.report_phone_location(current_setting('test.kees')::uuid, 52.3850, 4.9100, 8::real, 80::smallint);
reset role;
select pg_temp.check(pg_temp.events(current_setting('test.minoes')::uuid, current_setting('test.home')::uuid, 'exit') = 1,
                     'olga''s cat leaving the household''s home raises an alert');
select pg_temp.check(pg_temp.events(current_setting('test.kees')::uuid, current_setting('test.home')::uuid, 'exit') = 1,
                     'and so does sam''s');
select pg_temp.check(pg_temp.events(current_setting('test.pluis')::uuid, current_setting('test.home')::uuid, 'exit') = 0,
                     'a private cat is not watched by the household''s zone');

-- a cat sitter sees the zone, but cannot remove it
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
do $$ begin perform set_config('test.code', public.create_sitter_invite(current_setting('test.minoes')::uuid, null), false); end $$;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select public.accept_invite(current_setting('test.code'));
select pg_temp.check(
  (select count(*) from public.get_pet_geofences(current_setting('test.minoes')::uuid) where household_id is not null) = 1,
  'a cat sitter sees the household''s home on the cat');
select pg_temp.expect_error($$select public.delete_zone(current_setting('test.home')::uuid)$$,
                            'a cat sitter cannot delete household zones');

-- any member can remove it, not only the one who made it
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.delete_zone(current_setting('test.home')::uuid);
select pg_temp.check((select count(*) from public.get_household_zones(current_setting('test.house')::uuid)) = 0,
                     'any member can delete a household zone');

-- deleting the household removes its zones
do $$ begin
  perform set_config('test.home',
    public.create_circle_geofence(null, 'Home', 52.3790, 4.8995, 40, true, current_setting('test.house')::uuid)::text, false);
end $$;
select public.delete_household(current_setting('test.house')::uuid);
reset role;
select pg_temp.check((select count(*) from public.geofences where id = current_setting('test.home')::uuid) = 0,
                     'deleting a household deletes its zones');
\echo 'ALL HOUSEHOLD ZONE TESTS PASSED'
