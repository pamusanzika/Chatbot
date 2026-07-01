import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getOverviewData, resolveRange, type OverviewRange } from '@/lib/db/overview'

export async function GET(req: NextRequest) {
  const { tenant, tenantId } = await getTenant()
  const range = (req.nextUrl.searchParams.get('range') ?? 'this_month') as OverviewRange
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined

  const data = await getOverviewData(tenantId, tenant.currency, resolveRange(range, from, to))
  return NextResponse.json(data)
}
