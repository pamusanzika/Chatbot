import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getDailyUsage } from '@/lib/db/token-usage'

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenant()
    const daysParam = Number(req.nextUrl.searchParams.get('days') ?? '30')
    const days = Number.isFinite(daysParam) ? Math.min(90, Math.max(1, Math.trunc(daysParam))) : 30

    const series = await getDailyUsage(tenantId, days)
    return NextResponse.json({ series })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch daily usage' }, { status })
  }
}
