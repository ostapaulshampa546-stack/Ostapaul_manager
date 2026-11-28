-- =====================================================================
-- 0019 : QR code du menu de l'établissement (sans table)
-- Le menu public est lisible par tous via le jeton public du restaurant ;
-- il se met à jour automatiquement dès qu'un plat est ajouté ou modifié.
-- La commande en ligne reste réservée aux QR des tables.
-- =====================================================================
create or replace function public.public_restaurant_menu(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.tenants;
begin
  select * into t from public.tenants where public_token = p_token and length(p_token) >= 32 and sector = 'restaurant';
  if t.id is null or t.status <> 'active' then return null; end if;
  return jsonb_build_object(
    'establishment', t.name, 'logo_url', t.logo_url, 'table', null, 'phone', t.phone, 'city', t.city,
    'ordering_enabled', false,
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name,
        'items', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description,
                   'price', m.price, 'currency', m.currency) order by m.name)
                 from public.menu_items m where m.category_id = c.id and m.is_available), '[]'::jsonb)) order by c.sort, c.name)
      from public.menu_categories c where c.tenant_id = t.id), '[]'::jsonb),
    'uncategorized', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description,
        'price', m.price, 'currency', m.currency) order by m.name)
      from public.menu_items m where m.tenant_id = t.id and m.category_id is null and m.is_available), '[]'::jsonb)
  );
end $$;
revoke execute on function public.public_restaurant_menu(text) from public;
grant execute on function public.public_restaurant_menu(text) to anon, authenticated;
