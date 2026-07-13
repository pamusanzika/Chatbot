import { NextRequest, NextResponse } from 'next/server'
import { getTenant } from '@/lib/auth'
import { getComplaintById } from '@/lib/db/complaints'
import { sendAgentReply } from '@/lib/n8n-webhook'

/**
 * Proxies the agent's reply to n8n — the dashboard never sends WhatsApp or
 * saves the message itself, since the workflow does both and this would
 * double-write otherwise.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, tenantUser } = await getTenant()
    const { id } = await params

    const body = await req.json().catch(() => null)
    const message = body?.message
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const ticket = await getComplaintById(tenantId, id)
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    if (!ticket.phone) {
      return NextResponse.json({ error: 'Ticket has no phone number on file' }, { status: 400 })
    }

    const result = await sendAgentReply({
      tenantId,
      phone: ticket.phone,
      message: message.trim(),
      agentName: tenantUser.name,
    })

    return NextResponse.json(result)
  } catch (err) {
    const status = (err as Error).message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send reply' }, { status })
  }
}
