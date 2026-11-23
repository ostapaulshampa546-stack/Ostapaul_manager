-- =====================================================================
-- 0008 : application des paiements, création d'établissement,
--        facturation des abonnements, super admin, automatisations,
--        tableaux de bord, formules (seed) et droits d'exécution
-- =====================================================================

create or replace function public.convert_amount(p_tenant uuid, p_amount numeric, p_from text, p_to text) returns numeric
language sql stable security definer set search_path = public as $$
  select case
    when p_from = p_to then p_amount
    when p_from = 'CDF' and p_to = 'USD' then round(p_amount / t.cdf_per_usd, 2)
    when p_from = 'USD' and p_to = 'CDF' then round(p_amount * t.cdf_per_usd, 2)
    else p_amount end
  from public.tenants t where t.id = p_tenant
$$;

-- ---------------------------------------------------------------------
-- Contrôle de l'objet payé (même établissement, pas de surpaiement)
-- ---------------------------------------------------------------------
create or replace function public.payment_payable_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_cur text; v_remaining numeric;
begin
  if new.payable_type = 'other' then return new; end if;
  if new.payable_type = 'order' then
    select tenant_id, currency, total - paid_amount into v_tenant, v_cur, v_remaining from public.orders
     where id = new.payable_id and status not in ('paid', 'cancelled');
  elsif new.payable_type = 'student_invoice' then
    select tenant_id, currency, net_amount - paid_amount into v_tenant, v_cur, v_remaining from public.student_invoices
     where id = new.payable_id and status in ('unpaid', 'partial');
  elsif new.payable_type = 'sales_document' then
    select tenant_id, currency, total - paid_amount into v_tenant, v_cur, v_remaining from public.sales_documents
     where id = new.payable_id and doc_type = 'invoice' and status in ('issued', 'partial');
  elsif new.payable_type = 'subscription_invoice' then
    select tenant_id, 'USD', amount_usd into v_tenant, v_cur, v_remaining from public.subscription_invoices
     where id = new.payable_id and status = 'unpaid';
  end if;
  if v_tenant is null or v_tenant <> new.tenant_id then
    raise exception 'Document à payer introuvable, déjà soldé ou d''un autre établissement' using errcode = '42501';
  end if;
  if public.convert_amount(new.tenant_id, new.amount, new.currency, v_cur) > v_remaining + 0.01 then
    raise exception 'Montant supérieur au reste à payer (% %)', v_remaining, v_cur;
  end if;
  return new;
end $$;
create trigger payments_payable_check before insert on public.payments
  for each row execute function public.payment_payable_check();

-- ---------------------------------------------------------------------
-- Application d'un paiement confirmé (ou remboursé) à son document
-- ---------------------------------------------------------------------
create or replace function public.apply_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sign int;
  v_amt numeric;
  inv public.subscription_invoices;
  sub public.subscriptions;
  v_start timestamptz;
  si public.student_invoices;
  st public.students;
begin
  if new.status = 'succeeded' and (tg_op = 'INSERT' or old.status <> 'succeeded') then v_sign := 1;
  elsif tg_op = 'UPDATE' and old.status = 'succeeded' and new.status = 'refunded' then v_sign := -1;
  else return new; end if;

  perform set_config('ostapaul.payment_apply', 'on', true);
  if new.payable_type = 'order' then
    update public.orders o set
      paid_amount = o.paid_amount + v_sign * public.convert_amount(o.tenant_id, new.amount, new.currency, o.currency)
    where o.id = new.payable_id;
    update public.orders set status = 'paid' where id = new.payable_id and paid_amount >= total and status not in ('paid', 'cancelled');
  elsif new.payable_type = 'student_invoice' then
    update public.student_invoices i set
      paid_amount = i.paid_amount + v_sign * public.convert_amount(i.tenant_id, new.amount, new.currency, i.currency)
    where i.id = new.payable_id returning * into si;
    update public.student_invoices set status = case when paid_amount >= net_amount then 'paid'
      when paid_amount > 0 then 'partial' else 'unpaid' end where id = new.payable_id;
    -- Confirmation au parent (Premium : SMS/WhatsApp)
    select * into st from public.students where id = si.student_id;
    if v_sign = 1 and public.tenant_has_feature(new.tenant_id, 'sms_whatsapp')
       and exists (select 1 from public.automations a where a.tenant_id = new.tenant_id and a.kind = 'parent_notification' and a.enabled)
       and coalesce(st.guardian_whatsapp, st.guardian_phone) is not null then
      insert into public.message_outbox (tenant_id, channel, to_address, body, related_type, related_id, created_by)
      values (new.tenant_id, case when st.guardian_whatsapp is not null then 'whatsapp' else 'sms' end,
              coalesce(st.guardian_whatsapp, st.guardian_phone),
              'Paiement reçu : ' || new.amount || ' ' || new.currency || ' pour ' || st.first_name || ' ' || st.last_name ||
              ' (' || si.description || '). Reçu ' || new.receipt_number || '. Merci.',
              'payment', new.id, null);
    end if;
  elsif new.payable_type = 'sales_document' then
    update public.sales_documents d set
      paid_amount = d.paid_amount + v_sign * public.convert_amount(d.tenant_id, new.amount, new.currency, d.currency)
    where d.id = new.payable_id;
    update public.sales_documents set status = case when paid_amount >= total then 'paid'
      when paid_amount > 0 then 'partial' else 'issued' end where id = new.payable_id;
  elsif new.payable_type = 'subscription_invoice' and v_sign = 1 then
    update public.subscription_invoices set status = 'paid', paid_at = now() where id = new.payable_id returning * into inv;
    select * into sub from public.subscriptions where id = inv.subscription_id for update;
    v_start := greatest(now(), coalesce(case when sub.status in ('active', 'past_due') then sub.current_period_end end, now()));
    update public.subscriptions set status = 'active', plan_id = inv.plan_id,
      current_period_start = v_start, current_period_end = v_start + interval '1 month'
    where id = sub.id;
    perform public.notify_tenant(inv.tenant_id, 'billing', 'Abonnement renouvelé',
      'Paiement de ' || inv.amount_usd || ' USD reçu. Valable jusqu''au ' || to_char(v_start + interval '1 month', 'DD/MM/YYYY') || '.', '/subscription');
  end if;
  perform set_config('ostapaul.payment_apply', 'off', true);
  return new;
