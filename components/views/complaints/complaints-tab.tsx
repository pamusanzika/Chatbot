'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Eye, Send } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/inputs'
import { PillNav } from '@/components/ui/inputs'
import { Avatar } from '@/components/ui/avatar'
import { Drawer } from '@/components/ui/drawer'
import type { Complaint, ChatMessage, Order, ConversationControl } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', progress: 'In Progress', resolved: 'Resolved',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

function timeWaiting(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

function bubbleRole(m: ChatMessage): 'customer' | 'bot' | 'agent' {
  if (m.role === 'user') return 'customer'
  if (m.intent === 'agent_reply') return 'agent'
  return 'bot'
}

// ── Ticket Drawer ─────────────────────────────────────────────────────────

function TicketDrawer({
  ticket,
  onClose,
  onResolved,
}: {
  ticket: Complaint | null
  onClose: () => void
  onResolved: (id: string) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [control, setControl] = useState<ConversationControl>('bot')
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchThread = useCallback(async (ticketId: string, showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await fetch(`/api/complaints/${ticketId}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
      setControl(data.control ?? 'bot')
      setRecentOrders(data.recentOrders ?? [])
    } catch {}
    if (showSpinner) setLoading(false)
  }, [])

  useEffect(() => {
    if (!ticket) return
    fetchThread(ticket.id, true)
    const interval = setInterval(() => fetchThread(ticket.id, false), 4500)
    return () => clearInterval(interval)
  }, [ticket?.id, fetchThread])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function handleSend() {
    if (!ticket || !draft.trim() || sending) return
    const text = draft.trim()
    setSending(true)
    setDraft('')

    // Optimistic agent bubble — reconciled against the next fetch below.
    setMessages((prev) => [
      ...prev,
      {
        id: `optimistic-${Date.now()}`,
        session_id: '',
        tenant_id: ticket.tenant_id,
        role: 'assistant',
        content: text,
        language: null,
        intent: 'agent_reply',
        tokens_used: null,
        created_at: new Date().toISOString(),
      },
    ])

    try {
      await fetch(`/api/complaints/${ticket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
    } catch {}

    await fetchThread(ticket.id, false)
    setSending(false)
  }

  async function handleResolve() {
    if (!ticket) return
    if (!confirm('Resolve this ticket? The bot will resume replying to this customer.')) return
    setResolving(true)
    try {
      await fetch(`/api/complaints/${ticket.id}/resolve`, { method: 'POST' })
      setControl('bot')
      onResolved(ticket.id)
    } catch {}
    setResolving(false)
  }

  const isResolved = ticket?.status === 'resolved'

  return (
    <Drawer
      open={!!ticket}
      onClose={onClose}
      width={780}
      title={ticket ? `Ticket ${ticket.complaint_ref}` : ''}
      subtitle={ticket ? `${ticket.customer_name} · ${ticket.phone ?? '—'}` : ''}
      headerRight={
        ticket && !isResolved ? (
          <Button variant="secondary" size="sm" onClick={handleResolve} disabled={resolving}>
            {resolving ? 'Resolving…' : 'Resolve'}
          </Button>
        ) : undefined
      }
    >
      {ticket && (
        <div className="fb-stack" style={{ gap: 16 }}>
          {control === 'human' && !isResolved && (
            <div className="fb-banner-paused">🔴 Bot paused — you&apos;re handling this</div>
          )}
          {(control === 'bot' || isResolved) && (
            <div className="fb-banner-resumed">✅ Bot resumed for this customer</div>
          )}

          {recentOrders.length > 0 && (
            <section>
              <SectionLabel>Recent orders</SectionLabel>
              <div className="fb-notes" style={{ marginTop: 6 }}>
                {recentOrders.map((o) => (
                  <div key={o.id} className="fb-row-between" style={{ fontSize: 13 }}>
                    <span className="mono fb-strong">{o.order_ref}</span>
                    <Badge tone={o.status}>{o.status}</Badge>
                    <span className="fb-muted">{fmt(o.created_at)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionLabel>Triggering message</SectionLabel>
            <div className="fb-card" style={{ padding: 12, background: 'var(--surface)', marginTop: 6, fontSize: 13 }}>
              {ticket.summary}
            </div>
          </section>

          <section>
            <SectionLabel>Conversation</SectionLabel>
            <div className="fb-chat" ref={scrollRef} style={{ maxHeight: 380, overflowY: 'auto' }}>
              {loading && <p className="fb-muted" style={{ padding: 16 }}>Loading…</p>}
              {!loading && messages.length === 0 && (
                <p className="fb-muted" style={{ padding: 16 }}>No messages yet.</p>
              )}
              {messages.map((m) => {
                const kind = bubbleRole(m)
                return (
                  <div key={m.id} className={`fb-bubble-row ${kind}`}>
                    <div className={`fb-bubble ${kind}`}>
                      {kind === 'bot' && <div className="fb-bubble-tag">Bot</div>}
                      {kind === 'agent' && <div className="fb-bubble-tag">You</div>}
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      <div className="fb-bubble-meta">
                        <span>{fmt(m.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {!isResolved && (
            <section>
              <div className="fb-note-input">
                <textarea
                  className="fb-textarea"
                  rows={2}
                  placeholder={control === 'human' ? 'Reply to the customer…' : 'Bot is handling this conversation'}
                  value={draft}
                  disabled={sending}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                <Button icon={Send} onClick={handleSend} disabled={sending || !draft.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
    </Drawer>
  )
}

// ── Main Tab ─────────────────────────────────────────────────────────────

export function ComplaintsTab() {
  const [tickets, setTickets] = useState<Complaint[]>([])
  const [filter, setFilter] = useState<'Open' | 'Resolved' | 'All'>('Open')
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Complaint | null>(null)

  const statusParam = filter === 'Open' ? 'open' : filter === 'Resolved' ? 'resolved' : 'all'

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/complaints?status=${statusParam}`)
      const data = await res.json()
      setTickets(data.complaints ?? [])
    } catch {}
    setLoading(false)
  }, [statusParam])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  function handleResolved(id: string) {
    setTickets((prev) => (filter === 'Open' ? prev.filter((t) => t.id !== id) : prev.map((t) => t.id === id ? { ...t, status: 'resolved' } : t)))
    setActive((prev) => prev && prev.id === id ? { ...prev, status: 'resolved' } : prev)
  }

  const open = tickets.filter((t) => t.status !== 'resolved').length
  const resolved = tickets.filter((t) => t.status === 'resolved').length

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Complaints</h1>
          <p className="fb-page-sub">{open} open · {resolved} resolved</p>
        </div>
        <PillNav items={['Open', 'Resolved', 'All']} value={filter} onChange={(v) => setFilter(v as typeof filter)} />
      </div>

      <Card pad={0}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>ID</th><th>Customer</th><th>Message</th>
                <th>Waiting</th><th>Status</th><th>Assigned</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }} className="fb-muted">Loading…</td></tr>
              )}
              {!loading && tickets.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }} className="fb-muted">No tickets.</td></tr>
              )}
              {tickets.map((c) => (
                <tr key={c.id} className="fb-row-click" onClick={() => setActive(c)}>
                  <td className="mono fb-strong">{c.complaint_ref}</td>
                  <td>
                    <div className="fb-strong">{c.customer_name}</div>
                    <div className="fb-muted mono" style={{ fontSize: 12 }}>{c.phone}</div>
                  </td>
                  <td
                    className="fb-muted"
                    style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {c.summary}
                  </td>
                  <td className="fb-muted">{c.status === 'resolved' ? '—' : timeWaiting(c.created_at)}</td>
                  <td>
                    <Badge tone={c.status} dot>{STATUS_LABEL[c.status]}</Badge>
                  </td>
                  <td>
                    {c.assigned_to && (
                      <Avatar initials={c.assigned_to} color={c.assigned_to === 'AP' ? '#7c6dfa' : '#3b82f6'} size={26} />
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="fb-actions">
                      <IconButton icon={Eye} title="Open chat" onClick={() => setActive(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <TicketDrawer ticket={active} onClose={() => setActive(null)} onResolved={handleResolved} />
    </div>
  )
}
