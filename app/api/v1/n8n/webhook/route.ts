import { NextRequest, NextResponse } from 'next/server'
import { getTenantById } from '@/lib/db/tenant'
import { upsertChatSession, insertChatMessage, getControlByPhone } from '@/lib/db/chat-sessions'
import { createComplaintTicket } from '@/lib/db/complaints'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

/**
 * POST /api/v1/n8n/webhook
 * Generic n8n webhook endpoint. Accepts events from n8n workflows
 * and routes them based on the `action` field.
 *
 * Supported actions:
 *  - "get_config"    → returns tenant info + chatbot settings
 *  - "save_message"  → persists a chat message (same as /api/v1/chat/message)
 *  - "create_ticket" → escalation: opens a support ticket + hands conversation
 *                       control to a human. The workflow still sends the
 *                       WhatsApp holding message itself. Idempotent per phone.
 *  - "get_control"   → pause-gate check: is this phone bot- or human-controlled
 *                       right now? Also available as GET (see below).
 *  - "ping"          → health check
 */
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body as Record<string, unknown>

  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'action field is required' }, { status: 400 })
  }

  try {
    switch (action) {
      case 'ping':
        return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })

      case 'get_config': {
        const tenantId = body.tenant_id as string | undefined
        if (!tenantId) {
          return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
        }
        const tenant = await getTenantById(tenantId)
        return NextResponse.json({
          tenant: {
            id: tenant.id,
            name: tenant.name,
            industry: tenant.industry,
            phone: tenant.phone,
            whatsapp_number: tenant.whatsapp_number,
            currency: tenant.currency,
            default_language: tenant.default_language,
          },
          chatbot_settings: tenant.chatbot_settings,
        })
      }

      case 'save_message': {
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

        await upsertChatSession(
          tenant_id,
          session_id,
          phone,
          typeof channel === 'string' ? channel : null,
          typeof language === 'string' ? language : null,
          typeof intent === 'string' ? intent : null,
        )

        const message = await insertChatMessage(
          tenant_id,
          session_id,
          role,
          content,
          typeof language === 'string' ? language : null,
          typeof intent === 'string' ? intent : null,
          typeof tokens_used === 'number' ? tokens_used : null,
        )

        return NextResponse.json({ message }, { status: 201 })
      }

      case 'create_ticket': {
        const { tenant_id, phone, customer_name, summary, reason, language } =
          body as Record<string, unknown>

        if (!tenant_id || typeof tenant_id !== 'string')
          return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
        if (!phone || typeof phone !== 'string')
          return NextResponse.json({ error: 'phone is required' }, { status: 400 })
        if (!summary || typeof summary !== 'string')
          return NextResponse.json({ error: 'summary is required' }, { status: 400 })

        const ticket = await createComplaintTicket(tenant_id, {
          phone,
          customer_name: typeof customer_name === 'string' ? customer_name : null,
          summary,
          reason: typeof reason === 'string' ? reason : undefined,
          language: typeof language === 'string' ? language : undefined,
        })

        return NextResponse.json({ ticket }, { status: 201 })
      }

      case 'get_control': {
        const { tenant_id, phone } = body as Record<string, unknown>

        if (!tenant_id || typeof tenant_id !== 'string')
          return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
        if (!phone || typeof phone !== 'string')
          return NextResponse.json({ error: 'phone is required' }, { status: 400 })

        const control = await getControlByPhone(tenant_id, phone)
        return NextResponse.json({ control })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/v1/n8n/webhook?action=get_control&tenant_id=...&phone=...
 * Query-param form of the get_control action, for pause-gate nodes that
 * prefer a GET lookup over a POST body.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const action = req.nextUrl.searchParams.get('action')
  if (action !== 'get_control') {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  const phone = req.nextUrl.searchParams.get('phone')
  if (!tenantId) return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 })

  const control = await getControlByPhone(tenantId, phone)
  return NextResponse.json({ control })
}
