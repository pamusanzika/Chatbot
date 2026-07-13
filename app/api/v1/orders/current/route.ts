import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase-server'
import { getTenantById } from '@/lib/db/tenant'
import { normalizePhone } from '@/lib/phone'
import { normalizePaymentMethod } from '@/lib/payments'
import { resolveDeliveryFee } from '@/lib/db/delivery-zones'
import { resolveOrderItems, UnknownItemError } from '@/lib/db/order-items'
import {
  EDITABLE_ORDER_STATUSES,
  NON_TERMINAL_ORDER_STATUSES,
  ORDER_SNAPSHOT_COLUMNS,
  toOrderSnapshot,
} from '@/lib/db/orders'
import type { OrderItem, OrderStatus } from '@/types'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

type OrderClient = Awaited<ReturnType<typeof createServiceClient>>

interface CurrentOrderRow {
  id: string
  order_ref: string
  status: OrderStatus
  currency: string
  items: OrderItem[] | null
  subtotal: number | string
  delivery_fee: number | string
  total: number | string
  customer_name: string
  delivery_address: string | null
  contact_number: string | null
  payment_method: string
  created_at: string
  updated_at: string
  status_changed_at: string | null
}

// Full row needed both to render the GET snapshot and to guard the PATCH update.
const FULL_COLS = `id, ${ORDER_SNAPSHOT_COLUMNS}`

/**
 * Finds the customer's most relevant order for a tenant + phone, preferring
 * a non-terminal (still-active) order over cancelled/delivered ones. Falls
 * back to a normalized-phone LIKE match, same as active-awaiting-payment.
 */
async function findCurrentOrderForPhone(supabase: OrderClient, tenantId: string, phone: string) {
  const normalized = normalizePhone(phone)

  const run = async (excludeTerminal: boolean) => {
    let query = supabase.from('orders').select(FULL_COLS).eq('tenant_id', tenantId).eq('phone', phone)
    if (excludeTerminal) query = query.in('status', NON_TERMINAL_ORDER_STATUSES)
    let { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!data && !error && normalized !== phone) {
      let query2 = supabase.from('orders').select(FULL_COLS).eq('tenant_id', tenantId).like('phone', `%${normalized}`)
      if (excludeTerminal) query2 = query2.in('status', NON_TERMINAL_ORDER_STATUSES)
      ;({ data, error } = await query2.order('created_at', { ascending: false }).limit(1).maybeSingle())
    }
    return { data: data as CurrentOrderRow | null, error }
  }

  const active = await run(true)
  if (active.error) return active
  if (active.data) return active
  return run(false)
}

async function findOrderByRef(supabase: OrderClient, tenantId: string, orderRef: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(FULL_COLS)
    .eq('tenant_id', tenantId)
    .eq('order_ref', orderRef)
    .maybeSingle()
  return { data: data as CurrentOrderRow | null, error }
}

/**
 * GET /api/v1/orders/current?tenant_id=&phone=
 *
 * Called on every inbound chat message so n8n has ground truth for what's
 * actually on the order — injected verbatim into the model's system prompt
 * so it edits *this* list instead of reconstructing one from chat memory.
 * Never 404s for "no order" — the bot needs a 200 with `order: null` to
 * degrade gracefully.
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

    const [{ data, error }, tenant] = await Promise.all([
      findCurrentOrderForPhone(supabase, tenantId, phone),
      getTenantById(tenantId).catch(() => null),
    ])

    if (error) {
      return NextResponse.json({ error: 'Failed to query orders' }, { status: 500 })
    }

    const supportNumber = tenant?.chatbot_settings?.support_number ?? ''

    return NextResponse.json({
      order: data ? toOrderSnapshot(data) : null,
      support_number: supportNumber,
    })
  } catch (err) {
    console.error('[GET /api/v1/orders/current]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/orders/current
 *
 * Applies a customer's chat-driven edit to their own non-locked order.
 * Re-checks the order's status server-side (the authoritative check) so a
 * near-simultaneous dashboard confirmation always wins the race: the
 * conditional update below only touches the row while it's still editable,
 * and returns 409 order_locked otherwise. An optional `expected_updated_at`
 * additionally guards against two chat-driven edits landing within the same
 * window — the second one loses with 409 order_changed instead of silently
 * overwriting the first.
 *
 * Item prices and the delivery fee are always resolved server-side — the
 * caller's unit_price/delivery_fee are never trusted, closing the class of
 * bug where a hallucinated LLM price gets faithfully saved.
 */
