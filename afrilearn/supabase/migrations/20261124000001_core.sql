-- =====================================================================
-- AFRILEARN — 0001 : socle (référentiels, profils, super admin, journal)
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create type public.app_locale      as enum ('fr', 'en');
create type public.english_variant as enum ('us', 'uk');
create type public.cefr_level      as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
create type public.account_type    as enum ('student', 'center_manager', 'teacher');

-- ---------------------------------------------------------------------
-- Référentiels : devises et pays (activés pays par pays par le Super Admin)
-- ---------------------------------------------------------------------
create table public.currencies (
  code     char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name     text not null check (length(name) between 2 and 60),
  symbol   text not null check (length(symbol) between 1 and 8),
  decimals smallint not null default 2 check (decimals between 0 and 3)
);

create table public.countries (
  code          char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name_fr       text not null,
  name_en       text not null,
  currency_code char(3) not null references public.currencies(code),
  phone_prefix  text not null check (phone_prefix ~ '^\+[0-9]{1,4}$'),
  active        boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Profils (1 ligne par compte auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  full_name           text not null check (length(btrim(full_name)) between 2 and 120),
  account_type        public.account_type not null default 'student',
  locale              public.app_locale not null default 'fr',
  country_code        char(2) references public.countries(code),
  phone               text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  birth_date          date check (birth_date is null or birth_date between date '1900-01-01' and current_date),
  guardian_email      text check (guardian_email is null or guardian_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  guardian_consent_at timestamptz,
  english_variant     public.english_variant not null default 'us',
  cefr_level          public.cefr_level not null default 'A1',
  learning_goal       text check (learning_goal is null or length(learning_goal) <= 500),
  is_suspended        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.profiles (account_type);
create index on public.profiles (country_code);

create table public.platform_admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins a join public.profiles p on p.id = a.user_id
     where a.user_id = auth.uid() and not p.is_suspended)
$$;

create or replace function public.current_user_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_suspended)
$$;

-- Création automatique du profil à l'inscription (métadonnées fournies par le formulaire)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type public.account_type := 'student';
  v_locale public.app_locale := 'fr';
  v_country char(2);
  v_variant public.english_variant := 'us';
  v_name text := nullif(btrim(m ->> 'full_name'), '');
  v_birth date;
  v_guardian text;
begin
  if m ->> 'account_type' in ('student', 'center_manager', 'teacher') then v_type := (m ->> 'account_type')::public.account_type; end if;
  if m ->> 'locale' in ('fr', 'en') then v_locale := (m ->> 'locale')::public.app_locale; end if;
  if m ->> 'english_variant' in ('us', 'uk') then v_variant := (m ->> 'english_variant')::public.english_variant; end if;
  select code into v_country from public.countries where code = upper(m ->> 'country_code');
  if (m ->> 'birth_date') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin v_birth := (m ->> 'birth_date')::date; exception when others then v_birth := null; end;
    if v_birth > current_date or v_birth < date '1900-01-01' then v_birth := null; end if;
  end if;
  if (m ->> 'guardian_email') ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_guardian := lower(m ->> 'guardian_email'); end if;
  insert into public.profiles (id, email, full_name, account_type, locale, country_code, english_variant,
                               birth_date, guardian_email, guardian_consent_at)
  values (new.id, lower(new.email), coalesce(left(v_name, 120), split_part(new.email, '@', 1), 'Learner'),
          v_type, v_locale, v_country, v_variant, v_birth, v_guardian,
          case when v_guardian is not null and (m ->> 'guardian_consent') = 'true' then now() end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- Journal d'audit des actions sensibles (écrit uniquement par triggers)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigserial primary key,
  center_id  uuid,
  actor_id   uuid,
  action     text not null,
  table_name text not null,
  row_id     text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (center_id, created_at desc);
create index on public.audit_log (created_at desc);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_center uuid;
  v_diff jsonb := '{}'::jsonb;
  k text;
begin
  if tg_table_name = 'centers' then v_center := (r ->> 'id')::uuid;
  elsif r ? 'center_id' then v_center := (r ->> 'center_id')::uuid; end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(r) loop
      if k not in ('updated_at') and (r -> k) is distinct from (o -> k) then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', r -> k));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return new; end if;
  end if;
  -- les données personnelles ne sont pas recopiées dans le journal : uniquement l'identifiant et les champs modifiés
  insert into public.audit_log (center_id, actor_id, action, table_name, row_id, details)
  values (v_center, auth.uid(), lower(tg_op), tg_table_name,
          coalesce(r ->> 'id', r ->> 'user_id', r ->> 'code'),
          case when tg_op = 'UPDATE' then v_diff else '{}'::jsonb end);
  return coalesce(new, old);
end $$;

create trigger audit_platform_admins after insert or delete on public.platform_admins
  for each row execute function public.audit_row();
create trigger audit_countries after insert or update or delete on public.countries
  for each row execute function public.audit_row();
create trigger audit_profiles_suspension after update of is_suspended, account_type on public.profiles
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.currencies      enable row level security;
alter table public.countries       enable row level security;
alter table public.profiles        enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_log       enable row level security;

create policy currencies_read  on public.currencies for select using (true);
create policy currencies_admin on public.currencies for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy countries_read   on public.countries  for select using (true);
create policy countries_admin  on public.countries  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_platform_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid() and not is_suspended) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy platform_admins_read on public.platform_admins for select using (user_id = auth.uid() or public.is_platform_admin());

create policy audit_admin_read on public.audit_log for select using (public.is_platform_admin());

-- Colonnes modifiables par l'utilisateur lui-même (type de compte, suspension, e-mail : jamais)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, locale, country_code, phone, birth_date, guardian_email, guardian_consent_at,
              english_variant, cefr_level, learning_goal) on public.profiles to authenticated;
