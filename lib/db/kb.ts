import { createServiceClient } from '@/lib/supabase-server'
import type { KbEntry, Lang } from '@/types'

export async function getKbEntries(tenantId: string, language?: Lang): Promise<KbEntry[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('kb_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (language) query = query.eq('language', language)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createKbEntry(
  tenantId: string,
  entry: Omit<KbEntry, 'id' | 'tenant_id' | 'created_at'>
): Promise<KbEntry> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('kb_entries')
    .insert({ ...entry, tenant_id: tenantId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateKbEntry(
  tenantId: string,
  id: string,
  changes: Partial<Omit<KbEntry, 'id' | 'tenant_id' | 'created_at'>>
): Promise<KbEntry> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('kb_entries')
    .update(changes)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteKbEntry(tenantId: string, id: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('kb_entries')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}
