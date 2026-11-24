-- =====================================================================
-- 0012 : demandes de contact / démonstration du site vitrine
-- Écriture uniquement par le serveur (service_role), lecture par le super admin.
-- =====================================================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  organization text check (length(organization) <= 160),
  sector text check (sector in ('restaurant', 'school', 'pme', 'other')),
  phone text check (length(phone) <= 40),
  email text check (length(email) <= 200),
  message text check (length(message) <= 2000),
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  notes text,
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index on public.leads (created_at desc);
create index on public.leads (ip_hash, created_at desc);
alter table public.leads enable row level security;
create policy leads_admin_read on public.leads for select using (public.is_platform_admin());
create policy leads_admin_update on public.leads for update using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke insert on public.leads from anon, authenticated;
