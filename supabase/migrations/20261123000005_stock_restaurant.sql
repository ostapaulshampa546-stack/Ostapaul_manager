-- =====================================================================
-- 0005 : stocks (restaurant & PME) + module RESTAURANT
-- =====================================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sku text,
  barcode text,
  name text not null,
  category text,
  unit text not null default 'pièce',
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  qty_on_hand numeric(14,3) not null default 0,
  min_qty numeric(14,3) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, sku)
);
create index on public.products (tenant_id, is_active);
select public.apply_tenant_rls('products', 'stock.write', 'stock');

-- Le stock ne se modifie que par des mouvements (traçabilité)
create or replace function public.products_qty_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.qty_on_hand <> 0 and current_setting('ostapaul.stock', true) is distinct from 'on' then
      -- quantité initiale => mouvement d'entrée créé après insertion
      perform set_config('ostapaul.initial_qty', new.qty_on_hand::text, true);
      new.qty_on_hand := 0;
    end if;
  elsif new.qty_on_hand is distinct from old.qty_on_hand and current_setting('ostapaul.stock', true) is distinct from 'on' then
    new.qty_on_hand := old.qty_on_hand;
  end if;
  return new;
end $$;
create trigger products_qty_guard before insert or update on public.products
  for each row execute function public.products_qty_guard();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjust')),
  quantity numeric(14,3) not null check (quantity <> 0),
  unit_cost numeric(14,2),
  reason text,
  ref_type text,
  ref_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (tenant_id, product_id, created_at desc);
-- Mouvements : lecture + insertion uniquement (aucune modification ni suppression : traçabilité)
alter table public.stock_movements enable row level security;
create policy stock_movements_sel on public.stock_movements for select using (public.can_read(tenant_id));
create policy stock_movements_ins on public.stock_movements for insert
  with check (public.can_write(tenant_id, 'stock.write') and public.tenant_has_feature(tenant_id, 'stock'));

create or replace function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.products;
  v_delta numeric;
begin
  select * into p from public.products where id = new.product_id for update;
  if p.tenant_id <> new.tenant_id then raise exception 'Produit d''un autre établissement' using errcode = '42501'; end if;
  v_delta := case new.movement_type when 'in' then abs(new.quantity) when 'out' then -abs(new.quantity) else new.quantity end;
  perform set_config('ostapaul.stock', 'on', true);
  update public.products set qty_on_hand = qty_on_hand + v_delta where id = p.id returning * into p;
  perform set_config('ostapaul.stock', 'off', true);
  if p.qty_on_hand <= p.min_qty and (p.qty_on_hand - v_delta) > p.min_qty then
    perform public.notify_tenant(p.tenant_id, 'stock', 'Alerte de rupture : ' || p.name,
      'Stock restant : ' || p.qty_on_hand || ' ' || p.unit || ' (seuil ' || p.min_qty || ')', '/stock');
  end if;
  if new.movement_type = 'adjust' and abs(new.quantity) * greatest(p.cost_price, 1) > 500 then
    perform public.raise_fraud_alert(p.tenant_id, 'stock_adjustment', 'medium', 'Ajustement de stock important',
      jsonb_build_object('product', p.name, 'quantity', new.quantity, 'by', auth.uid()), 'stock_movements', new.id::text);
  end if;
  return new;
end $$;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

create or replace function public.products_initial_qty() returns trigger
language plpgsql security definer set search_path = public as $$
declare v numeric := nullif(current_setting('ostapaul.initial_qty', true), '')::numeric;
begin
  if v is not null and v <> 0 then
    perform set_config('ostapaul.initial_qty', '', true);
    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, unit_cost, reason)
    values (new.tenant_id, new.id, 'in', v, new.cost_price, 'Stock initial');
  end if;
  return new;
end $$;
create trigger products_initial_qty after insert on public.products
  for each row execute function public.products_initial_qty();

create or replace view public.low_stock with (security_invoker = true) as
  select * from public.products where is_active and qty_on_hand <= min_qty;

-- Approvisionnement (bons de commande fournisseurs)
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  number text not null default public.gen_reference('BC'),
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  expected_date date,
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  total numeric(14,2) not null default 0,
  notes text,
  received_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('purchase_orders', 'stock.write', 'stock_advanced');

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0)
);
select public.apply_tenant_rls('purchase_order_items', 'stock.write', 'stock_advanced');

create or replace function public.po_totals() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_po uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  update public.purchase_orders set total = coalesce((select sum(quantity * unit_cost) from public.purchase_order_items
    where purchase_order_id = v_po), 0) where id = v_po;
  return null;
end $$;
create trigger po_items_totals after insert or update or delete on public.purchase_order_items
  for each row execute function public.po_totals();

