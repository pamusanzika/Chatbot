'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import { decidePayment } from '@/lib/db/payments'
import { getOrder } from '@/lib/db/orders'
import { notifyOrderStatusChange } from '@/lib/n8n-webhook'

export async function decidePaymentAction(
  orderId: string,
  decision: 'approve' | 'reject',
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const { tenantId, tenantUser } = await getTenant()

  if (tenantUser.role !== 'Owner' && tenantUser.role !== 'Admin') {
    return { ok: false, error: 'Insufficient permissions' }
  }

  const result = await decidePayment(tenantId, orderId, decision, tenantUser.clerk_user_id, reason)

  if (result.status === 409) {
    revalidatePath('/payments')
    return { ok: false, error: 'Decision already made on this order' }
  }

  if (result.status !== 200) {
    return { ok: false, error: (result.body.error as string) ?? 'Unknown error' }
  }

  const updatedOrder = await getOrder(tenantId, orderId)
  if (updatedOrder) {
    notifyOrderStatusChange(updatedOrder, 'pending_verification')
  }

  revalidatePath('/payments')
  revalidatePath('/orders')
  return { ok: true }
}
