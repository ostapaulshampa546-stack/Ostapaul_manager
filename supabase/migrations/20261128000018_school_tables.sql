-- =====================================================================
-- 0018 : tableaux de l'école — statistiques par élève et par classe
-- (présences, cotation, finances), en lecture seule, selon les droits.
-- =====================================================================

create or replace function public.school_student_stats(
  p_tenant uuid, p_class uuid default null, p_from date default null, p_to date default null, p_period uuid default null
) returns table (
  student_id uuid, matricule text, last_name text, post_name text, first_name text, gender text, birth_date date,
  class_id uuid, class_name text, guardian_name text, guardian_phone text, status text,
  days_class int, days_present int, days_late int, days_excused int, days_absent int, attendance_rate numeric,
  percentage numeric, class_rank int, courses_graded int,
  due numeric, paid numeric, balance numeric, overdue numeric, currency text
) language plpgsql stable security definer set search_path = public as $$
declare
  v_att boolean; v_fees boolean;
  v_from date := coalesce(p_from, date_trunc('month', (now() at time zone 'Africa/Kinshasa')::date)::date);
  v_to date := coalesce(p_to, (now() at time zone 'Africa/Kinshasa')::date);
  v_cur text;
begin
  if not (public.has_perm(p_tenant, 'academic.read') or public.has_perm(p_tenant, 'academic.write') or public.is_platform_admin()) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  v_att := public.has_perm(p_tenant, 'attendance.read') or public.has_perm(p_tenant, 'attendance.scan') or public.is_platform_admin();
  v_fees := public.has_perm(p_tenant, 'fees.read') or public.has_perm(p_tenant, 'fees.write') or public.is_platform_admin();
  select base_currency into v_cur from public.tenants where id = p_tenant;

  return query
  with st as (
    select s.* from public.students s
     where s.tenant_id = p_tenant and (p_class is null or s.class_id = p_class)
  ),
  -- Jours de classe : jours où au moins un élève de la classe a été pointé ou appelé
  class_days as (
    select s.class_id, count(distinct a.attendance_date)::int as n
      from public.attendance a join public.students s on s.id = a.person_id
     where a.tenant_id = p_tenant and a.person_type = 'student' and a.attendance_date between v_from and v_to
       and (p_class is null or s.class_id = p_class)
     group by s.class_id
  ),
  att as (
    select a.person_id,
           count(distinct a.attendance_date) filter (where a.status in ('present', 'late'))::int as present,
           count(distinct a.attendance_date) filter (where a.status = 'late')::int as late,
           count(distinct a.attendance_date) filter (where a.status = 'excused')::int as excused
      from public.attendance a
     where a.tenant_id = p_tenant and a.person_type = 'student' and a.attendance_date between v_from and v_to
     group by a.person_id
  ),
  gr as (
    select s.id as sid,
           coalesce(sum(g.score / g.max_score * c.max_points), 0) as obt,
           coalesce(sum(case when g.id is not null then c.max_points end), 0) as mx,
           count(g.id)::int as n
      from st s
      left join public.courses c on c.class_id = s.class_id
      left join public.grades g on g.student_id = s.id and g.course_id = c.id and g.period_id = p_period
     where p_period is not null
     group by s.id
  ),
  fin as (
    select i.student_id as sid,
           sum(public.to_base(p_tenant, i.net_amount, i.currency)) as due,
           sum(public.to_base(p_tenant, i.paid_amount, i.currency)) as paid,
           sum(public.to_base(p_tenant, case when i.due_date < current_date and i.status in ('unpaid', 'partial') then i.net_amount - i.paid_amount else 0 end, i.currency)) as overdue
      from public.student_invoices i
     where i.tenant_id = p_tenant and i.status <> 'void'
     group by i.student_id
  )
  select s.id, s.matricule, s.last_name, s.post_name, s.first_name, s.gender, s.birth_date,
         s.class_id, cl.name, s.guardian_name, s.guardian_phone, s.status,
         case when v_att then coalesce(cd.n, 0) end,
         case when v_att then coalesce(at.present, 0) end,
         case when v_att then coalesce(at.late, 0) end,
         case when v_att then coalesce(at.excused, 0) end,
         case when v_att then greatest(coalesce(cd.n, 0) - coalesce(at.present, 0) - coalesce(at.excused, 0), 0) end,
         case when v_att and coalesce(cd.n, 0) > 0 then round(least(coalesce(at.present, 0)::numeric / cd.n, 1) * 100, 1) end,
         case when g.mx > 0 then round(g.obt / g.mx * 100, 2) end,
         case when g.mx > 0 then (rank() over (partition by s.class_id order by case when g.mx > 0 then g.obt / g.mx end desc nulls last))::int end,
         coalesce(g.n, 0),
         case when v_fees then coalesce(f.due, 0) end,
         case when v_fees then coalesce(f.paid, 0) end,
         case when v_fees then coalesce(f.due, 0) - coalesce(f.paid, 0) end,
         case when v_fees then coalesce(f.overdue, 0) end,
         v_cur
    from st s
    left join public.classes cl on cl.id = s.class_id
    left join class_days cd on cd.class_id = s.class_id
    left join att at on at.person_id = s.id
    left join gr g on g.sid = s.id
    left join fin f on f.sid = s.id
   order by cl.name nulls last, s.last_name, s.first_name;
end $$;

create or replace function public.school_class_overview(
  p_tenant uuid, p_from date default null, p_to date default null, p_period uuid default null
) returns table (
  class_id uuid, class_name text, level text, option_name text, titular text, capacity int,
  students int, boys int, girls int, attendance_rate numeric, average numeric, passed int, graded int,
  due numeric, paid numeric, balance numeric, overdue numeric, debtors int, currency text
) language plpgsql stable security definer set search_path = public as $$
declare v_pass numeric;
begin
  select coalesce((settings ->> 'pass_mark')::numeric, 50) into v_pass from public.tenants where id = p_tenant;
  return query
  with s as (select * from public.school_student_stats(p_tenant, null, p_from, p_to, p_period) x where x.status = 'active')
  select c.id, c.name, c.level, c.option_name,
         nullif(trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')), ''), c.capacity,
         count(s.student_id)::int,
         count(s.student_id) filter (where s.gender = 'M')::int,
         count(s.student_id) filter (where s.gender = 'F')::int,
         case when sum(s.days_class) > 0 then round(sum(s.days_present)::numeric / sum(s.days_class) * 100, 1) end,
         round(avg(s.percentage), 2),
         count(*) filter (where s.percentage >= v_pass)::int,
         count(s.percentage)::int,
         sum(s.due), sum(s.paid), sum(s.balance), sum(s.overdue),
         count(*) filter (where s.balance > 0)::int,
         max(s.currency)
    from public.classes c
    left join public.teachers t on t.id = c.titular_teacher_id
    left join s on s.class_id = c.id
   where c.tenant_id = p_tenant
   group by c.id, c.name, c.level, c.option_name, t.first_name, t.last_name, c.capacity
   order by c.name;
end $$;

revoke execute on function public.school_student_stats(uuid, uuid, date, date, uuid), public.school_class_overview(uuid, date, date, uuid) from public, anon;
grant execute on function public.school_student_stats(uuid, uuid, date, date, uuid), public.school_class_overview(uuid, date, date, uuid) to authenticated;
