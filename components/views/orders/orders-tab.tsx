'use client'
import { useState } from 'react'
import { Eye, MessageCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, PillNav } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import { OrderDrawer } from './order-drawer'
import { fmtNum } from '@/lib/constants'
import type { Order, OrderStatus } from '@/types'

const STATUSES = ['All', 'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']

export function OrdersTab({ initialOrders }: { initialOrders: Order[] }) {
  const [status, setStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<Order | null>(null)

  const rows = initialOrders.filter((o) => {
    if (status !== 'All' && o.status !== status) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        o.customer_name.toLowerCase().includes(q) ||
        o.order_ref.toLowerCase().includes(q) ||
        (o.customer_phone ?? '').includes(q) ||
        (o.phone ?? '').includes(q)
      )
    }
    return true
  })

  const pending = initialOrders.filter((o) => o.status === 'pending').length

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Orders</h1>
          <p className="fb-page-sub">
            {initialOrders.length} orders · {pending} pending
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="fb-filterbar">
        <PillNav
          items={STATUSES.map((s) => ({
            key: s,
            label: s === 'All' ? 'All' : s[0].toUpperCase() + s.slice(1),
          }))}
          value={status}
          onChange={setStatus}
        />
        <div style={{ flex: 1 }} />
        <Input
          icon={undefined}
          placeholder="Search orders…"
          value={search}
          onChange={setSearch}
          style={{ width: 220 }}
        />
      </div>

      {/* Table */}
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="num">Total</th>
                <th>Payment</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0' }} className="fb-muted">
                    {initialOrders.length === 0 ? 'No orders yet.' : 'No orders match your filter.'}
                  </td>
                </tr>
              )}
              {rows.map((o) => (
                <tr key={o.id} className="fb-row-click" onClick={() => setActive(o)}>
                  <td className="mono fb-strong">{o.order_ref}</td>
                  <td>
                    <div>{o.customer_name}</div>
                    {(o.customer_phone ?? o.phone) && (
                      <div className="fb-muted mono" style={{ fontSize: 12 }}>
                        {o.customer_phone ?? o.phone}
                      </div>
                    )}
                  </td>
                  <td className="fb-muted">
                    {o.items[0]?.name}
                    {o.items.length > 1 && (
                      <span style={{ marginLeft: 4 }}>+{o.items.length - 1}</span>
                    )}
                  </td>
                  <td className="num mono fb-strong">
                    {o.currency ?? 'LKR'} {fmtNum(o.total)}
                  </td>
                  <td>
                    <Badge tone="gray" outline>
                      {o.payment_method}
                    </Badge>
                  </td>
                  <td className="fb-muted" style={{ textTransform: 'capitalize' }}>
                    {o.channel}
                  </td>
                  <td>
                    <Badge tone={o.status} dot>
                      {o.status[0].toUpperCase() + o.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="fb-muted">
                    {new Date(o.created_at).toLocaleDateString('en-GB', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="fb-actions">
                      {(o.phone ?? o.customer_phone) && (
                        <IconButton
                          icon={MessageCircle}
                          tone="#25d366"
                          title="WhatsApp"
                          onClick={() =>
                            window.open(
                              `https://wa.me/${(o.phone ?? o.customer_phone ?? '').replace(/\D/g, '')}`,
                              '_blank'
                            )
                          }
                        />
                      )}
                      <IconButton icon={Eye} title="View" onClick={() => setActive(o)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <OrderDrawer order={active} onClose={() => setActive(null)} />
    </div>
  )
}
