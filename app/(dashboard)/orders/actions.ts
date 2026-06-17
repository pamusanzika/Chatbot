'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import { updateOrderStatus } from '@/lib/db/orders'
import type { OrderStatus } from '@/types'

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const { tenantId } = await getTenant()
  await updateOrderStatus(tenantId, orderId, status)
  revalidatePath('/orders')
}
