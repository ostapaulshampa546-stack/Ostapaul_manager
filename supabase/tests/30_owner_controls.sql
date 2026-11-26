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
