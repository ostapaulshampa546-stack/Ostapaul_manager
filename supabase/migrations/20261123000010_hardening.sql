-- =====================================================================
-- 0010 : durcissement (recommandations de l'analyseur de sécurité Supabase)
-- =====================================================================

-- search_path fixe sur les fonctions qui n'en avaient pas
alter function public.gen_token() set search_path = public;
alter function public.jwt_role() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.default_role_permissions(public.member_role) set search_path = public;
alter function public.apply_tenant_rls(text, text, text, text) set search_path = public;
alter function public.guard_tenant_column() set search_path = public;
alter function public.attach_audit(text) set search_path = public;
alter function public.gen_reference(text) set search_path = public;
alter function public.block_payment_delete() set search_path = public;
alter function public.products_qty_guard() set search_path = public;
alter function public.student_invoice_guard() set search_path = public;

-- Les fonctions de trigger ne doivent pas être appelables via l'API (/rest/v1/rpc)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Visiteurs anonymes : uniquement les pages publiques QR (menu, commande, carte, reçu)
-- et is_platform_admin (utilisée par la politique de lecture des formules).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.can_read(uuid), public.is_member(uuid), public.has_perm(uuid, text),
      public.can_write(uuid, text), public.tenant_has_feature(uuid, text), public.tenant_is_active(uuid),
      public.user_tenant_ids(), public.tenant_plan(uuid), public.member_role_of(uuid) from anon;
  end if;
end $$;
