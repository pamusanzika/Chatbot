-- GET/PATCH /api/v1/orders/current run on every inbound chat message —
-- index the exact (tenant_id, phone, created_at desc) access pattern so the
-- "most recent order for this customer" lookup stays index-only.
create index if not exists orders_tenant_phone_created_idx
  on public.orders (tenant_id, phone, created_at desc);
