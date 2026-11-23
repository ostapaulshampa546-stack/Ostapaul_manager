-- =====================================================================
-- 0002 : journalisation, notifications, anti-fraude, assistance,
--        automatisations + utilitaire de génération des politiques RLS
-- =====================================================================

-- Génère les politiques RLS standard d'une table métier :
--  SELECT : membres (+ super admin) [+ permission de lecture optionnelle]
--  INSERT/UPDATE/DELETE : permission d'écriture + abonnement actif [+ fonctionnalité]
create or replace function public.apply_tenant_rls(
  p_table text, p_write_perm text, p_feature text default null, p_read_perm text default null
) returns void language plpgsql as $$
declare
  v_feat text := case when p_feature is null then '' else format(' and public.tenant_has_feature(tenant_id, %L)', p_feature) end;
  v_read text := case when p_read_perm is null then 'public.can_read(tenant_id)'
                      else format('(public.has_perm(tenant_id, %L) or public.is_platform_admin())', p_read_perm) end;
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('create policy %I on public.%I for select using (%s)', p_table || '_sel', p_table, v_read);
  execute format('create policy %I on public.%I for insert with check (public.can_write(tenant_id, %L)%s)',
                 p_table || '_ins', p_table, p_write_perm, v_feat);
  execute format('create policy %I on public.%I for update using (public.can_write(tenant_id, %L)%s) with check (public.can_write(tenant_id, %L)%s)',
                 p_table || '_upd', p_table, p_write_perm, v_feat, p_write_perm, v_feat);
  execute format('create policy %I on public.%I for delete using (public.can_write(tenant_id, %L)%s)',
                 p_table || '_del', p_table, p_write_perm, v_feat);
end $$;

-- Remplit automatiquement tenant_id/created_by si absents et empêche le changement de tenant.
create or replace function public.guard_tenant_column() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Changement d''établissement interdit' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Journal d'audit (historique des opérations)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (tenant_id, created_at desc);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_tenant := old.tenant_id; v_id := old.id::text;
  else
    v_tenant := new.tenant_id; v_id := new.id::text;
  end if;
  insert into public.audit_logs (tenant_id, user_id, action, table_name, record_id, old_data, new_data)
  values (v_tenant, auth.uid(), lower(tg_op), tg_table_name, v_id,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create or replace function public.attach_audit(p_table text) returns void language plpgsql as $$
begin
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                 p_table || '_audit', p_table);
  execute format('create trigger %I before update on public.%I for each row execute function public.guard_tenant_column()',
                 p_table || '_tenant_guard', p_table);
end $$;

alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select
  using (public.has_perm(tenant_id, 'audit.read') or public.is_platform_admin());

-- ---------------------------------------------------------------------
-- Notifications in-app et file d'envoi SMS / WhatsApp / e-mail
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- null = tous les gestionnaires
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (tenant_id, created_at desc);

alter table public.notifications enable row level security;
create policy notif_read on public.notifications for select using (
  (user_id = auth.uid()) or (user_id is null and public.has_perm(tenant_id, 'reports.read'))
);
create policy notif_mark on public.notifications for update using (
  (user_id = auth.uid()) or (user_id is null and public.has_perm(tenant_id, 'reports.read'))
);

create or replace function public.notify_tenant(p_tenant uuid, p_kind text, p_title text, p_body text, p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (tenant_id, kind, title, body, link) values (p_tenant, p_kind, p_title, p_body, p_link);
$$;

create table public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  to_address text not null,
  subject text,
  body text not null check (length(body) <= 1600),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'not_configured')),
  provider text,
  provider_ref text,
  error text,
  related_type text,
  related_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index on public.message_outbox (status, created_at);

-- SMS/WhatsApp = Premium ; e-mail = Standard (notifications)
alter table public.message_outbox enable row level security;
create policy outbox_read on public.message_outbox for select using (public.can_read(tenant_id));
create policy outbox_insert on public.message_outbox for insert with check (
  public.can_write(tenant_id, 'notifications.send')
  and status = 'queued'
  and (
    (channel in ('sms', 'whatsapp') and public.tenant_has_feature(tenant_id, 'sms_whatsapp'))
    or (channel = 'email' and public.tenant_has_feature(tenant_id, 'notifications'))
  )
);

-- ---------------------------------------------------------------------
-- Anti-fraude
-- ---------------------------------------------------------------------
create table public.fraud_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  title text not null,
  details jsonb not null default '{}'::jsonb,
  ref_table text,
  ref_id text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.fraud_alerts (tenant_id, status, created_at desc);

