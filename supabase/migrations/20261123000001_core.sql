-- =====================================================================
-- OSTAPAUL MANAGER — 0001 CORE : multi-tenant, rôles, abonnements
-- =====================================================================
-- Principes :
--  * Chaque ligne métier porte un tenant_id (établissement).
--  * L'isolation est appliquée par Row Level Security (RLS) côté Postgres.
--  * Les droits sont dérivés du rôle du membre + permissions fines (Premium).
--  * L'accès en écriture exige un abonnement actif (ou essai en cours).
-- =====================================================================

create type public.sector as enum ('restaurant', 'school', 'pme');
create type public.plan_tier as enum ('basic', 'standard', 'premium');
create type public.member_role as enum (
  'owner', 'admin', 'manager', 'accountant', 'cashier', 'waiter', 'cook',
  'teacher', 'secretary', 'staff', 'viewer'
);
create type public.sub_status as enum ('trialing', 'active', 'past_due', 'expired', 'canceled');

-- Jeton aléatoire non devinable (122 bits) pour QR codes, sans extension.
create or replace function public.gen_token() returns text
language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
$$;

-- Rôle JWT courant ('anon', 'authenticated', 'service_role').
create or replace function public.jwt_role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'none'
  )
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Paramètres de la plateforme (ligne unique)
-- ---------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  trial_hours int not null default 48 check (trial_hours between 0 and 2160),
  grace_days int not null default 3 check (grace_days between 0 and 60),
  cdf_per_usd numeric(14,4) not null default 2800,
  support_email text,
  support_phone text,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  title text not null default 'Super Administrateur',
  phone text,
  email text,
  photo_url text,
  address text,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- Profils utilisateurs
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  locale text not null default 'fr' check (locale in ('fr', 'ln')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Formules d'abonnement
-- ---------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  sector public.sector not null,
  tier public.plan_tier not null,
  name text not null,
  price_usd numeric(10,2) not null check (price_usd >= 0),
  max_extra_users int, -- null = politique d'usage raisonnable
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  unique (sector, tier)
);

-- ---------------------------------------------------------------------
-- Établissements (tenants)
-- ---------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  sector public.sector not null,
  name text not null check (length(name) between 2 and 120),
  parent_id uuid references public.tenants(id) on delete set null,
  owner_id uuid not null references auth.users(id),
  logo_url text,
  address text,
  city text default 'Kinshasa',
  country text not null default 'CD',
  phone text,
  email text,
  base_currency text not null default 'USD' check (base_currency in ('USD', 'CDF')),
  cdf_per_usd numeric(14,4) not null default 2800 check (cdf_per_usd > 0),
  locale text not null default 'fr' check (locale in ('fr', 'ln')),
  public_token text not null unique default public.gen_token(),
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_reason text,
  settings jsonb not null default '{}'::jsonb,
  brand_color text default '#0B1F4B',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tenants (owner_id);
