-- =====================================================================
-- 0003 : paiements, caisses, recettes, dépenses, rapprochement
-- =====================================================================

create type public.payment_method as enum ('cash', 'orange_money', 'airtel_money', 'mpesa', 'bank', 'card');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'cancelled', 'refunded');

create or replace function public.to_base(p_tenant uuid, p_amount numeric, p_currency text) returns numeric
language sql stable security definer set search_path = public as $$
  select case
    when p_currency = t.base_currency then p_amount
    when t.base_currency = 'USD' and p_currency = 'CDF' then round(p_amount / t.cdf_per_usd, 2)
    when t.base_currency = 'CDF' and p_currency = 'USD' then round(p_amount * t.cdf_per_usd, 2)
    else p_amount end
  from public.tenants t where t.id = p_tenant
$$;

create or replace function public.gen_reference(p_prefix text) returns text
language sql volatile as $$
  select p_prefix || '-' || to_char(now() at time zone 'Africa/Kinshasa', 'YYMMDD') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
$$;

-- ---------------------------------------------------------------------
-- Caisses (multi-caisses en Standard+)
-- ---------------------------------------------------------------------
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  register_name text not null default 'Caisse principale',
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by uuid not null default auth.uid(),
  opened_at timestamptz not null default now(),
  opening_float numeric(14,2) not null default 0 check (opening_float >= 0),
  closed_by uuid,
  closed_at timestamptz,
  counted_cash numeric(14,2),
  expected_cash numeric(14,2),
  electronic_total numeric(14,2),
  difference numeric(14,2),
  notes text
);
create index on public.cash_sessions (tenant_id, status);

create or replace function public.cash_session_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'open'; new.opened_by := auth.uid(); new.opened_at := now();
    new.closed_at := null; new.counted_cash := null; new.expected_cash := null; new.difference := null;
    if not public.tenant_has_feature(new.tenant_id, 'multi_cash') and exists (
      select 1 from public.cash_sessions where tenant_id = new.tenant_id and status = 'open') then
      raise exception 'Une caisse est déjà ouverte. La gestion multi-caisses est disponible à partir de la formule Standard.';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'closed' then raise exception 'Caisse déjà clôturée'; end if;
    if new.status = 'closed' and current_setting('ostapaul.closing', true) is distinct from 'on' then
      raise exception 'Utilisez la fonction de clôture de caisse';
    end if;
  end if;
  return new;
end $$;
create trigger cash_sessions_rules before insert or update on public.cash_sessions
  for each row execute function public.cash_session_rules();
select public.apply_tenant_rls('cash_sessions', 'cash.manage');

-- ---------------------------------------------------------------------
-- Paiements (toutes sources : commandes, frais scolaires, factures, abonnements)
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reference text not null unique default public.gen_reference('PAY'),
  receipt_number text unique,
  receipt_token text not null unique default public.gen_token(),
  payable_type text not null check (payable_type in ('order', 'student_invoice', 'sales_document', 'subscription_invoice', 'other')),
  payable_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  payer_name text,
  payer_phone text,
  provider text,
  provider_ref text,
  failure_reason text,
  cash_session_id uuid references public.cash_sessions(id),
  recorded_by uuid default auth.uid(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (provider, provider_ref)
);
create index on public.payments (tenant_id, created_at desc);
create index on public.payments (payable_type, payable_id);
create index on public.payments (tenant_id, status, method);

