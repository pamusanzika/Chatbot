import { NextRequest, NextResponse } from 'next/server'
import { getTenantById } from '@/lib/db/tenant'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

/**
 * GET /api/v1/chatbot-settings?tenant_id=...
 * Returns chatbot configuration for a tenant. Used by n8n to fetch
 * bot name, system prompt, languages, and fallback messages.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })
  }

  try {
    const tenant = await getTenantById(tenantId)
    const defaults = {
      bot_name: tenant.name + ' Bot',
      language_model: 'llama-3.3-70b (Groq)',
      system_prompt: '',
      languages: [
        { name: 'English', enabled: true },
        { name: 'Sinhala', enabled: true },
        { name: 'Tamil', enabled: true },
        { name: 'Singlish', enabled: true },
      ],
      fallback_message: "Sorry, I didn't understand that. Can you rephrase?",
      handoff_triggers: 'speak to agent, human, real person',
      handoff_message: 'Connecting you to a team member, please hold',
    }

    return NextResponse.json({
      chatbot_settings: tenant.chatbot_settings ?? defaults,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch chatbot settings' },
      { status: 500 },
    )
  }
}
