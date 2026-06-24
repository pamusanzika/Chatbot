'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import { getOrder, updateOrderStatus } from '@/lib/db/orders'
import { notifyOrderStatusChange } from '@/lib/n8n-webhook'
import type { OrderStatus } from '@/types'

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const { tenantId } = await getTenant()

  const existing = await getOrder(tenantId, orderId)
  const previousStatus = existing?.status ?? 'unknown'

  const order = await updateOrderStatus(tenantId, orderId, status)

  notifyOrderStatusChange(order, previousStatus)

  revalidatePath('/orders')
}
