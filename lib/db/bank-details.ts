import { createServiceClient } from '@/lib/supabase-server'
import type { BankDetail, BankDetailAuditLog } from '@/types'

export async function getBankDetails(tenantId: string, activeOnly = false): Promise<BankDetail[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('bank_details')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getBankDetail(tenantId: string, id: string): Promise<BankDetail | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('bank_details')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createBankDetail(
  tenantId: string,
  detail: Omit<BankDetail, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>,
  performedBy: string
): Promise<BankDetail> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('bank_details')
    .insert({ ...detail, tenant_id: tenantId })
    .select()
    .single()
  if (error) throw error

  await logAudit(supabase, tenantId, data.id, 'create', detail, performedBy)
  return data
}

export async function updateBankDetail(
  tenantId: string,
  id: string,
  changes: Partial<Omit<BankDetail, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>,
  performedBy: string
): Promise<BankDetail> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('bank_details')
    .update(changes)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  await logAudit(supabase, tenantId, id, 'update', changes, performedBy)
  return data
}

export async function deleteBankDetail(
  tenantId: string,
  id: string,
  performedBy: string
): Promise<void> {
  const supabase = await createServiceClient()

  const { data: existing } = await supabase
    .from('bank_details')
    .select('bank_name, account_number')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('bank_details')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error

  await logAudit(supabase, tenantId, id, 'delete', existing ?? {}, performedBy)
}

export async function getAuditLogs(tenantId: string, bankDetailId?: string): Promise<BankDetailAuditLog[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('bank_detail_audit_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (bankDetailId) query = query.eq('bank_detail_id', bankDetailId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function logAudit(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  bankDetailId: string,
  action: 'create' | 'update' | 'delete',
  changes: Record<string, unknown>,
  performedBy: string
) {
  await supabase.from('bank_detail_audit_logs').insert({
    tenant_id: tenantId,
    bank_detail_id: bankDetailId,
    action,
    changes,
    performed_by: performedBy,
  })
}
