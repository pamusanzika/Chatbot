import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getCustomerDetail } from '@/lib/db/customers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params
  const { tenantId } = await getTenant()

  const detail = await getCustomerDetail(tenantId, customerId)
  if (!detail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(detail)
}
