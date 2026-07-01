import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getAnalyticsData, resolveRange, type AnalyticsRange } from '@/lib/db/analytics'

export async function GET(req: NextRequest) {
  const { tenant, tenantId } = await getTenant()
  const range = (req.nextUrl.searchParams.get('range') ?? 'this_month') as AnalyticsRange
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined

  const data = await getAnalyticsData(tenantId, tenant.currency, resolveRange(range, from, to))
  return NextResponse.json(data)
}
