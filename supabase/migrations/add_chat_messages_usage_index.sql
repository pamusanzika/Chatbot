-- Usage tab (dashboard): aggregates chat_messages.tokens_used by tenant and
-- date range. Add a covering index for those scans.
create index if not exists chat_messages_tenant_created_at on chat_messages(tenant_id, created_at);
