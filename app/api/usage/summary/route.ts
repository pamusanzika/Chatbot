import { NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getUsageSummary } from '@/lib/db/token-usage'

export async function GET() {
  try {
    const { tenantId } = await getTenant()
    const data = await getUsageSummary(tenantId)
    return NextResponse.json(data)
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch usage summary' }, { status })
  }
}
