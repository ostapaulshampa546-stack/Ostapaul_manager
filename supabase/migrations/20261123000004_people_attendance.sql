-- =====================================================================
-- 0004 : personnel (tous secteurs), cartes QR, présences, RH
-- =====================================================================

create or replace function public.next_matricule(p_tenant uuid, p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into public.counters (tenant_id, name, value) values (p_tenant, p_prefix, 1)
  on conflict (tenant_id, name) do update set value = public.counters.value + 1
  returning value into v_n;
  return p_prefix || '-' || to_char(now(), 'YY') || lpad(v_n::text, 5, '0');
end $$;

create table public.counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  value bigint not null default 0,
  primary key (tenant_id, name)
);
alter table public.counters enable row level security; -- accès via fonctions uniquement

-- ---------------------------------------------------------------------
-- Employés (restaurant, école [personnel administratif], PME)
-- ---------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  matricule text,
  first_name text not null,
  last_name text not null,
  gender text check (gender in ('M', 'F')),
  birth_date date,
  phone text,
  email text,
  address text,
  position text,
  department text,
  hire_date date default current_date,
  salary numeric(14,2),
  salary_currency text not null default 'USD' check (salary_currency in ('USD', 'CDF')),
  emergency_contact text,
  photo_path text,
  user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, matricule)
);
create index on public.employees (tenant_id, is_active);
select public.apply_tenant_rls('employees', 'hr.write');
select public.attach_audit('employees');

-- ---------------------------------------------------------------------
-- Cartes d'identification avec QR (élèves, enseignants, personnel)
-- ---------------------------------------------------------------------
create table public.id_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  person_type text not null check (person_type in ('employee', 'student', 'teacher')),
  person_id uuid not null,
  qr_token text not null unique default public.gen_token(),
  issued_at timestamptz not null default now(),
  expires_at date,
  revoked boolean not null default false,
  revoked_at timestamptz,
  unique (tenant_id, person_type, person_id)
);
select public.apply_tenant_rls('id_cards', 'cards.manage');

-- Création automatique de la carte + du matricule à l'inscription d'une personne
create or replace function public.auto_person_card() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_type text := case tg_table_name when 'employees' then 'employee' when 'students' then 'student' else 'teacher' end;
begin
  insert into public.id_cards (tenant_id, person_type, person_id, expires_at)
  values (new.tenant_id, v_type, new.id, (current_date + interval '1 year')::date)
  on conflict do nothing;
  return new;
end $$;

create or replace function public.auto_matricule() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.matricule is null or new.matricule = '' then
    new.matricule := public.next_matricule(new.tenant_id,
      case tg_table_name when 'employees' then 'EMP' when 'students' then 'ELV' else 'ENS' end);
  end if;
  return new;
end $$;

create trigger employees_matricule before insert on public.employees for each row execute function public.auto_matricule();
create trigger employees_card after insert on public.employees for each row execute function public.auto_person_card();

-- ---------------------------------------------------------------------
-- Présences
-- ---------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  person_type text not null check (person_type in ('employee', 'student', 'teacher')),
  person_id uuid not null,
  card_id uuid references public.id_cards(id) on delete set null,
  event_type text not null default 'in' check (event_type in ('in', 'out')),
  status text not null default 'present' check (status in ('present', 'late', 'absent', 'excused')),
  scanned_at timestamptz not null default now(),
  attendance_date date not null default (now() at time zone 'Africa/Kinshasa')::date,
  source text not null default 'qr' check (source in ('qr', 'manual')),
  device_id text,
  client_uuid uuid,
  recorded_by uuid default auth.uid(),
  synced_at timestamptz not null default now(),
  note text,
  unique (tenant_id, client_uuid)
);
create index on public.attendance (tenant_id, attendance_date);
create index on public.attendance (tenant_id, person_type, person_id, attendance_date);
select public.apply_tenant_rls('attendance', 'attendance.scan', null, 'attendance.read');

