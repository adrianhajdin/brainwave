-- Data migration of 20261018000600: "all my cats" zones become household zones.
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.check(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok   - %', p_label;
end $$;

select pg_temp.check(
  (select g.household_id = h.id
     from public.geofences g
     join public.households h on h.created_by = g.owner_id
    where g.name = 'Garden'),
  'olga''s "all my cats" Garden now belongs to the household holding her cats');
select pg_temp.check(
  (select household_id is null from public.geofences where name = 'Sams garden'),
  'an "all my cats" zone of someone without a household stays as it was');
select pg_temp.check(
  (select count(*) from public.geofences where device_id is not null and household_id is not null) = 0,
  'zones for one cat stay zones for that cat');
\echo 'ALL ZONE MIGRATION TESTS PASSED'
