-- =====================================================================
-- 0007 : module PME MANAGER (commercial)
-- =====================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  customer_type text not null default 'company' check (customer_type in ('individual', 'company')),
  phone text,
  email text,
  address text,
  tax_id text,     -- RCCM / Id. Nat. / NIF
  notes text,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('customers', 'customers.write');

create table public.sales_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doc_type text not null check (doc_type in ('quote', 'order', 'invoice')),
  number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'confirmed', 'issued',
                                                         'partial', 'paid', 'cancelled', 'converted')),
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  subtotal numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 16 check (tax_rate between 0 and 100), -- TVA RDC 16 %
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  notes text,
  source_id uuid references public.sales_documents(id) on delete set null,
  stock_applied boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index on public.sales_documents (tenant_id, doc_type, status);
select public.apply_tenant_rls('sales_documents', 'sales.write', null, 'sales.read');
select public.attach_audit('sales_documents');

create table public.sales_document_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.sales_documents(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
select public.apply_tenant_rls('sales_document_items', 'sales.write', null, 'sales.read');

create or replace function public.sales_doc_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prefix text;
begin
  if tg_op = 'INSERT' then
    v_prefix := case new.doc_type when 'quote' then 'DEV' when 'order' then 'BCL' else 'FAC' end;
    if new.number is null or new.number = '' then
      new.number := public.next_matricule(new.tenant_id, v_prefix);
    end if;
    new.paid_amount := 0; new.stock_applied := false;
    if new.status in ('issued', 'partial', 'paid', 'converted') then new.status := 'draft'; end if;
  else
    if new.status = 'issued' and old.status <> 'issued' and current_setting('ostapaul.issuing', true) is distinct from 'on'
       and current_setting('ostapaul.payment_apply', true) is distinct from 'on' then
      raise exception 'Utilisez « Émettre la facture »';
    end if;
    if current_setting('ostapaul.payment_apply', true) is distinct from 'on' then
      new.paid_amount := old.paid_amount;
      if new.status in ('partial', 'paid') and new.status <> old.status then new.status := old.status; end if;
      if old.status in ('issued', 'partial', 'paid') and old.doc_type = 'invoice' and
         (new.total <> old.total or new.customer_id is distinct from old.customer_id) then
        raise exception 'Facture émise : montant et client non modifiables (créez un avoir)';
      end if;
    end if;
  end if;
  new.tax_amount := round(new.subtotal * new.tax_rate / 100, 2);
  new.total := new.subtotal + new.tax_amount;
  return new;
end $$;
create trigger sales_doc_before before insert or update on public.sales_documents
  for each row execute function public.sales_doc_before();

create or replace function public.sales_items_totals() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_doc uuid := coalesce(new.document_id, old.document_id); d public.sales_documents;
begin
  select * into d from public.sales_documents where id = v_doc;
  if d.doc_type = 'invoice' and d.status in ('issued', 'partial', 'paid', 'cancelled') then
    raise exception 'Facture émise : lignes non modifiables';
  end if;
  update public.sales_documents set subtotal = coalesce((select sum(line_total) from public.sales_document_items
    where document_id = v_doc), 0) where id = v_doc;
  return null;
end $$;
create trigger sales_items_totals after insert or update or delete on public.sales_document_items
  for each row execute function public.sales_items_totals();

-- Conversion devis -> commande -> facture
create or replace function public.convert_sales_document(p_doc uuid, p_target text) returns uuid
language plpgsql security definer set search_path = public as $$
declare d public.sales_documents; v_new uuid;
begin
  select * into d from public.sales_documents where id = p_doc;
  if d.id is null or not public.can_write(d.tenant_id, 'sales.write') then raise exception 'Permission refusée' using errcode = '42501'; end if;
  if p_target not in ('order', 'invoice') or (d.doc_type = 'invoice') or (d.doc_type = 'order' and p_target = 'order') then
    raise exception 'Conversion impossible';
  end if;
  insert into public.sales_documents (tenant_id, doc_type, number, customer_id, currency, tax_rate, notes, source_id,
                                      due_date, status)
  values (d.tenant_id, p_target, '', d.customer_id, d.currency, d.tax_rate, d.notes, d.id,
          case when p_target = 'invoice' then current_date + 30 end, case when p_target = 'invoice' then 'draft' else 'confirmed' end)
  returning id into v_new;
  insert into public.sales_document_items (tenant_id, document_id, product_id, description, quantity, unit_price)
  select tenant_id, v_new, product_id, description, quantity, unit_price from public.sales_document_items where document_id = d.id;
  update public.sales_documents set status = 'converted' where id = d.id;
  return v_new;
end $$;

-- Émission d'une facture : verrouillage + sortie de stock
create or replace function public.issue_invoice(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d public.sales_documents;
begin
  select * into d from public.sales_documents where id = p_doc for update;
  if d.id is null or not public.can_write(d.tenant_id, 'sales.write') then raise exception 'Permission refusée' using errcode = '42501'; end if;
  if d.doc_type <> 'invoice' or d.status <> 'draft' then raise exception 'Seule une facture brouillon peut être émise'; end if;
  if d.total <= 0 then raise exception 'Facture vide'; end if;
  if not d.stock_applied then
    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, ref_type, ref_id)
    select d.tenant_id, i.product_id, 'out', i.quantity, 'Facture ' || d.number, 'sales_document', d.id
      from public.sales_document_items i join public.products p on p.id = i.product_id
     where i.document_id = d.id;
  end if;
  perform set_config('ostapaul.issuing', 'on', true);
  update public.sales_documents set status = 'issued', stock_applied = true, issue_date = current_date where id = d.id;
  perform set_config('ostapaul.issuing', 'off', true);
end $$;

create or replace view public.customer_balances with (security_invoker = true) as
  select d.tenant_id, c.id as customer_id, c.name, c.phone, d.currency,
         sum(d.total) as total_invoiced, sum(d.paid_amount) as total_paid, sum(d.total - d.paid_amount) as balance,
         sum(case when d.due_date < current_date then d.total - d.paid_amount else 0 end) as overdue
    from public.sales_documents d join public.customers c on c.id = d.customer_id
   where d.doc_type = 'invoice' and d.status in ('issued', 'partial', 'paid')
   group by d.tenant_id, c.id, d.currency;
