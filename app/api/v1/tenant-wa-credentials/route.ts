import { NextRequest, NextResponse } from 'next/server'
import { getTenantWaCredentialsById } from '@/lib/db/tenants'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  const provided = req.headers.get('x-api-key')
  return provided === expected
}

/**
 * GET /api/v1/tenant-wa-credentials?tenant_id=...
 * Returns the WhatsApp send credentials (wa_access_token, phone_number_id)
 * for a tenant. Used by the n8n order-status notifier: the dashboard's
 * order.status_updated webhook only carries tenant_id, not WA credentials,
 * so the notifier calls this to fetch them before sending the WhatsApp message.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id_required' }, { status: 400 })
  }

  try {
    const tenant = await getTenantWaCredentialsById(tenantId)
    if (!tenant) {
      return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })
    }

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        wa_access_token: tenant.wa_access_token,
        phone_number_id: tenant.phone_number_id,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch tenant' }, { status: 500 })
  }
}
