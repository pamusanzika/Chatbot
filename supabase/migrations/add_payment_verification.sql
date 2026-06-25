-- Payment verification: extend orders status, add payment_proofs + audit_logs

-- 1. Extend orders.status enum
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','awaiting_payment','pending_verification','confirmed','preparing','processing','shipped','delivered','cancelled'));

-- 2. Payment proofs
CREATE TABLE IF NOT EXISTS payment_proofs (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storage_path      text NOT NULL,
  mime_type         text NOT NULL,
  file_name         text NOT NULL,
  customer_reference text,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_proofs_all" ON payment_proofs
  FOR ALL USING (tenant_id = (
    SELECT t.id FROM tenants t
    JOIN tenant_users tu ON tu.tenant_id = t.id
    WHERE tu.clerk_user_id = auth.uid()::text
    LIMIT 1
  ));

-- 3. Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor       text NOT NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_all" ON audit_logs
  FOR ALL USING (tenant_id = (
    SELECT t.id FROM tenants t
    JOIN tenant_users tu ON tu.tenant_id = t.id
    WHERE tu.clerk_user_id = auth.uid()::text
    LIMIT 1
  ));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS payment_proofs_order ON payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS payment_proofs_tenant ON payment_proofs(tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);

-- 5. Storage bucket (run via Supabase dashboard or CLI — SQL reference only)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
-- ON CONFLICT DO NOTHING;
