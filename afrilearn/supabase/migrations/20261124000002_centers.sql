-- =====================================================================
-- AFRILEARN — 0002 : centres de formation (multi-tenant), membres,
-- enseignants, étudiants, programmes, classes, invitations
-- Chaque ligne métier porte center_id ; la RLS isole strictement les centres.
-- =====================================================================
create type public.center_status as enum ('active', 'suspended', 'closed');
create type public.member_role   as enum ('owner', 'manager', 'teacher', 'student');
create type public.person_status as enum ('active', 'inactive');
create type public.student_status as enum ('active', 'inactive', 'graduated');
create type public.class_status  as enum ('planned', 'active', 'finished');

create table public.centers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(btrim(name)) between 2 and 120),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  country_code     char(2) not null references public.countries(code),
  city             text check (city is null or length(city) <= 80),
  address          text check (address is null or length(address) <= 200),
  phone            text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  email            text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  description      text check (description is null or length(description) <= 1000),
  show_on_website  boolean not null default false,
  status           public.center_status not null default 'active',
  status_reason    text,
  student_seq      int not null default 0,
  created_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.centers (country_code);
create trigger centers_touch before update on public.centers for each row execute function public.touch_updated_at();

create table public.memberships (
  center_id  uuid not null references public.centers(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (center_id, user_id, role)
);
create index on public.memberships (user_id);

create table public.teachers (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  full_name   text not null check (length(btrim(full_name)) between 2 and 120),
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  specialties text check (specialties is null or length(specialties) <= 300),
  status      public.person_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, center_id),
  unique (center_id, user_id)
);
create index on public.teachers (center_id);
create trigger teachers_touch before update on public.teachers for each row execute function public.touch_updated_at();

create table public.students (
  id              uuid primary key default gen_random_uuid(),
  center_id       uuid not null references public.centers(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete set null,
  student_number  text not null,
  full_name       text not null check (length(btrim(full_name)) between 2 and 120),
  email           text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  birth_date      date check (birth_date is null or birth_date between date '1900-01-01' and current_date),
  guardian_name   text check (guardian_name is null or length(guardian_name) <= 120),
  guardian_phone  text check (guardian_phone is null or guardian_phone ~ '^\+?[0-9 ]{6,20}$'),
  cefr_level      public.cefr_level not null default 'A1',
  english_variant public.english_variant not null default 'us',
  status          public.student_status not null default 'active',
  enrolled_on     date not null default current_date,
  notes           text check (notes is null or length(notes) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, center_id),
  unique (center_id, student_number),
  unique (center_id, user_id)
);
create index on public.students (center_id, full_name);
create trigger students_touch before update on public.students for each row execute function public.touch_updated_at();

-- Matricule automatique par centre : AL-2026-00001
create or replace function public.assign_student_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_seq int;
begin
  update public.centers set student_seq = student_seq + 1 where id = new.center_id returning student_seq into v_seq;
  new.student_number := 'AL-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
  return new;
end $$;
create trigger students_number before insert on public.students for each row execute function public.assign_student_number();

create or replace function public.protect_student_number() returns trigger language plpgsql as $$
begin
  new.student_number := old.student_number; new.center_id := old.center_id; return new;
end $$;
create trigger students_number_immutable before update on public.students for each row execute function public.protect_student_number();

create table public.programs (
  id              uuid primary key default gen_random_uuid(),
  center_id       uuid not null references public.centers(id) on delete cascade,
  name            text not null check (length(btrim(name)) between 2 and 120),
  description     text check (description is null or length(description) <= 2000),
  cefr_level      public.cefr_level not null,
  english_variant public.english_variant,
  duration_weeks  int check (duration_weeks is null or duration_weeks between 1 and 260),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, center_id)
);
create trigger programs_touch before update on public.programs for each row execute function public.touch_updated_at();

