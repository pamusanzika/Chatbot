import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getComplaints } from '@/lib/db/complaints'

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenant()

    const status = req.nextUrl.searchParams.get('status') as 'open' | 'resolved' | 'all' | null
    const complaints = await getComplaints(tenantId, { status: status ?? 'open' })
    return NextResponse.json({ complaints })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch tickets' }, { status })
  }
}
