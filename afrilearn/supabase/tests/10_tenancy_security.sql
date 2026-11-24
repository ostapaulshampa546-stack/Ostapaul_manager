\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

-- Comptes de test (le trigger crée les profils)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner.a@test.dev', '{"full_name":"Owner A","account_type":"center_manager","country_code":"NG","locale":"en"}'),
  ('00000000-0000-0000-0000-00000000000b', 'owner.b@test.dev', '{"full_name":"Owner B","account_type":"center_manager","country_code":"KE"}'),
  ('00000000-0000-0000-0000-00000000000c', 'teacher@test.dev', '{"full_name":"Teacher T","account_type":"teacher"}'),
  ('00000000-0000-0000-0000-00000000000d', 'student@test.dev', '{"full_name":"Student S","account_type":"student","english_variant":"uk"}'),
  ('00000000-0000-0000-0000-00000000000e', 'outsider@test.dev', '{"full_name":"Outsider","account_type":"hacker"}'),
  ('00000000-0000-0000-0000-00000000000f', 'admin@test.dev', '{"full_name":"Platform Admin"}');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000f');

select tests.ok((select count(*) = 6 from public.profiles), 'inscription : un profil créé par compte');
select tests.ok((select account_type = 'student' from public.profiles where email = 'outsider@test.dev'), 'inscription : type de compte inconnu => étudiant');
select tests.ok((select english_variant = 'uk' and locale = 'fr' from public.profiles where email = 'student@test.dev'), 'inscription : variante UK et langue par défaut');
select tests.ok((select country_code = 'NG' and locale = 'en' from public.profiles where email = 'owner.a@test.dev'), 'inscription : pays et langue');

-- ---------- Centre A ----------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.put('cA', public.create_center('Lagos English Hub', 'NG', 'Lagos', '+234 800000000', 'hub@test.dev')::text);
select tests.ok((select slug = 'lagos-english-hub' from public.centers where id = tests.get('cA')::uuid), 'centre : slug généré');
select tests.ok(public.is_center_manager(tests.get('cA')::uuid), 'centre : le créateur est propriétaire');
insert into public.teachers (center_id, full_name, email) values (tests.get('cA')::uuid, 'Teacher T', 'teacher@test.dev');
select tests.put('tA', (select id::text from public.teachers where email = 'teacher@test.dev'));
insert into public.students (center_id, full_name, email, cefr_level) values
  (tests.get('cA')::uuid, 'Student S', 'student@test.dev', 'B1'),
  (tests.get('cA')::uuid, 'Other Student', null, 'A2');
select tests.put('sA', (select id::text from public.students where email = 'student@test.dev'));
select tests.put('sA2', (select id::text from public.students where full_name = 'Other Student'));
select tests.ok((select student_number ~ '^AL-[0-9]{4}-00001$' from public.students where id = tests.get('sA')::uuid), 'étudiant : matricule automatique');
select tests.fails($$insert into public.students (center_id, full_name, user_id) values ('$$ || tests.get('cA') || $$', 'Hijack', '00000000-0000-0000-0000-00000000000e')$$,
  'étudiant : impossible de lier un compte arbitraire à la création');
select tests.fails($$update public.students set student_number = 'X' where id = '$$ || tests.get('sA') || $$'$$, 'étudiant : matricule non modifiable');
insert into public.programs (center_id, name, cefr_level) values (tests.get('cA')::uuid, 'General English B1', 'B1');
insert into public.classes (center_id, name, cefr_level, teacher_id, capacity, program_id)
  values (tests.get('cA')::uuid, 'B1 Morning', 'B1', tests.get('tA')::uuid, 1, (select id from public.programs limit 1));
select tests.put('klA', (select id::text from public.classes where name = 'B1 Morning'));
insert into public.class_students (center_id, class_id, student_id) values (tests.get('cA')::uuid, tests.get('klA')::uuid, tests.get('sA')::uuid);
select tests.fails($$insert into public.class_students (center_id, class_id, student_id) values ('$$ || tests.get('cA') || $$', '$$ || tests.get('klA') || $$', '$$ || tests.get('sA2') || $$')$$,
  'classe : capacité maximale respectée');
select tests.ok((public.center_stats(tests.get('cA')::uuid) ->> 'students')::int = 2, 'tableau de bord du centre : 2 étudiants');