create table public.classes (
  id              uuid primary key default gen_random_uuid(),
  center_id       uuid not null references public.centers(id) on delete cascade,
  program_id      uuid,
  teacher_id      uuid,
  name            text not null check (length(btrim(name)) between 2 and 120),
  cefr_level      public.cefr_level not null,
  english_variant public.english_variant not null default 'us',
  room            text check (room is null or length(room) <= 60),
  capacity        int not null default 25 check (capacity between 1 and 500),
  start_date      date,
  end_date        date,
  schedule_note   text check (schedule_note is null or length(schedule_note) <= 300),
  status          public.class_status not null default 'planned',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, center_id),
  check (end_date is null or start_date is null or end_date >= start_date),
  -- clés composites : un enseignant / programme ne peut appartenir qu'au même centre
  foreign key (teacher_id, center_id) references public.teachers(id, center_id) on delete set null (teacher_id),
  foreign key (program_id, center_id) references public.programs(id, center_id) on delete set null (program_id)
);
create index on public.classes (center_id);
create index on public.classes (teacher_id);
create trigger classes_touch before update on public.classes for each row execute function public.touch_updated_at();

create table public.class_students (
  center_id   uuid not null,
  class_id    uuid not null,
  student_id  uuid not null,
  enrolled_at timestamptz not null default now(),
  primary key (class_id, student_id),
  foreign key (class_id, center_id) references public.classes(id, center_id) on delete cascade,
  foreign key (student_id, center_id) references public.students(id, center_id) on delete cascade
);
create index on public.class_students (student_id);

create or replace function public.enforce_class_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cap int; v_count int;
begin
  select capacity into v_cap from public.classes where id = new.class_id for update;
  select count(*) into v_count from public.class_students where class_id = new.class_id;
  if v_count >= v_cap then
    raise exception 'Class is full (capacity %)', v_cap using errcode = 'P0001', hint = 'class_full';
  end if;
  return new;
end $$;
create trigger class_students_capacity before insert on public.class_students
  for each row execute function public.enforce_class_capacity();

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers(id) on delete cascade,
  role        public.member_role not null check (role in ('manager', 'teacher', 'student')),
  teacher_id  uuid,
  student_id  uuid,
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash  text not null unique,
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  foreign key (teacher_id, center_id) references public.teachers(id, center_id) on delete cascade,
  foreign key (student_id, center_id) references public.students(id, center_id) on delete cascade,
  check ((role = 'teacher') = (teacher_id is not null)),
  check ((role = 'student') = (student_id is not null))
);
create index on public.invitations (center_id);

-- ---------------------------------------------------------------------
-- Fonctions d'autorisation (security definer : évitent la récursion RLS)
-- ---------------------------------------------------------------------
create or replace function public.has_center_role(p_center uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
     where m.center_id = p_center and m.user_id = auth.uid() and m.role = any (p_roles) and not p.is_suspended)
$$;

create or replace function public.is_center_manager(p_center uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_center_role(p_center, array['owner', 'manager']::public.member_role[])
$$;

create or replace function public.is_center_member(p_center uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_center_role(p_center, array['owner', 'manager', 'teacher', 'student']::public.member_role[])
$$;

-- Écriture uniquement si le centre est actif (un centre suspendu reste consultable)
create or replace function public.center_is_active(p_center uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.centers where id = p_center and status = 'active')
$$;

create or replace function public.can_manage_center(p_center uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_center_manager(p_center) and public.center_is_active(p_center)
$$;

create or replace function public.my_teacher_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select t.id from public.teachers t
   where t.user_id = auth.uid() and t.status = 'active'
     and public.has_center_role(t.center_id, array['teacher']::public.member_role[])
$$;

create or replace function public.my_student_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.students s
   where s.user_id = auth.uid() and public.has_center_role(s.center_id, array['student']::public.member_role[])
$$;

create or replace function public.teacher_sees_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes c where c.id = p_class and c.teacher_id in (select public.my_teacher_ids()))
$$;

create or replace function public.teacher_sees_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_students cs join public.classes c on c.id = cs.class_id
     where cs.student_id = p_student and c.teacher_id in (select public.my_teacher_ids()))
$$;

create or replace function public.student_in_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_students cs where cs.class_id = p_class and cs.student_id in (select public.my_student_ids()))
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.centers        enable row level security;
alter table public.memberships    enable row level security;
alter table public.teachers       enable row level security;
alter table public.students       enable row level security;
alter table public.programs       enable row level security;
alter table public.classes        enable row level security;
alter table public.class_students enable row level security;
alter table public.invitations    enable row level security;

