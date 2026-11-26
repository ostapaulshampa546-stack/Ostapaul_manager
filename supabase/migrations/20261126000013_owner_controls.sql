-- =====================================================================
-- 0013 : contrôle total du propriétaire de la plateforme
--  1. Permissions de chaque rôle modifiables par le super admin
--  2. Règles de blocage des connexions et textes du site réglables
--  3. Mode assistance : le super admin peut obtenir un accès complet
--     à un établissement (journalisé et notifié au propriétaire)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permissions des rôles
-- ---------------------------------------------------------------------
create table public.platform_role_permissions (
  role public.member_role primary key check (role not in ('owner', 'admin')),
  permissions text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.platform_role_permissions enable row level security;
create policy rolep_read on public.platform_role_permissions for select using (auth.uid() is not null);
create policy rolep_admin on public.platform_role_permissions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Permissions effectives d'un rôle : réglage du super admin, sinon valeurs par défaut
create or replace function public.role_permissions(p_role public.member_role) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r.permissions from public.platform_role_permissions r where r.role = p_role and p_role not in ('owner', 'admin')),
    public.default_role_permissions(p_role))
$$;

create or replace function public.has_perm(p_tenant uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant and m.is_active
      and (
        '*' = any (public.role_permissions(m.role))
        or p_perm = any (public.role_permissions(m.role))
        or (p_perm = any (m.permissions) and public.tenant_has_feature(p_tenant, 'permissions_advanced'))
      )
  )
$$;

-- ---------------------------------------------------------------------
-- 2. Réglages de la plateforme
-- ---------------------------------------------------------------------
alter table public.platform_settings
  add column login_max_attempts int not null default 4 check (login_max_attempts between 3 and 20),
  add column login_lock_minutes int not null default 60 check (login_lock_minutes between 5 and 1440),
  add column site_hero_title text check (length(site_hero_title) <= 160),
  add column site_hero_subtitle text check (length(site_hero_subtitle) <= 600),
  add column site_announcement text check (length(site_announcement) <= 240);

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
     where ip = p_ip and not success and created_at > now() - c_window;
  end if;

  if v_failures >= c_max then
    v_until := v_last_failure + c_window;
  elsif v_ip_failures >= c_max * 5 then
    v_until := (select max(created_at) from public.login_attempts where ip = p_ip and not success) + c_window;
  end if;

  return jsonb_build_object(
    'blocked', v_until is not null and v_until > now(),
    'retry_after_seconds', case when v_until > now() then ceil(extract(epoch from v_until - now()))::int else 0 end,
    'remaining', greatest(c_max - v_failures, 0),
    'max_attempts', c_max,
    'lock_minutes', extract(epoch from c_window)::int / 60);
end $$;

-- ---------------------------------------------------------------------
-- 3. Mode assistance du super admin
-- ---------------------------------------------------------------------
alter table public.memberships add column support_access boolean not null default false;

-- Les accès d'assistance ne comptent pas dans la limite d'utilisateurs de la formule
create or replace function public.enforce_user_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_count int;
  v_email text := '';
