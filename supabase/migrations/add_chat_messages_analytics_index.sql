create index if not exists chat_messages_tenant_timestamp
  on chat_messages(tenant_id, "timestamp" desc);