-- ---------- Centre B : isolation ----------
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.put('cB', public.create_center('Nairobi Speak', 'KE')::text);
select tests.ok((select count(*) = 0 from public.students where center_id = tests.get('cA')::uuid), 'isolation : B ne voit pas les étudiants de A');
select tests.ok((select count(*) = 1 from public.centers), 'isolation : B ne voit que son centre');
select tests.ok((select count(*) = 0 from public.teachers), 'isolation : B ne voit pas les enseignants de A');
select tests.fails($$insert into public.students (center_id, full_name) values ('$$ || tests.get('cA') || $$', 'Intrus')$$, 'isolation : B ne peut pas inscrire chez A');
update public.centers set name = 'Hacked' where id = tests.get('cA')::uuid;
select tests.fails($$select public.center_stats('$$ || tests.get('cA') || $$')$$, 'isolation : statistiques de A refusées à B');
select tests.fails($$insert into public.classes (center_id, name, cefr_level, teacher_id) values ('$$ || tests.get('cB') || $$', 'X', 'A1', '$$ || tests.get('tA') || $$')$$,
  'isolation : une classe de B ne peut pas utiliser un enseignant de A');
select tests.fails($$select public.create_invitation('$$ || tests.get('cA') || $$', 'teacher', '$$ || tests.get('tA') || $$')$$, 'isolation : B ne peut pas inviter chez A');
select tests.ok((select count(*) = 0 from public.audit_log where center_id = tests.get('cA')::uuid), 'isolation : journal de A invisible pour B');
reset role;
select tests.ok((select name = 'Lagos English Hub' from public.centers where id = tests.get('cA')::uuid), 'isolation : B ne peut pas modifier le centre A');

-- ---------- Invitations ----------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.put('invT', public.create_invitation(tests.get('cA')::uuid, 'teacher', tests.get('tA')::uuid));
select tests.put('invS', public.create_invitation(tests.get('cA')::uuid, 'student', tests.get('sA')::uuid));
select tests.ok(length(tests.get('invT')) = 48, 'invitation : jeton aléatoire de 192 bits');
select tests.fails($$select token_hash from public.invitations$$, 'invitation : empreinte du jeton illisible');
select tests.fails($$select public.create_invitation('$$ || tests.get('cA') || $$', 'student', '$$ || tests.get('sA2') || $$')$$, 'invitation : e-mail obligatoire');
select tests.ok((public.invitation_preview(tests.get('invT')) ->> 'center_name') = 'Lagos English Hub', 'invitation : aperçu public');
select tests.ok((public.invitation_preview(tests.get('invT')) ->> 'email_hint') = 't***@test.dev', 'invitation : e-mail masqué dans l''aperçu');

select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.fails($$select public.accept_invitation('$$ || tests.get('invT') || $$')$$, 'invitation : refusée si l''e-mail ne correspond pas');
select tests.fails($$select public.accept_invitation('deadbeef')$$, 'invitation : jeton invalide refusé');

select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.ok((public.accept_invitation(tests.get('invT')) ->> 'role') = 'teacher', 'invitation : acceptée par l''enseignant');
select tests.fails($$select public.accept_invitation('$$ || tests.get('invT') || $$')$$, 'invitation : usage unique');
select tests.ok((select count(*) = 1 from public.classes), 'enseignant : voit sa classe');
select tests.ok((select count(*) = 1 from public.students), 'enseignant : voit uniquement les étudiants de ses classes');
select tests.fails($$insert into public.students (center_id, full_name) values ('$$ || tests.get('cA') || $$', 'X')$$, 'enseignant : ne peut pas inscrire');
select tests.ok((select count(*) = 0 from public.memberships where role = 'owner'), 'enseignant : ne voit pas les autres membres');

select tests.login('00000000-0000-0000-0000-00000000000d');
select public.accept_invitation(tests.get('invS'));
select tests.ok((select count(*) = 1 from public.students), 'étudiant : voit uniquement sa fiche');
select tests.ok((select count(*) = 1 from public.classes), 'étudiant : voit sa classe');
select tests.ok((select count(*) = 0 from public.teachers), 'étudiant : ne voit pas les fiches enseignants');
select tests.fails($$update public.profiles set account_type = 'center_manager' where id = auth.uid()$$, 'profil : type de compte non modifiable');
select tests.fails($$update public.profiles set is_suspended = false where id = auth.uid()$$, 'profil : suspension non modifiable');
update public.profiles set cefr_level = 'B2', english_variant = 'us' where id = auth.uid();
select tests.ok((select cefr_level = 'B2' from public.profiles where id = auth.uid()), 'profil : niveau modifiable par l''étudiant');

select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*) = 3 from public.center_members(tests.get('cA')::uuid)), 'équipe : le gestionnaire voit les 3 membres');
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.fails($$select * from public.center_members('$$ || tests.get('cA') || $$')$$, 'équipe : liste refusée à l''enseignant');

-- Seul le propriétaire invite des gestionnaires
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.fails($$select public.create_invitation('$$ || tests.get('cA') || $$', 'manager', null, 'm@test.dev')$$, 'gestionnaire : l''enseignant ne peut pas inviter');

