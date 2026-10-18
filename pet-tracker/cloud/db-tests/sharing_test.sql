-- Tests for households v2 and cat sitters (migration 20261018000500), run on
-- the data household_test.sql leaves behind so the data migration is covered.
-- Run with ./run.sh
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

-- Other test files use the same cat names, so always look cats up by owner.
create or replace function pg_temp.cat(p_name text, p_owner uuid default '11111111-0000-0000-0000-000000000001') returns uuid
language sql security definer as $$ select id from public.devices where display_name = p_name and owner_id = p_owner $$;

create or replace function pg_temp.household_of(p_cat uuid) returns uuid
language sql security definer as $$ select household_id from public.devices where id = p_cat $$;

grant execute on all functions in schema pg_temp to public;

-- Users from household_test.sql
--   olga 1111... owns Minoes (phone), Tijger (collar), Pluis (phone)
--   mark 2222... was in olga's household and was removed
--   sam  3333... has no cats

-- --- data migration ----------------------------------------------------------------
select pg_temp.check(
  (select count(*) = 1 and min(name) = 'Olga''s household'
     from public.households where created_by = '11111111-0000-0000-0000-000000000001'),
  'existing owner gets one household named after them');
select pg_temp.check(
  (select role from public.household_memberships m join public.households h on h.id = m.household_id
    where h.created_by = '11111111-0000-0000-0000-000000000001' and m.user_id = h.created_by) = 'admin',
  'the owner is admin of it');
select pg_temp.check(
  (select count(*) from public.devices
    where owner_id = '11111111-0000-0000-0000-000000000001'
      and household_id = (select id from public.households where created_by = '11111111-0000-0000-0000-000000000001')) = 3,
  'all of the owner''s cats moved into that household');
select pg_temp.check(
  (select count(*) from public.household_memberships
    where user_id in ('22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000003')) = 0,
  'removed members and people without cats are in no household');

do $$ begin
  perform set_config('test.home', pg_temp.household_of(pg_temp.cat('Minoes'))::text, false);
  perform set_config('test.minoes', pg_temp.cat('Minoes')::text, false);
  perform set_config('test.pluis', pg_temp.cat('Pluis')::text, false);
  perform set_config('test.tijger', pg_temp.cat('Tijger')::text, false);
end $$;

-- --- joining a household --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select pg_temp.check(
  (select my_role = 'admin' and cat_count = 3 and jsonb_array_length(members) = 1
     from public.list_households()),
  'olga sees her household: admin, 3 cats, 1 member');
do $$ begin
  perform set_config('test.code', public.create_household_invite(current_setting('test.home')::uuid), false);
end $$;
select pg_temp.check(current_setting('test.code') ~ '^[A-HJ-NP-Z2-9]{8}$', 'household invite code is 8 unambiguous characters');
select public.rename_household(current_setting('test.home')::uuid, 'Home');

set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.devices) = 0, 'mark sees no cats before joining');
select pg_temp.check(
  (select public.accept_invite(lower(current_setting('test.code'))) ->> 'name') = 'Home',
  'mark joins and is told the household name');
select pg_temp.expect_error($$select public.accept_invite(current_setting('test.code'))$$, 'invite codes are single use');
select pg_temp.check((select count(*) from public.devices) = 3, 'mark now sees the household''s 3 cats');
select pg_temp.check(
  (select bool_and(access = 'household' and household_name = 'Home') from public.my_cat_access()),
  'the app is told these cats come from the household "Home"');
select pg_temp.check(
  (select my_role = 'member' and jsonb_array_length(members) = 2 from public.list_households()),
  'mark is a member; the household has 2 people');
select pg_temp.expect_error($$select public.create_household_invite(current_setting('test.home')::uuid)$$,
                            'members cannot invite');
select pg_temp.expect_error($$select public.rename_household(current_setting('test.home')::uuid, 'Mine')$$,
                            'members cannot rename the household');
select pg_temp.expect_error($$select public.set_cat_household(current_setting('test.minoes')::uuid, null)$$,
                            'members cannot move someone else''s cat');
select public.set_lost_mode(current_setting('test.minoes')::uuid, false);
select pg_temp.check((select not lost_mode from public.devices where id = current_setting('test.minoes')::uuid),
                     'members can still switch lost mode');

-- --- several households ------------------------------------------------------------------
do $$ begin
  perform set_config('test.flat', public.create_household('Mark''s flat')::text, false);
  perform set_config('test.bolt', public.create_phone_tracker('Bolt', '#10B981')::text, false);
end $$;
select pg_temp.check((select count(*) from public.list_households()) = 2, 'mark is in two households');
reset role;
select pg_temp.check(pg_temp.household_of(current_setting('test.bolt')::uuid) = current_setting('test.flat')::uuid,
                     'a new cat joins the household its owner administers');
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from public.devices where display_name = 'Bolt') = 0,
                     'olga does not see the cat in mark''s other household');

-- private cat
select public.set_cat_household(current_setting('test.pluis')::uuid, null);
select pg_temp.expect_error(
  $$select public.set_cat_household(current_setting('test.pluis')::uuid, current_setting('test.flat')::uuid)$$,
  'cats can only move into households the owner is in');
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.devices where display_name = 'Pluis') = 0,
                     'a private cat disappears for the household');

-- photos follow the cat, not the owner
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into storage.objects (bucket_id, name) values
  ('cat-photos', '11111111-0000-0000-0000-000000000001/' || current_setting('test.minoes') || '-1.jpg'),
  ('cat-photos', '11111111-0000-0000-0000-000000000001/' || current_setting('test.pluis') || '-1.jpg');
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select pg_temp.check(
  (select count(*) = 1 and min(name) like '%' || current_setting('test.minoes') || '%' from storage.objects),
  'household members see photos of shared cats only');

