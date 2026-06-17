import { createServiceClient } from '@/lib/supabase-server'
import type { Customer } from '@/types'

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
