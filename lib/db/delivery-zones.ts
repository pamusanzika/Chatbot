import { createServiceClient } from '@/lib/supabase-server'
import type { DeliveryZone } from '@/types'

export async function getDeliveryZones(tenantId: string): Promise<DeliveryZone[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('province', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertDeliveryZone(
  tenantId: string,
  zone: Omit<DeliveryZone, 'id' | 'tenant_id'> & { id?: string }
): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('delivery_zones')
    .upsert({ ...zone, tenant_id: tenantId })
  if (error) throw error
}

export async function deleteZone(tenantId: string, id: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('delivery_zones')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function toggleZone(tenantId: string, id: string, isActive: boolean): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('delivery_zones')
    .update({ is_active: isActive })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function lookupZoneByCity(
  tenantId: string,
  city: string
): Promise<DeliveryZone | null> {
  const supabase = await createServiceClient()

  // 1. Try exact province zone match first
  const { data: provinceMatch } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('zone_type', 'province')
    .contains('cities', [city])
    .single()
  if (provinceMatch) return provinceMatch

  // 2. Fall back to flat rate (covers all Sri Lanka cities)
  const { data: flatRate } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('zone_type', 'flat_rate')
    .single()
  return flatRate ?? null
}
