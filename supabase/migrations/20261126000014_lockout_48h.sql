-- =====================================================================
-- 0014 : blocage des connexions jusqu'à 7 jours ; réglage 3 tentatives / 48 h.
-- Le blocage par adresse IP reste court (20 échecs / 1 h) pour ne pas bloquer
-- tous les abonnés d'un opérateur mobile qui partagent la même adresse IP.
-- =====================================================================
alter table public.platform_settings drop constraint if exists platform_settings_login_lock_minutes_check;
alter table public.platform_settings add constraint platform_settings_login_lock_minutes_check
  check (login_lock_minutes between 5 and 10080);

create or replace function public.login_guard(p_email_hash text, p_ip text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_last_success timestamptz;
  v_failures int;
  v_last_failure timestamptz;
  v_ip_failures int := 0;
  v_until timestamptz;
  c_max int;
  c_window interval;
  c_ip_max constant int := 20;
  c_ip_window constant interval := interval '1 hour';
begin
  select login_max_attempts, make_interval(mins => login_lock_minutes) into c_max, c_window from public.platform_settings;
  c_max := coalesce(c_max, 4); c_window := coalesce(c_window, interval '1 hour');
  select max(created_at) into v_last_success from public.login_attempts
   where email_hash = p_email_hash and success;
  select count(*), max(created_at) into v_failures, v_last_failure from public.login_attempts
   where email_hash = p_email_hash and not success
     and created_at > now() - c_window
     and created_at > coalesce(v_last_success, '-infinity'::timestamptz);
  if p_ip is not null then
    select count(*) into v_ip_failures from public.login_attempts
     where ip = p_ip and not success and created_at > now() - c_ip_window;
  end if;

  if v_failures >= c_max then
    v_until := v_last_failure + c_window;
  elsif v_ip_failures >= c_ip_max then
    v_until := (select max(created_at) from public.login_attempts where ip = p_ip and not success) + c_ip_window;
  end if;

  return jsonb_build_object(
    'blocked', v_until is not null and v_until > now(),
    'retry_after_seconds', case when v_until > now() then ceil(extract(epoch from v_until - now()))::int else 0 end,
    'remaining', greatest(c_max - v_failures, 0),
    'max_attempts', c_max,
    'lock_minutes', extract(epoch from c_window)::int / 60);
end $$;

update public.platform_settings set login_max_attempts = 3, login_lock_minutes = 2880;
