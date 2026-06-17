-- Global sequence for human-friendly order numbers.
-- Format: ORD-YYYY-NNNN  (sequence is not reset per year; year in prefix is cosmetic)
create sequence if not exists public.order_number_seq start 1;

create table if not exists public.orders (
  id               uuid        primary key default gen_random_uuid(),
  order_ref        text        not null unique
                               default 'ORD-' || to_char(now(), 'YYYY') || '-'
                                         || lpad(nextval('public.order_number_seq')::text, 4, '0'),
  tenant_id        uuid        not null references public.tenants(id) on delete cascade,

  -- n8n / WhatsApp fields
  session_id       text,
  phone            text,
  channel          text        not null default 'whatsapp',
  language         text,
  currency         text        not null default 'LKR',

  -- Customer
  customer_name    text        not null,
  customer_phone   text,
  delivery_address text,
  contact_number   text,

  -- Legacy / future dashboard-only fields (nullable for bot-created orders)
  customer_id      uuid,
  delivery_zone    text,
  estimated_days   text,
  chat_session_id  text,
  payment_slip_url text,

  -- Order details
  items            jsonb       not null default '[]',
  payment_method   text        not null,
  status           text        not null default 'pending',
  subtotal         numeric(12,2) not null default 0,
  delivery_fee     numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists orders_tenant_created_idx on public.orders (tenant_id, created_at desc);
create index if not exists orders_tenant_status_idx  on public.orders (tenant_id, status);

alter table public.orders enable row level security;

-- Dashboard reads: authenticated staff see only their own tenant's rows.
-- Matches the pattern used by other tables (tenant_users joined on clerk_user_id).
-- The API write path uses the service role and bypasses RLS entirely.
create policy "tenant staff can view own orders"
  on public.orders for select
  using (
    tenant_id in (
      select t.id
      from   public.tenants      t
      join   public.tenant_users tu on tu.tenant_id = t.id
      where  tu.clerk_user_id = auth.uid()::text
    )
  );

-- Allow service-role updates (status changes via server actions use service role).
create policy "service role full access"
  on public.orders for all
  using (true)
  with check (true);
