-- =====================================================================
-- 0006 : module SCHOOL MANAGER (écoles, instituts, universités)
-- =====================================================================

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  unique (tenant_id, name),
  check (end_date > start_date)
);
select public.apply_tenant_rls('academic_years', 'academic.write');

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  matricule text,
  first_name text not null,
  last_name text not null,
  gender text check (gender in ('M', 'F')),
  phone text,
  email text,
  specialty text,
  grade_title text, -- ex. Licencié, Professeur, Chef de travaux
  hire_date date,
  photo_path text,
  user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, matricule)
);
select public.apply_tenant_rls('teachers', 'academic.write');
create trigger teachers_matricule before insert on public.teachers for each row execute function public.auto_matricule();
create trigger teachers_card after insert on public.teachers for each row execute function public.auto_person_card();

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  name text not null,           -- ex. 6e Primaire A, L1 Informatique
  level text,                   -- Maternelle, Primaire, Secondaire, Licence, Master
  option_name text,             -- option / filière / promotion
  capacity int,
  titular_teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('classes', 'academic.write');

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  matricule text,
  first_name text not null,
  post_name text,               -- postnom
  last_name text not null,
  gender text check (gender in ('M', 'F')),
  birth_date date,
  birth_place text,
  address text,
  photo_path text,
  class_id uuid references public.classes(id) on delete set null,
  guardian_name text,
  guardian_phone text,
  guardian_whatsapp text,
  guardian_email text,
  student_phone text,
  student_email text,
  status text not null default 'active' check (status in ('active', 'suspended', 'graduated', 'left')),
  enrolled_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (tenant_id, matricule)
);
create index on public.students (tenant_id, class_id);
select public.apply_tenant_rls('students', 'academic.write', null, 'academic.read');
select public.attach_audit('students');
create trigger students_matricule before insert on public.students for each row execute function public.auto_matricule();
create trigger students_card after insert on public.students for each row execute function public.auto_person_card();

-- Historique des inscriptions
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  unique (student_id, class_id)
);
select public.apply_tenant_rls('enrollments', 'academic.write', null, 'academic.read');

create or replace function public.student_enrollment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.class_id is not null and (tg_op = 'INSERT' or new.class_id is distinct from old.class_id) then
    insert into public.enrollments (tenant_id, student_id, class_id, academic_year_id)
    select new.tenant_id, new.id, c.id, c.academic_year_id from public.classes c
     where c.id = new.class_id and c.tenant_id = new.tenant_id
    on conflict (student_id, class_id) do nothing;
  end if;
  return new;
end $$;
create trigger students_enrollment after insert or update of class_id on public.students
  for each row execute function public.student_enrollment();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  name text not null,
  code text,
  max_points numeric(6,2) not null default 20 check (max_points > 0), -- pondération (maxima / crédits)
  hours_per_week numeric(5,2),
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('courses', 'academic.write', null, 'academic.read');

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  room text,
  check (end_time > start_time)
);
select public.apply_tenant_rls('timetable_slots', 'academic.write', null, 'academic.read');

create table public.grading_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete cascade,
  name text not null,      -- 1re période, Examen 1er semestre, Session…
  sort int not null default 0,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('grading_periods', 'academic.write', null, 'academic.read');

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  period_id uuid not null references public.grading_periods(id) on delete cascade,
  score numeric(6,2) not null check (score >= 0),
  max_score numeric(6,2) not null default 20 check (max_score > 0),
  comment text,
  recorded_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id, period_id),
  check (score <= max_score)
);
create index on public.grades (tenant_id, period_id);
select public.apply_tenant_rls('grades', 'grades.write', null, 'academic.read');
select public.attach_audit('grades');

create table public.deliberations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  period_id uuid not null references public.grading_periods(id) on delete cascade,
  status text not null default 'final' check (status in ('final', 'reopened')),
  results jsonb not null,
  decided_by uuid default auth.uid(),
  decided_at timestamptz not null default now(),
  notes text,
  unique (class_id, period_id)
);
alter table public.deliberations enable row level security;
create policy delib_read on public.deliberations for select using (public.has_perm(tenant_id, 'academic.read') or public.is_platform_admin());
create policy delib_reopen on public.deliberations for update using (public.can_write(tenant_id, 'settings.write'))
  with check (public.can_write(tenant_id, 'settings.write'));

-- Un enseignant ne peut noter que ses propres cours ; notes verrouillées après délibération
create or replace function public.grades_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.courses; v_role public.member_role;
begin
  select * into c from public.courses where id = coalesce(new.course_id, old.course_id);
  if exists (select 1 from public.deliberations d join public.students s on s.class_id = d.class_id
              where d.period_id = coalesce(new.period_id, old.period_id) and d.status = 'final'
                and s.id = coalesce(new.student_id, old.student_id)) then
    raise exception 'Notes verrouillées : la délibération de cette période est clôturée';
  end if;
  v_role := public.member_role_of(coalesce(new.tenant_id, old.tenant_id));
  if v_role = 'teacher' and not exists (select 1 from public.teachers t where t.id = c.teacher_id and t.user_id = auth.uid()) then
    raise exception 'Vous ne pouvez noter que vos propres cours' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    if c.tenant_id <> new.tenant_id then raise exception 'Incohérence d''établissement' using errcode = '42501'; end if;
    new.max_score := coalesce(new.max_score, c.max_points);
    new.recorded_by := auth.uid();
    new.updated_at := now();
  end if;
  return coalesce(new, old);
