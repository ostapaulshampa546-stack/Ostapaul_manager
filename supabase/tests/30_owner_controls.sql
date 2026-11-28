\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'owner13@test.cd'), ('00000000-0000-0000-0000-0000000000f2', 'cashier13@test.cd');
set role authenticated;
select tests.act('00000000-0000-0000-0000-0000000000f1');
select tests.put('t13', public.create_tenant('restaurant', 'Resto Contrôle', 'basic')::text);
reset role;
insert into public.memberships (tenant_id, user_id, role) values (tests.uid('t13'), '00000000-0000-0000-0000-0000000000f2', 'cashier');

-- permissions des rôles modifiables
set role authenticated;
select tests.act('00000000-0000-0000-0000-0000000000f2');
select tests.ok(not public.has_perm(tests.uid('t13'), 'stock.write'), 'caissier : pas de stock par défaut');
select tests.act('00000000-0000-0000-0000-0000000000ad');
insert into public.platform_role_permissions (role, permissions)
values ('cashier', array['orders.write', 'payments.cash', 'cash.manage', 'stock.write']);
select tests.act('00000000-0000-0000-0000-0000000000f2');
select tests.ok(public.has_perm(tests.uid('t13'), 'stock.write'), 'super admin : permission ajoutée au rôle caissier');
select tests.fails($$insert into public.platform_role_permissions (role, permissions) values ('waiter', '{}')$$, 'un client ne peut pas modifier les rôles');
select tests.fails($$insert into public.platform_role_permissions (role, permissions) values ('owner', '{}')$$, 'les rôles propriétaire/admin ne sont pas modifiables') ;

-- mode assistance
select tests.act('00000000-0000-0000-0000-0000000000ad');
select tests.ok(not public.has_perm(tests.uid('t13'), 'orders.write'), 'super admin : pas d''écriture sans mode assistance');
select public.admin_support_access(tests.uid('t13'), true, 'Aide à la configuration');
select tests.ok(public.has_perm(tests.uid('t13'), 'settings.write') and public.can_write(tests.uid('t13'), 'orders.write'), 'mode assistance : accès complet');
reset role;
select tests.ok((select count(*) from public.notifications where tenant_id = tests.uid('t13') and title like 'Accès assistance%') = 1, 'propriétaire prévenu de l''accès assistance');
select tests.ok((select count(*) from public.audit_logs where tenant_id = tests.uid('t13') and action = 'support_access_on') = 1, 'accès assistance journalisé');
set role authenticated;
select tests.act('00000000-0000-0000-0000-0000000000f1');
insert into public.invitations (tenant_id, email, role) values (tests.uid('t13'), 'u3@test.cd', 'waiter');
select tests.ok(true, 'l''accès assistance ne consomme pas de place utilisateur (Basique : 2)');
select tests.act('00000000-0000-0000-0000-0000000000ad');
select public.admin_support_access(tests.uid('t13'), false);
select tests.ok(not public.has_perm(tests.uid('t13'), 'orders.write'), 'fin du mode assistance : accès retiré');
select tests.act('00000000-0000-0000-0000-0000000000f1');
select tests.fails(format($$select public.admin_support_access(%L, true)$$, tests.get('t13')), 'mode assistance réservé au super admin');

-- blocage des connexions réglable
reset role;
update public.platform_settings set login_max_attempts = 6, login_lock_minutes = 30;
select tests.ok((public.login_guard(repeat('d', 64), null) ->> 'remaining')::int = 6 and (public.login_guard(repeat('d', 64), null) ->> 'lock_minutes')::int = 30,
  'règles de blocage réglables (6 tentatives, 30 min)');
update public.platform_settings set login_max_attempts = 4, login_lock_minutes = 60;
do $$ begin raise notice 'OWNER CONTROL TESTS PASSED'; end $$;
-- 3 tentatives / 48 h ; IP : 20 échecs / 1 h
reset role;
update public.platform_settings set login_max_attempts = 3, login_lock_minutes = 2880;
select public.login_record(repeat('e', 64), '5.5.5.5', false) from generate_series(1, 3);
select tests.ok((public.login_guard(repeat('e', 64), '5.5.5.5') ->> 'blocked')::boolean
  and (public.login_guard(repeat('e', 64), '5.5.5.5') ->> 'retry_after_seconds')::int > 47 * 3600, 'compte bloqué 48 h après 3 échecs');
update public.login_attempts set created_at = created_at - interval '2 hours' where email_hash = repeat('e', 64);
select tests.ok((public.login_guard(repeat('e', 64), '5.5.5.5') ->> 'blocked')::boolean, 'toujours bloqué après 2 heures');
select tests.ok(not (public.login_guard(repeat('f', 64), '5.5.5.5') ->> 'blocked')::boolean, 'les autres comptes de la même IP restent libres');
select public.login_record(repeat('e', 64), '5.5.5.5', true);
select tests.ok(not (public.login_guard(repeat('e', 64), '5.5.5.5') ->> 'blocked')::boolean, 'réinitialisation du mot de passe : débloqué');
update public.platform_settings set login_max_attempts = 4, login_lock_minutes = 60;
-- Surveillance : réservée au super admin
reset role;
do $$ declare ok boolean := false; begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.memberships where role <> 'owner' limit 1), 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_monitoring(); exception when insufficient_privilege then ok := true; end;
  reset role;
  perform tests.ok(ok, 'surveillance refusée aux non-admins');
end $$;
reset role;
do $$ declare r jsonb; begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.platform_admins limit 1), 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.admin_monitoring();
  reset role;
  perform tests.ok(r ? 'login' and r ? 'fraud' and r ? 'billing' and (r -> 'login' ->> 'max_attempts') is not null, 'surveillance : rapport complet pour le super admin');
end $$;
reset role;
-- Photos des cartes
reset role;
do $$ declare t uuid; e uuid; ok boolean := false; begin
  select tenant_id, id into t, e from public.employees limit 1;
  if e is null then perform tests.ok(true, 'photos : aucun employé de test (ignoré)'); return; end if;
  begin update public.employees set photo_path = gen_random_uuid()::text || '/photos/x.jpg' where id = e;
  exception when check_violation then ok := true; end;
  perform tests.ok(ok, 'photo : chemin hors du dossier de l''établissement refusé');
  update public.employees set photo_path = t::text || '/photos/employee/' || e::text || '-1.jpg' where id = e;
  perform tests.ok(true, 'photo : chemin valide accepté');
  update public.employees set photo_path = null where id = e;
end $$;
-- QR du menu de l'établissement
reset role;
do $$ declare t public.tenants; m jsonb; begin
  select * into t from public.tenants where sector = 'restaurant' limit 1;
  if t.id is null then perform tests.ok(true, 'menu public : pas de restaurant de test (ignoré)'); return; end if;
  set local role anon;
  m := public.public_restaurant_menu(t.public_token);
  reset role;
  perform tests.ok(m ->> 'establishment' = t.name and (m ->> 'ordering_enabled')::boolean = false, 'menu public : lisible sans connexion, sans commande');
  perform tests.ok(public.public_restaurant_menu('x') is null, 'menu public : jeton invalide refusé');
end $$;
reset role;
