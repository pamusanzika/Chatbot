import { NextRequest, NextResponse } from 'next/server'
import { getBankDetail, updateBankDetail, deleteBankDetail } from '@/lib/db/bank-details'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!checkApiKey(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId)
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })

  try {
    const detail = await getBankDetail(tenantId, params.id)
    if (!detail)
      return NextResponse.json({ error: 'Bank detail not found' }, { status: 404 })
    return NextResponse.json({ bank_detail: detail })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch bank detail' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!checkApiKey(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const { tenant_id, ...changes } = body as Record<string, unknown>
  if (!tenant_id || typeof tenant_id !== 'string')
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })

  const allowed = [
    'bank_name', 'account_name', 'account_number', 'branch_name',
    'branch_code', 'notes', 'is_active',
  ]
  const filtered: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in changes) filtered[key] = changes[key]
  }

  try {
    const updated = await updateBankDetail(tenant_id, params.id, filtered, 'api')
    return NextResponse.json({ bank_detail: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update bank detail' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!checkApiKey(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId)
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })

  try {
    await deleteBankDetail(tenantId, params.id, 'api')
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete bank detail' },
      { status: 500 }
    )
  }
}
