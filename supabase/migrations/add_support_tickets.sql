-- Support tab: extend complaints into working "support tickets", and add
-- conversation control (bot/human handoff) to chat_sessions.
--
-- complaints is defined in schema.sql #11 but was never actually applied to
-- this project (the Complaints tab was UI-only, always empty) — create it
-- for real here, then add the ticket fields on top.
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

drop policy if exists "complaints_all" on complaints;
create policy "complaints_all" on complaints
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

create index if not exists complaints_tenant_status on complaints(tenant_id, status);

alter table complaints
  add column if not exists phone text,
  add column if not exists reason text not null default 'complaint',
  add column if not exists resolved_at timestamptz;

create index if not exists complaints_tenant_phone on complaints(tenant_id, phone);

-- chat_sessions has no persisted "who's driving this conversation" state today —
-- add it so the n8n pause-gate can skip the LLM while an agent is handling a ticket.
alter table chat_sessions
  add column if not exists control text not null default 'bot',
  add column if not exists handoff_reason text,
  add column if not exists handoff_at timestamptz;

alter table chat_sessions drop constraint if exists chat_sessions_control_check;
alter table chat_sessions add constraint chat_sessions_control_check
  check (control in ('bot', 'human'));

create index if not exists chat_sessions_tenant_phone_control on chat_sessions(tenant_id, phone, control);

-- lib/db/complaints.ts already calls this RPC to append a note to the jsonb
-- array, but it was never defined anywhere in the repo — add it now.
create or replace function append_complaint_note(p_tenant_id uuid, p_id uuid, p_note jsonb)
returns void language sql as $$
  update complaints
  set notes = notes || jsonb_build_array(p_note)
  where tenant_id = p_tenant_id and id = p_id;
$$;

-- audit_logs — resolveComplaintTicket() writes an audit row here on resolve.
-- Defined in add_payment_verification.sql; no-op if that already ran.
create table if not exists audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  actor       text not null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table audit_logs enable row level security;

drop policy if exists "audit_logs_all" on audit_logs;
create policy "audit_logs_all" on audit_logs
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

create index if not exists audit_logs_entity on audit_logs(entity_type, entity_id);
create index if not exists audit_logs_tenant on audit_logs(tenant_id, created_at desc);
