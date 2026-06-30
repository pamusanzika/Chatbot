import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getCustomerDetail } from '@/lib/db/customers'
import { getRecentMessagesByPhone } from '@/lib/db/chat-sessions'

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

  const recentMessages = await getRecentMessagesByPhone(tenantId, detail.customer.phone)

  return NextResponse.json({
    ...detail,
    recent_messages: recentMessages,
  })
}