end $$;
create trigger payments_apply after insert or update of status on public.payments
  for each row execute function public.apply_payment();

-- ---------------------------------------------------------------------
-- Création d'un établissement (avec essai configurable, 48 h par défaut)
-- ---------------------------------------------------------------------
create or replace function public.create_tenant(
  p_sector public.sector, p_name text, p_tier public.plan_tier default 'standard',
  p_currency text default 'USD', p_city text default 'Kinshasa', p_phone text default null,
  p_parent uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_plan public.plans;
  v_trial boolean;
  v_hours int;
  v_year uuid;
  v_parent public.tenants;
begin
  if v_uid is null then raise exception 'Authentification requise' using errcode = '42501'; end if;
  if p_parent is not null then
    select * into v_parent from public.tenants where id = p_parent;
    if v_parent.owner_id <> v_uid or not public.tenant_has_feature(p_parent, 'multi_establishment') then
      raise exception 'La gestion multi-établissements nécessite la formule Premium' using errcode = '42501';
    end if;
    if v_parent.parent_id is not null then raise exception 'Une succursale ne peut pas avoir de succursale'; end if;
    p_sector := v_parent.sector;
  elsif (select count(*) from public.tenants where owner_id = v_uid and parent_id is null) >= 5 then
    raise exception 'Nombre maximal d''établissements atteint, contactez le support';
  end if;

  select * into v_plan from public.plans where sector = p_sector and tier = p_tier and is_active;
  if v_plan.id is null then raise exception 'Formule introuvable'; end if;

  insert into public.tenants (sector, name, owner_id, base_currency, city, phone, parent_id, settings)
  values (p_sector, trim(p_name), v_uid, coalesce(p_currency, 'USD'), p_city, p_phone, p_parent,
          jsonb_build_object('pass_mark', 50, 'retake_mark', 40, 'late_after', case when p_sector = 'school' then '07:45' else '08:15' end,
                             'cash_tolerance', 1, 'qr_ordering', true, 'tax_rate', 16))
  returning id into v_tenant;
  insert into public.memberships (tenant_id, user_id, role) values (v_tenant, v_uid, 'owner');

  if p_parent is null then
    -- un seul essai gratuit par utilisateur et par secteur
    v_trial := not exists (select 1 from public.tenants t where t.owner_id = v_uid and t.sector = p_sector and t.id <> v_tenant);
    select trial_hours into v_hours from public.platform_settings;
    insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at)
    values (v_tenant, v_plan.id, case when v_trial and v_hours > 0 then 'trialing' else 'expired' end::public.sub_status,
            case when v_trial then now() + make_interval(hours => v_hours) end);
  end if;

  insert into public.automations (tenant_id, kind, enabled)
  select v_tenant, k, k in ('stock_alert', 'daily_report', 'subscription_renewal', 'finance_alert')
    from unnest(array['payment_reminder', 'stock_alert', 'parent_notification', 'daily_report', 'subscription_renewal', 'finance_alert']) k;

  if p_sector = 'school' then
    insert into public.academic_years (tenant_id, name, start_date, end_date, is_current)
    values (v_tenant,
            case when extract(month from now()) >= 9 then extract(year from now())::int || '-' || (extract(year from now())::int + 1)
                 else (extract(year from now())::int - 1) || '-' || extract(year from now())::int end,
            make_date(case when extract(month from now()) >= 9 then extract(year from now())::int else extract(year from now())::int - 1 end, 9, 1),
            make_date(case when extract(month from now()) >= 9 then extract(year from now())::int + 1 else extract(year from now())::int end, 7, 2),
            true)
    returning id into v_year;
    insert into public.grading_periods (tenant_id, academic_year_id, name, sort) values
      (v_tenant, v_year, '1re période', 1), (v_tenant, v_year, '2e période', 2), (v_tenant, v_year, 'Examen 1er semestre', 3),
      (v_tenant, v_year, '3e période', 4), (v_tenant, v_year, '4e période', 5), (v_tenant, v_year, 'Examen 2e semestre', 6);
  elsif p_sector = 'restaurant' then
    insert into public.menu_categories (tenant_id, name, sort) values
      (v_tenant, 'Entrées', 1), (v_tenant, 'Plats', 2), (v_tenant, 'Boissons', 3), (v_tenant, 'Desserts', 4);
  end if;

  perform public.notify_tenant(v_tenant, 'welcome', 'Bienvenue sur OSTAPAUL MANAGER',
    case when p_parent is not null then 'Succursale créée.'
         when v_trial then 'Votre essai gratuit de ' || v_hours || ' heures a commencé.'
         else 'Réglez votre abonnement pour activer l''établissement.' end, '/subscription');
  return v_tenant;
