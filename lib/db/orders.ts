import { createServiceClient } from '@/lib/supabase-server'
import type { Order, OrderItem, OrderStatus } from '@/types'

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
    .update({ status })
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