revoke insert, update, delete on public.platform_admins, public.audit_log from anon, authenticated;
revoke all on public.audit_log from anon;

-- ---------------------------------------------------------------------
-- Données de référence : devises et pays africains (inactifs par défaut,
-- le Super Admin active les pays au fur et à mesure du déploiement)
-- ---------------------------------------------------------------------
insert into public.currencies (code, name, symbol, decimals) values
  ('USD', 'US Dollar', '$', 2), ('EUR', 'Euro', '€', 2),
  ('XAF', 'Franc CFA (CEMAC)', 'FCFA', 0), ('XOF', 'Franc CFA (UEMOA)', 'FCFA', 0),
  ('CDF', 'Franc congolais', 'FC', 2), ('NGN', 'Naira', '₦', 2), ('GHS', 'Cedi', 'GH₵', 2),
  ('KES', 'Kenyan Shilling', 'KSh', 2), ('TZS', 'Tanzanian Shilling', 'TSh', 0), ('UGX', 'Ugandan Shilling', 'USh', 0),
  ('RWF', 'Franc rwandais', 'FRw', 0), ('BIF', 'Franc burundais', 'FBu', 0), ('ZAR', 'Rand', 'R', 2),
  ('MAD', 'Dirham marocain', 'DH', 2), ('EGP', 'Egyptian Pound', 'E£', 2), ('ETB', 'Birr', 'Br', 2),
  ('MGA', 'Ariary', 'Ar', 0), ('GNF', 'Franc guinéen', 'FG', 0), ('ZMW', 'Kwacha', 'ZK', 2), ('AOA', 'Kwanza', 'Kz', 2);

insert into public.countries (code, name_fr, name_en, currency_code, phone_prefix) values
  ('CD', 'RD Congo', 'DR Congo', 'CDF', '+243'), ('CG', 'Congo', 'Republic of the Congo', 'XAF', '+242'),
  ('CM', 'Cameroun', 'Cameroon', 'XAF', '+237'), ('GA', 'Gabon', 'Gabon', 'XAF', '+241'),
  ('TD', 'Tchad', 'Chad', 'XAF', '+235'), ('CF', 'Centrafrique', 'Central African Republic', 'XAF', '+236'),
  ('SN', 'Sénégal', 'Senegal', 'XOF', '+221'), ('CI', 'Côte d''Ivoire', 'Côte d''Ivoire', 'XOF', '+225'),
  ('BJ', 'Bénin', 'Benin', 'XOF', '+229'), ('TG', 'Togo', 'Togo', 'XOF', '+228'), ('BF', 'Burkina Faso', 'Burkina Faso', 'XOF', '+226'),
  ('ML', 'Mali', 'Mali', 'XOF', '+223'), ('NE', 'Niger', 'Niger', 'XOF', '+227'), ('GN', 'Guinée', 'Guinea', 'GNF', '+224'),
  ('NG', 'Nigeria', 'Nigeria', 'NGN', '+234'), ('GH', 'Ghana', 'Ghana', 'GHS', '+233'),
  ('KE', 'Kenya', 'Kenya', 'KES', '+254'), ('TZ', 'Tanzanie', 'Tanzania', 'TZS', '+255'), ('UG', 'Ouganda', 'Uganda', 'UGX', '+256'),
  ('RW', 'Rwanda', 'Rwanda', 'RWF', '+250'), ('BI', 'Burundi', 'Burundi', 'BIF', '+257'),
  ('ZA', 'Afrique du Sud', 'South Africa', 'ZAR', '+27'), ('ZM', 'Zambie', 'Zambia', 'ZMW', '+260'), ('AO', 'Angola', 'Angola', 'AOA', '+244'),
  ('MA', 'Maroc', 'Morocco', 'MAD', '+212'), ('EG', 'Égypte', 'Egypt', 'EGP', '+20'), ('ET', 'Éthiopie', 'Ethiopia', 'ETB', '+251'),
  ('MG', 'Madagascar', 'Madagascar', 'MGA', '+261');
