import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getMonthlyUsage } from '@/lib/db/token-usage'

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenant()
    const monthsParam = Number(req.nextUrl.searchParams.get('months') ?? '12')
    const months = Number.isFinite(monthsParam) ? Math.min(24, Math.max(1, Math.trunc(monthsParam))) : 12

    const series = await getMonthlyUsage(tenantId, months)
    return NextResponse.json({ series })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch monthly usage' }, { status })
  }
}
