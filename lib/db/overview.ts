import { createServiceClient } from '@/lib/supabase-server'
import type { StatCard, ActivityEvent, Usage, Lang } from '@/types'
import { fmtCurrency, fmtNum } from '@/lib/constants'

export type OverviewRange = 'this_month' | 'last_month' | 'custom'

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

export function resolveRange(range: OverviewRange, from?: string, to?: string): DateRange {
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

function previousPeriod({ start, end }: DateRange): DateRange {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const durationMs = endMs - startMs
  return {
    start: new Date(startMs - durationMs).toISOString(),
    end: start,
  }
}

function trendOf(current: number, previous: number): { trend: number; up: boolean } {
  if (previous === 0) return { trend: current === 0 ? 0 : 100, up: current >= 0 }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { trend: Math.abs(pct), up: pct >= 0 }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export interface OverviewData {
  stats: StatCard[]
  activity: ActivityEvent[]
  langBreakdown: { key: Lang; pct: number; sessions: number }[]
  usage: Usage | null
  currency: string
}

export async function getOverviewData(
  tenantId: string,
  currency: string,
  range: DateRange
): Promise<OverviewData> {
  const supabase = await createServiceClient()
  const thisMonth = range
  const lastMonth = previousPeriod(range)

  const [
    { data: ordersThisMonth },
    { data: ordersLastMonth },
    { data: customersThisMonth },
    { data: customersLastMonth },
    { count: pendingVerifications },
    { data: recentOrders },
    { data: recentComplaints },
    { data: flaggedChats },
    { data: usageRow },
    { data: chatLangRows },
  ] = await Promise.all([
    supabase.from('orders').select('status, total').eq('tenant_id', tenantId)
      .gte('created_at', thisMonth.start).lt('created_at', thisMonth.end),
    supabase.from('orders').select('status, total').eq('tenant_id', tenantId)
      .gte('created_at', lastMonth.start).lt('created_at', lastMonth.end),
    supabase.from('customers').select('id').eq('tenant_id', tenantId)
      .gte('last_order_at', thisMonth.start).lt('last_order_at', thisMonth.end),
    supabase.from('customers').select('id').eq('tenant_id', tenantId)
      .gte('last_order_at', lastMonth.start).lt('last_order_at', lastMonth.end),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      .eq('status', 'pending_verification'),
    supabase.from('orders').select('order_ref, status, total, created_at').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('complaints').select('complaint_ref, customer_name, status, created_at').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('chat_sessions').select('phone, flag_note, last_message_at').eq('tenant_id', tenantId)
      .eq('flagged', true).order('last_message_at', { ascending: false }).limit(5),
    supabase.from('usage').select('*').eq('tenant_id', tenantId)
      .eq('month', new Date().toISOString().slice(0, 7)).maybeSingle(),
    supabase.from('chat_sessions').select('language').eq('tenant_id', tenantId)
      .gte('created_at', thisMonth.start).lt('created_at', thisMonth.end),
  ])

  const thisOrders = ordersThisMonth ?? []
  const lastOrders = ordersLastMonth ?? []
  const thisRevenue = thisOrders.reduce((s, o) => s + Number(o.total), 0)
  const lastRevenue = lastOrders.reduce((s, o) => s + Number(o.total), 0)
  const thisCustomers = customersThisMonth?.length ?? 0
  const lastCustomers = customersLastMonth?.length ?? 0

  const ordersTrend = trendOf(thisOrders.length, lastOrders.length)
  const revenueTrend = trendOf(thisRevenue, lastRevenue)
  const customersTrend = trendOf(thisCustomers, lastCustomers)

  const stats: StatCard[] = [
    {
      id: 'orders',
      label: 'Orders',
      value: fmtNum(thisOrders.length),
      icon: 'ShoppingBag',
      tone: 'purple',
      trend: ordersTrend.trend,
      up: ordersTrend.up,
      sub: 'vs previous period',
    },
    {
      id: 'revenue',
      label: 'Revenue',
      value: fmtCurrency(thisRevenue, currency),
      icon: 'Zap',
      tone: 'teal',
      trend: revenueTrend.trend,
      up: revenueTrend.up,
      sub: 'vs previous period',
    },
    {
      id: 'active-customers',
      label: 'Active customers',
      value: fmtNum(thisCustomers),
      icon: 'Users',
      tone: 'amber',
      trend: customersTrend.trend,
      up: customersTrend.up,
      sub: 'vs previous period',
    },
    {
      id: 'pending-verifications',
      label: 'Pending verifications',
      value: fmtNum(pendingVerifications ?? 0),
      icon: 'AlertCircle',
      tone: 'red',
      trend: 0,
      up: (pendingVerifications ?? 0) === 0,
      sub: 'awaiting review',
    },
  ]

  const merged: (ActivityEvent & { ts: string })[] = [
    ...(recentOrders ?? []).map((o) => ({
      type: 'order' as const,
      dot: '#7c6dfa',
      text: `Order ${o.order_ref} — ${o.status.replace('_', ' ')}`,
      time: timeAgo(o.created_at),
      ts: o.created_at,
    })),
    ...(recentComplaints ?? []).map((c) => ({
      type: 'complaint' as const,
      dot: '#ef4444',
      text: `Complaint ${c.complaint_ref} from ${c.customer_name} — ${c.status}`,
      time: timeAgo(c.created_at),
      ts: c.created_at,
    })),
    ...(flaggedChats ?? []).map((c) => ({
      type: 'handoff' as const,
      dot: '#f5a623',
      text: `Chat flagged for ${c.phone}${c.flag_note ? `: ${c.flag_note}` : ''}`,
      time: timeAgo(c.last_message_at),
      ts: c.last_message_at,
    })),
  ]

  const activity: ActivityEvent[] = merged
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 8)
    .map(({ ts: _ts, ...rest }) => rest)

  const langCounts: Record<string, number> = {}
  for (const row of chatLangRows ?? []) {
    const lang = (row.language as string) ?? 'EN'
    langCounts[lang] = (langCounts[lang] ?? 0) + 1
  }
  const totalLangSessions = Object.values(langCounts).reduce((s, n) => s + n, 0)
  const langBreakdown = Object.entries(langCounts)
    .map(([key, sessions]) => ({
      key: key as Lang,
      sessions,
      pct: totalLangSessions > 0 ? Math.round((sessions / totalLangSessions) * 100) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)

  return {
    stats,
    activity,
    langBreakdown,
    usage: (usageRow as Usage) ?? null,
    currency,
  }
}