-- --- cat sitters ----------------------------------------------------------------------------
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
do $$ begin
  perform set_config('test.sit', public.create_sitter_invite(current_setting('test.minoes')::uuid, now() + interval '7 days'), false);
end $$;
select pg_temp.expect_error($$select public.accept_invite(current_setting('test.sit'))$$, 'owners cannot sit their own cat');
do $$ begin
  perform set_config('test.sit', public.create_sitter_invite(current_setting('test.minoes')::uuid, now() + interval '7 days'), false);
end $$;
select pg_temp.expect_error($$select public.create_sitter_invite(current_setting('test.minoes')::uuid, now() - interval '1 day')$$,
                            'a sitting period cannot end in the past');
select pg_temp.expect_error($$select public.create_sitter_invite(current_setting('test.tijger')::uuid, now() + interval '2 years')$$,
                            'a sitting period is at most a year');

set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select pg_temp.check((public.accept_invite(current_setting('test.sit')) ->> 'kind') = 'sitter', 'sam accepts the sitter invite');
select pg_temp.check((select count(*) = 1 and min(display_name) = 'Minoes' from public.devices),
                     'the sitter sees only that cat');
select pg_temp.check(
  (select access = 'sitter' and sitter_until > now() + interval '6 days' from public.my_cat_access()),
  'the app knows sam is sitting until next week');
select pg_temp.check((select count(*) from public.get_pet_track(current_setting('test.minoes')::uuid, now() - interval '1 day')) > 0,
                     'the sitter sees the route');
select pg_temp.check(
  (select count(*) = 2 and bool_or(all_cats) from public.get_pet_geofences(current_setting('test.minoes')::uuid)),
  'the sitter sees the cat''s zone and the owner''s all-cats zone, not their own');
update public.devices set display_name = 'Hacked';
select pg_temp.check((select display_name from public.devices) = 'Minoes', 'sitters cannot rename the cat');
select public.set_lost_mode(current_setting('test.minoes')::uuid, true);
select pg_temp.check((select lost_mode from public.devices), 'sitters can switch lost mode on');
select public.register_push_token('ExponentPushToken[sam]', 'android');

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select pg_temp.check(
  (select count(*) = 1 and min(email) = 'sam@example.nl' from public.list_cat_sitters(current_setting('test.minoes')::uuid)),
  'the owner sees who is sitting');

reset role;
select pg_temp.check(
  (select count(*) from public.push_recipients('11111111-0000-0000-0000-000000000001', current_setting('test.minoes')::uuid)) = 3,
  'alerts for a shared cat go to owner, household and sitter');
select pg_temp.check(
  (select count(*) from public.push_recipients('11111111-0000-0000-0000-000000000001', current_setting('test.pluis')::uuid)) = 1,
  'alerts for a private cat go to the owner only');

update public.cat_sitters set until = now() - interval '1 minute';
set role authenticated;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) from public.devices) = 0, 'access ends when the sitting period ends');
reset role;
select pg_temp.check(
  (select count(*) from public.push_recipients('11111111-0000-0000-0000-000000000001', current_setting('test.minoes')::uuid)) = 2,
  'and so do the alerts');
update public.cat_sitters set until = null;
set role authenticated;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) from public.devices) = 1, '"until I stop it" has no end date');
select public.remove_cat_sitter(current_setting('test.minoes')::uuid, '33333333-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.devices) = 0, 'a sitter can stop on their own');

-- --- leaving and removing -------------------------------------------------------------------
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select public.leave_household(current_setting('test.home')::uuid);
select pg_temp.check((select count(*) = 1 and min(display_name) = 'Bolt' from public.devices),
                     'after leaving, mark only sees his own cat');

-- the last admin leaves: the oldest member takes over and the leaver's cats go with them
do $$ begin perform set_config('test.code', public.create_household_invite(current_setting('test.flat')::uuid), false); end $$;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.accept_invite(current_setting('test.code'));
select pg_temp.check((select count(*) from public.devices where display_name = 'Bolt') = 1, 'olga joins mark''s flat and sees Bolt');
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select public.leave_household(current_setting('test.flat')::uuid);
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select pg_temp.check(
  (select my_role from public.list_households() where household_id = current_setting('test.flat')::uuid) = 'admin',
  'when the last admin leaves, the remaining member becomes admin');
select pg_temp.check((select count(*) from public.devices where display_name = 'Bolt') = 0,
                     'the leaver''s cats leave the household with them');

-- an admin removes someone
do $$ begin perform set_config('test.code', public.create_household_invite(current_setting('test.home')::uuid), false); end $$;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select public.accept_invite(current_setting('test.code'));
select pg_temp.check((select count(*) from public.devices) = 2, 'sam joins the household (Minoes and Tijger)');
select pg_temp.expect_error($$select public.remove_household_member(current_setting('test.home')::uuid, '11111111-0000-0000-0000-000000000001')$$,
                            'members cannot remove people');
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.remove_household_member(current_setting('test.home')::uuid, '33333333-0000-0000-0000-000000000003');
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) from public.devices) = 0, 'removed people lose access immediately');

-- releasing a collar takes it out of the household
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.release_device(current_setting('test.tijger')::uuid);
reset role;
select pg_temp.check(pg_temp.household_of(current_setting('test.tijger')::uuid) is null, 'a released collar leaves its household');

-- deleting a household makes its cats private
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.delete_household(current_setting('test.home')::uuid);
reset role;
select pg_temp.check(pg_temp.household_of(current_setting('test.minoes')::uuid) is null, 'deleting a household makes its cats private');
select pg_temp.check((select count(*) from public.invites where household_id = current_setting('test.home')::uuid) = 0,
                     'and removes its open invites');

\echo 'ALL SHARING TESTS PASSED'
