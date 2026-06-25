import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { decidePayment } from '@/lib/db/payments'
import { notifyOrderStatusChange } from '@/lib/n8n-webhook'
import { getOrder } from '@/lib/db/orders'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const { tenantId, tenantUser } = await getTenant()

  if (tenantUser.role !== 'Owner' && tenantUser.role !== 'Admin') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const { decision, reason } = body as { decision: 'approve' | 'reject'; reason?: string }

  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const result = await decidePayment(tenantId, orderId, decision, tenantUser.clerk_user_id, reason)

  if (result.status === 200) {
    const updatedOrder = await getOrder(tenantId, orderId)
    if (updatedOrder) {
      const previousStatus = decision === 'approve' ? 'pending_verification' : 'pending_verification'
      notifyOrderStatusChange(updatedOrder, previousStatus)
    }
  }

  return NextResponse.json(result.body, { status: result.status })
}
