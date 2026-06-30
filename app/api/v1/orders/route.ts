import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getOrders, getOrder, updateOrderStatus } from '@/lib/db/orders'
import { upsertCustomerFromOrder } from '@/lib/db/customers'
import { lookupZoneByCity } from '@/lib/db/delivery-zones'
import { notifyOrderStatusChange } from '@/lib/n8n-webhook'
import { isBankTransfer, normalizePaymentMethod } from '@/lib/payments'
import type { OrderItem, OrderStatus } from '@/types'

const VALID_STATUSES: OrderStatus[] = ['pending', 'awaiting_payment', 'pending_verification', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

function cityFromAddress(address: string): string | null {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 1] : null
}

/**
 * POST /api/v1/orders
 * Called by n8n after a customer confirms an order via WhatsApp.
 * Upserts on the customer's open draft (pending) order to prevent duplicates.
 * Delivery fee is resolved server-side from delivery zones — body value is ignored.
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
    city: bodyCity,
  } = body as Record<string, unknown>

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

    const subtotal = verifiedItems.reduce((s, i) => s + i.line_total, 0)

    // Delivery fee resolved server-side from zones, body value ignored
    const city = (typeof bodyCity === 'string' ? bodyCity : null) ?? cityFromAddress(delivery_address)
    const zone = city ? await lookupZoneByCity(tenant_id, city) : null
    const delivery_fee = zone?.fee ?? 0
    const total = subtotal + delivery_fee

    const phoneStr = typeof phone === 'string' ? phone : null

    const baseRow = {
      tenant_id,
      session_id: typeof session_id === 'string' ? session_id : null,
      phone: phoneStr,
      channel: typeof channel === 'string' ? channel : 'whatsapp',
      language: typeof language === 'string' ? language : null,
      currency: typeof currency === 'string' ? currency : 'LKR',
      customer_name: customer_name.trim(),
      customer_phone: phoneStr,
      delivery_address: delivery_address.trim(),
      contact_number: typeof contact_number === 'string' ? contact_number : null,
      delivery_zone: zone?.district ?? null,
      estimated_days: zone?.estimated_days ?? null,
      items: verifiedItems,
      payment_method: normalizePaymentMethod(payment_method as string),
      subtotal,
      delivery_fee,
      total,
      updated_at: new Date().toISOString(),
    }

    const initialStatus = isBankTransfer(payment_method as string) ? 'awaiting_payment' : 'pending'

    // Upsert-on-draft: find the customer's open draft order (pending or awaiting_payment)
    if (phoneStr) {
      const { data: open } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('phone', phoneStr)
        .in('status', ['pending', 'awaiting_payment'])
        .maybeSingle()

      if (open) {
        const { data, error } = await supabase
          .from('orders')
          .update({ ...baseRow, status: initialStatus })
          .eq('id', open.id)
          .in('status', ['pending', 'awaiting_payment'])
          .select('order_ref')
          .maybeSingle()
        if (error) return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
        if (!data) return NextResponse.json({ error: 'order_locked' }, { status: 409 })
        if (phoneStr) await upsertCustomerFromOrder(tenant_id, phoneStr, customer_name.trim(), baseRow.language)
        return NextResponse.json({ order_id: data.order_ref, mode: 'updated', subtotal, delivery_fee, total })
      }
    }

    // No draft — insert. Catch the partial-unique race.
    const { data: ins, error: insErr } = await supabase
      .from('orders')
      .insert({ ...baseRow, status: initialStatus, created_at: new Date().toISOString() })
      .select('order_ref')
      .single()

    if (insErr?.code === '23505' && phoneStr) {
      const { data: again } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('phone', phoneStr)
        .in('status', ['pending', 'awaiting_payment'])
        .maybeSingle()
      if (again) {
        const { data } = await supabase
          .from('orders')
          .update({ ...baseRow, status: initialStatus })
          .eq('id', again.id)
          .in('status', ['pending', 'awaiting_payment'])
          .select('order_ref')
          .maybeSingle()
        if (data) {
          if (phoneStr) await upsertCustomerFromOrder(tenant_id, phoneStr, customer_name.trim(), baseRow.language)
          return NextResponse.json({ order_id: data.order_ref, mode: 'updated', subtotal, delivery_fee, total })
        }
      }
      return NextResponse.json({ error: 'order_locked' }, { status: 409 })
    }
    if (insErr) return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })

    if (phoneStr) await upsertCustomerFromOrder(tenant_id, phoneStr, customer_name.trim(), baseRow.language)
    return NextResponse.json({ order_id: ins.order_ref, mode: 'created', subtotal, delivery_fee, total })
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

/**
 * PATCH /api/v1/orders
 * Updates the status of an order. Can be called by n8n or external systems.
 * Also fires the n8n webhook so downstream workflows can react.
 */
export async function PATCH(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, order_id, status } = body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string')
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  if (!order_id || typeof order_id !== 'string')
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
  if (!status || !VALID_STATUSES.includes(status as OrderStatus))
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )

  try {
    const existing = await getOrder(tenant_id, order_id)
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Guard: confirmed/cancelled can only come from the dashboard payment-decision route
    if (status === 'confirmed' || status === 'cancelled') {
      if (existing.status !== 'pending_verification') {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${status}` },
          { status: 422 }
        )
      }
    }

    const previousStatus = existing.status
    const order = await updateOrderStatus(tenant_id, order_id, status as OrderStatus)

    const customerPhone = order.customer_phone ?? order.phone
    if (customerPhone) {
      await upsertCustomerFromOrder(tenant_id, customerPhone, order.customer_name, order.language)
    }

    notifyOrderStatusChange(order, previousStatus)

    return NextResponse.json({
      order_id: order.order_ref,
      previous_status: previousStatus,
      new_status: order.status,
    })
  } catch (err) {
    console.error('[PATCH /api/v1/orders]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update order status' },
      { status: 500 }
    )
  }
}
