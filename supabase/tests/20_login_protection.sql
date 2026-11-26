\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
update public.platform_settings set login_max_attempts = 4, login_lock_minutes = 60;
select tests.put('h', repeat('a', 64));
select tests.ok((public.login_guard(tests.get('h'), '1.2.3.4') ->> 'remaining')::int = 4, 'connexion : 4 tentatives disponibles');
select public.login_record(tests.get('h'), '1.2.3.4', false) from generate_series(1, 3);
select tests.ok(not (public.login_guard(tests.get('h'), '1.2.3.4') ->> 'blocked')::boolean
  and (public.login_guard(tests.get('h'), '1.2.3.4') ->> 'remaining')::int = 1, 'connexion : 3 échecs, 1 tentative restante');
select tests.ok((public.login_record(tests.get('h'), '1.2.3.4', false) ->> 'blocked')::boolean, 'connexion : bloquée au 4e échec');
select tests.ok((public.login_guard(tests.get('h'), '1.2.3.4') ->> 'retry_after_seconds')::int between 3500 and 3600, 'connexion : blocage d''environ 1 heure');
update public.login_attempts set created_at = created_at - interval '61 minutes' where email_hash = tests.get('h');
select tests.ok(not (public.login_guard(tests.get('h'), '1.2.3.4') ->> 'blocked')::boolean, 'connexion : débloquée après 1 heure');
select public.login_record(tests.get('h'), '1.2.3.4', false) from generate_series(1, 2);
select public.login_record(tests.get('h'), '1.2.3.4', true);
select tests.ok((public.login_guard(tests.get('h'), '1.2.3.4') ->> 'remaining')::int = 4, 'connexion réussie : compteur remis à zéro');
select tests.put('h2', repeat('b', 64));
select public.login_record(md5(i::text) || md5(i::text), '9.9.9.9', false) from generate_series(1, 20) i;
select tests.ok((public.login_guard(tests.get('h2'), '9.9.9.9') ->> 'blocked')::boolean, 'IP bloquée après 20 échecs sur des comptes différents');
set role authenticated;
select tests.fails($$select public.login_guard(repeat('c', 64), null)$$, 'journal de connexion inaccessible aux clients');
select tests.fails($$select count(*) from public.login_attempts$$, 'table des tentatives invisible aux clients');
reset role;
do $$ begin raise notice 'LOGIN TESTS PASSED'; end $$;
reset role; update public.platform_settings set login_max_attempts = 3, login_lock_minutes = 2880;
