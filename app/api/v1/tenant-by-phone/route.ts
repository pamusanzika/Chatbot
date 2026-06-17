import { NextRequest, NextResponse } from 'next/server'
import { getTenantByPhoneNumberId } from '@/lib/db/tenants'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  const provided = req.headers.get('x-api-key')
  return provided === expected
}

/**
 * GET /api/v1/tenant-by-phone?phone_number_id=...
 * Looks up a tenant by its WhatsApp phone_number_id. Used by the n8n bot
 * workflow to resolve which tenant an incoming WhatsApp message belongs to.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phoneNumberId = req.nextUrl.searchParams.get('phone_number_id')
  if (!phoneNumberId) {
    return NextResponse.json({ error: 'phone_number_id is required' }, { status: 400 })
  }

  try {
    const tenant = await getTenantByPhoneNumberId(phoneNumberId)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({
      tenant: {
        ...tenant,
        business_name: tenant.name,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch tenant' }, { status: 500 })
  }
}
