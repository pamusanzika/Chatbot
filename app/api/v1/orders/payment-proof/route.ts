import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase-server'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

/**
 * POST /api/v1/orders/payment-proof
 *
 * Called by n8n when a customer sends a payment slip image for an
 * awaiting_payment order. This endpoint:
 *   1. Validates the order exists and is in awaiting_payment status
 *   2. Uploads the image to the payment-proofs storage bucket
 *   3. Creates a payment_proofs row
 *   4. Flips order status to pending_verification
 *   5. Writes an audit_logs entry
 *
 * Body (JSON):
 *   tenant_id:          string (required)
 *   order_id:           string (required — the order UUID)
 *   image_base64:       string (required — raw base64, no data: prefix)
 *   mime_type?:         string (default: image/jpeg)
 *   file_name?:         string (default: payment-proof.jpg)
 *   customer_reference?: string (what the customer typed as reference)
 */
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, order_id, image_base64, mime_type, file_name, customer_reference } =
    body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string')
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  if (!order_id || typeof order_id !== 'string')
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
  if (!image_base64 || typeof image_base64 !== 'string')
    return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 })

  const mimeType = typeof mime_type === 'string' ? mime_type : 'image/jpeg'
  const ext = mimeType.split('/')[1] ?? 'jpg'
  const fileName = typeof file_name === 'string' ? file_name : `payment-proof.${ext}`
  const custRef = typeof customer_reference === 'string' ? customer_reference : null

  try {
    const supabase = await createServiceClient()

    // 1. Validate order exists and is awaiting_payment
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_ref, status, tenant_id')
      .eq('tenant_id', tenant_id)
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'awaiting_payment') {
      return NextResponse.json(
        { error: 'Order is not awaiting payment', current_status: order.status },
        { status: 409 }
      )
    }

    // 2. Check no proof already exists (UNIQUE constraint safety)
    const { data: existing } = await supabase
      .from('payment_proofs')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Proof already uploaded for this order' },
        { status: 409 }
      )
    }

    // 3. Upload to storage
    const buffer = Buffer.from(image_base64, 'base64')
    const storagePath = `${tenant_id}/${order_id}/${fileName}`

    const { error: uploadErr } = await supabase.storage
      .from('payment-proofs')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadErr) {
      console.error('[payment-proof] Storage upload error:', uploadErr)
      return NextResponse.json({ error: 'Failed to upload proof' }, { status: 500 })
    }

    // 4. Create payment_proofs row
    const { error: proofErr } = await supabase.from('payment_proofs').insert({
      order_id,
      tenant_id,
      storage_path: storagePath,
      mime_type: mimeType,
      file_name: fileName,
      customer_reference: custRef,
    })

    if (proofErr) {
      console.error('[payment-proof] DB insert error:', proofErr)
      // Clean up uploaded file
      await supabase.storage.from('payment-proofs').remove([storagePath])
      return NextResponse.json({ error: 'Failed to save proof record' }, { status: 500 })
    }

    // 5. Flip order status to pending_verification
    const { error: statusErr } = await supabase
      .from('orders')
      .update({ status: 'pending_verification', status_changed_at: new Date().toISOString() })
      .eq('id', order_id)
      .eq('status', 'awaiting_payment') // guard against race

    if (statusErr) {
      console.error('[payment-proof] Status update error:', statusErr)
    }

    // 6. Write audit log
    await supabase.from('audit_logs').insert({
      tenant_id,
      actor: 'system',
      action: 'proof_uploaded',
      entity_type: 'order',
      entity_id: order_id,
      meta: {
        file_name: fileName,
        mime_type: mimeType,
        customer_reference: custRef,
      },
    })

    revalidatePath('/payments')
    revalidatePath('/orders')

    return NextResponse.json({
      success: true,
      order_ref: order.order_ref,
      status: 'pending_verification',
    })
  } catch (err) {
    console.error('[POST /api/v1/orders/payment-proof]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
