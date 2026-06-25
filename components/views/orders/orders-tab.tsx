'use client'
import { useState, useCallback } from 'react'
import { Eye, MessageCircle, Trash2, Download } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, PillNav } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import { OrderDrawer } from './order-drawer'
import { deleteOrdersAction } from '@/app/(dashboard)/orders/actions'
import { fmtNum } from '@/lib/constants'
import type { Order } from '@/types'

const STATUSES = ['All', 'pending', 'awaiting_payment', 'pending_verification', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']

function exportOrdersCsv(orders: Order[]) {
  const headers = ['Order #', 'Customer', 'Phone', 'Items', 'Subtotal', 'Delivery Fee', 'Total', 'Currency', 'Payment Method', 'Channel', 'Status', 'Delivery Address', 'Date']
  const rows = orders.map((o) => [
    o.order_ref,
    o.customer_name,
    o.customer_phone ?? o.phone ?? '',
    o.items.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ''} x${i.quantity}`).join('; '),
    o.subtotal,
    o.delivery_fee,
    o.total,
    o.currency ?? 'LKR',
    o.payment_method,
    o.channel,
    o.status,
    o.delivery_address ?? '',
    new Date(o.created_at).toLocaleDateString('en-GB'),
  ])
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function OrdersTab({ initialOrders }: { initialOrders: Order[] }) {
  const [status, setStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<Order | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

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
  const allChecked = rows.length > 0 && rows.every((o) => selected.has(o.id))

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        rows.forEach((o) => next.delete(o.id))
      } else {
        rows.forEach((o) => next.add(o.id))
      }
      return next
    })
  }, [rows, allChecked])

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} order(s)? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteOrdersAction(ids)
      setSelected(new Set())
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    const toExport = rows.filter((o) => selected.has(o.id))
    exportOrdersCsv(toExport.length > 0 ? toExport : rows)
  }

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

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="fb-filterbar" style={{ gap: 10, alignItems: 'center' }}>
          <span className="fb-strong" style={{ fontSize: 13 }}>
            {selected.size} selected
          </span>
          <Button variant="danger" size="sm" icon={Trash2} onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      )}

      {/* Table */}
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
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
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px 0' }} className="fb-muted">
                    {initialOrders.length === 0 ? 'No orders yet.' : 'No orders match your filter.'}
                  </td>
                </tr>
              )}
              {rows.map((o) => (
                <tr key={o.id} className="fb-row-click" onClick={() => setActive(o)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
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