-- Journal brut des notifications prestataires (webhooks) — service_role uniquement
create table public.payment_events (
  id bigserial primary key,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null,
  event_type text not null,
  verified boolean not null default false,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;

-- Règles d'intégrité des paiements :
--  * un paiement électronique ne peut être marqué « réussi » que par le serveur
--    (service_role) après confirmation du prestataire ;
--  * un paiement en espèces est enregistré par un caissier autorisé, rattaché à une caisse ouverte ;
--  * un paiement réussi est immuable (sauf remboursement par le serveur).
create or replace function public.payment_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_server boolean := public.jwt_role() = 'service_role';
  v_sess record;
begin
  if tg_op = 'INSERT' then
    if new.payable_type = 'subscription_invoice' and not v_server and not public.is_platform_admin() then
      raise exception 'Les paiements d''abonnement passent par le module de facturation' using errcode = '42501';
    end if;
    if new.method = 'cash' then
      if not v_server and not public.is_platform_admin() and not public.has_perm(new.tenant_id, 'payments.cash') then
        raise exception 'Permission « encaissement » requise' using errcode = '42501';
      end if;
      if new.payable_type <> 'subscription_invoice' then
        if new.cash_session_id is null then
          select id into new.cash_session_id from public.cash_sessions
           where tenant_id = new.tenant_id and status = 'open'
           order by (opened_by = auth.uid()) desc, opened_at desc limit 1;
        end if;
        select * into v_sess from public.cash_sessions where id = new.cash_session_id;
        if v_sess.id is null or v_sess.status <> 'open' or v_sess.tenant_id <> new.tenant_id then
          raise exception 'Aucune caisse ouverte : ouvrez une caisse avant d''encaisser des espèces';
        end if;
      end if;
      new.status := 'succeeded';
      new.paid_at := now();
      new.recorded_by := auth.uid();
      new.provider := 'cash';
    else
      if not v_server then
        new.status := 'pending';
        new.paid_at := null;
      end if;
    end if;
    if new.status = 'succeeded' and new.receipt_number is null then
      new.receipt_number := public.gen_reference('REC');
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'succeeded' and not v_server then
    raise exception 'Un paiement confirmé ne peut pas être modifié' using errcode = '42501';
  end if;
  if not v_server then
    -- côté client : seule l'annulation d'un paiement en attente est permise
    if new.status not in ('pending', 'cancelled') or new.amount <> old.amount or new.method <> old.method
       or new.payable_id is distinct from old.payable_id or new.currency <> old.currency then
      raise exception 'Modification non autorisée du paiement' using errcode = '42501';
    end if;
  end if;
  if new.status = 'succeeded' and old.status <> 'succeeded' then
    new.paid_at := coalesce(new.paid_at, now());
    new.receipt_number := coalesce(new.receipt_number, public.gen_reference('REC'));
  end if;
  return new;
end $$;
create trigger payments_rules before insert or update on public.payments
  for each row execute function public.payment_rules();
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

create or replace function public.block_payment_delete() returns trigger
language plpgsql as $$
begin
  if public.jwt_role() <> 'service_role' then
    raise exception 'La suppression d''un paiement est interdite (traçabilité)' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger payments_no_delete before delete on public.payments
  for each row execute function public.block_payment_delete();

alter table public.payments enable row level security;
create policy payments_sel on public.payments for select using (public.can_read(tenant_id));
create policy payments_ins on public.payments for insert with check (
  public.tenant_is_active(tenant_id) and (public.has_perm(tenant_id, 'payments.cash') or public.has_perm(tenant_id, 'orders.write')
    or public.has_perm(tenant_id, 'fees.write') or public.has_perm(tenant_id, 'sales.write'))
  and (method = 'cash' or public.tenant_has_feature(tenant_id, 'payments_mobile'))
);
create policy payments_upd on public.payments for update using (public.has_perm(tenant_id, 'payments.cash') and status = 'pending')
  with check (public.has_perm(tenant_id, 'payments.cash'));
create policy payments_admin on public.payments for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Détection anti-fraude sur paiements : doublons et montants inhabituels
create or replace function public.payment_fraud_checks() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dup int;
  v_avg numeric;
begin
  if new.payable_type = 'subscription_invoice' then return new; end if;
  select count(*) into v_dup from public.payments p
   where p.tenant_id = new.tenant_id and p.id <> new.id and p.status in ('pending', 'succeeded')
     and p.amount = new.amount and p.currency = new.currency
     and p.payable_id is not distinct from new.payable_id
     and coalesce(p.payer_phone, '') = coalesce(new.payer_phone, '')
     and p.created_at > now() - interval '10 minutes';
  if v_dup > 0 and new.payable_id is not null then
    perform public.raise_fraud_alert(new.tenant_id, 'duplicate_payment', 'high', 'Doublon de paiement probable',
      jsonb_build_object('reference', new.reference, 'amount', new.amount, 'currency', new.currency, 'method', new.method),
      'payments', new.id::text);
  end if;
  select avg(amount) into v_avg from (
    select amount from public.payments where tenant_id = new.tenant_id and status = 'succeeded'
      and currency = new.currency and id <> new.id order by created_at desc limit 200) s;
  if v_avg is not null and v_avg > 0 and new.amount > v_avg * 10 and new.amount > 100 then
    perform public.raise_fraud_alert(new.tenant_id, 'unusual_amount', 'medium', 'Montant de paiement inhabituel',
      jsonb_build_object('reference', new.reference, 'amount', new.amount, 'average', round(v_avg, 2)),
      'payments', new.id::text);
  end if;
  return new;
end $$;
create trigger payments_fraud after insert on public.payments
  for each row execute function public.payment_fraud_checks();

-- ---------------------------------------------------------------------
-- Recettes diverses et dépenses
-- ---------------------------------------------------------------------
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null default 'Divers',
  description text,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  income_date date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.incomes (tenant_id, income_date);
select public.apply_tenant_rls('incomes', 'finance.write', null, 'finance.read');
select public.attach_audit('incomes');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('suppliers', 'stock.write');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null default 'Divers',
  description text,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  expense_date date not null default current_date,
  payment_method public.payment_method not null default 'cash',
  status text not null default 'paid' check (status in ('paid', 'unpaid')),
  due_date date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  receipt_path text,
  source text not null default 'manual' check (source in ('manual', 'ocr', 'purchase', 'payroll')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.expenses (tenant_id, expense_date);
select public.apply_tenant_rls('expenses', 'finance.write', null, 'finance.read');
select public.attach_audit('expenses');

create or replace function public.expense_fraud_checks() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_avg numeric;
begin
  select avg(amount) into v_avg from (select amount from public.expenses
    where tenant_id = new.tenant_id and currency = new.currency and id <> new.id
    order by created_at desc limit 100) s;
  if v_avg is not null and new.amount > v_avg * 5 and new.amount > 50 then
    perform public.raise_fraud_alert(new.tenant_id, 'unusual_expense', 'medium', 'Dépense inhabituellement élevée',
      jsonb_build_object('amount', new.amount, 'currency', new.currency, 'average', round(v_avg, 2), 'category', new.category),
      'expenses', new.id::text);
  end if;
  if tg_op = 'UPDATE' and old.amount <> new.amount and old.created_at < now() - interval '24 hours' then
    perform public.raise_fraud_alert(new.tenant_id, 'suspicious_edit', 'medium', 'Modification d''une dépense ancienne',
      jsonb_build_object('old_amount', old.amount, 'new_amount', new.amount, 'by', auth.uid()), 'expenses', new.id::text);
  end if;
  return new;
end $$;
create trigger expenses_fraud after insert or update on public.expenses
  for each row execute function public.expense_fraud_checks();

-- ---------------------------------------------------------------------
-- Clôture de caisse + détection des écarts
-- ---------------------------------------------------------------------
create or replace function public.close_cash_session(p_session uuid, p_counted numeric, p_notes text default null)
returns public.cash_sessions language plpgsql security definer set search_path = public as $$
declare
  s public.cash_sessions;
  v_cash numeric;
  v_elec numeric;
  v_threshold numeric;
begin
  select * into s from public.cash_sessions where id = p_session for update;
  if s.id is null then raise exception 'Caisse introuvable'; end if;
  if not public.can_write(s.tenant_id, 'cash.manage') then raise exception 'Permission refusée' using errcode = '42501'; end if;
  if s.status = 'closed' then raise exception 'Caisse déjà clôturée'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Montant compté invalide'; end if;

  select coalesce(sum(case when currency = s.currency then amount else 0 end), 0) into v_cash
    from public.payments where cash_session_id = s.id and status = 'succeeded' and method = 'cash';
  select coalesce(sum(public.to_base(s.tenant_id, amount, currency)), 0) into v_elec
    from public.payments where tenant_id = s.tenant_id and status = 'succeeded' and method <> 'cash'
      and paid_at between s.opened_at and now() and payable_type <> 'subscription_invoice';

  perform set_config('ostapaul.closing', 'on', true);
  update public.cash_sessions set
    status = 'closed', closed_by = auth.uid(), closed_at = now(), counted_cash = p_counted,
    expected_cash = s.opening_float + v_cash, electronic_total = v_elec,
    difference = p_counted - (s.opening_float + v_cash), notes = p_notes
  where id = s.id returning * into s;
  perform set_config('ostapaul.closing', 'off', true);

  v_threshold := coalesce((select (settings ->> 'cash_tolerance')::numeric from public.tenants where id = s.tenant_id), 1);
  if abs(s.difference) > v_threshold then
    perform public.raise_fraud_alert(s.tenant_id, 'cash_difference', case when abs(s.difference) > v_threshold * 20 then 'high' else 'medium' end,
      'Écart de caisse à la clôture',
      jsonb_build_object('register', s.register_name, 'expected', s.expected_cash, 'counted', s.counted_cash,
                         'difference', s.difference, 'currency', s.currency),
      'cash_sessions', s.id::text);
  end if;
  return s;
end $$;

-- ---------------------------------------------------------------------
-- Rapports financiers
-- ---------------------------------------------------------------------
-- granularité : 'day' | 'week' | 'month' | 'year' ; montants convertis en devise de base
create or replace function public.finance_summary(p_tenant uuid, p_from date, p_to date, p_granularity text default 'day')
returns table (period date, revenue numeric, expenses numeric, profit numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_perm(p_tenant, 'finance.read') or public.has_perm(p_tenant, 'reports.read') or public.is_platform_admin()) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  if p_granularity not in ('day', 'week', 'month', 'year') then raise exception 'Granularité invalide'; end if;
  return query
  with rev as (
    select date_trunc(p_granularity, (p.paid_at at time zone 'Africa/Kinshasa'))::date as d,
           sum(public.to_base(p_tenant, p.amount, p.currency)) as v
      from public.payments p
     where p.tenant_id = p_tenant and p.status = 'succeeded' and p.payable_type <> 'subscription_invoice'
       and (p.paid_at at time zone 'Africa/Kinshasa')::date between p_from and p_to
     group by 1
    union all
    select date_trunc(p_granularity, i.income_date)::date, sum(public.to_base(p_tenant, i.amount, i.currency))
      from public.incomes i where i.tenant_id = p_tenant and i.income_date between p_from and p_to group by 1
  ), exp as (
    select date_trunc(p_granularity, e.expense_date)::date as d, sum(public.to_base(p_tenant, e.amount, e.currency)) as v
      from public.expenses e where e.tenant_id = p_tenant and e.expense_date between p_from and p_to group by 1
  ), periods as (
    select d from rev union select d from exp
  )
  select pr.d,
         coalesce((select sum(v) from rev where rev.d = pr.d), 0)::numeric(14,2),
         coalesce((select sum(v) from exp where exp.d = pr.d), 0)::numeric(14,2),
         (coalesce((select sum(v) from rev where rev.d = pr.d), 0) - coalesce((select sum(v) from exp where exp.d = pr.d), 0))::numeric(14,2)
    from periods pr order by pr.d;
end $$;

-- Caisse intelligente : comparaison espèces vs électronique + anomalies de rapprochement
create or replace function public.reconciliation_report(p_tenant uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public.has_perm(p_tenant, 'finance.read') or public.is_platform_admin()) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'by_method', coalesce((select jsonb_agg(x) from (
        select method, currency, status, count(*) as count, sum(amount) as total
          from public.payments
         where tenant_id = p_tenant and payable_type <> 'subscription_invoice'
           and (created_at at time zone 'Africa/Kinshasa')::date between p_from and p_to
         group by 1, 2, 3 order by 1, 2, 3) x), '[]'::jsonb),
    'stale_pending', coalesce((select jsonb_agg(x) from (
        select reference, method, amount, currency, created_at from public.payments
         where tenant_id = p_tenant and status = 'pending' and created_at < now() - interval '30 minutes'
           and (created_at at time zone 'Africa/Kinshasa')::date between p_from and p_to
         order by created_at limit 100) x), '[]'::jsonb),
    'cash_sessions', coalesce((select jsonb_agg(x) from (
        select id, register_name, currency, opened_at, closed_at, opening_float, expected_cash, counted_cash,
               electronic_total, difference, status
          from public.cash_sessions
         where tenant_id = p_tenant and (opened_at at time zone 'Africa/Kinshasa')::date between p_from and p_to
         order by opened_at desc) x), '[]'::jsonb),
    'total_cash', (select coalesce(sum(public.to_base(p_tenant, amount, currency)), 0) from public.payments
         where tenant_id = p_tenant and status = 'succeeded' and method = 'cash' and payable_type <> 'subscription_invoice'
           and (paid_at at time zone 'Africa/Kinshasa')::date between p_from and p_to),
    'total_electronic', (select coalesce(sum(public.to_base(p_tenant, amount, currency)), 0) from public.payments
         where tenant_id = p_tenant and status = 'succeeded' and method <> 'cash' and payable_type <> 'subscription_invoice'
           and (paid_at at time zone 'Africa/Kinshasa')::date between p_from and p_to),
    'total_cash_difference', (select coalesce(sum(difference), 0) from public.cash_sessions
         where tenant_id = p_tenant and status = 'closed' and (opened_at at time zone 'Africa/Kinshasa')::date between p_from and p_to)
  ) into v;
  return v;
end $$;

-- Vérification publique d'un reçu via QR (infos minimales, aucune donnée sensible)
create or replace function public.verify_receipt(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'valid', p.status = 'succeeded',
    'status', p.status,
    'reference', p.reference,
    'receipt_number', p.receipt_number,
    'amount', p.amount,
    'currency', p.currency,
    'method', p.method,
    'paid_at', p.paid_at,
    'establishment', t.name)
  from public.payments p join public.tenants t on t.id = p.tenant_id
  where p.receipt_token = p_token and length(p_token) >= 32
$$;