end $$;

-- Acceptation des invitations correspondant à l'e-mail de l'utilisateur connecté
create or replace function public.accept_invitations() returns int
language plpgsql security definer set search_path = public as $$
declare v_email text; n int := 0; i record;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  for i in select * from public.invitations where lower(email) = lower(v_email) and accepted_at is null loop
    insert into public.memberships (tenant_id, user_id, role, permissions)
    values (i.tenant_id, auth.uid(), i.role, i.permissions)
    on conflict (tenant_id, user_id) do nothing;
    update public.invitations set accepted_at = now() where id = i.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Abonnement : changement de formule, facture de renouvellement
-- ---------------------------------------------------------------------
create or replace function public.change_plan(p_tenant uuid, p_tier public.plan_tier) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tenants; p public.plans; sub public.subscriptions; v_users int;
begin
  select * into t from public.tenants where id = p_tenant;
  if t.id is null or t.owner_id <> auth.uid() then raise exception 'Seul le propriétaire peut changer de formule' using errcode = '42501'; end if;
  if t.parent_id is not null then raise exception 'Changez la formule depuis l''établissement principal'; end if;
  select * into p from public.plans where sector = t.sector and tier = p_tier and is_active;
  if p.id is null then raise exception 'Formule introuvable'; end if;
  select count(*) into v_users from public.memberships where tenant_id = p_tenant and role <> 'owner' and is_active;
  if p.max_extra_users is not null and v_users > p.max_extra_users then
    raise exception 'Cette formule autorise % utilisateur(s) supplémentaire(s) ; vous en avez %. Désactivez des comptes d''abord.', p.max_extra_users, v_users;
  end if;
  if p_tier <> 'premium' and exists (select 1 from public.tenants where parent_id = p_tenant) then
    raise exception 'Vos succursales nécessitent la formule Premium';
  end if;
  select * into sub from public.subscriptions where tenant_id = p_tenant for update;
  update public.subscriptions set plan_id = p.id where id = sub.id;
  -- facture en attente : remplacée par le nouveau tarif
  update public.subscription_invoices set status = 'void' where subscription_id = sub.id and status = 'unpaid';
  perform public.notify_tenant(p_tenant, 'billing', 'Formule modifiée : ' || p.name, 'Nouveau tarif : ' || p.price_usd || ' USD / mois.', '/subscription');
end $$;

create or replace function public.create_renewal_invoice(p_tenant uuid) returns public.subscription_invoices
language plpgsql security definer set search_path = public as $$
declare sub public.subscriptions; p public.plans; inv public.subscription_invoices; v_start timestamptz; v_internal boolean;
begin
  v_internal := public.jwt_role() = 'service_role' or current_setting('ostapaul.cron', true) = 'on';
  if not v_internal and not (public.member_role_of(p_tenant) in ('owner', 'admin') or public.is_platform_admin()) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  select * into sub from public.subscriptions where tenant_id = p_tenant;
  if sub.id is null then raise exception 'Aucun abonnement (succursale ?)'; end if;
  select * into inv from public.subscription_invoices where subscription_id = sub.id and status = 'unpaid' order by created_at desc limit 1;
  if inv.id is not null then return inv; end if;
  select * into p from public.plans where id = sub.plan_id;
  v_start := greatest(now(), coalesce(case when sub.status in ('active', 'past_due') then sub.current_period_end end, now()));
  insert into public.subscription_invoices (tenant_id, subscription_id, plan_id, number, amount_usd, period_start, period_end, due_date)
  values (p_tenant, sub.id, p.id, public.gen_reference('ABO'), p.price_usd, v_start, v_start + interval '1 month',
          coalesce(sub.current_period_end, now()))
  returning * into inv;
  return inv;