end $$;
create trigger grades_guard before insert or update or delete on public.grades
  for each row execute function public.grades_guard();

-- Résultats d'une classe pour une période : pourcentage pondéré, rang, décision
create or replace function public.class_results(p_class uuid, p_period uuid)
returns table (student_id uuid, matricule text, full_name text, total_obtained numeric, total_max numeric,
               percentage numeric, rank int, decision text, courses_graded int)
language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid; v_pass numeric; v_retake numeric;
begin
  select tenant_id into v_tenant from public.classes where id = p_class;
  if v_tenant is null or not (public.has_perm(v_tenant, 'academic.read') or public.is_platform_admin()) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  select coalesce((settings ->> 'pass_mark')::numeric, 50), coalesce((settings ->> 'retake_mark')::numeric, 40)
    into v_pass, v_retake from public.tenants where id = v_tenant;
  return query
  with agg as (
    select s.id, s.matricule, s.first_name || ' ' || coalesce(s.post_name || ' ', '') || s.last_name as nm,
           coalesce(sum(g.score / g.max_score * c.max_points), 0) as obt,
           coalesce(sum(case when g.id is not null then c.max_points end), 0) as mx,
           count(g.id)::int as n
      from public.students s
      left join public.courses c on c.class_id = p_class
      left join public.grades g on g.student_id = s.id and g.course_id = c.id and g.period_id = p_period
     where s.class_id = p_class and s.status = 'active'
     group by s.id
  )
  select a.id, a.matricule, a.nm, round(a.obt, 2), a.mx,
         case when a.mx > 0 then round(a.obt / a.mx * 100, 2) else null end,
         (rank() over (order by case when a.mx > 0 then a.obt / a.mx end desc nulls last))::int,
         case when a.mx = 0 then 'Non évalué'
              when a.obt / a.mx * 100 >= v_pass then 'Admis'
              when a.obt / a.mx * 100 >= v_retake then 'Ajourné (seconde session)'
              else 'Non admis' end,
         a.n
    from agg a order by 7, 3;
end $$;

-- Bulletin individuel
create or replace function public.student_report_card(p_student uuid, p_period uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.students; v jsonb; r record;
begin
  select * into s from public.students where id = p_student;
  if s.id is null or not (public.has_perm(s.tenant_id, 'academic.read') or public.is_platform_admin()) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  select * into r from public.class_results(s.class_id, p_period) cr where cr.student_id = p_student;
  select jsonb_build_object(
    'student', jsonb_build_object('id', s.id, 'matricule', s.matricule,
       'name', s.first_name || ' ' || coalesce(s.post_name || ' ', '') || s.last_name, 'gender', s.gender, 'birth_date', s.birth_date),
    'class', (select jsonb_build_object('name', c.name, 'level', c.level, 'option', c.option_name) from public.classes c where c.id = s.class_id),
    'period', (select name from public.grading_periods where id = p_period),
    'establishment', (select jsonb_build_object('name', t.name, 'address', t.address, 'city', t.city, 'logo_url', t.logo_url, 'phone', t.phone)
                      from public.tenants t where t.id = s.tenant_id),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('course', c.name, 'max', c.max_points,
         'score', case when g.id is not null then round(g.score / g.max_score * c.max_points, 2) end,
         'teacher', (select first_name || ' ' || last_name from public.teachers where id = c.teacher_id),
         'comment', g.comment) order by c.name)
       from public.courses c left join public.grades g on g.course_id = c.id and g.student_id = s.id and g.period_id = p_period
      where c.class_id = s.class_id), '[]'::jsonb),
    'total_obtained', r.total_obtained, 'total_max', r.total_max, 'percentage', r.percentage, 'rank', r.rank,
    'class_size', (select count(*) from public.students where class_id = s.class_id and status = 'active'),
    'decision', r.decision,
    'attendance', jsonb_build_object(
       'present_days', (select count(distinct attendance_date) from public.attendance a where a.person_type = 'student'
                         and a.person_id = s.id and a.status in ('present', 'late')),
       'late_days', (select count(distinct attendance_date) from public.attendance a where a.person_type = 'student'
                         and a.person_id = s.id and a.status = 'late'))
  ) into v;
  return v;
end $$;

