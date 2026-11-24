-- =====================================================================
-- AFRILEARN — 0003 : formules et tarifs par pays, prospects (site),
-- administration de la plateforme, protection de la connexion
-- =====================================================================
create type public.plan_audience  as enum ('center', 'student');
create type public.billing_period as enum ('month', 'year');
create type public.lead_kind      as enum ('contact', 'center_demo', 'partnership');
create type public.lead_status    as enum ('new', 'in_progress', 'closed');

-- Formules : le contenu (nom, avantages, limites) est modifiable par le Super Admin.
-- AUCUN prix n'est fixé dans le code : les tarifs sont saisis par pays dans plan_prices.
create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  audience    public.plan_audience not null,
  name        text not null check (length(name) between 2 and 60),
  tagline_fr  text, tagline_en text,
  features_fr text[] not null default '{}',
  features_en text[] not null default '{}',
  limits      jsonb not null default '{}'::jsonb,
  is_free     boolean not null default false,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger plans_touch before update on public.plans for each row execute function public.touch_updated_at();

create table public.plan_prices (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.plans(id) on delete cascade,
  country_code  char(2) not null references public.countries(code),
  currency_code char(3) not null references public.currencies(code),
  period        public.billing_period not null default 'month',
  amount        numeric(14, 2) not null check (amount >= 0),
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (plan_id, country_code, period)
);
create trigger plan_prices_touch before update on public.plan_prices for each row execute function public.touch_updated_at();

alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
create policy plans_read on public.plans for select using (active or public.is_platform_admin());
create policy plans_admin on public.plans for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy plan_prices_read on public.plan_prices for select using (active or public.is_platform_admin());
create policy plan_prices_admin on public.plan_prices for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create trigger audit_plans after insert or update or delete on public.plans for each row execute function public.audit_row();
create trigger audit_plan_prices after insert or update or delete on public.plan_prices for each row execute function public.audit_row();

insert into public.plans (code, audience, name, is_free, sort_order, tagline_fr, tagline_en, features_fr, features_en, limits) values
 ('center_basic', 'center', 'Basic', false, 10,
  'Pour démarrer un petit centre', 'To get a small center started',
  array['Gestion des étudiants et enseignants', 'Classes et niveaux CECRL', 'Invitations des comptes', 'Journal des actions'],
  array['Student and teacher management', 'Classes and CEFR levels', 'Account invitations', 'Activity log'],
  '{"max_students": 100, "max_teachers": 5}'),
 ('center_professional', 'center', 'Professional', false, 20,
  'Pour les centres en croissance', 'For growing centers',
  array['Tout Basic', 'Programmes et emplois du temps', 'Plusieurs gestionnaires', 'Rapports académiques'],
  array['Everything in Basic', 'Programs and timetables', 'Multiple managers', 'Academic reports'],
  '{"max_students": 1000, "max_teachers": 50}'),
 ('center_enterprise', 'center', 'Enterprise', false, 30,
  'Réseaux de centres et institutions', 'Networks of centers and institutions',
  array['Tout Professional', 'Volumes sur mesure', 'Accompagnement dédié'],
  array['Everything in Professional', 'Custom volumes', 'Dedicated support'],
  '{}'),
 ('student_free', 'student', 'Free', true, 10,
  'Pour découvrir AFRILEARN', 'To discover AFRILEARN',
  array['Profil et niveau CECRL', 'Choix anglais américain ou britannique', 'Rejoindre un centre partenaire'],
  array['Profile and CEFR level', 'American or British English', 'Join a partner center'],
  '{}'),
 ('student_premium', 'student', 'Premium', false, 20,
  'Pour progresser chaque jour', 'To progress every day',
  array['Tout Free', 'Formations AFRILEARN Academy (phase 2)', 'Certificats (phase 2)'],
  array['Everything in Free', 'AFRILEARN Academy courses (phase 2)', 'Certificates (phase 2)'],
  '{}'),
 ('student_ai_unlimited', 'student', 'AI Unlimited', false, 30,
  'Le professeur IA sans limite', 'The AI teacher without limits',
  array['Tout Premium', 'Professeur IA écrit et vocal (phase 3)'],
  array['Everything in Premium', 'Written and voice AI teacher (phase 3)'],
  '{}');

