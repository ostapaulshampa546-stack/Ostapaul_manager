-- =====================================================================
-- 0015 : tableau de surveillance du super admin (lecture seule)
-- =====================================================================
create or replace function public.admin_monitoring() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_max int; v_lock interval; v_cron jsonb := null;
begin
  if not public.is_platform_admin() then raise exception 'Réservé au super administrateur' using errcode = '42501'; end if;
  select login_max_attempts, make_interval(mins => login_lock_minutes) into v_max, v_lock from public.platform_settings;

  -- Tâches planifiées pg_cron (si l'extension est installée)
  if to_regclass('cron.job_run_details') is not null then
    execute $q$
      select jsonb_build_object(
        'last_run', max(start_time),
        'failed_24h', count(*) filter (where status = 'failed' and start_time > now() - interval '24 hours'),
        'ok_24h', count(*) filter (where status = 'succeeded' and start_time > now() - interval '24 hours'),
        'last_error', (select left(return_message, 200) from cron.job_run_details where status = 'failed' order by start_time desc limit 1))
      from cron.job_run_details where start_time > now() - interval '7 days' $q$ into v_cron;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'login', jsonb_build_object(
      'max_attempts', v_max,
      'lock_minutes', extract(epoch from v_lock)::int / 60,
      'failures_24h', (select count(*) from public.login_attempts where not success and created_at > now() - interval '24 hours'),
      'successes_24h', (select count(*) from public.login_attempts where success and created_at > now() - interval '24 hours'),
      'blocked_accounts', (select count(*) from (
          select a.email_hash from public.login_attempts a
           where not a.success and a.created_at > now() - v_lock
             and a.created_at > coalesce((select max(s.created_at) from public.login_attempts s where s.email_hash = a.email_hash and s.success), '-infinity')
           group by a.email_hash having count(*) >= v_max) x),
      'blocked_ips', (select count(*) from (
          select ip from public.login_attempts where ip is not null and not success and created_at > now() - interval '1 hour'
           group by ip having count(*) >= 20) x)),
    'fraud', jsonb_build_object(
      'open', (select count(*) from public.fraud_alerts where status = 'open'),
      'open_high', (select count(*) from public.fraud_alerts where status = 'open' and severity = 'high'),
      'new_24h', (select count(*) from public.fraud_alerts where created_at > now() - interval '24 hours'),
      'latest', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select f.id, f.title, f.severity, f.created_at, t.name as tenant from public.fraud_alerts f
            join public.tenants t on t.id = f.tenant_id where f.status = 'open' order by f.created_at desc limit 5) x)),
    'billing', jsonb_build_object(
      'unpaid_invoices', (select count(*) from public.subscription_invoices where status = 'unpaid'),
      'unpaid_usd', (select coalesce(sum(amount_usd), 0) from public.subscription_invoices where status = 'unpaid'),
      'overdue_invoices', (select count(*) from public.subscription_invoices where status = 'unpaid' and due_date < now()),
      'expiring_3d', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select t.id, t.name, s.status, coalesce(case when s.status = 'trialing' then s.trial_ends_at end, s.current_period_end) as ends_at
            from public.subscriptions s join public.tenants t on t.id = s.tenant_id
           where (s.status = 'trialing' and s.trial_ends_at between now() and now() + interval '3 days')
              or (s.status in ('active', 'past_due') and s.current_period_end between now() and now() + interval '3 days')
           order by 4 limit 20) x),
      'past_due', (select count(*) from public.subscriptions where status = 'past_due'),
      'expired', (select count(*) from public.subscriptions where status = 'expired')),
    'growth', jsonb_build_object(
      'tenants_total', (select count(*) from public.tenants),
      'new_tenants_24h', (select count(*) from public.tenants where created_at > now() - interval '24 hours'),
      'new_users_24h', (select count(*) from auth.users where created_at > now() - interval '24 hours'),
      'new_leads', (select count(*) from public.leads where status = 'new'),
      'tickets_open', (select count(*) from public.support_tickets where status <> 'closed')),
    'messages', jsonb_build_object(
      'failed_24h', (select count(*) from public.message_outbox where status = 'failed' and created_at > now() - interval '24 hours'),
      'not_configured_24h', (select count(*) from public.message_outbox where status = 'not_configured' and created_at > now() - interval '24 hours'),
      'queued_old', (select count(*) from public.message_outbox where status = 'queued' and created_at < now() - interval '1 hour')),
    'security_events_24h', (select count(*) from public.security_events where created_at > now() - interval '24 hours'),
    'cron', v_cron
  );
end $$;

revoke execute on function public.admin_monitoring() from public, anon;
grant execute on function public.admin_monitoring() to authenticated;
