import { createServiceClient } from '@/lib/supabase-server'
import { getOrdersByCustomerPhone } from '@/lib/db/orders'
import type { Customer, Order } from '@/types'

export interface CustomerDetail {
  customer: Customer
  orders: Order[]
  paymentSummary: Record<string, number>
}

export async function getCustomers(tenantId: string, search?: string): Promise<Customer[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('total_spent', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCustomer(tenantId: string, id: string): Promise<Customer | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function upsertCustomerFromOrder(
  tenantId: string,
  phone: string,
  name: string,
  language?: string | null
): Promise<void> {
  const supabase = await createServiceClient()

  const orders = await getOrdersByCustomerPhone(tenantId, phone)
  const counted = orders.filter((o) => o.status !== 'cancelled')

  const total_orders = counted.length
  const total_spent = counted.reduce((sum, o) => sum + Number(o.total), 0)
  const last_order_at = orders.length > 0 ? orders[0].created_at : null

  const { error } = await supabase
    .from('customers')
    .upsert(
      {
        tenant_id: tenantId,
        phone,
        name,
        language: language ?? 'EN',
        total_orders,
        total_spent,
        last_order_at,
      },
      { onConflict: 'tenant_id,phone' }
    )
  if (error) throw error
}

export async function getCustomerDetail(tenantId: string, id: string): Promise<CustomerDetail | null> {
  const customer = await getCustomer(tenantId, id)
  if (!customer) return null

  const orders = await getOrdersByCustomerPhone(tenantId, customer.phone)

  const paymentSummary: Record<string, number> = {}
  for (const o of orders) {
    paymentSummary[o.status] = (paymentSummary[o.status] ?? 0) + 1
  }

  return { customer, orders, paymentSummary }
}