-- Centres : visibles par leurs membres et le Super Admin. Création via create_center().
create policy centers_read on public.centers for select using (public.is_center_member(id) or public.is_platform_admin());
create policy centers_update on public.centers for update using (public.can_manage_center(id)) with check (public.can_manage_center(id));
revoke insert, update, delete on public.centers from anon, authenticated;
grant update (name, city, address, phone, email, description, show_on_website) on public.centers to authenticated;

-- Vitrine : centres partenaires qui ont choisi d'apparaître sur le site (colonnes publiques uniquement)
create or replace view public.public_partner_centers with (security_invoker = false) as
  select c.id, c.name, c.city, c.country_code, c.description from public.centers c
   where c.show_on_website and c.status = 'active';
grant select on public.public_partner_centers to anon, authenticated;

create policy memberships_read on public.memberships for select
  using (user_id = auth.uid() or public.is_center_manager(center_id) or public.is_platform_admin());
create policy memberships_delete on public.memberships for delete
  using (public.can_manage_center(center_id) and role in ('teacher', 'student')
         or (role = 'manager' and public.has_center_role(center_id, array['owner']::public.member_role[])));
revoke insert, update on public.memberships from anon, authenticated;

create policy teachers_manager on public.teachers for all
  using (public.is_center_manager(center_id) or public.is_platform_admin())
  with check (public.can_manage_center(center_id));
create policy teachers_self on public.teachers for select using (user_id = auth.uid());
-- fiche liée à un compte uniquement via accept_invitation() : user_id jamais écrit par les clients
revoke insert, update on public.teachers from anon, authenticated;
grant insert (center_id, full_name, email, phone, specialties, status) on public.teachers to authenticated;
grant update (full_name, email, phone, specialties, status) on public.teachers to authenticated;

create policy students_manager on public.students for all
  using (public.is_center_manager(center_id) or public.is_platform_admin())
  with check (public.can_manage_center(center_id));
create policy students_self on public.students for select using (user_id = auth.uid());
create policy students_teacher on public.students for select using (public.teacher_sees_student(id));
revoke insert, update on public.students from anon, authenticated;
grant insert (center_id, full_name, email, phone, birth_date, guardian_name, guardian_phone, cefr_level,
              english_variant, status, enrolled_on, notes) on public.students to authenticated;
grant update (full_name, email, phone, birth_date, guardian_name, guardian_phone, cefr_level,
              english_variant, status, enrolled_on, notes) on public.students to authenticated;

create policy programs_read on public.programs for select using (public.is_center_member(center_id) or public.is_platform_admin());
create policy programs_write on public.programs for all using (public.can_manage_center(center_id)) with check (public.can_manage_center(center_id));

create policy classes_manager on public.classes for all
  using (public.is_center_manager(center_id) or public.is_platform_admin())
  with check (public.can_manage_center(center_id));
create policy classes_teacher on public.classes for select using (teacher_id in (select public.my_teacher_ids()));
create policy classes_student on public.classes for select using (public.student_in_class(id));

create policy class_students_manager on public.class_students for all
  using (public.is_center_manager(center_id) or public.is_platform_admin())
  with check (public.can_manage_center(center_id));
create policy class_students_teacher on public.class_students for select using (public.teacher_sees_class(class_id));
create policy class_students_student on public.class_students for select using (student_id in (select public.my_student_ids()));

create policy invitations_manager_read on public.invitations for select using (public.is_center_manager(center_id));
create policy invitations_manager_delete on public.invitations for delete using (public.can_manage_center(center_id) and accepted_at is null);
revoke insert, update on public.invitations from anon, authenticated;
revoke select on public.invitations from anon, authenticated;
grant select (id, center_id, role, teacher_id, student_id, email, expires_at, accepted_by, accepted_at, created_by, created_at)
  on public.invitations to authenticated;

create policy audit_center_read on public.audit_log for select using (center_id is not null and public.is_center_manager(center_id));