end $$;

create or replace function public.cancel_subscription(p_tenant uuid, p_cancel boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select owner_id from public.tenants where id = p_tenant) is distinct from auth.uid() then
    raise exception 'Seul le propriétaire peut résilier' using errcode = '42501';
  end if;
  update public.subscriptions set cancel_at_period_end = p_cancel where tenant_id = p_tenant;
end $$;

-- ---------------------------------------------------------------------
-- Cycle de facturation (pg_cron horaire ou /api/cron)
-- ---------------------------------------------------------------------
create or replace function public.billing_cycle() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; n_exp int := 0; n_due int := 0; n_inv int := 0; ps public.platform_settings;
begin
  if public.jwt_role() not in ('service_role', 'none') and not public.is_platform_admin() then
    raise exception 'Réservé au système' using errcode = '42501';
  end if;
  perform set_config('ostapaul.cron', 'on', true);
  select * into ps from public.platform_settings;

  -- rappel de fin d'essai (12 h avant)
  for r in select s.* from public.subscriptions s where s.status = 'trialing'
           and s.trial_ends_at between now() and now() + interval '12 hours'
           and not exists (select 1 from public.notifications n where n.tenant_id = s.tenant_id and n.kind = 'trial_ending') loop
    insert into public.notifications (tenant_id, kind, title, body, link)
    values (r.tenant_id, 'trial_ending', 'Votre essai se termine bientôt',
            'Fin de l''essai le ' || to_char(r.trial_ends_at at time zone 'Africa/Kinshasa', 'DD/MM/YYYY HH24:MI') || '. Souscrivez pour continuer.', '/subscription');
  end loop;

  update public.subscriptions set status = 'expired' where status = 'trialing' and trial_ends_at <= now();
  get diagnostics n_exp = row_count;

  update public.subscriptions set status = 'canceled'
   where status = 'active' and current_period_end <= now() and cancel_at_period_end;
  update public.subscriptions set status = 'past_due' where status = 'active' and current_period_end <= now();
  get diagnostics n_due = row_count;
  update public.subscriptions set status = 'expired'
   where status = 'past_due' and current_period_end + make_interval(days => ps.grace_days) <= now();

  -- factures de renouvellement 3 jours avant l'échéance
  for r in select s.* from public.subscriptions s
           where s.status in ('active', 'past_due') and not s.cancel_at_period_end
             and s.current_period_end <= now() + interval '3 days'
             and not exists (select 1 from public.subscription_invoices i where i.subscription_id = s.id and i.status = 'unpaid') loop
    perform public.create_renewal_invoice(r.tenant_id);
    insert into public.notifications (tenant_id, kind, title, body, link)
    values (r.tenant_id, 'billing', 'Facture de renouvellement disponible',
            'Votre abonnement expire le ' || to_char(r.current_period_end at time zone 'Africa/Kinshasa', 'DD/MM/YYYY') || '.', '/subscription');
    n_inv := n_inv + 1;
  end loop;

  perform set_config('ostapaul.cron', 'off', true);
  return jsonb_build_object('trials_expired', n_exp, 'past_due', n_due, 'invoices_created', n_inv);
end $$;