-- ---------- Visiteur anonyme ----------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.ok(public.submit_lead('contact', 'Visitor', 'visitor@test.dev', 'Hello, I want a demo') is not null, 'site : message de contact enregistré');
select public.submit_lead('contact', 'Visitor', 'visitor@test.dev', 'Second message'), public.submit_lead('contact', 'Visitor', 'VISITOR@test.dev', 'Third message');
select tests.fails($$select public.submit_lead('contact', 'Visitor', 'visitor@test.dev', 'Fourth message')$$, 'site : limite de 3 messages par heure');
select tests.fails($$select count(*) from public.leads$$, 'site : messages illisibles pour un visiteur');
select tests.ok((select count(*) = 0 from public.public_partner_centers), 'site : aucun centre affiché sans accord');
select tests.ok((select count(*) >= 20 from public.countries), 'site : pays lisibles');
select tests.fails($$select public.platform_stats()$$, 'anonyme : statistiques refusées');
select tests.fails($$select public.create_center('X', 'NG')$$, 'anonyme : création de centre refusée');

-- ---------- Super Admin ----------
reset role;
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.fails($$select public.platform_stats()$$, 'non-admin : statistiques refusées');
select tests.fails($$select public.admin_set_center_status('$$ || tests.get('cA') || $$', 'suspended')$$, 'non-admin : suspension refusée');
select tests.ok((select count(*) = 0 from public.profiles where id <> auth.uid()), 'non-admin : ne voit que son profil');

select tests.login('00000000-0000-0000-0000-00000000000f');
select tests.ok((public.platform_stats() ->> 'centers')::int = 2, 'admin : statistiques globales');
select tests.ok((select count(*) = 6 from public.profiles), 'admin : voit tous les utilisateurs');
select tests.ok((select count(*) = 3 from public.leads), 'admin : voit les prospects');
select public.admin_set_center_status(tests.get('cB')::uuid, 'suspended', 'Unpaid');
insert into public.plan_prices (plan_id, country_code, currency_code, amount) select id, 'NG', 'NGN', 15000 from public.plans where code = 'center_basic';
select tests.ok((select count(*) = 1 from public.plan_prices), 'admin : tarif par pays');
update public.countries set active = true where code in ('NG', 'KE');
select tests.fails($$select public.admin_revoke_admin(auth.uid())$$, 'admin : ne peut pas retirer son propre accès');
select tests.fails($$select public.admin_set_user_suspended(auth.uid(), true)$$, 'admin : ne peut pas se suspendre');

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*) = 1 from public.centers), 'centre suspendu : reste consultable');
select tests.fails($$insert into public.students (center_id, full_name) values ('$$ || tests.get('cB') || $$', 'Y')$$, 'centre suspendu : écriture bloquée');

select tests.login('00000000-0000-0000-0000-00000000000a');
update public.centers set show_on_website = true where id = tests.get('cA')::uuid;
select tests.login('00000000-0000-0000-0000-00000000000f');
select public.admin_set_user_suspended('00000000-0000-0000-0000-00000000000a', true);
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.ok(not public.is_center_manager(tests.get('cA')::uuid), 'utilisateur suspendu : perd ses droits');
select tests.ok((select count(*) = 0 from public.students), 'utilisateur suspendu : plus d''accès aux données');

reset role;
select tests.ok((select count(*) = 1 from public.public_partner_centers), 'site : centre partenaire visible après accord');
select tests.ok((select count(*) > 10 from public.audit_log where center_id = tests.get('cA')::uuid), 'audit : actions du centre journalisées');
select tests.ok((select count(*) >= 1 from public.audit_log where table_name = 'profiles' and details ? 'is_suspended'), 'audit : suspension journalisée');
select tests.ok(not exists (select 1 from public.audit_log where details::text like '%student@test.dev%'), 'audit : pas de données personnelles dans le journal');
select tests.ok(not has_function_privilege('anon', 'public.login_guard(text, text)', 'execute'), 'connexion : garde réservée au serveur');
do $$ begin raise notice 'TENANCY TESTS PASSED'; end $$;
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', 'kid@test.dev', '{"full_name":"Kid","birth_date":"2014-05-01","guardian_email":"Parent@Test.dev","guardian_consent":true}'),
  ('00000000-0000-0000-0000-000000000012', 'bad@test.dev', '{"full_name":"Bad","birth_date":"3000-01-01","guardian_email":"nope"}');
select tests.ok((select birth_date = '2014-05-01' and guardian_email = 'parent@test.dev' and guardian_consent_at is not null from public.profiles where email = 'kid@test.dev'), 'mineur : date de naissance et accord du tuteur enregistrés');
select tests.ok((select birth_date is null and guardian_email is null from public.profiles where email = 'bad@test.dev'), 'inscription : métadonnées invalides ignorées');
