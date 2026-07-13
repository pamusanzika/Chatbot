import type { Order } from '@/types'

const N8N_ORDER_STATUS_WEBHOOK_URL = process.env.N8N_ORDER_STATUS_WEBHOOK_URL
const N8N_AGENT_REPLY_WEBHOOK_URL = process.env.N8N_AGENT_REPLY_WEBHOOK_URL

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

/**
 * Proxies an agent's Support-tab reply to the n8n agent-reply workflow, which
 * sends the WhatsApp message AND saves it to chat_messages. The dashboard
 * never sends WhatsApp or writes the message itself — this keeps the
 * workflow as the single writer and avoids double-saving the reply.
 */
export async function sendAgentReply(input: {
  tenantId: string
  phone: string
  message: string
  agentName: string
}): Promise<{ ok: true; sent: boolean }> {
  if (!N8N_AGENT_REPLY_WEBHOOK_URL) {
    throw new Error('N8N_AGENT_REPLY_WEBHOOK_URL is not configured')
  }

  const res = await fetch(N8N_AGENT_REPLY_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      phone: input.phone,
      message: input.message,
      agent_name: input.agentName,
    }),
  })

  if (!res.ok) {
    throw new Error(`n8n agent-reply webhook responded ${res.status}`)
  }

  const data = await res.json().catch(() => ({}))
  return { ok: true, sent: data.sent ?? true }
}
