import type { Order } from '@/types'

const N8N_ORDER_STATUS_WEBHOOK_URL = process.env.N8N_ORDER_STATUS_WEBHOOK_URL

export async function notifyOrderStatusChange(order: Order, previousStatus: string) {
  if (!N8N_ORDER_STATUS_WEBHOOK_URL) return

  try {
    await fetch(N8N_ORDER_STATUS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'order.status_updated',
        order_id: order.id,
        order_ref: order.order_ref,
        tenant_id: order.tenant_id,
        previous_status: previousStatus,
        new_status: order.status,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone ?? order.phone,
        channel: order.channel,
        language: order.language,
        total: order.total,
        updated_at: new Date().toISOString(),
      }),
    })
  } catch (err) {
    console.error('[n8n webhook] Failed to notify order status change:', err)
  }
}
