-- =====================================================================
-- 0011 : protection contre les attaques par force brute sur la connexion
-- 4 échecs consécutifs pour un même compte => blocage d'environ 1 heure.
-- Garde-fou supplémentaire par adresse IP (20 échecs / heure).
-- Les e-mails ne sont pas stockés en clair : uniquement leur empreinte SHA-256.
-- Accessible uniquement au serveur applicatif (service_role).
-- =====================================================================

create table public.login_attempts (
  id bigserial primary key,
  email_hash text not null check (length(email_hash) = 64),
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index on public.login_attempts (email_hash, created_at desc);
create index on public.login_attempts (ip, created_at desc);
alter table public.login_attempts enable row level security; -- aucune politique : invisible pour les clients

-- État de blocage d'un compte (et de l'IP) avant une tentative
create or replace function public.login_guard(p_email_hash text, p_ip text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_last_success timestamptz;
  v_failures int;
  v_last_failure timestamptz;
  v_ip_failures int := 0;
  v_until timestamptz;
  c_max constant int := 4;
  c_window constant interval := interval '1 hour';
begin
  select max(created_at) into v_last_success from public.login_attempts
   where email_hash = p_email_hash and success;
  select count(*), max(created_at) into v_failures, v_last_failure from public.login_attempts
   where email_hash = p_email_hash and not success
     and created_at > now() - c_window
     and created_at > coalesce(v_last_success, '-infinity'::timestamptz);
  if p_ip is not null then
    select count(*) into v_ip_failures from public.login_attempts
     where ip = p_ip and not success and created_at > now() - c_window;
  end if;

  if v_failures >= c_max then
    v_until := v_last_failure + c_window;
  elsif v_ip_failures >= 20 then
    v_until := (select max(created_at) from public.login_attempts where ip = p_ip and not success) + c_window;
  end if;

  return jsonb_build_object(
    'blocked', v_until is not null and v_until > now(),
    'retry_after_seconds', case when v_until > now() then ceil(extract(epoch from v_until - now()))::int else 0 end,
    'remaining', greatest(c_max - v_failures, 0));
end $$;

-- Enregistre le résultat d'une tentative ; renvoie l'état mis à jour
create or replace function public.login_record(p_email_hash text, p_ip text, p_success boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  insert into public.login_attempts (email_hash, ip, success) values (p_email_hash, left(p_ip, 64), p_success);
  return public.login_guard(p_email_hash, p_ip);
end $$;

revoke all on public.login_attempts from anon, authenticated;
revoke execute on function public.login_guard(text, text) from public, anon, authenticated;
revoke execute on function public.login_record(text, text, boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.login_guard(text, text), public.login_record(text, text, boolean) to service_role;
  end if;
end $$;
