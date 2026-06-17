import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { createOrder, getOrders } from '@/lib/db/orders'
import type { OrderItem, OrderStatus } from '@/types'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

/**
 * POST /api/v1/orders
 * Called by n8n after a customer confirms an order via WhatsApp.
 * Validates the API key, re-prices items against the product catalog,
 * persists the order, and returns { order_id } for the workflow to store.
 */
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    tenant_id,
    session_id,
    phone,
    channel,
    language,
    customer_name,
    delivery_address,
    contact_number,
    payment_method,
    currency,
    items,
    delivery_fee,
  } = body as Record<string, unknown>

  // Required field validation
  if (!tenant_id || typeof tenant_id !== 'string')
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  if (!customer_name || typeof customer_name !== 'string')
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  if (!delivery_address || typeof delivery_address !== 'string')
    return NextResponse.json({ error: 'delivery_address is required' }, { status: 400 })
  if (!payment_method || typeof payment_method !== 'string')
    return NextResponse.json({ error: 'payment_method is required' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 })

  try {
    const supabase = await createServiceClient()

    // Fetch product catalog for this tenant (for server-side price re-validation)
    const [{ data: products }, { data: variants }] = await Promise.all([
      supabase.from('products').select('id, name, base_price').eq('tenant_id', tenant_id),
      supabase.from('product_variants').select('product_id, size, color_name, price').eq('tenant_id', tenant_id),
    ])

    type RawItem = Record<string, unknown>

    const verifiedItems: OrderItem[] = (items as RawItem[]).map((item) => {
      const itemName = String(item.name ?? '').trim()
      const itemVariant = item.variant ? String(item.variant).trim() : null
      const quantity = Number(item.quantity ?? 0)
      let unit_price = Number(item.unit_price ?? 0)
      let price_unverified = true

      const matchedProduct = (products ?? []).find(
        (p: { id: string; name: string; base_price: number }) =>
          p.name.toLowerCase() === itemName.toLowerCase()
      )

      if (matchedProduct) {
        if (itemVariant) {
          const matchedVariant = (variants ?? []).find(
            (v: { product_id: string; size: string; color_name: string; price: number }) =>
              v.product_id === matchedProduct.id &&
              (v.size.toLowerCase() === itemVariant.toLowerCase() ||
                v.color_name.toLowerCase() === itemVariant.toLowerCase())
          )
          unit_price = matchedVariant ? matchedVariant.price : matchedProduct.base_price
        } else {
          unit_price = matchedProduct.base_price
        }
        price_unverified = false
      }

      const line_total = quantity * unit_price
      return {
        name: itemName,
        ...(itemVariant ? { variant: itemVariant } : {}),
        quantity,
        unit_price,
        line_total,
        ...(price_unverified ? { price_unverified: true } : {}),
      }
    })

    // Recompute authoritative totals
    const computedSubtotal = verifiedItems.reduce((s, i) => s + i.line_total, 0)
    const computedDeliveryFee = typeof delivery_fee === 'number' ? delivery_fee : 0
    const computedTotal = computedSubtotal + computedDeliveryFee

    const order = await createOrder(tenant_id, {
      session_id: typeof session_id === 'string' ? session_id : undefined,
      phone: typeof phone === 'string' ? phone : undefined,
      channel: typeof channel === 'string' ? channel : 'whatsapp',
      language: typeof language === 'string' ? language : null,
      currency: typeof currency === 'string' ? currency : 'LKR',
      customer_name: customer_name.trim(),
      customer_phone: typeof phone === 'string' ? phone : undefined,
      delivery_address: delivery_address.trim(),
      contact_number: typeof contact_number === 'string' ? contact_number : undefined,
      items: verifiedItems,
      payment_method: payment_method.trim(),
      subtotal: computedSubtotal,
      delivery_fee: computedDeliveryFee,
      total: computedTotal,
    })

    return NextResponse.json({ order_id: order.order_ref })
  } catch (err) {
    console.error('[POST /api/v1/orders]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create order' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/orders?tenant_id=...&status=...
 * Returns orders for a tenant. Useful for n8n lookups and debugging.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })
  }

  const status = req.nextUrl.searchParams.get('status') as OrderStatus | null

  try {
    const orders = await getOrders(tenantId, { status: status ?? undefined })
    return NextResponse.json({ orders })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
