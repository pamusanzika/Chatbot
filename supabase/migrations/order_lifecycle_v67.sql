-- v6.7 Order lifecycle: dedup guard, tracking columns, draft lookup index

-- (a) One editable draft per customer per tenant
create unique index if not exists orders_one_open_draft_per_customer
  on public.orders (tenant_id, phone)
  where status = 'pending';

-- (b) Tracking/fulfilment columns
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists estimated_delivery_date date;

-- (c) Open-draft lookup index
create index if not exists orders_open_draft_lookup
  on public.orders (tenant_id, phone) where status = 'pending';