begin
  if public.jwt_role() = 'service_role' then return new; end if;
  if tg_table_name = 'memberships' then
    if new.role = 'owner' or new.support_access then return new; end if;
    select lower(email) into v_email from auth.users where id = new.user_id;
  end if;
  select (public.tenant_plan(new.tenant_id)).max_extra_users into v_max;
  if v_max is null then return new; end if;
  select (select count(*) from public.memberships m
           where m.tenant_id = new.tenant_id and m.role <> 'owner' and m.is_active and not m.support_access
             and (tg_table_name <> 'memberships' or m.id <> new.id))
       + (select count(*) from public.invitations i
           where i.tenant_id = new.tenant_id and i.accepted_at is null
             and lower(i.email) <> coalesce(v_email, '')
             and (tg_table_name <> 'invitations' or i.id <> new.id))
    into v_count;
  if v_count + 1 > v_max then
    raise exception 'Limite de % utilisateur(s) supplémentaire(s) atteinte pour votre formule. Passez à une formule supérieure.', v_max
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.change_plan(p_tenant uuid, p_tier public.plan_tier) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tenants; p public.plans; sub public.subscriptions; v_users int;
begin
  select * into t from public.tenants where id = p_tenant;
  if t.id is null or t.owner_id <> auth.uid() then raise exception 'Seul le propriétaire peut changer de formule' using errcode = '42501'; end if;
  if t.parent_id is not null then raise exception 'Changez la formule depuis l''établissement principal'; end if;
  select * into p from public.plans where sector = t.sector and tier = p_tier and is_active;
  if p.id is null then raise exception 'Formule introuvable'; end if;
  select count(*) into v_users from public.memberships where tenant_id = p_tenant and role <> 'owner' and is_active and not support_access;
  if p.max_extra_users is not null and v_users > p.max_extra_users then
    raise exception 'Cette formule autorise % utilisateur(s) supplémentaire(s) ; vous en avez %. Désactivez des comptes d''abord.', p.max_extra_users, v_users;
  end if;
  if p_tier <> 'premium' and exists (select 1 from public.tenants where parent_id = p_tenant) then
    raise exception 'Vos succursales nécessitent la formule Premium';
  end if;
  select * into sub from public.subscriptions where tenant_id = p_tenant for update;
  update public.subscriptions set plan_id = p.id where id = sub.id;
  update public.subscription_invoices set status = 'void' where subscription_id = sub.id and status = 'unpaid';
  perform public.notify_tenant(p_tenant, 'billing', 'Formule modifiée : ' || p.name, 'Nouveau tarif : ' || p.price_usd || ' USD / mois.', '/subscription');
end $$;

-- Active / désactive l'accès complet du super admin à un établissement
create or replace function public.admin_support_access(p_tenant uuid, p_enable boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_existing public.memberships; v_name text;
begin
  if not public.is_platform_admin() then raise exception 'Réservé au super administrateur' using errcode = '42501'; end if;
  select * into v_existing from public.memberships where tenant_id = p_tenant and user_id = auth.uid();
  if v_existing.id is not null and not v_existing.support_access then
    raise exception 'Vous êtes déjà membre de cet établissement avec votre propre rôle';
  end if;
  if p_enable then
    if v_existing.id is null then
      insert into public.memberships (tenant_id, user_id, role, support_access) values (p_tenant, auth.uid(), 'admin', true);
    else
      update public.memberships set is_active = true, role = 'admin' where id = v_existing.id;
    end if;
  elsif v_existing.id is not null then
    update public.memberships set is_active = false where id = v_existing.id;
  end if;
  select coalesce(full_name, 'L''équipe OSTAPAUL') into v_name from public.platform_admins where user_id = auth.uid();
  insert into public.audit_logs (tenant_id, user_id, action, table_name, record_id, new_data)
  values (p_tenant, auth.uid(), case when p_enable then 'support_access_on' else 'support_access_off' end, 'memberships', p_tenant::text,
          jsonb_build_object('reason', left(p_reason, 300)));
  perform public.notify_tenant(p_tenant, 'admin',
    case when p_enable then 'Accès assistance OSTAPAUL activé' else 'Accès assistance OSTAPAUL terminé' end,
    case when p_enable then v_name || ' (OSTAPAUL MANAGER) a accédé à votre établissement pour assistance' || coalesce(' : ' || p_reason, '.')
         || ' Vous pouvez retirer cet accès dans Utilisateurs.'
         else v_name || ' a quitté votre établissement.' end, '/users');
end $$;

-- Le propriétaire ne doit pas pouvoir être rétrogradé par le mode assistance : règles d'écriture inchangées.
revoke execute on function public.admin_support_access(uuid, boolean, text) from public, anon;
grant execute on function public.admin_support_access(uuid, boolean, text), public.role_permissions(public.member_role) to authenticated;
