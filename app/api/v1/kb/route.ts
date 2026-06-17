import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getKbEntries, createKbEntry } from '@/lib/db/kb'
import type { Lang } from '@/types'

const VALID_LANGS: Lang[] = ['EN', 'SI', 'TA', 'SL']

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  const provided = req.headers.get('x-api-key')
  return provided === expected
}

/**
 * GET /api/v1/kb?tenant_id=...&language=EN
 * Returns all knowledge base entries for a tenant. Used by the n8n bot
 * workflow to load the FAQ/knowledge base it answers customer questions from.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })
  }

  const langParam = req.nextUrl.searchParams.get('language')?.toUpperCase()
  const language = VALID_LANGS.includes(langParam as Lang) ? (langParam as Lang) : undefined

  try {
    const entries = await getKbEntries(tenantId, language)
    return NextResponse.json({ entries })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch entries' }, { status: 500 })
  }
}

/**
 * POST /api/v1/kb
 * Body: { tenant_id, category, question, answer, keywords?, language? }
 * Lets the n8n workflow log new Q&A pairs (e.g. unanswered customer
 * questions reviewed by staff) back into the knowledge base.
 */
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, category, question, answer, keywords, language } = body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string') {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }
  if (!question || typeof question !== 'string' || !answer || typeof answer !== 'string') {
    return NextResponse.json({ error: 'question and answer are required' }, { status: 400 })
  }

  const lang = VALID_LANGS.includes((language as string)?.toUpperCase() as Lang)
    ? ((language as string).toUpperCase() as Lang)
    : 'EN'

  try {
    // Verify the tenant exists before inserting (createKbEntry has no FK check otherwise)
    const supabase = await createServiceClient()
    const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenant_id).single()
    if (!tenant) {
      return NextResponse.json({ error: 'Unknown tenant_id' }, { status: 404 })
    }

    const created = await createKbEntry(tenant_id, {
      category: typeof category === 'string' && category.trim() ? category.trim() : 'General',
      question: question.trim(),
      answer: answer.trim(),
      keywords: Array.isArray(keywords) ? keywords.map(String) : [],
      language: lang,
    })
    return NextResponse.json({ entry: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create entry' }, { status: 500 })
  }
}
