import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { flagChatSession } from '@/lib/db/chat-sessions'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { tenantId } = await getTenant()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { flagged, flag_note } = body as Record<string, unknown>
    if (typeof flagged !== 'boolean') {
      return NextResponse.json({ error: 'flagged (boolean) is required' }, { status: 400 })
    }

    await flagChatSession(tenantId, params.sessionId, flagged, typeof flag_note === 'string' ? flag_note : '')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update flag' }, { status })
  }
}
