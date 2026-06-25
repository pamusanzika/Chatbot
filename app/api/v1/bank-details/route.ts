import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getBankDetails, createBankDetail } from '@/lib/db/bank-details'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

export async function GET(req: NextRequest) {
  if (!checkApiKey(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId)
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })

  const activeOnly = req.nextUrl.searchParams.get('active_only') === 'true'

  try {
    const details = await getBankDetails(tenantId, activeOnly)
    return NextResponse.json({ bank_details: details })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch bank details' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const {
    tenant_id, bank_name, account_name, account_number,
    branch_name, branch_code, notes, is_active,
  } = body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string')
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  if (!bank_name || typeof bank_name !== 'string')
    return NextResponse.json({ error: 'bank_name is required' }, { status: 400 })
  if (!account_name || typeof account_name !== 'string')
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  if (!account_number || typeof account_number !== 'string')
    return NextResponse.json({ error: 'account_number is required' }, { status: 400 })

  try {
    const supabase = await createServiceClient()
    const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenant_id).single()
    if (!tenant)
      return NextResponse.json({ error: 'Unknown tenant_id' }, { status: 404 })

    const created = await createBankDetail(
      tenant_id,
      {
        bank_name: (bank_name as string).trim(),
        account_name: (account_name as string).trim(),
        account_number: (account_number as string).trim(),
        branch_name: typeof branch_name === 'string' ? branch_name.trim() : '',
        branch_code: typeof branch_code === 'string' ? branch_code.trim() : '',
        notes: typeof notes === 'string' ? notes.trim() : '',
        is_active: typeof is_active === 'boolean' ? is_active : true,
      },
      'api'
    )
    return NextResponse.json({ bank_detail: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create bank detail' },
      { status: 500 }
    )
  }
}
