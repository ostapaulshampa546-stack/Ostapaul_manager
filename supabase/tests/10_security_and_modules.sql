-- =====================================================================
-- Tests d'intégration SQL : isolation multi-tenant, permissions,
-- abonnements, paiements, modules Restaurant / École / PME.
-- Chaque test affiche « PASS » ou lève une erreur « FAIL ».
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;
create table if not exists tests.ctx (k text primary key, v text);
grant all on tests.ctx to anon, authenticated, service_role;

create or replace function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAIL: %', p_msg; end if;
  raise notice 'PASS: %', p_msg;
end $$;

create or replace function tests.fails(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'PASS: % (refusé : %)', p_msg, left(sqlerrm, 90);
    return;
  end;
  raise exception 'FAIL: % — la requête aurait dû échouer', p_msg;
end $$;

create or replace function tests.get(p_k text) returns text language sql as $$ select v from tests.ctx where k = p_k $$;
create or replace function tests.uid(p_k text) returns uuid language sql as $$ select v::uuid from tests.ctx where k = p_k $$;
create or replace function tests.put(p_k text, p_v text) returns void language sql as $$
  insert into tests.ctx values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Utilisateurs
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'resto@test.cd'),
  ('00000000-0000-0000-0000-00000000000b', 'ecole@test.cd'),
  ('00000000-0000-0000-0000-00000000000c', 'serveur@test.cd'),
  ('00000000-0000-0000-0000-00000000000d', 'intrus@test.cd'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@ostapaul.cd'),
  ('00000000-0000-0000-0000-0000000000e1', 'u1@test.cd'),
  ('00000000-0000-0000-0000-0000000000e2', 'u2@test.cd'),
  ('00000000-0000-0000-0000-0000000000e3', 'u3@test.cd');
insert into public.platform_admins (user_id, full_name) values ('00000000-0000-0000-0000-0000000000ad', 'Super Admin');

create or replace function tests.act(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
end $$;
grant execute on function tests.act(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- tenants
set role authenticated;
select tests.act('00000000-0000-0000-0000-00000000000a');
select tests.put('tA', public.create_tenant('restaurant', 'Chez Mama Kinshasa', 'standard')::text);
select tests.ok((select status from public.subscriptions where tenant_id = tests.uid('tA')) = 'trialing', 'essai de 48 h démarré');
select tests.ok((select trial_ends_at between now() + interval '47 hours' and now() + interval '49 hours'
                 from public.subscriptions where tenant_id = tests.uid('tA')), 'durée d''essai = 48 h (configurable)');
select tests.ok(public.tenant_is_active(tests.uid('tA')), 'établissement actif pendant l''essai');

select tests.act('00000000-0000-0000-0000-00000000000b');
select tests.put('tB', public.create_tenant('school', 'Complexe Scolaire Lumière', 'basic')::text);
select tests.ok((select count(*) from public.grading_periods where tenant_id = tests.uid('tB')) = 6, 'périodes scolaires créées');

-- ------------------------------------------------------------- isolation
select tests.ok((select count(*) from public.tenants) = 1, 'B ne voit que son établissement');
select tests.fails(format($$insert into public.employees (tenant_id, first_name, last_name) values (%L, 'X', 'Y')$$, tests.get('tA')),
  'B ne peut pas écrire chez A');
select tests.act('00000000-0000-0000-0000-00000000000d');
select tests.ok((select count(*) from public.tenants) = 0, 'un intrus ne voit aucun établissement');
select tests.ok((select count(*) from public.subscriptions) = 0, 'un intrus ne voit aucun abonnement');
select tests.fails(format($$select public.dashboard_stats(%L)$$, tests.get('tA')), 'tableau de bord refusé à un intrus');

-- ---------------------------------------------------------- personnel + cartes
select tests.act('00000000-0000-0000-0000-00000000000a');
insert into public.employees (tenant_id, first_name, last_name, position, salary)
values (tests.uid('tA'), 'Jean', 'Mukendi', 'Serveur', 150);
select tests.put('emp', (select id::text from public.employees where tenant_id = tests.uid('tA') limit 1));
select tests.ok((select matricule like 'EMP-%' from public.employees where id = tests.uid('emp')), 'matricule automatique');
select tests.put('card', (select qr_token from public.id_cards where person_id = tests.uid('emp')));
select tests.ok(tests.get('card') is not null and length(tests.get('card')) >= 32, 'carte QR générée automatiquement');

-- pointage
select tests.put('cu', gen_random_uuid()::text);
select tests.ok((public.record_scan(tests.uid('tA'), 'https://app/v/' || tests.get('card'), 'in', now(), tests.uid('cu')) ->> 'ok')::boolean,
  'pointage QR enregistré (URL de carte acceptée)');
select tests.ok((public.record_scan(tests.uid('tA'), tests.get('card'), 'in', now(), tests.uid('cu')) ->> 'duplicate')::boolean,
  'synchronisation idempotente (client_uuid)');
select tests.ok(jsonb_array_length(public.record_scans_batch(tests.uid('tA'),
  jsonb_build_array(jsonb_build_object('token', tests.get('card'), 'event', 'out', 'scanned_at', now() - interval '2 hours',
                                       'client_uuid', gen_random_uuid())))) = 1, 'lot hors ligne synchronisé');
select tests.ok((select count(*) from public.attendance where tenant_id = tests.uid('tA')) = 2, '2 pointages au total');
select tests.fails(format($$select public.record_scan(%L, %L, 'in', now() - interval '30 days')$$, tests.get('tA'), tests.get('card')),
  'scan trop ancien refusé');

-- --------------------------------------------------------------- restaurant
insert into public.dining_tables (tenant_id, label) values (tests.uid('tA'), 'T1');
select tests.put('table', (select id::text from public.dining_tables where tenant_id = tests.uid('tA')));
select tests.ok((select length(qr_token) >= 32 from public.dining_tables where id = tests.uid('table')), 'QR de table automatique');
insert into public.menu_items (tenant_id, name, price) values (tests.uid('tA'), 'Poulet mayo', 12), (tests.uid('tA'), 'Fanta', 2);
insert into public.orders (tenant_id, table_id) values (tests.uid('tA'), tests.uid('table'));
select tests.put('order', (select id::text from public.orders where tenant_id = tests.uid('tA')));
insert into public.order_items (tenant_id, order_id, menu_item_id, name, unit_price, quantity)
select tests.uid('tA'), tests.uid('order'), id, 'ignored', 0, case when name = 'Fanta' then 3 else 1 end
  from public.menu_items where tenant_id = tests.uid('tA');
select tests.ok((select total from public.orders where id = tests.uid('order')) = 18, 'total commande = 12 + 3×2 = 18 (prix serveur)');
select tests.ok((select status from public.dining_tables where id = tests.uid('table')) = 'occupied', 'table occupée');

select tests.fails(format($$insert into public.payments (tenant_id, payable_type, payable_id, amount, method) values (%L, 'order', %L, 10, 'cash')$$,
  tests.get('tA'), tests.get('order')), 'espèces refusées sans caisse ouverte');
insert into public.cash_sessions (tenant_id, opening_float) values (tests.uid('tA'), 20);
select tests.fails(format($$insert into public.payments (tenant_id, payable_type, payable_id, amount, method) values (%L, 'order', %L, 50, 'cash')$$,
  tests.get('tA'), tests.get('order')), 'surpaiement refusé');
insert into public.payments (tenant_id, payable_type, payable_id, amount, method, payer_name)
values (tests.uid('tA'), 'order', tests.uid('order'), 8, 'cash', 'Client');
select tests.ok((select status from public.orders where id = tests.uid('order')) = 'new', 'paiement partiel : commande non soldée');

-- paiement mobile : le client ne peut pas se déclarer « réussi »
insert into public.payments (tenant_id, payable_type, payable_id, amount, method, status, payer_phone)
values (tests.uid('tA'), 'order', tests.uid('order'), 10, 'mpesa', 'succeeded', '+243810000000');
select tests.put('mm', (select id::text from public.payments where method = 'mpesa'));
select tests.ok((select status from public.payments where id = tests.uid('mm')) = 'pending', 'paiement électronique forcé en attente');
select tests.fails(format($$update public.payments set status = 'succeeded' where id = %L$$, tests.get('mm')),
  'confirmation électronique interdite côté client');
-- confirmation par le serveur (webhook vérifié)
reset role;
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
update public.payments set status = 'succeeded', provider = 'pawapay', provider_ref = 'dep-123' where id = tests.uid('mm');
set role authenticated;
select tests.act('00000000-0000-0000-0000-00000000000a');
select tests.ok((select status from public.orders where id = tests.uid('order')) = 'paid', 'commande soldée après confirmation prestataire');
select tests.ok((select status from public.dining_tables where id = tests.uid('table')) = 'free', 'table libérée');
select tests.ok((select receipt_number is not null from public.payments where id = tests.uid('mm')), 'reçu numéroté généré');
update public.payments set amount = 1 where id = tests.uid('mm');
delete from public.payments where id = tests.uid('mm');
select tests.ok((select amount from public.payments where id = tests.uid('mm')) = 10, 'paiement confirmé immuable et non supprimable');
select tests.fails(format($$update public.orders set notes = 'x' where id = %L$$, tests.get('order')), 'commande payée verrouillée');

-- clôture de caisse avec écart
select tests.ok((public.close_cash_session((select id from public.cash_sessions where tenant_id = tests.uid('tA')), 25)).difference = -3,
  'écart de caisse calculé (20 + 8 attendus, 25 comptés)');
select tests.ok((select count(*) from public.fraud_alerts where tenant_id = tests.uid('tA') and kind = 'cash_difference') = 1,
  'alerte anti-fraude écart de caisse');

-- menu public / commande QR (anonyme)
reset role;
select tests.put('tableToken', (select qr_token from public.dining_tables where id = tests.uid('table')));
select tests.put('itemId', (select id::text from public.menu_items where name = 'Fanta'));
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(jsonb_array_length(public.public_table_menu(tests.get('tableToken')) -> 'uncategorized') = 2, 'menu public via QR');
select tests.fails('select count(*) from public.orders', 'anonyme : aucune lecture directe des commandes');
select tests.ok((public.public_place_order(tests.get('tableToken'),
  jsonb_build_array(jsonb_build_object('menu_item_id', tests.get('itemId'), 'quantity', 2)), 'Table client') ->> 'total')::numeric = 4,
  'commande client via QR (prix côté serveur)');

-- ------------------------------------------------------- utilisateurs & rôles
reset role; set role authenticated;
select tests.act('00000000-0000-0000-0000-00000000000a');
insert into public.invitations (tenant_id, email, role) values (tests.uid('tA'), 'serveur@test.cd', 'waiter');
select tests.act('00000000-0000-0000-0000-00000000000c');
select tests.ok(public.accept_invitations() = 1, 'invitation acceptée');
select tests.ok(public.has_perm(tests.uid('tA'), 'orders.write'), 'serveur : peut prendre des commandes');
select tests.fails(format($$insert into public.expenses (tenant_id, amount) values (%L, 10)$$, tests.get('tA')), 'serveur : pas de dépenses');
select tests.ok((select count(*) from public.expenses) = 0, 'serveur : ne lit pas les dépenses');
update public.memberships set role = 'admin' where user_id = auth.uid();
select tests.ok(public.member_role_of(tests.uid('tA')) = 'waiter', 'serveur : auto-promotion sans effet (RLS)');

-- limite d'utilisateurs (Basique = 2 supplémentaires)
select tests.act('00000000-0000-0000-0000-00000000000b');
insert into public.invitations (tenant_id, email, role) values (tests.uid('tB'), 'u1@test.cd', 'teacher'), (tests.uid('tB'), 'u2@test.cd', 'secretary');
select tests.fails(format($$insert into public.invitations (tenant_id, email, role) values (%L, 'u3@test.cd', 'teacher')$$, tests.get('tB')),
  'limite de 2 utilisateurs supplémentaires (Basique)');

-- -------------------------------------------------------------------- école
select tests.fails(format($$insert into public.work_schedules (tenant_id, employee_id, weekday, start_time, end_time)
  values (%L, gen_random_uuid(), 1, '08:00', '16:00')$$, tests.get('tB')), 'Basique : gestion du personnel (horaires) indisponible');
insert into public.teachers (tenant_id, first_name, last_name, user_id) values (tests.uid('tB'), 'Paul', 'Kabasele', '00000000-0000-0000-0000-0000000000e1');
insert into public.classes (tenant_id, name, level) values (tests.uid('tB'), '6e Primaire A', 'Primaire');
select tests.put('class', (select id::text from public.classes where tenant_id = tests.uid('tB')));
insert into public.courses (tenant_id, class_id, teacher_id, name, max_points)
values (tests.uid('tB'), tests.uid('class'), (select id from public.teachers limit 1), 'Mathématiques', 40),
       (tests.uid('tB'), tests.uid('class'), null, 'Français', 20);
insert into public.students (tenant_id, first_name, post_name, last_name, class_id, guardian_phone)
values (tests.uid('tB'), 'Grâce', 'Mbuyi', 'Tshala', tests.uid('class'), '+243990000001'),
       (tests.uid('tB'), 'Daniel', 'Ilunga', 'Kasongo', tests.uid('class'), '+243990000002');
select tests.ok((select count(*) from public.id_cards where tenant_id = tests.uid('tB')) = 3, 'cartes élèves + enseignant générées');
select tests.ok((select count(*) from public.enrollments where tenant_id = tests.uid('tB')) = 2, 'inscriptions historisées');
select tests.put('period', (select id::text from public.grading_periods where tenant_id = tests.uid('tB') and sort = 1));
insert into public.grades (tenant_id, student_id, course_id, period_id, score, max_score)
select tests.uid('tB'), s.id, c.id, tests.uid('period'),
       case when s.first_name = 'Grâce' then c.max_points * 0.8 else c.max_points * 0.45 end, c.max_points
  from public.students s cross join public.courses c where s.tenant_id = tests.uid('tB');
select tests.ok((select percentage from public.class_results(tests.uid('class'), tests.uid('period')) where full_name like 'Grâce%') = 80,
  'pourcentage pondéré = 80 %');
select tests.ok((select rank from public.class_results(tests.uid('class'), tests.uid('period')) where full_name like 'Grâce%') = 1, 'classement');
select tests.ok((select decision from public.class_results(tests.uid('class'), tests.uid('period')) where full_name like 'Daniel%') = 'Ajourné (seconde session)',
  'décision de délibération');
select tests.ok(public.student_report_card((select id from public.students where first_name = 'Grâce'), tests.uid('period')) ->> 'decision' = 'Admis', 'bulletin');
select public.finalize_deliberation(tests.uid('class'), tests.uid('period'));
select tests.fails(format($$update public.grades set score = 20 where period_id = %L$$, tests.get('period')), 'notes verrouillées après délibération');

-- appel en classe (deux fois le même jour : mise à jour, pas de doublon)
select tests.ok(public.record_roll_call(tests.uid('class'), current_date,
  (select jsonb_agg(jsonb_build_object('student_id', id, 'status', 'absent')) from public.students where class_id = tests.uid('class'))) = 2, 'appel en classe');
select public.record_roll_call(tests.uid('class'), current_date,
  (select jsonb_agg(jsonb_build_object('student_id', id, 'status', 'present')) from public.students where class_id = tests.uid('class')));
select tests.ok((select count(*) from public.attendance where source = 'manual' and status = 'present') = 2
  and (select count(*) from public.attendance where source = 'manual') = 2, 'appel refait : mis à jour sans doublon');

-- frais scolaires + bourse
insert into public.scholarships (tenant_id, student_id, kind, value) select tests.uid('tB'), id, 'percent', 50 from public.students where first_name = 'Daniel';
insert into public.fee_types (tenant_id, name, amount) values (tests.uid('tB'), 'Minerval 1er trimestre', 100);
select tests.ok(public.generate_fee_invoices((select id from public.fee_types limit 1)) = 2, 'factures de frais générées');
select tests.ok((select net_amount from public.student_invoices i join public.students s on s.id = i.student_id where s.first_name = 'Daniel') = 50,
  'bourse de 50 % appliquée');
insert into public.cash_sessions (tenant_id) values (tests.uid('tB'));
insert into public.payments (tenant_id, payable_type, payable_id, amount, method)
select tests.uid('tB'), 'student_invoice', i.id, 40, 'cash' from public.student_invoices i join public.students s on s.id = i.student_id where s.first_name = 'Grâce';
select tests.ok((select i.status || ':' || i.paid_amount from public.student_invoices i join public.students s on s.id = i.student_id where s.first_name = 'Grâce') = 'partial:40.00',
  'paiement partiel des frais');
select tests.ok((select balance from public.student_balances where full_name like 'Grâce%') = 60, 'solde élève = 60');
update public.student_invoices set paid_amount = 100, status = 'paid' where paid_amount = 40;
select tests.ok((select status from public.student_invoices where paid_amount = 40) = 'partial', 'statut de paiement non falsifiable');

-- tableaux de l'école : statistiques par élève et par classe
select tests.ok((select percentage = 80 and class_rank = 1 and attendance_rate = 100 and days_class = 1 and balance = 60
   from public.school_student_stats(tests.uid('tB'), tests.uid('class'), current_date - 7, current_date, tests.uid('period')) where first_name = 'Grâce'),
  'tableau élève : cote, rang, présence, solde');
select tests.ok((select students = 2 and average = 62.5 and passed = 1 and debtors = 2 and attendance_rate = 100
   from public.school_class_overview(tests.uid('tB'), current_date - 7, current_date, tests.uid('period'))),
  'tableau de classe : effectif, moyenne, réussite, débiteurs');

-- enseignant : ne note que ses cours
select tests.act('00000000-0000-0000-0000-0000000000e1');
select tests.ok(public.accept_invitations() = 1, 'enseignant : invitation acceptée (quota respecté)');
select tests.put('p2', (select id::text from public.grading_periods where sort = 2));
insert into public.grades (tenant_id, student_id, course_id, period_id, score, max_score)
select tests.uid('tB'), s.id, c.id, tests.uid('p2'), 30, 40 from public.students s, public.courses c
 where s.first_name = 'Grâce' and c.name = 'Mathématiques';
select tests.ok((select count(*) from public.grades where period_id = tests.uid('p2')) = 1, 'enseignant : note son cours');
select tests.fails(format($$insert into public.grades (tenant_id, student_id, course_id, period_id, score) select %L, s.id, c.id, %L, 10
  from public.students s, public.courses c where s.first_name = 'Grâce' and c.name = 'Français'$$, tests.get('tB'), tests.get('p2')),
  'enseignant : ne note pas le cours d''un autre');
select tests.fails(format($$insert into public.fee_types (tenant_id, name, amount) values (%L, 'x', 1)$$, tests.get('tB')), 'enseignant : pas de frais');

-- --------------------------------------------------------------------- PME
select tests.act('00000000-0000-0000-0000-00000000000a');
select tests.put('tP', public.create_tenant('pme', 'Ets Kongo Distribution', 'premium')::text);
insert into public.products (tenant_id, name, sale_price, qty_on_hand, min_qty) values (tests.uid('tP'), 'Sac de ciment', 12, 100, 10);
select tests.put('prod', (select id::text from public.products where tenant_id = tests.uid('tP')));
select tests.ok((select qty_on_hand from public.products where id = tests.uid('prod')) = 100, 'stock initial via mouvement');
update public.products set qty_on_hand = 9999 where id = tests.uid('prod');
select tests.ok((select qty_on_hand from public.products where id = tests.uid('prod')) = 100, 'stock non modifiable hors mouvement');
insert into public.customers (tenant_id, name) values (tests.uid('tP'), 'Bâtir Congo SARL');
insert into public.sales_documents (tenant_id, doc_type, number, customer_id, status)
select tests.uid('tP'), 'quote', '', id, 'paid' from public.customers where tenant_id = tests.uid('tP');
select tests.put('quote', (select id::text from public.sales_documents where doc_type = 'quote'));
select tests.ok((select status from public.sales_documents where id = tests.uid('quote')) = 'draft', 'statut initial non falsifiable');
insert into public.sales_document_items (tenant_id, document_id, product_id, description, quantity, unit_price)
values (tests.uid('tP'), tests.uid('quote'), tests.uid('prod'), 'Sac de ciment 50 kg', 95, 12);
select tests.ok((select total from public.sales_documents where id = tests.uid('quote')) = 1322.40, 'devis TTC (TVA 16 %)');
select tests.put('inv', public.convert_sales_document(tests.uid('quote'), 'invoice')::text);
select tests.fails(format($$update public.sales_documents set status = 'issued' where id = %L$$, tests.get('inv')), 'émission directe interdite');
select public.issue_invoice(tests.uid('inv'));
select tests.ok((select qty_on_hand from public.products where id = tests.uid('prod')) = 5, 'sortie de stock à l''émission');
select tests.ok((select count(*) from public.notifications where tenant_id = tests.uid('tP') and kind = 'stock') = 1, 'alerte de rupture');
select tests.fails(format($$insert into public.sales_document_items (tenant_id, document_id, description, quantity, unit_price) values (%L, %L, 'x', 1, 1)$$,
  tests.get('tP'), tests.get('inv')), 'facture émise : lignes verrouillées');
insert into public.cash_sessions (tenant_id) values (tests.uid('tP'));
insert into public.payments (tenant_id, payable_type, payable_id, amount, method) values (tests.uid('tP'), 'sales_document', tests.uid('inv'), 1322.40, 'cash');
select tests.ok((select status from public.sales_documents where id = tests.uid('inv')) = 'paid', 'facture soldée');
select tests.ok((select count(*) from public.fraud_alerts where kind = 'duplicate_payment') = 0, 'pas de faux doublon');

-- ------------------------------------------------------------ abonnements
select tests.ok((public.create_renewal_invoice(tests.uid('tA'))).amount_usd = 25, 'facture de renouvellement (Restaurant Standard 25 $)');
select public.change_plan(tests.uid('tA'), 'premium');
select tests.ok((public.create_renewal_invoice(tests.uid('tA'))).amount_usd = 40, 'changement de formule -> nouvelle facture 40 $');
select tests.fails(format($$insert into public.payments (tenant_id, payable_type, payable_id, amount, method) values (%L, 'subscription_invoice', %L, 40, 'cash')$$,
  tests.get('tA'), (select id from public.subscription_invoices where status = 'unpaid' and tenant_id = tests.uid('tA'))),
  'le client ne peut pas marquer son abonnement payé en espèces');
reset role; set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into public.payments (tenant_id, payable_type, payable_id, amount, method, status, provider, provider_ref)
select tenant_id, 'subscription_invoice', id, 40, 'orange_money', 'succeeded', 'pawapay', 'dep-abo-1'
  from public.subscription_invoices where status = 'unpaid' and tenant_id = tests.uid('tA');
reset role;
select tests.ok((select status = 'active' and current_period_end > now() + interval '29 days' from public.subscriptions where tenant_id = tests.uid('tA')),
  'abonnement activé pour 1 mois après paiement confirmé');

-- expiration de l'essai -> lecture seule
update public.subscriptions set trial_ends_at = now() - interval '1 minute' where tenant_id = tests.uid('tB');
select set_config('request.jwt.claims', '', false);
select tests.ok((public.billing_cycle() ->> 'trials_expired')::int = 1, 'cycle de facturation : essais expirés');
set role authenticated;
select tests.act('00000000-0000-0000-0000-00000000000b');
select tests.ok(not public.tenant_is_active(tests.uid('tB')), 'essai expiré : inactif');
select tests.ok((select count(*) from public.students) = 2, 'essai expiré : données toujours consultables');
select tests.fails(format($$insert into public.students (tenant_id, first_name, last_name) values (%L, 'A', 'B')$$, tests.get('tB')),
  'essai expiré : écriture bloquée');
select tests.act('00000000-0000-0000-0000-00000000000b');
select tests.ok(public.create_tenant('school', 'Deuxième école') is not null, 'second établissement créé');
select tests.ok((select s.status from public.subscriptions s join public.tenants t on t.id = s.tenant_id where t.name = 'Deuxième école') = 'expired',
  'un seul essai gratuit par secteur');

-- --------------------------------------------------------------- super admin
select tests.fails('select public.admin_overview()', 'vue globale refusée hors super admin');
select tests.act('00000000-0000-0000-0000-0000000000ad');
select tests.ok((public.admin_overview() ->> 'tenants_total')::int = 4, 'super admin : tous les établissements');
select tests.ok((public.admin_overview() ->> 'revenue_total_usd')::numeric = 40, 'super admin : revenus plateforme');
select tests.put('inv_b', (public.create_renewal_invoice(tests.uid('tB'))).id::text);
select tests.ok(public.admin_record_subscription_cash(tests.uid('inv_b'), 'Directeur') is not null, 'super admin : encaissement espèces d''un abonnement');
select tests.ok((select status = 'active' and current_period_end > now() + interval '29 days' from public.subscriptions where tenant_id = tests.uid('tB')),
  'abonnement activé après paiement en espèces auprès du super admin');
select public.admin_set_tenant_status(tests.uid('tP'), 'suspended', 'Test');
select tests.act('00000000-0000-0000-0000-00000000000a');
select tests.ok(not public.tenant_is_active(tests.uid('tP')), 'établissement suspendu : inactif');
select tests.act('00000000-0000-0000-0000-0000000000ad');
select public.admin_set_tenant_status(tests.uid('tP'), 'active');

-- ------------------------------------------------------------- audit & accès
select tests.act('00000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*) from public.audit_logs where tenant_id = tests.uid('tA') and table_name = 'orders') > 0, 'journal d''audit alimenté');
select tests.act('00000000-0000-0000-0000-00000000000c');
select tests.ok((select count(*) from public.audit_logs) = 0, 'serveur : pas d''accès au journal');
select public.report_access_denied(tests.uid('tA'), 'test') from generate_series(1, 5);
reset role;
select tests.ok((select count(*) from public.fraud_alerts where kind = 'unauthorized_access') = 1, 'alerte tentatives non autorisées');
set role authenticated;
select tests.fails($$select public.notify_tenant(gen_random_uuid(), 'x', 'x', 'x')$$, 'fonctions internes non appelables');
reset role;
do $$ begin raise notice 'ALL TESTS PASSED'; end $$;
