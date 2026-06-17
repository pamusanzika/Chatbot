import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getChatMessages } from '@/lib/db/chat-sessions'

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { tenantId } = await getTenant()
    const messages = await getChatMessages(tenantId, params.sessionId)
    return NextResponse.json({ messages, count: messages.length })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch messages' }, { status })
  }
}
