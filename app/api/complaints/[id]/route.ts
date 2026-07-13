import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getComplaintById } from '@/lib/db/complaints'
import { getControlByPhone, getMessagesByPhone } from '@/lib/db/chat-sessions'
import { getOrdersByCustomerPhone } from '@/lib/db/orders'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenant()
    const { id } = await params

    const ticket = await getComplaintById(tenantId, id)
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const [control, messages, recentOrders] = await Promise.all([
      ticket.phone ? getControlByPhone(tenantId, ticket.phone) : Promise.resolve('bot' as const),
      ticket.phone ? getMessagesByPhone(tenantId, ticket.phone) : Promise.resolve([]),
      ticket.phone ? getOrdersByCustomerPhone(tenantId, ticket.phone) : Promise.resolve([]),
    ])

    return NextResponse.json({ ticket, control, messages, recentOrders: recentOrders.slice(0, 5) })
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch ticket' }, { status })
  }
}
