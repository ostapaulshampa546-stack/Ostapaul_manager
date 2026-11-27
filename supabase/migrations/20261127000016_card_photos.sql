-- =====================================================================
-- 0016 : photos d'identité sur les cartes
-- Les photos sont stockées dans le bucket privé tenant-files :
--   <tenant_id>/photos/<type>/<person_id>-<horodatage>.jpg
-- =====================================================================

-- Chemin de la photo d'une carte scannée (membres de l'établissement uniquement)
create or replace function public.card_photo(p_tenant uuid, p_token text) returns text
language plpgsql stable security definer set search_path = public as $$
declare c public.id_cards; v text;
begin
  if not public.is_member(p_tenant) then return null; end if;
  select * into c from public.id_cards
   where tenant_id = p_tenant and qr_token = regexp_replace(coalesce(p_token, ''), '^.*/v/', '');
  if c.id is null then return null; end if;
  if c.person_type = 'employee' then select photo_path into v from public.employees where id = c.person_id;
  elsif c.person_type = 'student' then select photo_path into v from public.students where id = c.person_id;
  else select photo_path into v from public.teachers where id = c.person_id; end if;
  return v;
end $$;

revoke execute on function public.card_photo(uuid, text) from public, anon;
grant execute on function public.card_photo(uuid, text) to authenticated;

-- Le chemin d'une photo doit rester dans le dossier de l'établissement
alter table public.employees add constraint employees_photo_path_check
  check (photo_path is null or photo_path like tenant_id::text || '/photos/%');
alter table public.students add constraint students_photo_path_check
  check (photo_path is null or photo_path like tenant_id::text || '/photos/%');
alter table public.teachers add constraint teachers_photo_path_check
  check (photo_path is null or photo_path like tenant_id::text || '/photos/%');