create or replace function public.receive_purchase_order(p_po uuid, p_record_expense boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare po public.purchase_orders; it record;
begin
  select * into po from public.purchase_orders where id = p_po for update;
  if po.id is null or not public.can_write(po.tenant_id, 'stock.write') or not public.tenant_has_feature(po.tenant_id, 'stock_advanced') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  if po.status in ('received', 'cancelled') then raise exception 'Bon de commande déjà traité'; end if;
  for it in select * from public.purchase_order_items where purchase_order_id = po.id loop
    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, unit_cost, reason, ref_type, ref_id)
    values (po.tenant_id, it.product_id, 'in', it.quantity, it.unit_cost, 'Réception ' || po.number, 'purchase_order', po.id);
  end loop;
  update public.purchase_orders set status = 'received', received_at = now() where id = po.id;
  if p_record_expense and po.total > 0 then
    insert into public.expenses (tenant_id, category, description, amount, currency, supplier_id, source, status)
    values (po.tenant_id, 'Achats', 'Réception ' || po.number, po.total, po.currency, po.supplier_id, 'purchase', 'unpaid');
  end if;
end $$;

-- =====================================================================
-- RESTAURANT
-- =====================================================================
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  seats int not null default 4 check (seats between 1 and 100),
  zone text,
  qr_token text not null unique default public.gen_token(), -- QR généré automatiquement
  status text not null default 'free' check (status in ('free', 'occupied', 'reserved')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, label)
);
select public.apply_tenant_rls('dining_tables', 'tables.write');

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort int not null default 0
);
select public.apply_tenant_rls('menu_categories', 'menu.write');

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(14,2) not null check (price >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  is_available boolean not null default true,
  image_path text,
  product_id uuid references public.products(id) on delete set null, -- consommation de stock
  stock_qty_per_unit numeric(14,3) not null default 1,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('menu_items', 'menu.write');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number text not null,
  order_type text not null default 'dine_in' check (order_type in ('dine_in', 'takeaway', 'delivery')),
  table_id uuid references public.dining_tables(id) on delete set null,
  waiter_id uuid references public.employees(id) on delete set null,
  customer_name text,
  customer_phone text,
  status text not null default 'new' check (status in ('new', 'in_kitchen', 'ready', 'served', 'paid', 'cancelled')),
  source text not null default 'staff' check (source in ('staff', 'qr')),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  notes text,
  stock_applied boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (tenant_id, number)
);
create index on public.orders (tenant_id, status, created_at desc);
select public.apply_tenant_rls('orders', 'orders.write');
-- La cuisine peut faire avancer le statut
create policy orders_kitchen on public.orders for update
  using (public.can_write(tenant_id, 'kitchen.write')) with check (public.can_write(tenant_id, 'kitchen.write'));
select public.attach_audit('orders');

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 999),
  line_total numeric(14,2) generated always as (unit_price * quantity) stored,
  kitchen_status text not null default 'pending' check (kitchen_status in ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);
create index on public.order_items (order_id);
select public.apply_tenant_rls('order_items', 'orders.write');
create policy order_items_kitchen on public.order_items for update
  using (public.can_write(tenant_id, 'kitchen.write')) with check (public.can_write(tenant_id, 'kitchen.write'));

create or replace function public.order_number(p_tenant uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_key text := 'ORD' || to_char(now() at time zone 'Africa/Kinshasa', 'YYMMDD'); v_n bigint;
begin
  insert into public.counters (tenant_id, name, value) values (p_tenant, v_key, 1)
  on conflict (tenant_id, name) do update set value = public.counters.value + 1 returning value into v_n;
  return to_char(now() at time zone 'Africa/Kinshasa', 'DDMM') || '-' || lpad(v_n::text, 3, '0');
end $$;

create or replace function public.orders_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.number := public.order_number(new.tenant_id);
    new.paid_amount := 0; new.stock_applied := false;
    if new.order_type = 'dine_in' and new.table_id is not null then
      update public.dining_tables set status = 'occupied' where id = new.table_id and tenant_id = new.tenant_id;
    end if;
  else
    if old.status in ('paid', 'cancelled') and public.jwt_role() <> 'service_role'
       and current_setting('ostapaul.payment_apply', true) is distinct from 'on' then
      raise exception 'Commande clôturée : modification impossible' using errcode = '42501';
    end if;
    if new.paid_amount is distinct from old.paid_amount and current_setting('ostapaul.payment_apply', true) is distinct from 'on' then
      new.paid_amount := old.paid_amount; -- seul un paiement confirmé modifie ce champ
    end if;
    if new.status = 'paid' and old.status <> 'paid' and new.paid_amount < new.total then
      raise exception 'Commande non soldée';
    end if;
    new.total := greatest(new.subtotal - new.discount, 0);
    if new.discount > 0 and new.discount is distinct from old.discount and new.subtotal > 0 and new.discount / new.subtotal > 0.3 then
      perform public.raise_fraud_alert(new.tenant_id, 'large_discount', 'medium', 'Remise importante sur commande',
        jsonb_build_object('order', new.number, 'subtotal', new.subtotal, 'discount', new.discount, 'by', auth.uid()), 'orders', new.id::text);
    end if;
    if new.status in ('paid', 'cancelled') and old.status not in ('paid', 'cancelled') then
      new.closed_at := now();
      if new.table_id is not null and not exists (select 1 from public.orders o where o.table_id = new.table_id
           and o.id <> new.id and o.status not in ('paid', 'cancelled')) then
        update public.dining_tables set status = 'free' where id = new.table_id;
      end if;
    end if;
    -- déstockage à l'envoi en cuisine
    if new.status = 'in_kitchen' and not new.stock_applied then
      insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, ref_type, ref_id)
      select new.tenant_id, mi.product_id, 'out', oi.quantity * mi.stock_qty_per_unit, 'Commande ' || new.number, 'order', new.id
        from public.order_items oi join public.menu_items mi on mi.id = oi.menu_item_id
       where oi.order_id = new.id and mi.product_id is not null and oi.kitchen_status <> 'cancelled';
      new.stock_applied := true;
    end if;
  end if;
  return new;