-- ---------------------------------------------------------------------
-- Prospects : formulaire de contact du site (anonyme, limité en débit)
-- ---------------------------------------------------------------------
create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  kind         public.lead_kind not null default 'contact',
  full_name    text not null check (length(btrim(full_name)) between 2 and 120),
  email        text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone        text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  organization text check (organization is null or length(organization) <= 120),
  country_code char(2) references public.countries(code),
  message      text not null check (length(btrim(message)) between 5 and 3000),
  status       public.lead_status not null default 'new',
  handled_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index on public.leads (created_at desc);
alter table public.leads enable row level security;
create policy leads_admin on public.leads for all using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.leads from anon;

create or replace function public.submit_lead(p_kind public.lead_kind, p_full_name text, p_email text, p_message text,
                                              p_phone text default null, p_organization text default null,
                                              p_country char(2) default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text := lower(btrim(p_email));
begin
  if (select count(*) from public.leads where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many messages, try again later' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Service busy' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.leads (kind, full_name, email, phone, organization, country_code, message)
  values (p_kind, btrim(p_full_name), v_email, nullif(btrim(p_phone), ''), nullif(btrim(p_organization), ''),
          (select code from public.countries where code = upper(p_country)), btrim(p_message))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.submit_lead(public.lead_kind, text, text, text, text, text, char) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Administration de la plateforme (Super Admin uniquement)
-- ---------------------------------------------------------------------
create or replace function public.require_platform_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform admin only' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_set_center_status(p_center uuid, p_status public.center_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
  update public.centers set status = p_status, status_reason = nullif(btrim(p_reason), '') where id = p_center;
  if not found then raise exception 'Center not found' using errcode = 'P0001'; end if;
end $$;

create or replace function public.admin_set_user_suspended(p_user uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
  if p_user = auth.uid() then raise exception 'You cannot suspend yourself' using errcode = 'P0001', hint = 'self'; end if;
  update public.profiles set is_suspended = p_suspended where id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0001'; end if;
end $$;

create or replace function public.admin_grant_admin(p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_platform_admin();
  select id into v_id from public.profiles where email = lower(btrim(p_email));
  if v_id is null then raise exception 'No account with this e-mail' using errcode = 'P0001', hint = 'not_found'; end if;
  insert into public.platform_admins (user_id, created_by) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

create or replace function public.admin_revoke_admin(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
  if p_user = auth.uid() then raise exception 'You cannot remove your own access' using errcode = 'P0001', hint = 'self'; end if;
  if (select count(*) from public.platform_admins) <= 1 then raise exception 'At least one admin is required' using errcode = 'P0001', hint = 'last'; end if;
  delete from public.platform_admins where user_id = p_user;
end $$;

create or replace function public.platform_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_by_type', coalesce((select jsonb_object_agg(account_type, n) from (select account_type, count(*) n from public.profiles group by 1) x), '{}'),
    'users_last_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'centers', (select count(*) from public.centers),
    'centers_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.centers group by 1) x), '{}'),
    'center_students', (select count(*) from public.students),
    'center_teachers', (select count(*) from public.teachers),
    'classes', (select count(*) from public.classes),
    'countries_active', (select count(*) from public.countries where active),
    'leads_new', (select count(*) from public.leads where status = 'new'),
    'by_country', coalesce((select jsonb_agg(x order by x.centers desc) from (
        select c.country_code as code, count(*) centers from public.centers c group by 1) x), '[]'),
    'signups_by_day', coalesce((select jsonb_agg(x order by x.day) from (
        select to_char(d::date, 'YYYY-MM-DD') as day, (select count(*) from public.profiles p where p.created_at::date = d::date) as n
          from generate_series(current_date - 13, current_date, interval '1 day') d) x), '[]'));
end $$;

-- Vue d'ensemble d'un utilisateur pour le Super Admin (centres et rôles)
create or replace function public.admin_user_memberships(p_user uuid) returns table(center_id uuid, center_name text, role public.member_role)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
  return query select m.center_id, c.name, m.role from public.memberships m join public.centers c on c.id = m.center_id where m.user_id = p_user;
end $$;

-- ---------------------------------------------------------------------
-- Protection contre la force brute (appelée côté serveur avec la clé service_role)
-- 5 échecs consécutifs par compte => 30 min ; 30 échecs / heure par IP.
-- Les e-mails ne sont stockés que sous forme d'empreinte SHA-256.
-- ---------------------------------------------------------------------
create table public.login_attempts (
  id         bigserial primary key,
  email_hash text not null check (length(email_hash) = 64),
  ip         text,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index on public.login_attempts (email_hash, created_at desc);
create index on public.login_attempts (ip, created_at desc);
alter table public.login_attempts enable row level security;

create or replace function public.login_guard(p_email_hash text, p_ip text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_last_success timestamptz; v_failures int; v_last_failure timestamptz; v_ip_failures int := 0; v_until timestamptz;
  c_max constant int := 5; c_window constant interval := interval '30 minutes';
begin
  select max(created_at) into v_last_success from public.login_attempts where email_hash = p_email_hash and success;
  select count(*), max(created_at) into v_failures, v_last_failure from public.login_attempts
   where email_hash = p_email_hash and not success and created_at > now() - c_window
     and created_at > coalesce(v_last_success, '-infinity'::timestamptz);
  if p_ip is not null then
    select count(*) into v_ip_failures from public.login_attempts where ip = p_ip and not success and created_at > now() - interval '1 hour';
  end if;
  if v_failures >= c_max then v_until := v_last_failure + c_window;
  elsif v_ip_failures >= 30 then
    v_until := (select max(created_at) from public.login_attempts where ip = p_ip and not success) + interval '1 hour';
  end if;
  return jsonb_build_object('blocked', v_until is not null and v_until > now(),
    'retry_after_seconds', case when v_until > now() then ceil(extract(epoch from v_until - now()))::int else 0 end,
    'remaining', greatest(c_max - v_failures, 0));
end $$;

create or replace function public.login_record(p_email_hash text, p_ip text, p_success boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  insert into public.login_attempts (email_hash, ip, success) values (p_email_hash, left(p_ip, 64), p_success);
  delete from public.login_attempts where created_at < now() - interval '30 days';
  return public.login_guard(p_email_hash, p_ip);
end $$;

-- ---------------------------------------------------------------------
-- Droits d'exécution : les fonctions internes ne sont pas appelables par les clients
-- ---------------------------------------------------------------------
revoke all on public.login_attempts from anon, authenticated;
revoke execute on function public.login_guard(text, text), public.login_record(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.handle_new_user(), public.handle_user_email_change(), public.audit_row(),
  public.assign_student_number(), public.enforce_class_capacity() from public, anon, authenticated;
revoke execute on function public.create_center(text, char, text, text, text), public.create_invitation(uuid, public.member_role, uuid, text),
  public.accept_invitation(text), public.unlink_person(uuid, public.member_role, uuid), public.center_stats(uuid),
  public.admin_set_center_status(uuid, public.center_status, text), public.admin_set_user_suspended(uuid, boolean),
  public.admin_grant_admin(text), public.admin_revoke_admin(uuid), public.platform_stats(), public.admin_user_memberships(uuid)
  from public, anon;
grant execute on function public.create_center(text, char, text, text, text), public.create_invitation(uuid, public.member_role, uuid, text),
  public.accept_invitation(text), public.unlink_person(uuid, public.member_role, uuid), public.center_stats(uuid),
  public.admin_set_center_status(uuid, public.center_status, text), public.admin_set_user_suspended(uuid, boolean),
  public.admin_grant_admin(text), public.admin_revoke_admin(uuid), public.platform_stats(), public.admin_user_memberships(uuid)
  to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.login_guard(text, text), public.login_record(text, text, boolean) to service_role;
  end if;
end $$;
