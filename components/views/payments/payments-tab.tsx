'use client'
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, PillNav, IconButton } from '@/components/ui/inputs'
import { PaymentReviewDrawer } from './payment-review-drawer'
import { fmtNum } from '@/lib/constants'
import type { UserRole } from '@/types'
import type { PaymentOrderRow } from '@/lib/db/payments'

const STATUS_FILTERS = [
  { key: 'pending_verification', label: 'Pending Verification' },
  { key: 'awaiting_payment', label: 'Awaiting Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting Payment',
  pending_verification: 'Pending Verification',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function PaymentsTab({
  initialOrders,
  userRole,
}: {
  initialOrders: PaymentOrderRow[]
  userRole: UserRole
}) {
  const [status, setStatus] = useState('pending_verification')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const rows = initialOrders.filter((o) => {
    if (status !== 'all' && o.status !== status) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        o.customer_name.toLowerCase().includes(q) ||
        o.order_ref.toLowerCase().includes(q) ||
        (o.customer_phone ?? '').includes(q)
      )
    }
    return true
  })

  const pendingCount = initialOrders.filter((o) => o.status === 'pending_verification').length

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Payments</h1>
          <p className="fb-page-sub">
            {initialOrders.length} total &middot; {pendingCount} pending verification
          </p>
        </div>
      </div>

      <div className="fb-filterbar">
        <PillNav items={STATUS_FILTERS} value={status} onChange={setStatus} />
        <div style={{ flex: 1 }} />
        <Input
          placeholder="Search orders..."
          value={search}
          onChange={setSearch}
          style={{ width: 220 }}
        />
      </div>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th className="num">Total</th>
                <th>Waiting</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 0' }} className="fb-muted">
                    No orders match this filter.
                  </td>
                </tr>
              )}
              {rows.map((o) => (
                <tr key={o.id} className="fb-row-click" onClick={() => setActiveId(o.id)}>
                  <td className="mono fb-strong">{o.order_ref}</td>
                  <td>
                    <div>{o.customer_name}</div>
                    {(o.customer_phone ?? o.phone) && (
                      <div className="fb-muted mono" style={{ fontSize: 12 }}>
                        {o.customer_phone ?? o.phone}
                      </div>
                    )}
                  </td>
                  <td className="num mono fb-strong">
                    {o.currency ?? 'LKR'} {fmtNum(o.total)}
                  </td>
                  <td className="fb-muted">{timeAgo(o.created_at)}</td>
                  <td>
                    <Badge tone={o.status} dot>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <IconButton icon={Eye} title="Review" onClick={() => setActiveId(o.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PaymentReviewDrawer
        orderId={activeId}
        userRole={userRole}
        onClose={() => setActiveId(null)}
      />
    </div>
  )
}
