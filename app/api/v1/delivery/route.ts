import { NextRequest, NextResponse } from 'next/server'
import { getDeliveryZones, lookupZoneByCity } from '@/lib/db/delivery-zones'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  const provided = req.headers.get('x-api-key')
  return provided === expected
}

/**
 * GET /api/v1/delivery?tenant_id=...&city=...
 * - With `city`: returns the matching active delivery zone (fee, eta, free
 *   delivery threshold) for that city, or { zone: null } if none match.
 * - Without `city`: returns all delivery zones for the tenant.
 * Used by the n8n bot workflow to answer "how much is delivery to X?".
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })
  }

  const city = req.nextUrl.searchParams.get('city')

  try {
    if (city) {
      const zone = await lookupZoneByCity(tenantId, city)
      return NextResponse.json({ zone })
    }

    const zones = await getDeliveryZones(tenantId)
    return NextResponse.json({ zones })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch delivery zones' }, { status: 500 })
  }
}