create index on public.tenants (parent_id);
create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null default 'viewer',
  permissions text[] not null default '{}',
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status public.sub_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  number text not null unique,
  amount_usd numeric(10,2) not null check (amount_usd >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  due_date timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.subscription_invoices (tenant_id, status);

-- ---------------------------------------------------------------------
-- Fonctions d'autorisation (security definer => pas de récursion RLS)
-- ---------------------------------------------------------------------
create or replace function public.user_tenant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.tenant_id from public.memberships m
  where m.user_id = auth.uid() and m.is_active
$$;

create or replace function public.member_role_of(p_tenant uuid) returns public.member_role
language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m
  where m.user_id = auth.uid() and m.tenant_id = p_tenant and m.is_active
$$;

create or replace function public.is_member(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.tenant_id = p_tenant and m.is_active)
$$;

-- Abonnement en vigueur ? (calculé en temps réel : pas de dépendance au cron)
create or replace function public.tenant_is_active(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tenants t
    join public.subscriptions s on s.tenant_id = coalesce(t.parent_id, t.id) -- succursale : abonnement du siège
    join public.tenants root on root.id = s.tenant_id
    cross join public.platform_settings ps
    where t.id = p_tenant
      and t.status = 'active' and root.status = 'active'
      and (
        (s.status = 'trialing' and s.trial_ends_at > now())
        or (s.status = 'active' and s.current_period_end > now())
        or (s.status = 'past_due' and s.current_period_end + make_interval(days => ps.grace_days) > now())
      )
  )
$$;

create or replace function public.tenant_plan(p_tenant uuid) returns public.plans
language sql stable security definer set search_path = public as $$
  select p.* from public.tenants t
    join public.subscriptions s on s.tenant_id = coalesce(t.parent_id, t.id)
    join public.plans p on p.id = s.plan_id
  where t.id = p_tenant
$$;

create or replace function public.tenant_has_feature(p_tenant uuid, p_feature text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.tenant_is_active(p_tenant) and coalesce(p_feature = any ((public.tenant_plan(p_tenant)).features), false)
$$;

-- Permissions par défaut de chaque rôle.
create or replace function public.default_role_permissions(p_role public.member_role) returns text[]
language sql immutable as $$
  select case p_role
    when 'owner' then array['*']
    when 'admin' then array['*']
    when 'manager' then array['orders.write','tables.write','menu.write','kitchen.write','stock.write',
      'finance.read','finance.write','payments.cash','cash.manage','hr.read','hr.write','attendance.scan',
      'attendance.read','academic.read','academic.write','grades.write','fees.read','fees.write','sales.read',
      'sales.write','customers.write','reports.read','audit.read','notifications.send','cards.manage','ai.use','ocr.use']
    when 'accountant' then array['finance.read','finance.write','payments.cash','cash.manage','fees.read',
      'fees.write','sales.read','sales.write','reports.read','hr.read','stock.read','ai.use','ocr.use']
    when 'cashier' then array['orders.write','payments.cash','cash.manage','fees.read','sales.read','finance.read']
    when 'waiter' then array['orders.write','tables.write']
    when 'cook' then array['kitchen.write']
    when 'teacher' then array['academic.read','grades.write','attendance.scan','attendance.read']
    when 'secretary' then array['academic.read','academic.write','fees.read','attendance.scan','attendance.read',
      'customers.write','notifications.send','cards.manage','hr.read']
    when 'staff' then array['attendance.scan','stock.read']
    when 'viewer' then array['reports.read']
  end
$$;

create or replace function public.has_perm(p_tenant uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant and m.is_active
      and (
        '*' = any (public.default_role_permissions(m.role))
        or p_perm = any (public.default_role_permissions(m.role))
        -- Permissions fines personnalisées : formule Premium uniquement
        or (p_perm = any (m.permissions) and public.tenant_has_feature(p_tenant, 'permissions_advanced'))
      )
  )
$$;

-- Écriture autorisée = permission + abonnement actif.
create or replace function public.can_write(p_tenant uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_perm(p_tenant, p_perm) and public.tenant_is_active(p_tenant)
$$;

-- Lecture : membres de l'établissement (et super admin).
create or replace function public.can_read(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(p_tenant) or public.is_platform_admin()
$$;

-- ---------------------------------------------------------------------
-- Limite d'utilisateurs selon la formule
-- ---------------------------------------------------------------------
create or replace function public.enforce_user_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_count int;
  v_email text := '';
begin
  if public.jwt_role() = 'service_role' then return new; end if;
  if tg_table_name = 'memberships' then
    select lower(email) into v_email from auth.users where id = new.user_id;
  end if;
  select (public.tenant_plan(new.tenant_id)).max_extra_users into v_max;
  if v_max is null then return new; end if; -- usage raisonnable
  select (select count(*) from public.memberships m
           where m.tenant_id = new.tenant_id and m.role <> 'owner' and m.is_active
             and (tg_table_name <> 'memberships' or m.id <> new.id))
       + (select count(*) from public.invitations i
           where i.tenant_id = new.tenant_id and i.accepted_at is null
             and lower(i.email) <> coalesce(v_email, '')
             and (tg_table_name <> 'invitations' or i.id <> new.id))
    into v_count;
  if tg_table_name = 'memberships' then
    if new.role = 'owner' then return new; end if;
  end if;
  if v_count + 1 > v_max then
    raise exception 'Limite de % utilisateur(s) supplémentaire(s) atteinte pour votre formule. Passez à une formule supérieure.', v_max
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger memberships_user_limit before insert on public.memberships
  for each row execute function public.enforce_user_limit();
create trigger invitations_user_limit before insert on public.invitations
  for each row execute function public.enforce_user_limit();

-- ---------------------------------------------------------------------
-- RLS du noyau
-- ---------------------------------------------------------------------
alter table public.platform_settings enable row level security;
alter table public.platform_admins enable row level security;
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;

create policy settings_read on public.platform_settings for select using (true);
create policy settings_admin on public.platform_settings for update using (public.is_platform_admin());

create policy padmin_self on public.platform_admins for select using (user_id = auth.uid() or public.is_platform_admin());
create policy padmin_update on public.platform_admins for update using (user_id = auth.uid());

create policy profiles_self on public.profiles for select using (
  id = auth.uid() or public.is_platform_admin()
  or exists (select 1 from public.memberships m
             where m.user_id = profiles.id and m.tenant_id in (select public.user_tenant_ids()))
);
create policy profiles_update on public.profiles for update using (id = auth.uid());

create policy plans_public on public.plans for select using (is_active or public.is_platform_admin());
create policy plans_admin_all on public.plans for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy tenants_read on public.tenants for select using (public.can_read(id));
create policy tenants_update on public.tenants for update
  using (public.has_perm(id, 'settings.write'))
  with check (public.has_perm(id, 'settings.write'));
-- insertion uniquement via create_tenant()

create policy memberships_read on public.memberships for select using (public.can_read(tenant_id));
create policy memberships_write on public.memberships for update
  using (public.has_perm(tenant_id, 'users.manage') and role <> 'owner')
  with check (public.has_perm(tenant_id, 'users.manage') and role <> 'owner');
create policy memberships_delete on public.memberships for delete
  using (public.has_perm(tenant_id, 'users.manage') and role <> 'owner');

create policy invitations_read on public.invitations for select using (public.can_read(tenant_id));
create policy invitations_insert on public.invitations for insert
  with check (public.can_write(tenant_id, 'users.manage') and role <> 'owner');
create policy invitations_delete on public.invitations for delete using (public.has_perm(tenant_id, 'users.manage'));

create policy subs_read on public.subscriptions for select using (public.can_read(tenant_id));
create policy subinv_read on public.subscription_invoices for select using (public.can_read(tenant_id));
create policy subinv_admin on public.subscription_invoices for all using (public.is_platform_admin()) with check (public.is_platform_admin());
