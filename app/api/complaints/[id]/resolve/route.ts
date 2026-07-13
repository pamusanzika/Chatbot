import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { resolveComplaintTicket } from '@/lib/db/complaints'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, tenantUser } = await getTenant()
    const { id } = await params

    const ticket = await resolveComplaintTicket(tenantId, id, tenantUser.name)
    return NextResponse.json({ ticket })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to resolve ticket' }, { status })
  }
}
