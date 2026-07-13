/**
 * Acceptance test for the /orders/current ground-truth flow (P0/P1 fixes for
 * the "revised summary vs. stale machine block" bug).
 *
 * Usage:
 *   npx tsx scripts/test-order-current-flow.ts
 *
 * Requires a running dev server (`npm run dev`) and env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWBOT_API_KEY
 *   TEST_TENANT_ID       — tenant to run against
 *   TEST_PRODUCT_NAME    — an active product in that tenant's catalog (default "T-shirt")
 *   TEST_ADDRESS         — a delivery address whose city resolves to a zone (e.g. "12 Main St, Colombo")
 *   BASE_URL             — defaults to http://localhost:3000
 *
 * The expected subtotal/fee are read straight from the DB (not hardcoded),
 * so this passes against any tenant's real catalog/delivery zones.
 *
 * Creates and then deletes its own test orders — safe to run against a real
 * dev database, but do not point it at production.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const API_KEY = process.env.FLOWBOT_API_KEY!
const TENANT_ID = process.env.TEST_TENANT_ID!
const PRODUCT_NAME = process.env.TEST_PRODUCT_NAME ?? 'T-shirt'
const ADDRESS = process.env.TEST_ADDRESS!
const PHONE = `94700${Date.now().toString().slice(-6)}`

if (!API_KEY || !TENANT_ID || !ADDRESS) {
  console.error('Missing required env: FLOWBOT_API_KEY, TEST_TENANT_ID, TEST_ADDRESS')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const createdOrderIds: string[] = []

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAILED: ${msg}`)
  console.log(`ok: ${msg}`)
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function main() {
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('id, base_price')
    .eq('tenant_id', TENANT_ID)
    .ilike('name', PRODUCT_NAME)
    .limit(1)
    .maybeSingle()
  if (productErr || !product) throw new Error(`Test product "${PRODUCT_NAME}" not found for tenant`)
  const unitPrice = Number(product.base_price)

  // 1. Create a pending order: 1 x product
  const created = await api('POST', '/api/v1/orders', {
    tenant_id: TENANT_ID,
    phone: PHONE,
    customer_name: 'Acceptance Test',
    delivery_address: ADDRESS,
    contact_number: PHONE,
    payment_method: 'Cash on Delivery',
    items: [{ name: PRODUCT_NAME, quantity: 1, unit_price: 1 }], // bogus price — must be ignored
  })
  assert(created.status === 200, `POST /orders succeeded (got ${created.status}: ${JSON.stringify(created.json)})`)
  const orderRef = created.json.order_id
  const expectedFee = Number(created.json.delivery_fee)
  createdOrderIds.push(orderRef)

  assert(created.json.order.items[0].quantity === 1, 'created order has quantity 1')
  assert(created.json.order.items[0].unit_price === unitPrice, `created order used DB price ${unitPrice}, not the bogus 1`)
  assert(created.json.order.total === unitPrice + expectedFee, `created total === ${unitPrice + expectedFee}`)

  // 2. GET /orders/current returns the full snapshot
  const current = await api('GET', `/api/v1/orders/current?tenant_id=${TENANT_ID}&phone=${PHONE}`)
  assert(current.status === 200, 'GET /orders/current returns 200')
  assert(current.json.order.order_ref === orderRef, 'GET current matches created order_ref')
  assert(current.json.order.items[0].quantity === 1, 'GET current shows quantity 1')
  assert(current.json.order.total === unitPrice + expectedFee, 'GET current total matches')
  assert(typeof current.json.order.customer_name === 'string', 'GET current has customer_name')
  assert(typeof current.json.order.delivery_address === 'string', 'GET current has delivery_address')
  assert(typeof current.json.order.payment_method === 'string', 'GET current has payment_method')
  assert('status_changed_at' in current.json.order, 'GET current has status_changed_at')

  // 3. PATCH quantity to 2
  const patched = await api('PATCH', '/api/v1/orders/current', {
    tenant_id: TENANT_ID,
    phone: PHONE,
    customer_name: 'Acceptance Test',
    delivery_address: ADDRESS,
    contact_number: PHONE,
    payment_method: 'Cash on Delivery',
    items: [{ name: PRODUCT_NAME, quantity: 2, unit_price: 1 }],
  })
  assert(patched.status === 200, `PATCH quantity=2 succeeded (${JSON.stringify(patched.json)})`)
  assert(patched.json.order.items[0].quantity === 2, 'echoed order shows quantity 2')
  assert(patched.json.order.subtotal === unitPrice * 2, 'echoed subtotal === unitPrice * 2')
  assert(patched.json.order.total === unitPrice * 2 + expectedFee, 'echoed total reflects new quantity')

  // 4. PATCH with a hallucinated low price — DB price must win
  const patchedPrice = await api('PATCH', '/api/v1/orders/current', {
    tenant_id: TENANT_ID,
    phone: PHONE,
    customer_name: 'Acceptance Test',
    delivery_address: ADDRESS,
    contact_number: PHONE,
    payment_method: 'Cash on Delivery',
    items: [{ name: PRODUCT_NAME, quantity: 1, unit_price: 15 }],
  })
  assert(patchedPrice.status === 200, 'PATCH with hallucinated price succeeded')
  assert(patchedPrice.json.order.items[0].unit_price === unitPrice, `DB price ${unitPrice} wins over hallucinated 15`)

  // 5. Confirm from "dashboard" (direct DB write, mirrors decidePayment), then PATCH must 409
  const { error: confirmErr } = await supabase
    .from('orders')
    .update({ status: 'confirmed', status_changed_at: new Date().toISOString() })
    .eq('tenant_id', TENANT_ID)
    .eq('order_ref', orderRef)
  if (confirmErr) throw confirmErr

  const beforeRow = await supabase.from('orders').select('items, total').eq('order_ref', orderRef).single()

  const patchAfterConfirm = await api('PATCH', '/api/v1/orders/current', {
    tenant_id: TENANT_ID,
    phone: PHONE,
    customer_name: 'Acceptance Test',
    delivery_address: ADDRESS,
    contact_number: PHONE,
    payment_method: 'Cash on Delivery',
    items: [{ name: PRODUCT_NAME, quantity: 99, unit_price: 1 }],
  })
  assert(patchAfterConfirm.status === 409, 'PATCH after confirm returns 409')
  assert(patchAfterConfirm.json.error === 'order_locked', 'PATCH after confirm reports order_locked')

  const afterRow = await supabase.from('orders').select('items, total').eq('order_ref', orderRef).single()
  assert(
    JSON.stringify(afterRow.data) === JSON.stringify(beforeRow.data),
    'row unchanged by the rejected PATCH'
  )

  // 6. POST /orders again for the same phone creates a NEW order, doesn't touch the confirmed one
  const secondOrder = await api('POST', '/api/v1/orders', {
    tenant_id: TENANT_ID,
    phone: PHONE,
    customer_name: 'Acceptance Test',
    delivery_address: ADDRESS,
    contact_number: PHONE,
    payment_method: 'Cash on Delivery',
    items: [{ name: PRODUCT_NAME, quantity: 1, unit_price: 1 }],
  })
  assert(secondOrder.status === 200, 'second POST /orders succeeded')
  assert(secondOrder.json.order_id !== orderRef, 'second POST created a new order_ref')
  createdOrderIds.push(secondOrder.json.order_id)

  console.log('\nAll acceptance checks passed.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    if (createdOrderIds.length) {
      await supabase.from('orders').delete().eq('tenant_id', TENANT_ID).in('order_ref', createdOrderIds)
      console.log(`Cleaned up test orders: ${createdOrderIds.join(', ')}`)
    }
  })
