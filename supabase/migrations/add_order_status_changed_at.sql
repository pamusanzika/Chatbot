-- Tracks when `status` last changed, distinct from `updated_at` which also
-- moves on every chat-driven PATCH to /orders/current. n8n uses this to know
-- when to cut chat history and start a fresh conversation/order.
alter table public.orders add column if not exists status_changed_at timestamptz;

update public.orders set status_changed_at = updated_at where status_changed_at is null;
