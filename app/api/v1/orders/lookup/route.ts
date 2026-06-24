import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  const orderRef = (req.nextUrl.searchParams.get('order_ref') ?? '').trim().toUpperCase()

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }
  if (!orderRef) {
    return NextResponse.json({ error: 'missing_ref' }, { status: 400 })
  }

  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('orders')
      .select(
        'order_ref, status, items, subtotal, delivery_fee, total, currency, ' +
        'tracking_number, estimated_delivery_date, estimated_days, delivery_zone, created_at'
      )
      .eq('tenant_id', tenantId)
      .eq('order_ref', orderRef)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
