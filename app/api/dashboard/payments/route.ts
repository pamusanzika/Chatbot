import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getPaymentOrders } from '@/lib/db/payments'

export async function GET(req: NextRequest) {
  const { tenantId } = await getTenant()
  const status = req.nextUrl.searchParams.get('status') ?? 'pending_verification'
  const orders = await getPaymentOrders(tenantId, status)
  return NextResponse.json(orders)
}
