-- Minimal stand-in for the Supabase platform objects the migrations depend on,
-- so they can be tested against a vanilla PostgreSQL + PostGIS instance.
-- NOT for use against a real Supabase project.
-- Roles are cluster-wide, so tolerate re-runs.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema auth;
create schema extensions;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;

create table auth.users (id uuid primary key default gen_random_uuid(), email text);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant execute on function auth.uid() to public;

create publication supabase_realtime;

-- Supabase default privileges: new public tables are granted to API roles.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

-- Supabase Storage (only what the migrations touch)
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