-- ---------------------------------------------------------------------
-- Automatisations intelligentes (exécutées quotidiennement)
-- ---------------------------------------------------------------------
create or replace function public.run_automations() returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; r record; n int := 0; v_rev numeric; v_exp numeric; v_low int; t public.tenants;
begin
  if public.jwt_role() not in ('service_role', 'none') and not public.is_platform_admin() then
    raise exception 'Réservé au système' using errcode = '42501';
  end if;
  for a in select au.* from public.automations au
           where au.enabled and (au.last_run_at is null or au.last_run_at < now() - interval '20 hours') loop
    select * into t from public.tenants where id = a.tenant_id;
    continue when not public.tenant_has_feature(a.tenant_id, 'notifications');

    if a.kind = 'stock_alert' then
      select count(*) into v_low from public.products where tenant_id = a.tenant_id and is_active and qty_on_hand <= min_qty;
      if v_low > 0 then
        perform public.notify_tenant(a.tenant_id, 'stock', v_low || ' produit(s) en rupture ou sous le seuil', 'Pensez à vous réapprovisionner.', '/stock');
        n := n + 1;
      end if;

    elsif a.kind in ('daily_report', 'finance_alert') then
      select coalesce(sum(public.to_base(a.tenant_id, amount, currency)), 0) into v_rev from public.payments
       where tenant_id = a.tenant_id and status = 'succeeded' and payable_type <> 'subscription_invoice'
         and (paid_at at time zone 'Africa/Kinshasa')::date = (now() at time zone 'Africa/Kinshasa')::date - 1;
      select coalesce(sum(public.to_base(a.tenant_id, amount, currency)), 0) into v_exp from public.expenses
       where tenant_id = a.tenant_id and expense_date = (now() at time zone 'Africa/Kinshasa')::date - 1;
      if a.kind = 'daily_report' then
        perform public.notify_tenant(a.tenant_id, 'report', 'Rapport du ' || to_char(now() - interval '1 day', 'DD/MM/YYYY'),
          'Recettes : ' || v_rev || ' ' || t.base_currency || ' — Dépenses : ' || v_exp || ' ' || t.base_currency ||
          ' — Résultat : ' || (v_rev - v_exp) || ' ' || t.base_currency, '/finance');
        n := n + 1;
      elsif v_exp > v_rev and v_exp > 0 then
        perform public.notify_tenant(a.tenant_id, 'finance', 'Alerte financière : dépenses supérieures aux recettes hier',
          'Dépenses ' || v_exp || ' vs recettes ' || v_rev || ' ' || t.base_currency, '/finance');
        n := n + 1;
      end if;

    elsif a.kind = 'payment_reminder' and public.tenant_has_feature(a.tenant_id, 'automation') then
      -- frais scolaires en retard -> parents (SMS/WhatsApp si Premium) ; 1 rappel / 7 jours / facture
      for r in select i.*, s.first_name, s.last_name, coalesce(s.guardian_whatsapp, s.guardian_phone) as phone,
                      s.guardian_whatsapp is not null as wa
                 from public.student_invoices i join public.students s on s.id = i.student_id
                where i.tenant_id = a.tenant_id and i.status in ('unpaid', 'partial') and i.due_date < current_date
                  and coalesce(s.guardian_whatsapp, s.guardian_phone) is not null
                  and not exists (select 1 from public.message_outbox m where m.related_id = i.id
                                  and m.created_at > now() - interval '7 days') limit 500 loop
        insert into public.message_outbox (tenant_id, channel, to_address, body, related_type, related_id, created_by)
        values (a.tenant_id, case when r.wa then 'whatsapp' else 'sms' end, r.phone,
                t.name || ' : rappel de paiement pour ' || r.first_name || ' ' || r.last_name || ' — ' || r.description ||
                ', reste ' || (r.net_amount - r.paid_amount) || ' ' || r.currency || '. Merci.',
                'student_invoice', r.id, null);
        n := n + 1;
      end loop;
      -- factures clients PME en retard -> notification interne
      for r in select d.* from public.sales_documents d where d.tenant_id = a.tenant_id and d.doc_type = 'invoice'
                  and d.status in ('issued', 'partial') and d.due_date < current_date loop
        perform public.notify_tenant(a.tenant_id, 'payment', 'Facture ' || r.number || ' en retard',
          'Reste à encaisser : ' || (r.total - r.paid_amount) || ' ' || r.currency, '/pme/documents/' || r.id);
        n := n + 1;
      end loop;

    elsif a.kind = 'parent_notification' and public.tenant_has_feature(a.tenant_id, 'automation') then
      -- absences du jour ouvrable précédent (élèves actifs sans aucun pointage)
      for r in select s.*, coalesce(s.guardian_whatsapp, s.guardian_phone) as phone, s.guardian_whatsapp is not null as wa
                 from public.students s
                where s.tenant_id = a.tenant_id and s.status = 'active'
                  and extract(isodow from (now() at time zone 'Africa/Kinshasa')::date - 1) between 1 and 6
                  and coalesce(s.guardian_whatsapp, s.guardian_phone) is not null
                  and exists (select 1 from public.attendance x where x.tenant_id = a.tenant_id
                              and x.attendance_date = (now() at time zone 'Africa/Kinshasa')::date - 1) -- jour d'école effectif
                  and not exists (select 1 from public.attendance x where x.person_type = 'student' and x.person_id = s.id
                                  and x.attendance_date = (now() at time zone 'Africa/Kinshasa')::date - 1
                                  and x.status in ('present', 'late', 'excused'))
                limit 1000 loop
        insert into public.message_outbox (tenant_id, channel, to_address, body, related_type, related_id, created_by)
        values (a.tenant_id, case when r.wa then 'whatsapp' else 'sms' end, r.phone,
                t.name || ' : ' || r.first_name || ' ' || r.last_name || ' était absent(e) le ' ||
                to_char(now() - interval '1 day', 'DD/MM/YYYY') || '.', 'absence', r.id, null);
        n := n + 1;
      end loop;
    end if;
    update public.automations set last_run_at = now() where id = a.id;
  end loop;
  return jsonb_build_object('actions', n);
