import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getChatSessions } from '@/lib/db/chat-sessions'

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenant()

    const params = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
    const language = params.get('language') ?? undefined
    const flaggedParam = params.get('flagged')
    const flagged = flaggedParam === 'true' ? true : flaggedParam === 'false' ? false : undefined
    const search = params.get('search') ?? undefined
    const intent = params.get('intent') ?? undefined

    const result = await getChatSessions(tenantId, { language, flagged, search, intent }, page)
    return NextResponse.json({ ...result, page })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch sessions' }, { status })
  }
}