end $$;
create trigger orders_before before insert or update on public.orders
  for each row execute function public.orders_before();

create or replace function public.order_items_totals() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders set subtotal = coalesce((select sum(line_total) from public.order_items
    where order_id = v_order and kitchen_status <> 'cancelled'), 0)
  where id = v_order and status not in ('paid', 'cancelled');
  return null;
end $$;
create trigger order_items_totals after insert or update or delete on public.order_items
  for each row execute function public.order_items_totals();

create or replace function public.order_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = coalesce(new.order_id, old.order_id);
  if o.status in ('paid', 'cancelled') then raise exception 'Commande clôturée'; end if;
  if tg_op <> 'DELETE' and o.tenant_id <> new.tenant_id then raise exception 'Incohérence d''établissement' using errcode = '42501'; end if;
  if tg_op = 'INSERT' and new.menu_item_id is not null then
    select name, price into new.name, new.unit_price from public.menu_items
     where id = new.menu_item_id and tenant_id = new.tenant_id;
    if new.name is null then raise exception 'Article inconnu'; end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger order_items_guard before insert or update or delete on public.order_items
  for each row execute function public.order_items_guard();

-- Menu public via QR de table (lecture anonyme sécurisée)
create or replace function public.public_table_menu(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare dt public.dining_tables; t public.tenants;
begin
  select * into dt from public.dining_tables where qr_token = p_token and is_active and length(p_token) >= 32;
  if dt.id is null then return null; end if;
  select * into t from public.tenants where id = dt.tenant_id;
  return jsonb_build_object(
    'establishment', t.name, 'logo_url', t.logo_url, 'table', dt.label, 'phone', t.phone,
    'ordering_enabled', public.tenant_is_active(t.id) and coalesce((t.settings ->> 'qr_ordering')::boolean, true),
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

-- Commande client depuis le QR de la table : [{menu_item_id, quantity}]
create or replace function public.public_place_order(p_token text, p_items jsonb, p_customer_name text default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  dt public.dining_tables;
  v_order public.orders;
  it jsonb;
  v_recent int;
  v_currency text;
begin
  select * into dt from public.dining_tables where qr_token = p_token and is_active and length(p_token) >= 32;
  if dt.id is null then raise exception 'Table inconnue'; end if;
  if not public.tenant_is_active(dt.tenant_id) then raise exception 'Commande en ligne indisponible'; end if;
  if coalesce((select (settings ->> 'qr_ordering')::boolean from public.tenants where id = dt.tenant_id), true) = false then
    raise exception 'Commande par QR désactivée';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Panier invalide';
  end if;
  select count(*) into v_recent from public.orders
   where table_id = dt.id and source = 'qr' and created_at > now() - interval '10 minutes';
  if v_recent >= 3 then raise exception 'Trop de commandes récentes pour cette table, appelez un serveur'; end if;

  select m.currency into v_currency from public.menu_items m
   where m.id = ((p_items -> 0) ->> 'menu_item_id')::uuid and m.tenant_id = dt.tenant_id;
  insert into public.orders (tenant_id, order_type, table_id, customer_name, notes, source, currency)
  values (dt.tenant_id, 'dine_in', dt.id, left(p_customer_name, 80), left(p_notes, 300), 'qr', coalesce(v_currency, 'USD'))
  returning * into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from public.menu_items where id = (it ->> 'menu_item_id')::uuid
                   and tenant_id = dt.tenant_id and is_available) then
      raise exception 'Article indisponible';
    end if;
    insert into public.order_items (tenant_id, order_id, menu_item_id, name, unit_price, quantity)
    values (dt.tenant_id, v_order.id, (it ->> 'menu_item_id')::uuid, '-', 0,
            least(greatest(coalesce((it ->> 'quantity')::int, 1), 1), 50));
  end loop;
  perform public.notify_tenant(dt.tenant_id, 'order', 'Nouvelle commande QR — ' || dt.label, 'Commande ' || v_order.number, '/restaurant/pos');
  select * into v_order from public.orders where id = v_order.id;
  return jsonb_build_object('number', v_order.number, 'total', v_order.total, 'currency', v_order.currency);
end $$;
