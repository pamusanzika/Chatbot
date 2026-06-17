-- ============================================================
-- FlowBot — Supabase schema + RLS policies
-- Run this in the Supabase SQL editor for your project.
-- Every table is scoped to tenant_id; RLS enforces isolation.
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────
-- 1. TENANTS
-- ──────────────────────────────────────────────────────────
create table if not exists tenants (
  id               uuid primary key default uuid_generate_v4(),
  clerk_org_id     text unique not null,
  name             text not null,
  phone            text,
  whatsapp_number  text,
  email            text,
  address          text,
  industry         text,
  default_language text not null default 'EN',
  timezone         text not null default 'Asia/Colombo',
  currency         text not null default 'LKR',
  social_links     jsonb not null default '{}'::jsonb,
  plan             text not null default 'free' check (plan in ('free','starter','pro')),
  trial_ends_at    timestamptz,
  created_at       timestamptz not null default now()
);

alter table tenants enable row level security;

-- Tenants can only read/update their own row.
-- Service role can do anything (used server-side).
create policy "tenant_select" on tenants
  for select using (auth.uid() is not null);

create policy "tenant_update" on tenants
  for update using (true);

create policy "tenant_insert" on tenants
  for insert with check (true);

-- ──────────────────────────────────────────────────────────
-- 2. TENANT USERS
-- ──────────────────────────────────────────────────────────
create table if not exists tenant_users (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  clerk_user_id text not null,
  name          text not null,
  email         text not null,
  role          text not null default 'Staff' check (role in ('Owner','Admin','Staff')),
  status        text not null default 'Active' check (status in ('Active','Invited','Suspended')),
  last_active_at timestamptz,
  created_at    timestamptz not null default now(),
  unique(tenant_id, clerk_user_id)
);

alter table tenant_users enable row level security;

create policy "tenant_users_select" on tenant_users
  for select using (
    tenant_id in (select id from tenants)
  );

create policy "tenant_users_insert" on tenant_users
  for insert with check (true);

create policy "tenant_users_update" on tenant_users
  for update using (true);

create policy "tenant_users_delete" on tenant_users
  for delete using (true);

-- ──────────────────────────────────────────────────────────
-- 3. CUSTOMERS
-- ──────────────────────────────────────────────────────────
create table if not exists customers (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  name           text not null,
  phone          text not null,
  language       text not null default 'EN',
  total_orders   int not null default 0,
  total_spent    numeric(12,2) not null default 0,
  last_order_at  timestamptz,
  created_at     timestamptz not null default now(),
  unique(tenant_id, phone)
);

alter table customers enable row level security;