alter table public.fraud_alerts enable row level security;
create policy fraud_read on public.fraud_alerts for select using (public.has_perm(tenant_id, 'audit.read') or public.is_platform_admin());
create policy fraud_update on public.fraud_alerts for update using (public.has_perm(tenant_id, 'audit.read'))
  with check (public.has_perm(tenant_id, 'audit.read'));

create or replace function public.raise_fraud_alert(p_tenant uuid, p_kind text, p_severity text, p_title text,
  p_details jsonb, p_ref_table text default null, p_ref_id text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.fraud_alerts (tenant_id, kind, severity, title, details, ref_table, ref_id)
  values (p_tenant, p_kind, p_severity, p_title, coalesce(p_details, '{}'::jsonb), p_ref_table, p_ref_id);
  perform public.notify_tenant(p_tenant, 'fraud', 'Alerte sécurité : ' || p_title, p_details::text, '/alerts');
end $$;

-- Tentatives d'accès refusées signalées par le serveur applicatif (limité à 50 / utilisateur / jour)
create table public.security_events (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid,
  kind text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.security_events enable row level security;
create policy secev_read on public.security_events for select using (public.has_perm(tenant_id, 'audit.read') or public.is_platform_admin());

create or replace function public.report_access_denied(p_tenant uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null then return; end if;
  select count(*) into v_count from public.security_events
   where user_id = auth.uid() and created_at > now() - interval '1 day';
  if v_count >= 50 then return; end if;
  insert into public.security_events (tenant_id, user_id, kind, details)
  values (p_tenant, auth.uid(), 'access_denied', jsonb_build_object('action', left(p_action, 200)));
  -- 5 refus en 10 minutes => alerte
  if p_tenant is not null and public.is_member(p_tenant) and (
     select count(*) from public.security_events
      where user_id = auth.uid() and tenant_id = p_tenant and created_at > now() - interval '10 minutes') = 5 then
    perform public.raise_fraud_alert(p_tenant, 'unauthorized_access', 'high',
      'Tentatives répétées d''actions non autorisées',
      jsonb_build_object('user_id', auth.uid(), 'last_action', p_action));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Assistance technique
-- ---------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  subject text not null check (length(subject) between 3 and 200),
  body text not null check (length(body) <= 5000),
  priority text not null default 'normal' check (priority in ('normal', 'priority', 'vip')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  is_staff boolean not null default false,
  body text not null check (length(body) <= 5000),
  created_at timestamptz not null default now()
);

-- Priorité déterminée par la formule (support e-mail / prioritaire / VIP)
create or replace function public.ticket_priority() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.priority := case
    when public.tenant_has_feature(new.tenant_id, 'support_vip') then 'vip'
    when public.tenant_has_feature(new.tenant_id, 'support_priority') then 'priority'
    else 'normal' end;
  return new;
end $$;
create trigger support_ticket_priority before insert on public.support_tickets
  for each row execute function public.ticket_priority();

create or replace function public.support_message_staff() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_staff := public.is_platform_admin();
  new.author_id := auth.uid();
  update public.support_tickets set updated_at = now(),
    status = case when new.is_staff and status = 'open' then 'in_progress' else status end
  where id = new.ticket_id;
  return new;
end $$;
create trigger support_message_staff before insert on public.support_messages
  for each row execute function public.support_message_staff();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
create policy tickets_read on public.support_tickets for select using (public.can_read(tenant_id));
create policy tickets_insert on public.support_tickets for insert with check (public.is_member(tenant_id) and created_by = auth.uid());
create policy tickets_admin on public.support_tickets for update using (public.is_platform_admin() or public.has_perm(tenant_id, 'settings.write'));
create policy smsg_read on public.support_messages for select using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and public.can_read(t.tenant_id)));
create policy smsg_insert on public.support_messages for insert with check (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (public.is_member(t.tenant_id) or public.is_platform_admin())));

-- ---------------------------------------------------------------------
-- Automatisations configurables
-- ---------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('payment_reminder', 'stock_alert', 'parent_notification', 'daily_report',
                                     'subscription_renewal', 'finance_alert')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, kind)
);
alter table public.automations enable row level security;
create policy autom_read on public.automations for select using (public.can_read(tenant_id));
create policy autom_write on public.automations for update
  using (public.can_write(tenant_id, 'settings.write') and public.tenant_has_feature(tenant_id, 'notifications'))
  with check (public.can_write(tenant_id, 'settings.write') and public.tenant_has_feature(tenant_id, 'notifications'));