-- Enregistrement d'un scan (en ligne ou synchronisation différée). Idempotent via client_uuid.
create or replace function public.record_scan(
  p_tenant uuid, p_token text, p_event text default 'in', p_scanned_at timestamptz default now(),
  p_client_uuid uuid default gen_random_uuid(), p_device text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.id_cards;
  v_existing public.attendance;
  v_at timestamptz := coalesce(p_scanned_at, now());
  v_late time;
  v_status text := 'present';
  v_name text;
  v_extra text;
  v_id uuid;
begin
  if not public.can_write(p_tenant, 'attendance.scan') then
    perform public.report_access_denied(p_tenant, 'record_scan');
    raise exception 'Permission de pointage refusée' using errcode = '42501';
  end if;
  if p_event not in ('in', 'out') then raise exception 'Type de pointage invalide'; end if;
  if v_at > now() + interval '5 minutes' or v_at < now() - interval '7 days' then
    raise exception 'Horodatage du scan hors limites (max 7 jours hors connexion)';
  end if;

  select * into v_existing from public.attendance where tenant_id = p_tenant and client_uuid = p_client_uuid;
  if v_existing.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'attendance_id', v_existing.id);
  end if;

  p_token := regexp_replace(coalesce(p_token, ''), '^.*/v/', '');
  select * into c from public.id_cards where qr_token = p_token;
  if c.id is null or c.tenant_id <> p_tenant then
    return jsonb_build_object('ok', false, 'error', 'Carte inconnue pour cet établissement');
  end if;
  if c.revoked or (c.expires_at is not null and c.expires_at < v_at::date) then
    return jsonb_build_object('ok', false, 'error', 'Carte révoquée ou expirée');
  end if;

  if p_event = 'in' then
    v_late := nullif((select settings ->> 'late_after' from public.tenants where id = p_tenant), '')::time;
    if v_late is not null and (v_at at time zone 'Africa/Kinshasa')::time > v_late then v_status := 'late'; end if;
  end if;

  if c.person_type = 'employee' then
    select first_name || ' ' || last_name, coalesce(position, '') into v_name, v_extra from public.employees where id = c.person_id;
  elsif c.person_type = 'student' then
    select s.first_name || ' ' || coalesce(s.post_name || ' ', '') || s.last_name, coalesce(cl.name, '')
      into v_name, v_extra from public.students s left join public.classes cl on cl.id = s.class_id where s.id = c.person_id;
  else
    select first_name || ' ' || last_name, coalesce(specialty, '') into v_name, v_extra from public.teachers where id = c.person_id;
  end if;

  insert into public.attendance (tenant_id, person_type, person_id, card_id, event_type, status, scanned_at,
                                 attendance_date, source, device_id, client_uuid, recorded_by)
  values (p_tenant, c.person_type, c.person_id, c.id, p_event, v_status, v_at,
          (v_at at time zone 'Africa/Kinshasa')::date, 'qr', left(p_device, 100), p_client_uuid, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'attendance_id', v_id, 'person_type', c.person_type, 'person_id', c.person_id,
                            'name', v_name, 'detail', v_extra, 'status', v_status, 'event', p_event, 'at', v_at);
end $$;

