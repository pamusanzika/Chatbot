-- Customer 360 view: support phone-based order/chat history lookups

create index if not exists orders_tenant_customer_phone
  on public.orders (tenant_id, customer_phone);

create index if not exists orders_tenant_phone
  on public.orders (tenant_id, phone);

create index if not exists chat_sessions_tenant_phone
  on public.chat_sessions (tenant_id, phone);
