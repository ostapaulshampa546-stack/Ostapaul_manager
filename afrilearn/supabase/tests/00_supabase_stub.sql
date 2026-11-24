-- Reproduit le minimum de l'environnement Supabase pour tester les migrations
-- sur un Postgres local (rôles, schéma auth, auth.uid()).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Utilitaires de test
create schema if not exists tests;
create table if not exists tests.kv (k text primary key, v text);
grant usage on schema tests to anon, authenticated, service_role;
grant all on tests.kv to anon, authenticated, service_role;
create or replace function tests.put(k text, v text) returns void language sql as $$
  insert into tests.kv values (k, v) on conflict (k) do update set v = excluded.v $$;
create or replace function tests.get(k text) returns text language sql stable as $$ select v from tests.kv where kv.k = get.k $$;
create or replace function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if;
end $$;
create or replace function tests.fails(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'PASS  % (%)', label, sqlerrm; return; end;
  raise exception 'FAIL  % (no error)', label;
end $$;
-- Bascule sur un utilisateur authentifié (comme le ferait PostgREST)
create or replace function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  perform set_config('request.jwt.claim.sub', p_user::text, false);
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;