-- Synchronisation d'un lot de scans hors ligne : [{token, event, scanned_at, client_uuid}]
create or replace function public.record_scans_batch(p_tenant uuid, p_items jsonb, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  res jsonb := '[]'::jsonb;
  r jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'Lot invalide (500 scans max)';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    begin
      r := public.record_scan(p_tenant, it ->> 'token', coalesce(it ->> 'event', 'in'),
                              (it ->> 'scanned_at')::timestamptz, (it ->> 'client_uuid')::uuid, p_device);
    exception when others then
      r := jsonb_build_object('ok', false, 'error', sqlerrm);
    end;
    res := res || jsonb_build_array(r || jsonb_build_object('client_uuid', it ->> 'client_uuid'));
  end loop;
  return res;
end $$;

-- Vérification publique d'une carte (QR scanné par un téléphone quelconque) : infos minimales
create or replace function public.verify_card(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.id_cards;
  v jsonb;
begin
  select * into c from public.id_cards where qr_token = p_token and length(p_token) >= 32;
  if c.id is null then return jsonb_build_object('valid', false); end if;
  select jsonb_build_object('name', first_name || ' ' || last_name, 'role', position, 'matricule', matricule)
    into v from public.employees where id = c.person_id and c.person_type = 'employee';
  if v is null then
    select jsonb_build_object('name', first_name || ' ' || coalesce(post_name || ' ', '') || last_name, 'role', 'Élève / Étudiant', 'matricule', matricule)
      into v from public.students where id = c.person_id and c.person_type = 'student';
  end if;
  if v is null then
    select jsonb_build_object('name', first_name || ' ' || last_name, 'role', 'Enseignant', 'matricule', matricule)
      into v from public.teachers where id = c.person_id and c.person_type = 'teacher';
  end if;
  return coalesce(v, '{}'::jsonb) || jsonb_build_object(
    'valid', not c.revoked and (c.expires_at is null or c.expires_at >= current_date),
    'person_type', c.person_type,
    'expires_at', c.expires_at,
    'establishment', (select name from public.tenants where id = c.tenant_id),
    'tenant_id', c.tenant_id,
    'person_id', case when public.is_member(c.tenant_id) then c.person_id end);
end $$;

-- ---------------------------------------------------------------------
-- RH : horaires, congés/permissions, contrats, salaires
-- ---------------------------------------------------------------------
create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
select public.apply_tenant_rls('work_schedules', 'hr.write', 'staff');

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null default 'conge' check (kind in ('conge', 'permission', 'maladie', 'maternite', 'autre')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
select public.apply_tenant_rls('leave_requests', 'hr.write', 'staff');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  contract_type text not null default 'CDI' check (contract_type in ('CDI', 'CDD', 'Stage', 'Consultant', 'Journalier')),
  start_date date not null,
  end_date date,
  salary numeric(14,2),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  status text not null default 'active' check (status in ('active', 'ended', 'suspended')),
  notes text,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('contracts', 'hr.write', 'staff');

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period date not null,
  base_salary numeric(14,2) not null default 0,
  bonuses numeric(14,2) not null default 0,
  deductions numeric(14,2) not null default 0,
  net_salary numeric(14,2) generated always as (base_salary + bonuses - deductions) stored,
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  days_present int,
  status text not null default 'draft' check (status in ('draft', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, period)
);
select public.apply_tenant_rls('payslips', 'hr.write', 'staff', 'hr.read');
select public.attach_audit('payslips');

-- Génère les fiches de paie du mois à partir des salaires et des présences
create or replace function public.generate_payslips(p_tenant uuid, p_period date)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.can_write(p_tenant, 'hr.write') or not public.tenant_has_feature(p_tenant, 'staff') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  p_period := date_trunc('month', p_period)::date;
  insert into public.payslips (tenant_id, employee_id, period, base_salary, currency, days_present)
  select e.tenant_id, e.id, p_period, coalesce(e.salary, 0), e.salary_currency,
         (select count(distinct a.attendance_date) from public.attendance a
           where a.tenant_id = e.tenant_id and a.person_type = 'employee' and a.person_id = e.id and a.event_type = 'in'
             and a.attendance_date >= p_period and a.attendance_date < (p_period + interval '1 month'))
    from public.employees e where e.tenant_id = p_tenant and e.is_active
  on conflict (employee_id, period) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Paiement d'une fiche : passe en payé et crée la dépense correspondante
create or replace function public.pay_payslip(p_payslip uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payslips; v_name text;
begin
  select * into p from public.payslips where id = p_payslip for update;
  if p.id is null or not public.can_write(p.tenant_id, 'hr.write') or not public.has_perm(p.tenant_id, 'finance.write') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  if p.status = 'paid' then raise exception 'Fiche déjà payée'; end if;
  update public.payslips set status = 'paid', paid_at = now() where id = p.id;
  select first_name || ' ' || last_name into v_name from public.employees where id = p.employee_id;
  if p.net_salary > 0 then
    insert into public.expenses (tenant_id, category, description, amount, currency, source)
    values (p.tenant_id, 'Salaires', 'Salaire ' || to_char(p.period, 'MM/YYYY') || ' — ' || v_name, p.net_salary, p.currency, 'payroll');
  end if;
end $$;
