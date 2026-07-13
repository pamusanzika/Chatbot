import { createServiceClient } from '@/lib/supabase-server'
import { setControlByPhone } from '@/lib/db/chat-sessions'
import type { Complaint, ComplaintStatus, ComplaintNote } from '@/types'

export interface ComplaintFilters {
  status?: 'open' | 'resolved' | 'all'
}

export async function getComplaints(tenantId: string, filters: ComplaintFilters = {}): Promise<Complaint[]> {
  const supabase = await createServiceClient()
  let query = supabase.from('complaints').select('*').eq('tenant_id', tenantId)

  if (filters.status === 'open') query = query.neq('status', 'resolved')
  else if (filters.status === 'resolved') query = query.eq('status', 'resolved')

  // Queue semantics: oldest waiting ticket first.
  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getComplaintById(tenantId: string, id: string): Promise<Complaint | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export interface CreateComplaintTicketInput {
  phone: string
  customer_name?: string | null
  customer_id?: string | null
  summary: string
  reason?: string
  language?: string
}

/**
 * Called by the n8n escalation workflow (via the create_ticket action on
 * /api/v1/n8n/webhook) when a customer explicitly asks for a human. Creates
 * the ticket and hands conversation control to a human in the same call —
 * the workflow still sends the WhatsApp holding message itself.
 *
 * Idempotent: if the phone already has an open (unresolved) ticket — e.g. the
 * customer sends another message while still waiting on the first escalation
 * — reuse it instead of creating a duplicate, but still (re-)flip control to
 * human so a stuck/expired handoff gets re-armed.
 */
export async function createComplaintTicket(
  tenantId: string,
  input: CreateComplaintTicketInput
): Promise<Complaint> {
  const supabase = await createServiceClient()

  const { data: existing, error: existingErr } = await supabase
    .from('complaints')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone', input.phone)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingErr) throw existingErr

  if (existing) {
    // Control flip must succeed for the escalation to be considered
    // complete — let it throw rather than reporting success while the bot
    // stays live.
    await setControlByPhone(tenantId, input.phone, 'human', input.reason ?? existing.reason ?? 'complaint')
    return existing as Complaint
  }

  const complaintRef = `CMP-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from('complaints')
    .insert({
      tenant_id: tenantId,
      complaint_ref: complaintRef,
      customer_id: input.customer_id ?? null,
      customer_name: input.customer_name || input.phone,
      phone: input.phone,
      reason: input.reason ?? 'complaint',
      summary: input.summary,
      status: 'open',
      language: input.language ?? 'EN',
    })
    .select()
    .single()
  if (error) throw error

  await setControlByPhone(tenantId, input.phone, 'human', input.reason ?? 'complaint')

  return data as Complaint
}

export async function claimComplaintTicket(tenantId: string, id: string, assignedTo: string): Promise<Complaint> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('complaints')
    .update({ assigned_to: assignedTo })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Complaint
}

/**
 * The only path that un-pauses the bot: marks the ticket resolved and flips
 * conversation control back to bot for the customer's phone.
 */
export async function resolveComplaintTicket(tenantId: string, id: string, resolvedBy: string): Promise<Complaint> {
  const supabase = await createServiceClient()

  const ticket = await getComplaintById(tenantId, id)
  if (!ticket) throw new Error('Ticket not found')

  const { data, error } = await supabase
    .from('complaints')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (ticket.phone) {
    await setControlByPhone(tenantId, ticket.phone, 'bot')
  }

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor: resolvedBy,
    action: 'ticket_resolved',
    entity_type: 'complaint',
    entity_id: id,
    meta: { phone: ticket.phone, complaint_ref: ticket.complaint_ref },
  })

  return data as Complaint
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
