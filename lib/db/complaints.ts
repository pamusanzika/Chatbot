import { createServiceClient } from '@/lib/supabase-server'
import type { Complaint, ComplaintStatus, ComplaintNote } from '@/types'

export async function getComplaints(tenantId: string): Promise<Complaint[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateComplaintStatus(
  tenantId: string,
  id: string,
  status: ComplaintStatus
): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function addComplaintNote(
  tenantId: string,
  id: string,
  note: ComplaintNote
): Promise<void> {
  const supabase = await createServiceClient()
  // Append to jsonb array
  const { error } = await supabase.rpc('append_complaint_note', {
    p_tenant_id: tenantId,
    p_id: id,
    p_note: note,
  })
  if (error) throw error
}