end $$;

-- ---------------------------------------------------------------------
-- Tableau de bord (données réelles) et prévisions de stock
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.tenants; v jsonb; v_today date := (now() at time zone 'Africa/Kinshasa')::date;
begin
  select * into t from public.tenants where id = p_tenant;
  if t.id is null or not (public.is_member(p_tenant) or public.is_platform_admin()) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  v := jsonb_build_object(
    'currency', t.base_currency,
    'revenue_today', (select coalesce(sum(public.to_base(p_tenant, amount, currency)), 0) from public.payments
        where tenant_id = p_tenant and status = 'succeeded' and payable_type <> 'subscription_invoice'
          and (paid_at at time zone 'Africa/Kinshasa')::date = v_today),
    'revenue_month', (select coalesce(sum(revenue), 0) from public.finance_summary(p_tenant, date_trunc('month', v_today)::date, v_today, 'day')),
    'expenses_month', (select coalesce(sum(expenses), 0) from public.finance_summary(p_tenant, date_trunc('month', v_today)::date, v_today, 'day')),
    'pending_payments', (select count(*) from public.payments where tenant_id = p_tenant and status = 'pending'),
    'low_stock', (select count(*) from public.products where tenant_id = p_tenant and is_active and qty_on_hand <= min_qty),
    'open_alerts', (select count(*) from public.fraud_alerts where tenant_id = p_tenant and status = 'open'),
    'staff_present_today', (select count(distinct person_id) from public.attendance where tenant_id = p_tenant
        and person_type = 'employee' and attendance_date = v_today and status in ('present', 'late')),
    'employees', (select count(*) from public.employees where tenant_id = p_tenant and is_active),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', period, 'r', revenue, 'e', expenses) order by period), '[]'::jsonb)
                 from public.finance_summary(p_tenant, v_today - 29, v_today, 'day'))
  );
  if t.sector = 'restaurant' then
    v := v || jsonb_build_object(
      'open_orders', (select count(*) from public.orders where tenant_id = p_tenant and status not in ('paid', 'cancelled')),
      'orders_today', (select count(*) from public.orders where tenant_id = p_tenant and (created_at at time zone 'Africa/Kinshasa')::date = v_today and status <> 'cancelled'),
      'tables_occupied', (select count(*) from public.dining_tables where tenant_id = p_tenant and status = 'occupied'),
      'tables_total', (select count(*) from public.dining_tables where tenant_id = p_tenant and is_active),
      'top_items', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select oi.name, sum(oi.quantity) as qty, sum(oi.line_total) as amount from public.order_items oi
            join public.orders o on o.id = oi.order_id
           where oi.tenant_id = p_tenant and o.status = 'paid' and o.created_at > now() - interval '30 days'
           group by oi.name order by 2 desc limit 5) x));
  elsif t.sector = 'school' then
    v := v || jsonb_build_object(
      'students', (select count(*) from public.students where tenant_id = p_tenant and status = 'active'),
      'teachers', (select count(*) from public.teachers where tenant_id = p_tenant and is_active),
      'classes', (select count(*) from public.classes where tenant_id = p_tenant),
      'students_present_today', (select count(distinct person_id) from public.attendance where tenant_id = p_tenant
          and person_type = 'student' and attendance_date = v_today and status in ('present', 'late')),
      'fees_due', (select coalesce(sum(public.to_base(p_tenant, net_amount, currency)), 0) from public.student_invoices where tenant_id = p_tenant and status <> 'void'),
      'fees_paid', (select coalesce(sum(public.to_base(p_tenant, paid_amount, currency)), 0) from public.student_invoices where tenant_id = p_tenant and status <> 'void'),
      'fees_overdue', (select coalesce(sum(public.to_base(p_tenant, net_amount - paid_amount, currency)), 0) from public.student_invoices
          where tenant_id = p_tenant and status in ('unpaid', 'partial') and due_date < v_today));
  else
    v := v || jsonb_build_object(
      'customers', (select count(*) from public.customers where tenant_id = p_tenant),
      'receivables', (select coalesce(sum(public.to_base(p_tenant, total - paid_amount, currency)), 0) from public.sales_documents
          where tenant_id = p_tenant and doc_type = 'invoice' and status in ('issued', 'partial')),
      'payables', (select coalesce(sum(public.to_base(p_tenant, amount, currency)), 0) from public.expenses where tenant_id = p_tenant and status = 'unpaid'),
      'quotes_open', (select count(*) from public.sales_documents where tenant_id = p_tenant and doc_type = 'quote' and status in ('draft', 'sent')),
      'sales_month', (select coalesce(sum(public.to_base(p_tenant, total, currency)), 0) from public.sales_documents
          where tenant_id = p_tenant and doc_type = 'invoice' and status in ('issued', 'partial', 'paid') and issue_date >= date_trunc('month', v_today)),
      'top_customers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select c.name, sum(public.to_base(p_tenant, d.total, d.currency)) as amount from public.sales_documents d
            join public.customers c on c.id = d.customer_id
           where d.tenant_id = p_tenant and d.doc_type = 'invoice' and d.status in ('issued', 'partial', 'paid')
             and d.issue_date > current_date - 90 group by c.name order by 2 desc limit 5) x));
  end if;
  return v;
