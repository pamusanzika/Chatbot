'use client'
import { useState, useEffect, useCallback } from 'react'
import { Eye, Trash2 } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge, LangBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import { Drawer } from '@/components/ui/drawer'
import type { ChatSession, ChatMessage, ChatStats, Lang } from '@/types'

const INTENT_TONE: Record<string, string> = {
  Order: 'purple', Delivery: 'teal', Stock: 'amber', Complaint: 'amber', Handoff: 'red', Other: 'gray',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

function renderMessageContent(content: string) {
  const urlRegex = /(https?:\/\/\S+)/gi
  const parts = content.split(urlRegex)
  urlRegex.lastIndex = 0

  return parts.map((part, i) => {
    if (!/^https?:\/\//i.test(part)) {
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
    }

    const isImage =
      /\.(jpg|jpeg|png|webp|gif|svg)/i.test(part) ||
      /supabase\.co\/storage\/v1\/object\/public\//i.test(part)

    if (isImage) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          <img
            src={part}
            alt="Product image"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            style={{
              maxWidth: '200px',
              maxHeight: '200px',
              borderRadius: '8px',
              display: 'block',
              marginTop: '6px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          />
        </a>
      )
    }

    return (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--accent)', wordBreak: 'break-all' }}
      >
        {part}
      </a>
    )
  })
}

// ── Chat Drawer ──────────────────────────────────────────────────────────────

function ChatDrawer({
  session,
  onClose,
  onFlagChange,
}: {
  session: ChatSession | null
  onClose: () => void
  onFlagChange: (sessionId: string, flagged: boolean) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [flagging, setFlagging] = useState(false)

  useEffect(() => {
    if (!session) { setMessages([]); return }
    setFlagNote(session.flag_note ?? '')
    setLoading(true)
    fetch(`/api/chat-logs/sessions/${session.session_id}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [session?.session_id])

  async function handleFlag() {
    if (!session) return
    setFlagging(true)
    const next = !session.flagged
    await fetch(`/api/chat-logs/sessions/${session.session_id}/flag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagged: next, flag_note: flagNote }),
    })
    onFlagChange(session.session_id, next)
    setFlagging(false)
  }

  return (
    <Drawer
      open={!!session}
      onClose={onClose}
      title={session ? `Session ${session.session_id}` : ''}
      subtitle={session?.phone}
      headerRight={
        session ? (
          <Button variant={session.flagged ? 'danger' : 'secondary'} size="sm" onClick={handleFlag} disabled={flagging}>
            {session.flagged ? 'Unflag' : 'Flag'}
          </Button>
        ) : undefined
      }
    >
      {session?.flagged && (
        <div style={{ padding: '8px 0 12px' }}>
          <Input
            placeholder="Flag note (optional)"
            value={flagNote}
            onChange={setFlagNote}
          />
        </div>
      )}
      <div className="fb-chat">
        {loading && <p className="fb-muted" style={{ padding: 16 }}>Loading…</p>}
        {!loading && messages.length === 0 && (
          <p className="fb-muted" style={{ padding: 16 }}>No messages.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`fb-bubble-row ${m.role}`}>
            <div className={`fb-bubble ${m.role}`}>
              <div>{renderMessageContent(m.content)}</div>
              <div className="fb-bubble-meta">
                {m.language && <LangBadge code={m.language as Lang} />}
                <span>{fmt(m.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  )
}

// ── Main Tab ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export function ChatLogsTab() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [stats, setStats] = useState<ChatStats | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState('')
  const [flagFilter, setFlagFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ChatSession | null>(null)

  const fetchSessions = useCallback(async (p: number) => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p) })
    if (search) qs.set('search', search)
    if (langFilter) qs.set('language', langFilter)
    if (flagFilter) qs.set('flagged', flagFilter)

    const res = await fetch(`/api/chat-logs/sessions?${qs}`)
    const data = await res.json()
    setSessions(data.sessions ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setLoading(false)
  }, [search, langFilter, flagFilter])

  useEffect(() => { setPage(1) }, [search, langFilter, flagFilter])
  useEffect(() => { fetchSessions(page) }, [page, fetchSessions])

  useEffect(() => {
    fetch('/api/chat-logs/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  function handleFlagChange(sessionId: string, flagged: boolean) {
    setSessions((prev) =>
      prev.map((s) => (s.session_id === sessionId ? { ...s, flagged } : s))
    )
    if (active?.session_id === sessionId) setActive((s) => s ? { ...s, flagged } : s)
    setStats((prev) => prev ? { ...prev, flaggedCount: prev.flaggedCount + (flagged ? 1 : -1) } : prev)
  }

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      {/* Header */}
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Chat Logs</h1>
          <p className="fb-page-sub">
            {stats ? `${stats.totalSessions} sessions this month · ${stats.flaggedCount} flagged` : 'Loading…'}
          </p>
        </div>
        <div className="fb-row" style={{ gap: 8 }}>
          <Input placeholder="Search phone…" value={search} onChange={setSearch} style={{ width: 180 }} />
          <select
            className="fb-select"
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
          >
            <option value="">All Languages</option>
            <option value="EN">EN</option>
            <option value="SI">SI</option>
            <option value="TA">TA</option>
            <option value="SL">SL</option>
          </select>
          <select
            className="fb-select"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Flagged</option>
            <option value="false">Not Flagged</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <Card pad={0}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Phone</th>
                <th className="num">Messages</th>
                <th>Lang</th>
                <th>Intent</th>
                <th>Last Message</th>
                <th>Flag</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }} className="fb-muted">Loading…</td></tr>
              )}
              {!loading && sessions.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }} className="fb-muted">No sessions found.</td></tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} className="fb-row-click" onClick={() => setActive(s)}>
                  <td className="mono fb-strong" style={{ fontSize: 12 }}>{s.session_id}</td>
                  <td className="mono fb-muted" style={{ fontSize: 13 }}>{s.phone}</td>
                  <td className="num mono">{s.message_count}</td>
                  <td>{s.language ? <LangBadge code={s.language as Lang} /> : <span className="fb-muted">—</span>}</td>
                  <td>
                    {s.intent
                      ? <Badge tone={INTENT_TONE[s.intent] ?? 'gray'}>{s.intent}</Badge>
                      : <span className="fb-muted">—</span>}
                  </td>
                  <td className="fb-muted">{fmt(s.last_message_at)}</td>
                  <td>
                    {s.flagged
                      ? <Badge tone="red" dot>Flagged</Badge>
                      : <span className="fb-muted">—</span>}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="fb-actions">
                      <IconButton icon={Eye} title="View" onClick={() => setActive(s)} />
                      <IconButton
                        icon={Trash2}
                        tone="#ef4444"
                        title="Delete session"
                        onClick={async () => {
                          if (!confirm('Delete this chat session and all its messages? This cannot be undone.')) return
                          await fetch(`/api/chat-logs/sessions/${s.session_id}`, { method: 'DELETE' })
                          setSessions((prev) => prev.filter((x) => x.session_id !== s.session_id))
                          setTotal((t) => t - 1)
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="fb-row" style={{ justifyContent: 'center', gap: 8, padding: '12px 0' }}>
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="fb-muted" style={{ lineHeight: '30px', fontSize: 13 }}>
              {page} / {totalPages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>

      <ChatDrawer session={active} onClose={() => setActive(null)} onFlagChange={handleFlagChange} />
    </div>
  )
}
