import { NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getChatStats } from '@/lib/db/chat-sessions'

export async function GET() {
  try {
    const { tenantId } = await getTenant()
    const stats = await getChatStats(tenantId)
    return NextResponse.json(stats)
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch stats' }, { status })
  }
}