export async function PATCH(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    tenant_id,
    phone,
    order_ref,
    language,
    customer_name,
    delivery_address,
    contact_number,
    payment_method,
    currency,
    items,
    city,
    expected_updated_at,
  } = body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string')
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })

  const orderRef = typeof order_ref === 'string' ? order_ref.trim().toUpperCase() : ''
  const phoneStr = typeof phone === 'string' ? phone.trim() : ''
  if (!orderRef && !phoneStr)
    return NextResponse.json({ error: 'order_ref or phone is required' }, { status: 400 })

  if (!customer_name || typeof customer_name !== 'string')
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  if (!delivery_address || typeof delivery_address !== 'string')
    return NextResponse.json({ error: 'delivery_address is required' }, { status: 400 })
  if (!payment_method || typeof payment_method !== 'string')
    return NextResponse.json({ error: 'payment_method is required' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 })

  const expectedUpdatedAt = typeof expected_updated_at === 'string' ? expected_updated_at : null

  try {
    const supabase = await createServiceClient()

    const { data: existing, error: findErr } = orderRef
      ? await findOrderByRef(supabase, tenant_id, orderRef)
      : await findCurrentOrderForPhone(supabase, tenant_id, phoneStr)

    if (findErr) {
      return NextResponse.json({ error: 'Failed to query order' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
    }
    if (!EDITABLE_ORDER_STATUSES.includes(existing.status)) {
      return NextResponse.json(
        { error: 'order_locked', status: existing.status, order_ref: existing.order_ref },
        { status: 409 }
      )
    }

    let recomputedItems
    try {
      recomputedItems = await resolveOrderItems(supabase, tenant_id, items as Record<string, unknown>[])
    } catch (err) {
      if (err instanceof UnknownItemError) {
        return NextResponse.json({ error: 'unknown_item', name: err.itemName }, { status: 422 })
      }
      throw err
    }

    const trimmedAddress = delivery_address.trim()
    const cityHint = typeof city === 'string' ? city : null
    const { fee: resolvedDeliveryFee, district, estimated_days } = await resolveDeliveryFee(
      tenant_id,
      trimmedAddress,
      cityHint
    )

    const subtotal = recomputedItems.reduce((s, i) => s + i.line_total, 0)
    const total = subtotal + resolvedDeliveryFee

    const updatePayload = {
      customer_name: customer_name.trim(),
      delivery_address: trimmedAddress,
      contact_number: typeof contact_number === 'string' ? contact_number : null,
      payment_method: normalizePaymentMethod(payment_method),
      currency: typeof currency === 'string' ? currency : 'LKR',
      language: typeof language === 'string' ? language : null,
      items: recomputedItems,
      subtotal,
      delivery_fee: resolvedDeliveryFee,
      delivery_zone: district,
      estimated_days,
      total,
      updated_at: new Date().toISOString(),
    }

    // Conditional on status still being editable — closes the race with a
    // concurrent dashboard confirmation. Also conditional on expected_updated_at
    // when supplied — closes the race between two near-simultaneous chat edits.
    // 0 rows matched means one of those lost.
    let updateQuery = supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('tenant_id', tenant_id)
      .in('status', EDITABLE_ORDER_STATUSES)
    if (expectedUpdatedAt) {
      updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt)
    }

    const { data: updated, error: updateErr } = await updateQuery.select(FULL_COLS).maybeSingle()

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    if (!updated) {
      const { data: fresh } = await supabase
        .from('orders')
        .select(FULL_COLS)
        .eq('id', existing.id)
        .maybeSingle()
      const freshRow = fresh as CurrentOrderRow | null

      if (!freshRow || !EDITABLE_ORDER_STATUSES.includes(freshRow.status)) {
        return NextResponse.json(
          {
            error: 'order_locked',
            status: freshRow?.status ?? existing.status,
            order_ref: freshRow?.order_ref ?? existing.order_ref,
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'order_changed', order: toOrderSnapshot(freshRow) },
        { status: 409 }
      )
    }

    revalidatePath('/orders')

    return NextResponse.json({
      ok: true,
      order: toOrderSnapshot(updated),
    })
  } catch (err) {
    console.error('[PATCH /api/v1/orders/current]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
