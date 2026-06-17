import { createServiceClient } from '@/lib/supabase-server'
import type { Usage } from '@/types'

export async function getCurrentUsage(tenantId: string): Promise<Usage | null> {
  const supabase = await createServiceClient()
  const month = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const { data, error } = await supabase
    .from('usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('month', month)
    .single()
  if (error) return null
  return data
}

export async function incrementTokenUsage(tenantId: string, tokens: number): Promise<void> {
  const supabase = await createServiceClient()
  const month = new Date().toISOString().slice(0, 7)
  // Upsert row then increment
  await supabase.from('usage').upsert(
    { tenant_id: tenantId, month, tokens_used: tokens },
    { onConflict: 'tenant_id,month', ignoreDuplicates: false }
  )
}
