import { NextRequest, NextResponse } from 'next/server'
import { getSessionWithHistory } from '@/lib/db/chat-sessions'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

/**
 * GET /api/v1/chat/session?tenant_id=...&session_id=...
 * Returns the session record and last 20 messages. Used by n8n to restore
 * conversation context when a returning customer sends a new message.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const tenantId = params.get('tenant_id')
  const sessionId = params.get('session_id')

  if (!tenantId) return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  if (!sessionId) return NextResponse.json({ error: 'session_id is required' }, { status: 400 })

  try {
    const { session, history } = await getSessionWithHistory(tenantId, sessionId)
    return NextResponse.json({ session, history })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch session' }, { status: 500 })
  }
}
