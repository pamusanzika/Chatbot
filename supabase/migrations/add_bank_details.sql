-- ──────────────────────────────────────────────────────────
-- HELPER FUNCTION (safe to re-run)
-- ──────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ──────────────────────────────────────────────────────────
-- BANK DETAILS
-- ──────────────────────────────────────────────────────────
create table if not exists bank_details (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  bank_name      text not null,
  account_name   text not null,
  account_number text not null,
  branch_name    text not null default '',
  branch_code    text not null default '',
  notes          text not null default '',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table bank_details enable row level security;

create policy "bank_details_all" on bank_details
  for all using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

create trigger bank_details_updated_at
  before update on bank_details
  for each row execute function update_updated_at();

create index if not exists bank_details_tenant_active on bank_details(tenant_id, is_active);

-- ──────────────────────────────────────────────────────────
-- BANK DETAIL AUDIT LOGS
-- ──────────────────────────────────────────────────────────
create table if not exists bank_detail_audit_logs (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  bank_detail_id  uuid references bank_details(id) on delete set null,
  action          text not null check (action in ('create','update','delete')),
  changes         jsonb not null default '{}'::jsonb,
  performed_by    text not null,
  created_at      timestamptz not null default now()
);

alter table bank_detail_audit_logs enable row level security;

create policy "bank_detail_audit_logs_select" on bank_detail_audit_logs
  for select using (tenant_id = (
    select t.id from tenants t
    join tenant_users tu on tu.tenant_id = t.id
    where tu.clerk_user_id = auth.uid()::text
    limit 1
  ));

-- Only service role can insert audit logs
create policy "bank_detail_audit_logs_insert" on bank_detail_audit_logs
  for insert with check (true);

create index if not exists bank_detail_audit_tenant on bank_detail_audit_logs(tenant_id, created_at desc);
