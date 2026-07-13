import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase-server'
import { getOrders, getOrder, updateOrderStatus, ORDER_SNAPSHOT_COLUMNS, toOrderSnapshot } from '@/lib/db/orders'
import { upsertCustomerFromOrder } from '@/lib/db/customers'
import { resolveDeliveryFee } from '@/lib/db/delivery-zones'
import { resolveOrderItems, UnknownItemError } from '@/lib/db/order-items'
import { notifyOrderStatusChange } from '@/lib/n8n-webhook'
import { isBankTransfer, normalizePaymentMethod } from '@/lib/payments'
import { normalizePhone } from '@/lib/phone'
import type { OrderStatus } from '@/types'

const VALID_STATUSES: OrderStatus[] = ['pending', 'awaiting_payment', 'pending_verification', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']

// Only these statuses count as an unresolved draft eligible for upsert.
// pending_verification/confirmed/preparing/shipped/delivered/cancelled are past the draft
// stage and must never be matched or overwritten by a new placement.
const DRAFT_STATUSES = ['pending', 'awaiting_payment'] as const

// Bound on how old a draft can be and still be silently updated, so a
// long-abandoned draft doesn't absorb an unrelated fresh purchase.
const DRAFT_UPSERT_WINDOW_HOURS = 24

async function findDraftOrder(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  phone: string
): Promise<{ id: string } | null> {
  const cutoff = new Date(Date.now() - DRAFT_UPSERT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const normalized = normalizePhone(phone)

  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .in('status', DRAFT_STATUSES)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) return data

  if (normalized && normalized !== phone) {
    const { data: fallback } = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .like('phone', `%${normalized}`)
      .in('status', DRAFT_STATUSES)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (fallback) return fallback
  }

  return null
}

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
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

    let verifiedItems
    try {
      verifiedItems = await resolveOrderItems(supabase, tenant_id, items as Record<string, unknown>[])
    } catch (err) {
      if (err instanceof UnknownItemError) {
        return NextResponse.json({ error: 'unknown_item', name: err.itemName }, { status: 422 })
      }
      throw err
    }

    const subtotal = verifiedItems.reduce((s, i) => s + i.line_total, 0)

    // Delivery fee resolved server-side from zones, body value ignored
    const trimmedAddress = delivery_address.trim()
    const cityHint = typeof bodyCity === 'string' ? bodyCity : null
    const { fee: delivery_fee, district, estimated_days } = await resolveDeliveryFee(
      tenant_id,
      trimmedAddress,
      cityHint
    )
    const total = subtotal + delivery_fee

    const phoneStr = typeof phone === 'string' ? phone : null
    const now = new Date().toISOString()

    const baseRow = {
      tenant_id,
      session_id: typeof session_id === 'string' ? session_id : null,
      phone: phoneStr,
      channel: typeof channel === 'string' ? channel : 'whatsapp',
      language: typeof language === 'string' ? language : null,
      currency: typeof currency === 'string' ? currency : 'LKR',
      customer_name: customer_name.trim(),
      customer_phone: phoneStr,
      delivery_address: trimmedAddress,
      contact_number: typeof contact_number === 'string' ? contact_number : null,
      delivery_zone: district,
      estimated_days,
      items: verifiedItems,
      payment_method: normalizePaymentMethod(payment_method as string),
      subtotal,
      delivery_fee,
      total,
      updated_at: now,
    }

    const initialStatus = isBankTransfer(payment_method as string) ? 'awaiting_payment' : 'pending'

    // Upsert-on-draft: find the customer's open draft order (pending or awaiting_payment),
    // created within the last DRAFT_UPSERT_WINDOW_HOURS hours only.
    if (phoneStr) {
      const open = await findDraftOrder(supabase, tenant_id, phoneStr)

      if (open) {
        const { data, error } = await supabase
          .from('orders')
          .update({ ...baseRow, status: initialStatus, status_changed_at: now })
          .eq('id', open.id)
          .in('status', DRAFT_STATUSES)
          .select(ORDER_SNAPSHOT_COLUMNS)
          .maybeSingle()
        if (error) return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
        if (!data) return NextResponse.json({ error: 'order_locked' }, { status: 409 })
        await upsertCustomerFromOrder(tenant_id, phoneStr, customer_name.trim(), baseRow.language)
        revalidatePath('/orders')
        return NextResponse.json({
          order_id: data.order_ref,
          mode: 'updated',
          subtotal,
          delivery_fee,
          total,
          order: toOrderSnapshot(data),
        })
      }
    }

    // No draft — insert. Catch the partial-unique race.
    const { data: ins, error: insErr } = await supabase
      .from('orders')
      .insert({ ...baseRow, status: initialStatus, status_changed_at: now, created_at: now })
      .select(ORDER_SNAPSHOT_COLUMNS)
      .single()

    if (insErr?.code === '23505' && phoneStr) {
      const again = await findDraftOrder(supabase, tenant_id, phoneStr)
      if (again) {
        const { data } = await supabase
          .from('orders')
          .update({ ...baseRow, status: initialStatus, status_changed_at: now })
          .eq('id', again.id)
          .in('status', DRAFT_STATUSES)
          .select(ORDER_SNAPSHOT_COLUMNS)
          .maybeSingle()
        if (data) {
          await upsertCustomerFromOrder(tenant_id, phoneStr, customer_name.trim(), baseRow.language)
          revalidatePath('/orders')
          return NextResponse.json({
            order_id: data.order_ref,
            mode: 'updated',
            subtotal,
            delivery_fee,
            total,
            order: toOrderSnapshot(data),
          })
        }
      }
      return NextResponse.json({ error: 'order_locked' }, { status: 409 })
    }
    if (insErr) return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })

    if (phoneStr) await upsertCustomerFromOrder(tenant_id, phoneStr, customer_name.trim(), baseRow.language)
    revalidatePath('/orders')
    return NextResponse.json({
      order_id: ins.order_ref,
      mode: 'created',
      subtotal,
      delivery_fee,
      total,
      order: toOrderSnapshot(ins),
    })
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

    revalidatePath('/orders')
    revalidatePath('/payments')

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