end $$;

-- Prévision de rupture : consommation moyenne sur 30 jours -> jours restants
create or replace function public.stock_forecast(p_tenant uuid) returns table (
  product_id uuid, name text, qty_on_hand numeric, min_qty numeric, avg_daily_out numeric, days_left numeric, unit text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_read(p_tenant) then raise exception 'Permission refusée' using errcode = '42501'; end if;
  return query
  select p.id, p.name, p.qty_on_hand, p.min_qty,
         round(coalesce(sum(abs(m.quantity)) filter (where m.movement_type = 'out'), 0) / 30.0, 3),
         case when coalesce(sum(abs(m.quantity)) filter (where m.movement_type = 'out'), 0) = 0 then null
              else round(p.qty_on_hand / (sum(abs(m.quantity)) filter (where m.movement_type = 'out') / 30.0), 1) end,
         p.unit
    from public.products p
    left join public.stock_movements m on m.product_id = p.id and m.created_at > now() - interval '30 days'
   where p.tenant_id = p_tenant and p.is_active
   group by p.id
   order by 6 nulls last, p.name;
end $$;

-- ---------------------------------------------------------------------
-- SUPER ADMIN
-- ---------------------------------------------------------------------
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Réservé au super administrateur' using errcode = '42501'; end if;
  return jsonb_build_object(
    'tenants_total', (select count(*) from public.tenants),
    'tenants_by_sector', (select jsonb_object_agg(sector, n) from (select sector, count(*) n from public.tenants group by sector) x),
    'subs_by_status', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.subscriptions group by status) x),
    'suspended', (select count(*) from public.tenants where status = 'suspended'),
    'mrr_usd', (select coalesce(sum(p.price_usd), 0) from public.subscriptions s join public.plans p on p.id = s.plan_id
                 where s.status = 'active' and s.current_period_end > now()),
    'revenue_total_usd', (select coalesce(sum(amount), 0) from public.payments where payable_type = 'subscription_invoice' and status = 'succeeded'),
    'revenue_by_month', (select coalesce(jsonb_agg(x order by m), '[]'::jsonb) from (
        select to_char(date_trunc('month', paid_at), 'YYYY-MM') m, sum(amount) total from public.payments
         where payable_type = 'subscription_invoice' and status = 'succeeded' and paid_at > now() - interval '12 months'
         group by 1) x),
    'renewals_7d', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select t.id, t.name, t.sector, s.current_period_end, p.name as plan, p.price_usd from public.subscriptions s
          join public.tenants t on t.id = s.tenant_id join public.plans p on p.id = s.plan_id
         where s.status in ('active', 'past_due') and s.current_period_end < now() + interval '7 days'
         order by s.current_period_end) x),
    'users_total', (select count(distinct user_id) from public.memberships),
    'tickets_open', (select count(*) from public.support_tickets where status <> 'closed'),
    'new_tenants_30d', (select count(*) from public.tenants where created_at > now() - interval '30 days')
  );
end $$;

