import { NextRequest, NextResponse } from 'next/server'
import { getTenantById } from '@/lib/db/tenant'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  const provided = req.headers.get('x-api-key')
  return provided === expected
}

/**
 * GET /api/v1/tenant?tenant_id=...
 * Returns business profile info (name, industry, contact details, social
 * links) for a tenant. Used by the n8n bot workflow for prompt context and
 * to surface social links / contact info to customers.
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
    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        industry: tenant.industry,
        email: tenant.email,
        phone: tenant.phone,
        whatsapp_number: tenant.whatsapp_number,
        address: tenant.address,
        default_language: tenant.default_language,
        currency: tenant.currency,
        social_links: tenant.social_links,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch tenant' }, { status: 500 })
  }
}
