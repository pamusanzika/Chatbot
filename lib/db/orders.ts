import { createServiceClient } from '@/lib/supabase-server'
import type { Order, OrderItem, OrderSnapshot, OrderStatus } from '@/types'

// Statuses the customer may still amend via chat — the team hasn't acted on
// the order yet. Everything else (confirmed/preparing/shipped/delivered/cancelled)
// is dashboard-owned or terminal and rejected by the /orders/current PATCH guard.
export const EDITABLE_ORDER_STATUSES: OrderStatus[] = ['pending', 'awaiting_payment', 'pending_verification']

// Excluded when picking the customer's "current" order — these are done, so a
// newer non-terminal order (if any) is more relevant to surface to the bot.
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['cancelled', 'delivered']

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'pending', 'awaiting_payment', 'pending_verification', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled',
]

export const NON_TERMINAL_ORDER_STATUSES: OrderStatus[] = ALL_ORDER_STATUSES.filter(
  (s) => !TERMINAL_ORDER_STATUSES.includes(s)
)

// Columns needed to build an OrderSnapshot — used by /orders/current (GET/PATCH)
// and POST /orders so n8n always gets the full ground-truth order back.
export const ORDER_SNAPSHOT_COLUMNS =
  'order_ref, status, currency, items, subtotal, delivery_fee, total, customer_name, delivery_address, contact_number, payment_method, created_at, updated_at, status_changed_at'

interface OrderSnapshotRow {
  order_ref: string
  status: OrderStatus
  currency: string
  items: OrderItem[] | null
  subtotal: number | string
  delivery_fee: number | string
  total: number | string
  customer_name: string
  delivery_address: string | null
  contact_number: string | null
  payment_method: string
  created_at: string
  updated_at: string
  status_changed_at: string | null
}

/** Coerces a raw orders row into the JSON shape n8n injects verbatim into the model prompt. */
export function toOrderSnapshot(row: OrderSnapshotRow): OrderSnapshot {
  return {
    order_ref: row.order_ref,
    status: row.status,
    currency: row.currency,
    items: (row.items ?? []).map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
    subtotal: Number(row.subtotal),
    delivery_fee: Number(row.delivery_fee),
    total: Number(row.total),
    customer_name: row.customer_name,
    delivery_address: row.delivery_address,
    contact_number: row.contact_number,
    payment_method: row.payment_method,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status_changed_at: row.status_changed_at,
  }
}

export interface CreateOrderInput {
  session_id?: string
  phone?: string
  channel?: string
  language?: string | null
  currency?: string
  customer_name: string
  customer_phone?: string
  delivery_address?: string
  contact_number?: string
  items: OrderItem[]
  payment_method: string
  subtotal: number
  delivery_fee: number
  total: number
}

export async function createOrder(tenantId: string, input: CreateOrderInput): Promise<Order> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      session_id: input.session_id ?? null,
      phone: input.phone ?? null,
      channel: input.channel ?? 'whatsapp',
      language: input.language ?? null,
      currency: input.currency ?? 'LKR',
      customer_name: input.customer_name,
      customer_phone: input.customer_phone ?? input.phone ?? null,
      delivery_address: input.delivery_address ?? null,
      contact_number: input.contact_number ?? null,
      items: input.items,
      payment_method: input.payment_method,
      status: 'pending',
      status_changed_at: new Date().toISOString(),
      subtotal: input.subtotal,
      delivery_fee: input.delivery_fee,
      total: input.total,
    })
    .select()
    .single()
  if (error) throw error
  return data as Order
}

export async function getOrders(
  tenantId: string,
  opts: { status?: OrderStatus; search?: string; limit?: number } = {}
): Promise<Order[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)

  if (opts.status) query = query.eq('status', opts.status)
  if (opts.search) {
    query = query.or(
      `customer_name.ilike.%${opts.search}%,order_ref.ilike.%${opts.search}%,customer_phone.ilike.%${opts.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getOrder(tenantId: string, orderId: string): Promise<Order | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
    .single()
  if (error) return null
  return data
}

export async function getOrdersByCustomerPhone(tenantId: string, phone: string): Promise<Order[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`customer_phone.eq.${phone},phone.eq.${phone}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  status: OrderStatus
): Promise<Order> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
    .select()
    .single()
  if (error) throw error
  return data as Order
}

export async function deleteOrders(tenantId: string, orderIds: string[]): Promise<number> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .delete()
    .eq('tenant_id', tenantId)
    .in('id', orderIds)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

export async function getOrderStats(tenantId: string) {
  const supabase = await createServiceClient()
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data, error } = await supabase
    .from('orders')
    .select('status, total, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', firstOfMonth)

  if (error) throw error

  const orders = data ?? []
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((s: number, o: { total: unknown; status: string }) => s + Number(o.total), 0)
  const pending = orders.filter((o: { status: string }) => o.status === 'pending').length

  return { totalOrders, totalRevenue, pending }
}