-- Audit
create trigger audit_centers after insert or update or delete on public.centers for each row execute function public.audit_row();
create trigger audit_memberships after insert or delete on public.memberships for each row execute function public.audit_row();
create trigger audit_teachers after insert or update or delete on public.teachers for each row execute function public.audit_row();
create trigger audit_students after insert or update or delete on public.students for each row execute function public.audit_row();
create trigger audit_classes after insert or update or delete on public.classes for each row execute function public.audit_row();
create trigger audit_class_students after insert or delete on public.class_students for each row execute function public.audit_row();
create trigger audit_invitations after insert or update or delete on public.invitations for each row execute function public.audit_row();

-- ---------------------------------------------------------------------
-- RPC métier
-- ---------------------------------------------------------------------
create or replace function public.slugify(p text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(translate(p,
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')), '[^a-z0-9]+', '-', 'g'))
$$;

-- Création d'un centre : l'utilisateur en devient propriétaire (5 centres maximum par compte)
create or replace function public.create_center(p_name text, p_country char(2), p_city text default null,
                                                p_phone text default null, p_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_slug text; v_base text;
begin
  if auth.uid() is null or not public.current_user_active() then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if (select count(*) from public.centers where created_by = auth.uid()) >= 5 then
    raise exception 'Center limit reached' using errcode = 'P0001', hint = 'center_limit';
  end if;
  if not exists (select 1 from public.countries where code = upper(p_country)) then
    raise exception 'Unknown country' using errcode = 'P0001', hint = 'country';
  end if;
  v_base := left(coalesce(nullif(public.slugify(p_name), ''), 'center'), 60);
  v_slug := v_base;
  while exists (select 1 from public.centers where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;
  insert into public.centers (name, slug, country_code, city, phone, email, created_by)
  values (btrim(p_name), v_slug, upper(p_country), nullif(btrim(p_city), ''), nullif(btrim(p_phone), ''),
          nullif(lower(btrim(p_email)), ''), auth.uid())
  returning id into v_id;
  insert into public.memberships (center_id, user_id, role) values (v_id, auth.uid(), 'owner');
  update public.profiles set account_type = 'center_manager' where id = auth.uid() and account_type = 'student';
  return v_id;
end $$;

-- Invitation : renvoie le jeton en clair une seule fois (seule son empreinte est stockée)
create or replace function public.create_invitation(p_center uuid, p_role public.member_role, p_person uuid default null,
                                                    p_email text default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'hex'); v_email text;
begin
  if p_role = 'manager' then
    if not (public.has_center_role(p_center, array['owner']::public.member_role[]) and public.center_is_active(p_center)) then
      raise exception 'Only the owner can invite managers' using errcode = '42501';
    end if;
    v_email := lower(btrim(p_email));
  elsif not public.can_manage_center(p_center) then
    raise exception 'Not allowed' using errcode = '42501';
  elsif p_role = 'teacher' then
    select coalesce(lower(btrim(p_email)), email) into v_email from public.teachers where id = p_person and center_id = p_center and user_id is null;
    if not found then raise exception 'Teacher not found or already linked' using errcode = 'P0001', hint = 'person'; end if;
  elsif p_role = 'student' then
    select coalesce(lower(btrim(p_email)), email) into v_email from public.students where id = p_person and center_id = p_center and user_id is null;
    if not found then raise exception 'Student not found or already linked' using errcode = 'P0001', hint = 'person'; end if;
  else
    raise exception 'Invalid role' using errcode = 'P0001';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid e-mail is required' using errcode = 'P0001', hint = 'email';
  end if;
  -- une seule invitation en attente par personne
  delete from public.invitations where center_id = p_center and accepted_at is null
     and ((p_role = 'teacher' and teacher_id = p_person) or (p_role = 'student' and student_id = p_person)
          or (p_role = 'manager' and role = 'manager' and email = v_email));
  insert into public.invitations (center_id, role, teacher_id, student_id, email, token_hash, created_by)
  values (p_center, p_role, case when p_role = 'teacher' then p_person end, case when p_role = 'student' then p_person end,
          v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token;
end $$;

-- Aperçu d'une invitation (page publique /invite/[token]) — ne révèle que le nom du centre et le rôle
create or replace function public.invitation_preview(p_token text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('center_name', c.name, 'role', i.role,
           'email_hint', regexp_replace(i.email, '^(.).*(@.*)$', '\1***\2'),
           'expired', i.expires_at < now(), 'accepted', i.accepted_at is not null)
    from public.invitations i join public.centers c on c.id = i.center_id
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

-- Acceptation : l'e-mail du compte connecté doit correspondre à l'invitation
create or replace function public.accept_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare inv public.invitations; v_email text;
begin
  if auth.uid() is null or not public.current_user_active() then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into inv from public.invitations where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'Invalid invitation' using errcode = 'P0001', hint = 'invalid'; end if;
  if inv.accepted_at is not null then raise exception 'Invitation already used' using errcode = 'P0001', hint = 'used'; end if;
  if inv.expires_at < now() then raise exception 'Invitation expired' using errcode = 'P0001', hint = 'expired'; end if;
  if not public.center_is_active(inv.center_id) then raise exception 'Center unavailable' using errcode = 'P0001', hint = 'center'; end if;
  select email into v_email from public.profiles where id = auth.uid();
  if lower(v_email) is distinct from lower(inv.email) then
    raise exception 'This invitation was sent to another e-mail address' using errcode = 'P0001', hint = 'email_mismatch';
  end if;
  if inv.role = 'teacher' then
    update public.teachers set user_id = auth.uid() where id = inv.teacher_id and user_id is null;
    if not found then raise exception 'Already linked' using errcode = 'P0001', hint = 'used'; end if;
  elsif inv.role = 'student' then
    update public.students set user_id = auth.uid() where id = inv.student_id and user_id is null;
    if not found then raise exception 'Already linked' using errcode = 'P0001', hint = 'used'; end if;
  end if;
  insert into public.memberships (center_id, user_id, role) values (inv.center_id, auth.uid(), inv.role) on conflict do nothing;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return jsonb_build_object('center_id', inv.center_id, 'role', inv.role);
end $$;

-- Détacher un compte d'une fiche (enseignant / étudiant) : retire l'accès au centre
create or replace function public.unlink_person(p_center uuid, p_role public.member_role, p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.can_manage_center(p_center) or p_role not in ('teacher', 'student') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_role = 'teacher' then
    select user_id into v_user from public.teachers where id = p_person and center_id = p_center for update;
    update public.teachers set user_id = null where id = p_person and center_id = p_center;
  else
    select user_id into v_user from public.students where id = p_person and center_id = p_center for update;
    update public.students set user_id = null where id = p_person and center_id = p_center;
  end if;
  if v_user is not null then
    delete from public.memberships where center_id = p_center and user_id = v_user and role = p_role;
  end if;
end $$;

-- Tableau de bord du centre
create or replace function public.center_stats(p_center uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_center_manager(p_center) or public.is_platform_admin()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students', (select count(*) from public.students where center_id = p_center and status = 'active'),
    'students_linked', (select count(*) from public.students where center_id = p_center and user_id is not null),
    'teachers', (select count(*) from public.teachers where center_id = p_center and status = 'active'),
    'classes', (select count(*) from public.classes where center_id = p_center and status <> 'finished'),
    'programs', (select count(*) from public.programs where center_id = p_center),
    'pending_invitations', (select count(*) from public.invitations where center_id = p_center and accepted_at is null and expires_at > now()),
    'by_level', coalesce((select jsonb_object_agg(cefr_level, n) from (
        select cefr_level, count(*) n from public.students where center_id = p_center and status = 'active' group by 1) x), '{}'::jsonb));
end $$;

-- Équipe du centre (nom et e-mail des comptes membres), réservée aux gestionnaires
create or replace function public.center_members(p_center uuid)
returns table(user_id uuid, role public.member_role, full_name text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_center_manager(p_center) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query select m.user_id, m.role, p.full_name, p.email, m.created_at
    from public.memberships m join public.profiles p on p.id = m.user_id
   where m.center_id = p_center order by m.role, p.full_name;
end $$;
revoke execute on function public.center_members(uuid) from public, anon;
grant execute on function public.center_members(uuid) to authenticated;