create or replace function public.finalize_deliberation(p_class uuid, p_period uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid;
begin
  select tenant_id into v_tenant from public.classes where id = p_class;
  if v_tenant is null or not public.can_write(v_tenant, 'academic.write') or public.member_role_of(v_tenant) not in ('owner', 'admin', 'manager') then
    raise exception 'Seule la direction peut clôturer une délibération' using errcode = '42501';
  end if;
  insert into public.deliberations (tenant_id, class_id, period_id, results, notes, status)
  values (v_tenant, p_class, p_period,
          (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.class_results(p_class, p_period) r), p_notes, 'final')
  on conflict (class_id, period_id) do update set results = excluded.results, status = 'final',
     decided_at = now(), decided_by = auth.uid(), notes = excluded.notes
  returning id into v_id;
  return v_id;
end $$;

-- Appel manuel (liste de classe) : [{student_id, status}]
create or replace function public.record_roll_call(p_class uuid, p_date date, p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; it jsonb; n int := 0;
begin
  select tenant_id into v_tenant from public.classes where id = p_class;
  if v_tenant is null or not public.can_write(v_tenant, 'attendance.scan') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  delete from public.attendance a using public.students s
   where a.tenant_id = v_tenant and a.source = 'manual' and a.attendance_date = p_date
     and a.person_type = 'student' and a.person_id = s.id and s.class_id = p_class;
  for it in select * from jsonb_array_elements(p_items) loop
    if exists (select 1 from public.students where id = (it ->> 'student_id')::uuid and class_id = p_class) then
      insert into public.attendance (tenant_id, person_type, person_id, status, attendance_date, scanned_at, source)
      values (v_tenant, 'student', (it ->> 'student_id')::uuid, coalesce(it ->> 'status', 'present'), p_date,
              (p_date::timestamp + time '08:00') at time zone 'Africa/Kinshasa', 'manual');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Finances scolaires
-- ---------------------------------------------------------------------
create table public.fee_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  class_id uuid references public.classes(id) on delete cascade, -- null = toutes les classes
  name text not null,       -- Minerval, Frais de fonctionnement, Frais académiques…
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  due_date date,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('fee_types', 'fees.write', null, 'fees.read');

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  name text not null default 'Bourse',
  kind text not null default 'percent' check (kind in ('percent', 'fixed')),
  value numeric(14,2) not null check (value > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);
select public.apply_tenant_rls('scholarships', 'fees.write', null, 'fees.read');

create table public.student_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_type_id uuid references public.fee_types(id) on delete set null,
  number text not null default public.gen_reference('FS'),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  net_amount numeric(14,2) generated always as (greatest(amount - discount, 0)) stored,
  paid_amount numeric(14,2) not null default 0,
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid', 'void')),
  created_at timestamptz not null default now(),
  unique (student_id, fee_type_id)
);
create index on public.student_invoices (tenant_id, status);
select public.apply_tenant_rls('student_invoices', 'fees.write', null, 'fees.read');
select public.attach_audit('student_invoices');

create or replace function public.student_invoice_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.paid_amount := 0; new.status := 'unpaid'; return new; end if;
  if current_setting('ostapaul.payment_apply', true) is distinct from 'on' then
    new.paid_amount := old.paid_amount;
    if new.status <> old.status and new.status <> 'void' then new.status := old.status; end if;
    if old.paid_amount > 0 and (new.amount <> old.amount or new.discount <> old.discount) then
      raise exception 'Facture déjà partiellement payée : montant non modifiable';
    end if;
  end if;
  return new;
end $$;
create trigger student_invoice_guard before insert or update on public.student_invoices
  for each row execute function public.student_invoice_guard();

-- Génère les factures d'un type de frais pour tous les élèves concernés (bourses appliquées)
create or replace function public.generate_fee_invoices(p_fee_type uuid) returns int
language plpgsql security definer set search_path = public as $$
declare f public.fee_types; n int;
begin
  select * into f from public.fee_types where id = p_fee_type;
  if f.id is null or not public.can_write(f.tenant_id, 'fees.write') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  insert into public.student_invoices (tenant_id, student_id, fee_type_id, description, amount, discount, currency, due_date)
  select f.tenant_id, s.id, f.id, f.name, f.amount,
         least(f.amount, coalesce((select sum(case when sc.kind = 'percent' then f.amount * sc.value / 100 else sc.value end)
                                    from public.scholarships sc where sc.student_id = s.id and sc.is_active), 0)),
         f.currency, f.due_date
    from public.students s
   where s.tenant_id = f.tenant_id and s.status = 'active' and (f.class_id is null or s.class_id = f.class_id)
  on conflict (student_id, fee_type_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace view public.student_balances with (security_invoker = true) as
  select s.tenant_id, s.id as student_id, s.matricule,
         s.first_name || ' ' || coalesce(s.post_name || ' ', '') || s.last_name as full_name,
         s.class_id, s.guardian_name, s.guardian_phone, i.currency,
         sum(i.net_amount) as total_due, sum(i.paid_amount) as total_paid,
         sum(i.net_amount - i.paid_amount) as balance,
         sum(case when i.due_date < current_date and i.status in ('unpaid', 'partial') then i.net_amount - i.paid_amount else 0 end) as overdue
    from public.students s join public.student_invoices i on i.student_id = s.id and i.status <> 'void'
   group by s.tenant_id, s.id, i.currency;
