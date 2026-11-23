-- =====================================================================
-- 0009 : Supabase Storage — fichiers privés par établissement
-- Chemin obligatoire : <tenant_id>/<dossier>/<fichier>
-- =====================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('tenant-files', 'tenant-files', false)
    on conflict (id) do nothing;

    execute $p$create policy tenant_files_read on storage.objects for select to authenticated
      using (bucket_id = 'tenant-files' and public.can_read(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy tenant_files_write on storage.objects for insert to authenticated
      with check (bucket_id = 'tenant-files' and public.is_member(((storage.foldername(name))[1])::uuid)
                  and public.tenant_is_active(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy tenant_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'tenant-files' and public.has_perm(((storage.foldername(name))[1])::uuid, 'settings.write'))$p$;
  end if;
end $$;

-- Planification (Supabase : extension pg_cron). Ignoré si indisponible.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('ostapaul-billing', '7 * * * *', 'select public.billing_cycle()');
    perform cron.schedule('ostapaul-automations', '13 5 * * *', 'select public.run_automations()');
  end if;
exception when others then
  raise notice 'pg_cron non configuré : utilisez /api/cron (%)', sqlerrm;
end $$;
