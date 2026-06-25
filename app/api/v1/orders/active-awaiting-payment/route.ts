import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { normalizePhone } from '@/lib/phone'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

/**
 * GET /api/v1/orders/active-awaiting-payment?tenant_id=&phone=
 *
 * n8n calls this when a customer sends an image. If an awaiting_payment order
 * exists for this phone, n8n routes to the payment-proof branch instead of
 * image search. Returns the order or 404.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  const phone = req.nextUrl.searchParams.get('phone')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  try {
    const supabase = await createServiceClient()
    const normalized = normalizePhone(phone)

    // Try exact match first, then normalized suffix match
    let { data, error } = await supabase
      .from('orders')
      .select('id, order_ref, status, total, currency, customer_name, payment_method, created_at')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .eq('status', 'awaiting_payment')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data && !error && normalized !== phone) {
      ;({ data, error } = await supabase
        .from('orders')
        .select('id, order_ref, status, total, currency, customer_name, payment_method, created_at')
        .eq('tenant_id', tenantId)
        .like('phone', `%${normalized}`)
        .eq('status', 'awaiting_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle())
    }

    if (error) {
      return NextResponse.json({ error: 'Failed to query orders' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ awaiting: false }, { status: 404 })
    }

    return NextResponse.json({
      awaiting: true,
      order: data,
    })
  } catch (err) {
    console.error('[GET /api/v1/orders/active-awaiting-payment]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
