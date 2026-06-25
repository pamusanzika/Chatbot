import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getPaymentOrder, getSignedProofUrl, getAuditLogs } from '@/lib/db/payments'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const { tenantId } = await getTenant()

  const order = await getPaymentOrder(tenantId, orderId)
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let signedProofUrl: string | null = null
  if (order.payment_proof?.storage_path) {
    signedProofUrl = await getSignedProofUrl(order.payment_proof.storage_path)
  }

  const auditLogs = await getAuditLogs(tenantId, 'order', orderId)

  return NextResponse.json({
    ...order,
    signed_proof_url: signedProofUrl,
    audit_logs: auditLogs,
  })
}