create policy "customers_all" on customers
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 4. DELIVERY ZONES
-- ──────────────────────────────────────────────────────────
create table if not exists delivery_zones (
  id                       uuid primary key default uuid_generate_v4(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  province                 text not null,
  district                 text not null,
  cities                   text[] not null default '{}',
  fee                      numeric(10,2) not null,
  estimated_days           text not null,
  free_delivery_threshold  numeric(10,2) not null default 0,
  zone_type                text not null default 'province' check (zone_type in ('province', 'flat_rate', 'worldwide')),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now()
);

alter table delivery_zones enable row level security;

create policy "delivery_zones_all" on delivery_zones
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 5. PRODUCTS
-- ──────────────────────────────────────────────────────────
create table if not exists products (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  category            text not null,
  base_price          numeric(10,2) not null,
  description         text,
  image_urls          text[] not null default '{}',
  is_active           boolean not null default true,
  -- Used only for simple products that have no size/colour variants
  -- (e.g. "White Socks") — direct SKU + stock tracking on the product itself.
  sku                 text,
  stock               int,
  low_stock_threshold int not null default 5,
  created_at          timestamptz not null default now()
);

alter table products enable row level security;

create policy "products_all" on products
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 6. PRODUCT VARIANTS
-- ──────────────────────────────────────────────────────────
create table if not exists product_variants (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  product_id          uuid not null references products(id) on delete cascade,
  size                text not null,
  color_hex           text not null,
  color_name          text not null,
  price               numeric(10,2) not null,
  stock               int not null default 0,
  low_stock_threshold int not null default 5,
  sku                 text not null,
  created_at          timestamptz not null default now(),
  unique(tenant_id, sku)
);

alter table product_variants enable row level security;

create policy "product_variants_all" on product_variants
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 7. KB ENTRIES
-- ──────────────────────────────────────────────────────────
create table if not exists kb_entries (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  category   text not null,
  question   text not null,
  answer     text not null,
  keywords   text[] not null default '{}',
  language   text not null default 'EN',
  created_at timestamptz not null default now()
);

alter table kb_entries enable row level security;

create policy "kb_entries_all" on kb_entries
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 8. ORDERS
-- ──────────────────────────────────────────────────────────
create table if not exists orders (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  order_ref         text not null,
  customer_id       uuid references customers(id),
  customer_name     text not null,
  customer_phone    text not null,
  items             jsonb not null default '[]',
  subtotal          numeric(12,2) not null,
  delivery_fee      numeric(10,2) not null default 0,
  total             numeric(12,2) not null,
  payment_method    text not null check (payment_method in ('COD','Bank')),
  payment_slip_url  text,
  status            text not null default 'pending'
                    check (status in ('pending','processing','shipped','delivered','cancelled')),
  delivery_zone     text,
  estimated_days    text,
  language          text not null default 'EN',
  chat_session_id   uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(tenant_id, order_ref)
);

alter table orders enable row level security;

create policy "orders_all" on orders
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────────────────────
-- 9. CHAT SESSIONS
-- ──────────────────────────────────────────────────────────
create table if not exists chat_sessions (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  session_ref     text not null,
  customer_phone  text not null,
  message_count   int not null default 0,
  language        text not null default 'EN',
  intent          text not null default 'Other',
  is_flagged      boolean not null default false,
  started_at      timestamptz not null default now(),
  unique(tenant_id, session_ref)
);

alter table chat_sessions enable row level security;

create policy "chat_sessions_all" on chat_sessions
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 10. CHAT MESSAGES
-- ──────────────────────────────────────────────────────────
create table if not exists chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  from_role   text not null check (from_role in ('user','bot')),
  text        text not null,
  language    text not null default 'EN',
  timestamp   timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "chat_messages_all" on chat_messages
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 11. COMPLAINTS
-- ──────────────────────────────────────────────────────────
create table if not exists complaints (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  complaint_ref   text not null,
  customer_id     uuid references customers(id),
  customer_name   text not null,
  summary         text not null,
  status          text not null default 'open'
                  check (status in ('open','progress','resolved')),
  assigned_to     text,
  notes           jsonb not null default '[]',
  language        text not null default 'EN',
  created_at      timestamptz not null default now(),
  unique(tenant_id, complaint_ref)
);

alter table complaints enable row level security;

create policy "complaints_all" on complaints
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 12. USAGE
-- ──────────────────────────────────────────────────────────
create table if not exists usage (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  month             text not null,  -- e.g. '2026-06'
  tokens_used       bigint not null default 0,
  tokens_limit      bigint not null default 10000000,
  orders_processed  int not null default 0,
  active_customers  int not null default 0,
  unique(tenant_id, month)
);

alter table usage enable row level security;

create policy "usage_all" on usage
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 12b. CATEGORIES
-- ──────────────────────────────────────────────────────────
create table if not exists categories (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,
  color      text not null default '#7c6dfa',
  created_at timestamptz not null default now(),
  unique(tenant_id, name)
);

alter table categories enable row level security;

create policy "categories_all" on categories
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- ──────────────────────────────────────────────────────────
-- 13. STOCK MOVEMENTS (audit trail for variant stock changes)
-- ──────────────────────────────────────────────────────────
create table if not exists stock_movements (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  variant_id  uuid references product_variants(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  delta       int not null,
  reason      text not null check (reason in ('Restock','Sale','Damaged','Return','Adjustment')),
  created_at  timestamptz not null default now(),
  constraint stock_movements_target check (
    (variant_id is not null) <> (product_id is not null)
  )
);

alter table stock_movements enable row level security;

create policy "stock_movements_all" on stock_movements
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

create index if not exists stock_movements_tenant_variant on stock_movements(tenant_id, variant_id);

-- ──────────────────────────────────────────────────────────
-- 14. STORAGE — product images
-- ──────────────────────────────────────────────────────────
-- Run once in the Supabase dashboard (Storage > New bucket) or via SQL:
--   insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);
--
-- Public read, tenant-scoped write (path must start with "<tenant_id>/"):
-- create policy "product_images_read" on storage.objects
--   for select using (bucket_id = 'product-images');
--
-- create policy "product_images_write" on storage.objects
--   for insert with check (
--     bucket_id = 'product-images'
--     and (storage.foldername(name))[1] = (
--       select t.id::text from tenants t
--       join tenant_users tu on tu.tenant_id = t.id
--       where tu.clerk_user_id = auth.uid()::text
--       limit 1
--     )
--   );

-- ──────────────────────────────────────────────────────────
-- INDEXES (performance)
-- ──────────────────────────────────────────────────────────
create index if not exists orders_tenant_status on orders(tenant_id, status);
create index if not exists orders_tenant_created on orders(tenant_id, created_at desc);
create index if not exists customers_tenant_phone on customers(tenant_id, phone);
create index if not exists chat_sessions_tenant_started on chat_sessions(tenant_id, started_at desc);
create index if not exists complaints_tenant_status on complaints(tenant_id, status);
create index if not exists kb_entries_tenant_lang on kb_entries(tenant_id, language);
create index if not exists product_variants_tenant_product on product_variants(tenant_id, product_id);
