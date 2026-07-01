import { createServiceClient } from '@/lib/supabase-server'
import type { Usage, Lang, ChatIntent } from '@/types'

export type AnalyticsRange = 'this_month' | 'last_month' | 'custom'

interface DateRange {
  start: string
  end: string
}

function monthRange(offset: number): DateRange {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function resolveRange(range: AnalyticsRange, from?: string, to?: string): DateRange {
  if (range === 'last_month') return monthRange(-1)
  if (range === 'custom' && from && to) {
    const start = new Date(from)
    const end = new Date(to)
    end.setDate(end.getDate() + 1) // make `to` inclusive
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start < end) {
      return { start: start.toISOString(), end: end.toISOString() }
    }
  }
  return monthRange(0)
}

const INTENT_COLORS: Record<string, string> = {
  Order: '#7c6dfa',
  Delivery: '#2dd4a0',
  Stock: '#f5a623',
  Complaint: '#ef4444',
  Handoff: '#3b82f6',
  Other: '#9ca3af',
}

function dayKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

function dayLabel(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' })
}

function dayList(range: DateRange): string[] {
  const start = new Date(range.start)
  const end = new Date(range.end)
  const days: string[] = []
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    days.push(dayKey(d.toISOString()))
  }
  return days
}

export interface AnalyticsData {
  msgVolume: { d: string; EN: number; SI: number; TA: number; SL: number }[]
  intentBreakdown: { key: ChatIntent; pct: number; color: string }[]
  conversionData: { d: string; rate: number }[]
  topQuestions: { q: string; n: number }[]
  deliveryByZone: { p: string; n: number }[]
  stockMovement: { name: string; units: number; rev: number }[]
  usage: Usage | null
  totalMsgs: number
  avgConversion: number
  ordersViaBot: number
  activeCustomers: number
  currency: string
}

export async function getAnalyticsData(
  tenantId: string,
  currency: string,
  range: DateRange
): Promise<AnalyticsData> {
  const supabase = await createServiceClient()

  const [
    { data: messages },
    { data: sessions },
    { data: orders },
    { data: usageRow },
    { data: customersRows },
  ] = await Promise.all([
    supabase.from('chat_messages').select('language, from_role, text, timestamp').eq('tenant_id', tenantId)
      .gte('timestamp', range.start).lt('timestamp', range.end),
    supabase.from('chat_sessions').select('intent, started_at').eq('tenant_id', tenantId)
      .gte('started_at', range.start).lt('started_at', range.end),
    supabase.from('orders').select('status, total, items, delivery_zone, chat_session_id, created_at')
      .eq('tenant_id', tenantId).gte('created_at', range.start).lt('created_at', range.end),
    supabase.from('usage').select('*').eq('tenant_id', tenantId)
      .eq('month', new Date().toISOString().slice(0, 7)).maybeSingle(),
    supabase.from('customers').select('id').eq('tenant_id', tenantId)
      .gte('last_order_at', range.start).lt('last_order_at', range.end),
  ])

  const msgs = messages ?? []
  const sess = sessions ?? []
  const ords = orders ?? []

  // ── Message volume by language per day ──
  const days = dayList(range)
  const volumeByDay: Record<string, { EN: number; SI: number; TA: number; SL: number }> = {}
  for (const day of days) volumeByDay[day] = { EN: 0, SI: 0, TA: 0, SL: 0 }
  for (const m of msgs) {
    const key = dayKey(m.timestamp)
    if (!volumeByDay[key]) continue
    const lang = ((m.language as string) ?? 'EN') as Lang
    if (lang in volumeByDay[key]) volumeByDay[key][lang as 'EN' | 'SI' | 'TA' | 'SL']++
  }
  const msgVolume = days.map((day) => ({ d: dayLabel(day), ...volumeByDay[day] }))

  // ── Intent breakdown ──
  const intentCounts: Record<string, number> = {}
  for (const s of sess) {
    const intent = (s.intent as string) ?? 'Other'
    intentCounts[intent] = (intentCounts[intent] ?? 0) + 1
  }
  const totalIntents = Object.values(intentCounts).reduce((a, b) => a + b, 0)
  const intentBreakdown = Object.entries(intentCounts)
    .map(([key, n]) => ({
      key: key as ChatIntent,
      pct: totalIntents > 0 ? Math.round((n / totalIntents) * 100) : 0,
      color: INTENT_COLORS[key] ?? '#9ca3af',
    }))
    .sort((a, b) => b.pct - a.pct)

  // ── Conversion rate per day (orders / sessions) ──
  const sessionsByDay: Record<string, number> = {}
  for (const day of days) sessionsByDay[day] = 0
  for (const s of sess) {
    const key = dayKey(s.started_at)
    if (key in sessionsByDay) sessionsByDay[key]++
  }
  const ordersByDay: Record<string, number> = {}
  for (const day of days) ordersByDay[day] = 0
  for (const o of ords) {
    const key = dayKey(o.created_at)
    if (key in ordersByDay) ordersByDay[key]++
  }
  const conversionData = days.map((day) => {
    const s = sessionsByDay[day]
    const rate = s > 0 ? Math.round((ordersByDay[day] / s) * 1000) / 10 : 0
    return { d: dayLabel(day), rate }
  })
  const totalSessions = Object.values(sessionsByDay).reduce((a, b) => a + b, 0)
  const avgConversion = totalSessions > 0 ? Math.round((ords.length / totalSessions) * 1000) / 10 : 0

  // ── Top customer questions (most frequent user messages) ──
  const questionCounts = new Map<string, { display: string; n: number }>()
  for (const m of msgs) {
    if (m.from_role !== 'user') continue
    const norm = m.text.trim().toLowerCase()
    if (!norm) continue
    const entry = questionCounts.get(norm)
    if (entry) entry.n++
    else questionCounts.set(norm, { display: m.text.trim(), n: 1 })
  }
  const topQuestions = Array.from(questionCounts.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((e) => ({ q: e.display, n: e.n }))

  // ── Orders by delivery zone ──
  const zoneCounts: Record<string, number> = {}
  for (const o of ords) {
    const zone = (o.delivery_zone as string) ?? 'Unspecified'
    zoneCounts[zone] = (zoneCounts[zone] ?? 0) + 1
  }
  const deliveryByZone = Object.entries(zoneCounts)
    .map(([p, n]) => ({ p, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)

  // ── Stock movement (units sold + revenue per product from order items) ──
  const stockCounts = new Map<string, { units: number; rev: number }>()
  for (const o of ords) {
    const items = (o.items as { name: string; quantity: number; line_total: number }[]) ?? []
    for (const item of items) {
      const entry = stockCounts.get(item.name) ?? { units: 0, rev: 0 }
      entry.units += item.quantity ?? 0
      entry.rev += Number(item.line_total ?? 0)
      stockCounts.set(item.name, entry)
    }
  }
  const stockMovement = Array.from(stockCounts.entries())
    .map(([name, v]) => ({ name, units: v.units, rev: v.rev }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 6)

  const totalMsgs = msgs.length
  const ordersViaBot = ords.filter((o) => o.chat_session_id).length

  return {
    msgVolume,
    intentBreakdown,
    conversionData,
    topQuestions,
    deliveryByZone,
    stockMovement,
    usage: (usageRow as Usage) ?? null,
    totalMsgs,
    avgConversion,
    ordersViaBot,
    activeCustomers: customersRows?.length ?? 0,
    currency,
  }
}
