import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { deleteChatSession } from '@/lib/db/chat-sessions'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { tenantId } = await getTenant()
    await deleteChatSession(tenantId, params.sessionId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete session' }, { status })
  }
}