create or replace function public.admin_set_tenant_status(p_tenant uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Réservé au super administrateur' using errcode = '42501'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'Statut invalide'; end if;
  update public.tenants set status = p_status, suspended_reason = case when p_status = 'suspended' then p_reason end where id = p_tenant;
  insert into public.audit_logs (tenant_id, user_id, action, table_name, record_id, new_data)
  values (p_tenant, auth.uid(), 'admin_' || p_status, 'tenants', p_tenant::text, jsonb_build_object('reason', p_reason));
  perform public.notify_tenant(p_tenant, 'admin', case when p_status = 'suspended' then 'Compte suspendu' else 'Compte réactivé' end,
    coalesce(p_reason, ''), '/support');
end $$;

create or replace function public.admin_record_subscription_cash(p_invoice uuid, p_payer text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.subscription_invoices; v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Réservé au super administrateur' using errcode = '42501'; end if;
  select * into inv from public.subscription_invoices where id = p_invoice and status = 'unpaid';
  if inv.id is null then raise exception 'Facture introuvable ou déjà payée'; end if;
  insert into public.payments (tenant_id, payable_type, payable_id, amount, currency, method, payer_name)
  values (inv.tenant_id, 'subscription_invoice', inv.id, inv.amount_usd, 'USD', 'cash', p_payer)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_grant_days(p_tenant uuid, p_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Réservé au super administrateur' using errcode = '42501'; end if;
  if p_days not between 1 and 365 then raise exception 'Nombre de jours invalide'; end if;
  update public.subscriptions set status = 'active',
    current_period_start = coalesce(current_period_start, now()),
    current_period_end = greatest(coalesce(current_period_end, now()), now()) + make_interval(days => p_days)
  where tenant_id = p_tenant;
  insert into public.audit_logs (tenant_id, user_id, action, table_name, record_id, new_data)
  values (p_tenant, auth.uid(), 'admin_grant_days', 'subscriptions', p_tenant::text, jsonb_build_object('days', p_days));
end $$;

-- ---------------------------------------------------------------------
-- Formules : tarifs mensuels USD (modifiables par le super admin)
-- ---------------------------------------------------------------------
do $$
declare
  f_basic text[] := array['core', 'billing', 'finance_basic', 'reports_basic', 'history', 'support_email', 'stock',
                          'attendance', 'cards', 'payments_mobile'];
  f_std text[] := array['stock_advanced', 'staff', 'reports_detailed', 'realtime_stats', 'notifications', 'multi_cash',
                        'export', 'payments_advanced', 'support_priority'];
  f_prem text[] := array['multi_establishment', 'ai', 'forecast', 'analytics_advanced', 'reports_custom', 'automation',
                         'sms_whatsapp', 'permissions_advanced', 'backup_plus', 'api', 'support_vip', 'workspace_custom', 'ocr', 'voice'];
begin
  insert into public.plans (sector, tier, name, price_usd, max_extra_users, features, sort) values
    ('restaurant', 'basic', 'Basique', 20, 2, f_basic, 1),
    ('restaurant', 'standard', 'Standard', 25, 10, f_basic || f_std, 2),
    ('restaurant', 'premium', 'Premium', 40, null, f_basic || f_std || f_prem, 3),
    ('school', 'basic', 'Basique', 25, 2, f_basic, 1),
    ('school', 'standard', 'Standard', 30, 10, f_basic || f_std, 2),
    ('school', 'premium', 'Premium', 45, null, f_basic || f_std || f_prem, 3),
    ('pme', 'basic', 'Basique', 30, 2, f_basic, 1),
    ('pme', 'standard', 'Standard', 35, 10, f_basic || f_std, 2),
    ('pme', 'premium', 'Premium', 50, null, f_basic || f_std || f_prem, 3);
end $$;

-- Rapports financiers : granularité hebdo/annuelle réservée à Standard+ (rapports détaillés)
create or replace function public.finance_report(p_tenant uuid, p_from date, p_to date, p_granularity text default 'day')
returns table (period date, revenue numeric, expenses numeric, profit numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_granularity <> 'day' and not public.tenant_has_feature(p_tenant, 'reports_detailed') then
    raise exception 'Rapports hebdomadaires / annuels : formule Standard ou Premium requise';
  end if;
  if p_to - p_from > 31 and not public.tenant_has_feature(p_tenant, 'reports_detailed') then
    raise exception 'Formule Basique : rapports limités à 31 jours';
  end if;
  return query select * from public.finance_summary(p_tenant, p_from, p_to, p_granularity);
end $$;

-- ---------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon';
    execute 'grant execute on all functions in schema public to authenticated, service_role';
    -- fonctions internes : jamais appelables directement par un client
    execute 'revoke execute on function public.notify_tenant(uuid, text, text, text, text) from authenticated';
    execute 'revoke execute on function public.raise_fraud_alert(uuid, text, text, text, jsonb, text, text) from authenticated';
    execute 'revoke execute on function public.apply_tenant_rls(text, text, text, text) from authenticated';
    execute 'revoke execute on function public.attach_audit(text) from authenticated';
    execute 'revoke execute on function public.next_matricule(uuid, text) from authenticated';
    execute 'revoke execute on function public.order_number(uuid) from authenticated';
    execute 'revoke execute on function public.billing_cycle() from authenticated';
    execute 'revoke execute on function public.run_automations() from authenticated';
    execute 'revoke execute on function public.finance_summary(uuid, date, date, text) from authenticated';
    -- fonctions utilisées par les politiques RLS + pages publiques QR
    execute 'grant execute on function public.is_platform_admin(), public.can_read(uuid), public.is_member(uuid),
      public.has_perm(uuid, text), public.can_write(uuid, text), public.tenant_has_feature(uuid, text),
      public.tenant_is_active(uuid), public.user_tenant_ids(), public.tenant_plan(uuid), public.default_role_permissions(public.member_role),
      public.jwt_role(), public.member_role_of(uuid),
      public.public_table_menu(text), public.public_place_order(text, jsonb, text, text),
      public.verify_card(text), public.verify_receipt(text) to anon';
  end if;
end $$;
