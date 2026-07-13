import { createServiceClient } from '@/lib/supabase-server'

// Day/month buckets use UTC calendar boundaries, matching lib/db/analytics.ts.

export interface UsageSummary {
  today: number
  this_month: number
  all_time: number
  messages_today: number
}

export interface UsageDailyPoint {
  date: string
  tokens: number
  messages: number
}

export interface UsageMonthlyPoint {
  month: string
  tokens: number
  messages: number
}

function utcDayStartIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
}

function utcMonthStartIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

function sumTokens(rows: { tokens_used: number | null }[] | null): number {
  return (rows ?? []).reduce((acc, r) => acc + (r.tokens_used ?? 0), 0)
}

export async function getUsageSummary(tenantId: string): Promise<UsageSummary> {
  const supabase = await createServiceClient()
  const now = new Date()
  const todayStart = utcDayStartIso(now)
  const monthStart = utcMonthStartIso(now)

  const [{ data: todayRows, error: todayErr }, { data: monthRows, error: monthErr }, { data: allRows, error: allErr }] =
    await Promise.all([
      supabase.from('chat_messages').select('tokens_used').eq('tenant_id', tenantId).gte('created_at', todayStart),
      supabase.from('chat_messages').select('tokens_used').eq('tenant_id', tenantId).gte('created_at', monthStart),
      supabase.from('chat_messages').select('tokens_used').eq('tenant_id', tenantId),
    ])
  if (todayErr) throw todayErr
  if (monthErr) throw monthErr
  if (allErr) throw allErr

  return {
    today: sumTokens(todayRows),
    this_month: sumTokens(monthRows),
    all_time: sumTokens(allRows),
    messages_today: todayRows?.length ?? 0,
  }
}

export async function getDailyUsage(tenantId: string, days: number): Promise<UsageDailyPoint[]> {
  const supabase = await createServiceClient()
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)

  const { data, error } = await supabase
    .from('chat_messages')
    .select('tokens_used, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
  if (error) throw error

  const byDay = new Map<string, { tokens: number; messages: number }>()
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    byDay.set(d.toISOString().slice(0, 10), { tokens: 0, messages: 0 })
  }

  for (const row of data ?? []) {
    const key = (row.created_at as string).slice(0, 10)
    const bucket = byDay.get(key)
    if (!bucket) continue
    bucket.tokens += row.tokens_used ?? 0
    bucket.messages += 1
  }

  return Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v }))
}

export async function getMonthlyUsage(tenantId: string, months: number): Promise<UsageMonthlyPoint[]> {
  const supabase = await createServiceClient()
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1))

  const { data, error } = await supabase
    .from('chat_messages')
    .select('tokens_used, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
  if (error) throw error

  const byMonth = new Map<string, { tokens: number; messages: number }>()
  for (let d = new Date(start); d < end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    byMonth.set(d.toISOString().slice(0, 7), { tokens: 0, messages: 0 })
  }

  for (const row of data ?? []) {
    const key = (row.created_at as string).slice(0, 7)
    const bucket = byMonth.get(key)
    if (!bucket) continue
    bucket.tokens += row.tokens_used ?? 0
    bucket.messages += 1
  }

  return Array.from(byMonth.entries()).map(([month, v]) => ({ month, ...v }))
}
