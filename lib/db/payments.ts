import { createServiceClient } from '@/lib/supabase-server'
import type { Order, PaymentProof, AuditLog, OrderStatus } from '@/types'

export interface PaymentOrderRow extends Order {
  payment_proof: PaymentProof | null
}

export async function getPaymentOrders(
  tenantId: string,
  status?: string
): Promise<PaymentOrderRow[]> {
  const supabase = await createServiceClient()

  let query = supabase
    .from('orders')
    .select('*, payment_proof:payment_proofs(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  } else {
    query = query.in('status', ['awaiting_payment', 'pending_verification', 'confirmed', 'cancelled'])
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row: Record<string, unknown>) => {
    const proofs = row.payment_proof as PaymentProof[] | PaymentProof | null
    const proof = Array.isArray(proofs) ? proofs[0] ?? null : proofs
    return { ...row, payment_proof: proof } as PaymentOrderRow
  })
}

export async function getPaymentOrder(
  tenantId: string,
  orderId: string
): Promise<PaymentOrderRow | null> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('orders')
    .select('*, payment_proof:payment_proofs(*)')
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
    .single()

  if (error) return null

  const proofs = data.payment_proof as PaymentProof[] | PaymentProof | null
  const proof = Array.isArray(proofs) ? proofs[0] ?? null : proofs
  return { ...data, payment_proof: proof } as PaymentOrderRow
}

export async function getSignedProofUrl(storagePath: string): Promise<string | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(storagePath, 300)

  if (error) return null
  return data.signedUrl
}

export async function getAuditLogs(
  tenantId: string,
  entityType: string,
  entityId: string
): Promise<AuditLog[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createAuditLog(
  tenantId: string,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  meta: Record<string, unknown> = {}
) {
  const supabase = await createServiceClient()
  const { error } = await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor,
    action,
    entity_type: entityType,
    entity_id: entityId,
    meta,
  })
  if (error) throw error
}

export async function decidePayment(
  tenantId: string,
  orderId: string,
  decision: 'approve' | 'reject',
  actor: string,
  reason?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const supabase = await createServiceClient()

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) {
    return { status: 404, body: { error: 'Order not found' } }
  }

  if (order.status === 'confirmed' || order.status === 'cancelled') {
    return { status: 409, body: { error: 'Decision already made', current_status: order.status } }
  }

  const newStatus: OrderStatus = decision === 'approve' ? 'confirmed' : 'cancelled'

  const { error: updateErr } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('tenant_id', tenantId)
    .eq('id', orderId)

  if (updateErr) throw updateErr

  await createAuditLog(tenantId, actor, `payment_${decision}d`, 'order', orderId, {
    decision,
    reason: reason ?? null,
    previous_status: order.status,
    new_status: newStatus,
  })

  return { status: 200, body: { status: newStatus } }
}
