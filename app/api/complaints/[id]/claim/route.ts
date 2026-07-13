import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { claimComplaintTicket } from '@/lib/db/complaints'

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, tenantUser } = await getTenant()
    const { id } = await params

    const ticket = await claimComplaintTicket(tenantId, id, initials(tenantUser.name))
    return NextResponse.json({ ticket })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to claim ticket' }, { status })
  }
}
