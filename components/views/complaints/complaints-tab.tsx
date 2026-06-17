'use client'
import { useState } from 'react'
import { Eye, Plus } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/inputs'
import { Input } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import { Avatar } from '@/components/ui/avatar'
import { Drawer } from '@/components/ui/drawer'
import { STATUS_COLORS } from '@/lib/constants'
import type { Complaint } from '@/types'

const COMPLAINTS: Complaint[] = []

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', progress: 'In Progress', resolved: 'Resolved',
}

function ComplaintDrawer({ complaint, onClose }: { complaint: Complaint | null; onClose: () => void }) {
  const [note, setNote] = useState('')

  return (
    <Drawer
      open={!!complaint}
      onClose={onClose}
      title={complaint ? `Complaint ${complaint.complaint_ref}` : ''}
      subtitle={complaint?.customer_name}
      headerRight={
        complaint ? (
          <Select
            value={STATUS_LABEL[complaint.status] ?? 'Open'}
            options={['Open', 'In Progress', 'Resolved']}
            style={{ width: 140 }}
          />
        ) : undefined
      }
    >
      {complaint && (
        <div className="fb-stack" style={{ gap: 20 }}>
          {/* Detail */}
          <section>
            <SectionLabel>Detail</SectionLabel>
            <div className="fb-card fb-stack" style={{ padding: 16, background: 'var(--surface)', marginTop: 8 }}>
              <div className="fb-strong" style={{ marginBottom: 4 }}>{complaint.customer_name}</div>
              <div>{complaint.summary}</div>
            </div>
          </section>

          {/* Internal notes */}
          <section>
            <SectionLabel>Internal notes</SectionLabel>
            <div className="fb-notes">
              {complaint.notes.map((n, i) => (
                <div className="fb-note" key={i}>
                  <Avatar initials={n.author} color="#3b82f6" size={26} />
                  <div>
                    <div className="fb-strong" style={{ fontSize: 13 }}>
                      {n.author} · {n.created_at}
                    </div>
                    <div>{n.text}</div>
                  </div>
                </div>
              ))}
              {complaint.notes.length === 0 && (
                <div className="fb-muted" style={{ fontSize: 13 }}>No notes yet.</div>
              )}
            </div>
            <div className="fb-note-input">
              <Input full placeholder="Add a note…" value={note} onChange={setNote} />
              <Button size="sm">Add</Button>
            </div>
          </section>

          {/* WA reply */}
          <section>
            <SectionLabel>Reply via WhatsApp</SectionLabel>
            <textarea className="fb-textarea" rows={3} placeholder="Type your reply to the customer…" />
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary">Send WA reply</Button>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  )
}

export function ComplaintsTab() {
  const [active, setActive] = useState<Complaint | null>(null)
  const open = COMPLAINTS.filter((c) => c.status !== 'resolved').length
  const resolved = COMPLAINTS.filter((c) => c.status === 'resolved').length

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Complaints</h1>
          <p className="fb-page-sub">{open} open · {resolved} resolved</p>
        </div>
      </div>

      <Card pad={0}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>ID</th><th>Customer</th><th>Summary</th>
                <th>Status</th><th>Assigned</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {COMPLAINTS.map((c) => (
                <tr key={c.id} className="fb-row-click" onClick={() => setActive(c)}>
                  <td className="mono fb-strong">{c.complaint_ref}</td>
                  <td>{c.customer_name}</td>
                  <td
                    className="fb-muted"
                    style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {c.summary}
                  </td>
                  <td>
                    <Badge tone={c.status} dot>{STATUS_LABEL[c.status]}</Badge>
                  </td>
                  <td>
                    {c.assigned_to && (
                      <Avatar
                        initials={c.assigned_to}
                        color={c.assigned_to === 'AP' ? '#7c6dfa' : '#3b82f6'}
                        size={26}
                      />
                    )}
                  </td>
                  <td className="fb-muted">{c.created_at.slice(5)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="fb-actions">
                      <IconButton icon={Eye} title="View" onClick={() => setActive(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ComplaintDrawer complaint={active} onClose={() => setActive(null)} />
    </div>
  )
}
