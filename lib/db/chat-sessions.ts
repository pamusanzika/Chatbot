import { createServiceClient } from '@/lib/supabase-server'
import type { ChatSession, ChatMessage, ChatStats, Lang } from '@/types'

export interface ChatSessionFilters {
  language?: string
  flagged?: boolean
  search?: string
}

const SESSION_FIELDS =
  'id, session_id, phone, channel, language, intent, flagged, flag_note, message_count, last_message_at, created_at'

const MESSAGE_FIELDS = 'id, role, content, language, intent, tokens_used, created_at'

export async function getChatSessions(
  tenantId: string,
  filters: ChatSessionFilters = {},
  page = 1
): Promise<{ sessions: ChatSession[]; total: number; totalPages: number }> {
  const supabase = await createServiceClient()
  const PAGE_SIZE = 20
  const offset = (page - 1) * PAGE_SIZE

  function baseQuery() {
    let q = supabase.from('chat_sessions').select(SESSION_FIELDS).eq('tenant_id', tenantId)
    if (filters.language) q = q.eq('language', filters.language)
    if (filters.flagged !== undefined) q = q.eq('flagged', filters.flagged)
    if (filters.search) q = q.ilike('phone', `%${filters.search}%`)
    return q
  }

  function countQuery() {
    let q = supabase.from('chat_sessions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    if (filters.language) q = q.eq('language', filters.language)
    if (filters.flagged !== undefined) q = q.eq('flagged', filters.flagged)
    if (filters.search) q = q.ilike('phone', `%${filters.search}%`)
    return q
  }

  const [{ data, error }, { count, error: countErr }] = await Promise.all([
    baseQuery().order('last_message_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
    countQuery(),
  ])

  if (error) throw error
  if (countErr) throw countErr

  const total = count ?? 0
  return {
    sessions: (data ?? []) as unknown as ChatSession[],
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  }
}

export async function deleteChatSession(tenantId: string, sessionId: string): Promise<void> {
  const supabase = await createServiceClient()
  // Delete messages first (FK constraint), then the session
  const { error: msgErr } = await supabase
    .from('chat_messages')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
  if (msgErr) throw msgErr
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
  if (error) throw error
}

export async function getChatMessages(tenantId: string, sessionId: string): Promise<ChatMessage[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_FIELDS)
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ChatMessage[]
}

export async function getRecentMessagesByPhone(
  tenantId: string,
  phone: string,
  limit = 10
): Promise<ChatMessage[]> {
  const supabase = await createServiceClient()

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('session_id')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) return []

  const messages = await getChatMessages(tenantId, session.session_id)
  return messages.slice(-limit).reverse()
}

export async function flagChatSession(
  tenantId: string,
  sessionId: string,
  flagged: boolean,
  note: string
): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('chat_sessions')
    .update({ flagged, flag_note: note })
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
  if (error) throw error
}

export async function getChatStats(tenantId: string): Promise<ChatStats> {
  const supabase = await createServiceClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { count: totalSessions },
    { count: totalMessages },
    { count: flaggedCount },
    { data: langRows },
  ] = await Promise.all([
    supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
    supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
    supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('flagged', true)
      .gte('created_at', monthStart),
    supabase
      .from('chat_sessions')
      .select('language')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
  ])

  const languageBreakdown: Record<string, number> = {}
  for (const row of langRows ?? []) {
    const lang = (row.language as string) ?? 'Unknown'
    languageBreakdown[lang] = (languageBreakdown[lang] ?? 0) + 1
  }

  return {
    totalSessions: totalSessions ?? 0,
    totalMessages: totalMessages ?? 0,
    flaggedCount: flaggedCount ?? 0,
    languageBreakdown,
  }
}

export async function upsertChatSession(
  tenantId: string,
  sessionId: string,
  phone: string,
  channel: string | null,
  language: string | null
): Promise<void> {
  const supabase = await createServiceClient()
  const now = new Date().toISOString()

  // Try to insert a new session; ignore if it already exists
  await supabase.from('chat_sessions').insert({
    tenant_id: tenantId,
    session_id: sessionId,
    phone,
    channel,
    language,
    last_message_at: now,
    message_count: 0,
  })

  // Read current count then increment — works whether the row was just created or already existed
  const { data: row } = await supabase
    .from('chat_sessions')
    .select('message_count')
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .single()

  const { error } = await supabase
    .from('chat_sessions')
    .update({
      last_message_at: now,
      language: language ?? undefined,
      message_count: ((row?.message_count as number) ?? 0) + 1,
    })
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)

  if (error) throw error
}

export async function insertChatMessage(
  tenantId: string,
  sessionId: string,
  role: string,
  content: string,
  language: string | null,
  intent: string | null,
  tokensUsed: number | null
): Promise<ChatMessage> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ tenant_id: tenantId, session_id: sessionId, role, content, language, intent, tokens_used: tokensUsed })
    .select(MESSAGE_FIELDS)
    .single()
  if (error) throw error
  return data as unknown as ChatMessage
}

export async function getSessionWithHistory(
  tenantId: string,
  sessionId: string
): Promise<{ session: ChatSession | null; history: Pick<ChatMessage, 'role' | 'content' | 'language' | 'created_at'>[] }> {
  const supabase = await createServiceClient()

  const [{ data: session }, { data: messages }] = await Promise.all([
    supabase
      .from('chat_sessions')
      .select(SESSION_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .maybeSingle(),
    supabase
      .from('chat_messages')
      .select('role, content, language, created_at')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20),
  ])

  return {
    session: session as unknown as ChatSession | null,
    history: (messages ?? []) as unknown as Pick<ChatMessage, 'role' | 'content' | 'language' | 'created_at'>[],
  }
}
