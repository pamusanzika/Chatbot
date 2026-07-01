create index if not exists chat_messages_tenant_created_at
  on chat_messages(tenant_id, created_at desc);
