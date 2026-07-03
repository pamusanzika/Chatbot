import { NextRequest, NextResponse } from 'next/server'
import { upsertChatSession, insertChatMessage } from '@/lib/db/chat-sessions'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

/**
 * POST /api/v1/chat/message
 * Upserts the chat session and appends a message. Called by n8n after every
 * WhatsApp message so the dashboard shows live conversation history.
 */
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, session_id, phone, role, content, language, intent, tokens_used, channel } =
    body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string')
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  if (!session_id || typeof session_id !== 'string')
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  if (!phone || typeof phone !== 'string')
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  if (!role || typeof role !== 'string')
    return NextResponse.json({ error: 'role is required' }, { status: 400 })
  if (!content || typeof content !== 'string')
    return NextResponse.json({ error: 'content is required' }, { status: 400 })

  try {
    await upsertChatSession(
      tenant_id,
      session_id,
      phone,
      typeof channel === 'string' ? channel : null,
      typeof language === 'string' ? language : null,
      typeof intent === 'string' ? intent : null
    )

    const message = await insertChatMessage(
      tenant_id,
      session_id,
      role,
      content,
      typeof language === 'string' ? language : null,
      typeof intent === 'string' ? intent : null,
      typeof tokens_used === 'number' ? tokens_used : null
    )

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save message' }, { status: 500 })
  }
}
