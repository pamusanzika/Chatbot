'use client'
import { useState, useTransition } from 'react'
import { Truck, MapPin, Phone } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/card'
import { useCurrency } from '@/components/layout/currency-provider'
import { updateOrderStatusAction } from '@/app/(dashboard)/orders/actions'
import type { Order, OrderStatus } from '@/types'

const ALL_STATUSES: OrderStatus[] = ['pending', 'awaiting_payment', 'pending_verification', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']

const LANG_LABELS: Record<string, string> = {
  EN: '🇬🇧 English',
  SI: '🇱🇰 Sinhala',
  TA: '🇱🇰 Tamil',
  SL: '💬 Singlish',
}

export function OrderDrawer({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { fmt } = useCurrency()
  const [isPending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState<OrderStatus | null>(null)

  const currentStatus = (localStatus ?? order?.status ?? 'pending') as OrderStatus

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as OrderStatus
    if (!order) return
    setLocalStatus(next)
    startTransition(async () => {
      await updateOrderStatusAction(order.id, next)
    })
  }

  return (
    <Drawer
      open={!!order}
      onClose={() => {
        setLocalStatus(null)
        onClose()
      }}
      width={720}
      subtitle={order ? `Order ${order.order_ref}` : ''}
      title={order ? order.customer_name : ''}
      headerRight={
        order ? (
          <>
            <Badge tone={currentStatus} dot>
              {currentStatus[0].toUpperCase() + currentStatus.slice(1)}
            </Badge>
            <Button variant="secondary" size="sm">Message</Button>
          </>
        ) : undefined
      }
    >
      {order && (
        <div className="fb-stack" style={{ gap: 22 }}>
          {/* Status update */}
          <section>
            <SectionLabel>Update Status</SectionLabel>
            <select
              value={currentStatus}
              onChange={handleStatusChange}
              disabled={isPending}
              style={{
                marginTop: 8,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </section>

          {/* Customer details */}
          <section>
            <SectionLabel>Customer</SectionLabel>
            <div className="fb-kv-grid">
              <div className="fb-kv"><span>Name</span><b>{order.customer_name}</b></div>
              {(order.customer_phone ?? order.phone) && (
                <div className="fb-kv">
                  <span>Phone</span>
                  <b className="mono">{order.customer_phone ?? order.phone}</b>
                </div>
              )}
              {order.contact_number && order.contact_number !== (order.customer_phone ?? order.phone) && (
                <div className="fb-kv"><span>Contact</span><b className="mono">{order.contact_number}</b></div>
              )}
              {order.language && (
                <div className="fb-kv">
                  <span>Language</span>
                  <b>{LANG_LABELS[order.language] ?? order.language}</b>
                </div>
              )}
              <div className="fb-kv">
                <span>Payment</span>
                <b><Badge tone="gray" outline>{order.payment_method}</Badge></b>
              </div>
              {order.currency && (
                <div className="fb-kv"><span>Currency</span><b>{order.currency}</b></div>
              )}
            </div>
          </section>

          {/* Delivery address */}
          {order.delivery_address && (
            <section className="fb-panel">
              <div className="fb-panel-icon" style={{ background: '#7c6dfa18', color: '#7c6dfa' }}>
                <MapPin size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <SectionLabel>Delivery Address</SectionLabel>
                <div className="fb-strong" style={{ marginTop: 4 }}>{order.delivery_address}</div>
              </div>
            </section>
          )}

          {/* Legacy delivery zone (dashboard-created orders) */}
          {order.delivery_zone && (
            <section className="fb-panel">
              <div className="fb-panel-icon" style={{ background: '#7c6dfa18', color: '#7c6dfa' }}>
                <Truck size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <SectionLabel>Delivery Zone</SectionLabel>
                <div className="fb-strong" style={{ marginTop: 4 }}>{order.delivery_zone}</div>
                {order.estimated_days && (
                  <div className="fb-muted" style={{ fontSize: 13 }}>
                    Estimated <b className="mono">{order.estimated_days}</b> working days
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Items */}
          <section>
            <SectionLabel>Items</SectionLabel>
            <div className="fb-items">
              {order.items.map((it, i) => (
                <div className="fb-item-row" key={i}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fb-strong">
                      {it.name}
                      {it.variant && (
                        <span className="fb-muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                          — {it.variant}
                        </span>
                      )}
                      {it.price_unverified && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            color: '#f5a623',
                            background: '#f5a62320',
                            padding: '1px 6px',
                            borderRadius: 4,
                          }}
                        >
                          unverified price
                        </span>
                      )}
                    </div>
                    <div className="fb-muted mono" style={{ fontSize: 12 }}>
                      {it.quantity} × {fmt(it.unit_price)}
                    </div>
                  </div>
                  <div className="mono fb-strong" style={{ flexShrink: 0 }}>
                    {fmt(it.line_total)}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="fb-totals">
              <div>
                <span>Subtotal</span>
                <span className="mono">{fmt(order.subtotal)}</span>
              </div>
              <div>
                <span>Delivery</span>
                <span className="mono">{order.delivery_fee ? fmt(order.delivery_fee) : 'Free'}</span>
              </div>
              <div className="fb-total-row">
                <span>Total</span>
                <span className="mono">{fmt(order.total)}</span>
              </div>
            </div>
          </section>

          {/* Channel + timestamps */}
          <section>
            <SectionLabel>Meta</SectionLabel>
            <div className="fb-kv-grid">
              <div className="fb-kv"><span>Channel</span><b style={{ textTransform: 'capitalize' }}>{order.channel}</b></div>
              {order.session_id && (
                <div className="fb-kv"><span>Session</span><b className="mono" style={{ fontSize: 12 }}>{order.session_id}</b></div>
              )}
              <div className="fb-kv">
                <span>Created</span>
                <b>{new Date(order.created_at).toLocaleString('en-GB')}</b>
              </div>
              <div className="fb-kv">
                <span>Updated</span>
                <b>{new Date(order.updated_at).toLocaleString('en-GB')}</b>
              </div>
            </div>
          </section>

          {/* Payment slip */}
          {order.payment_slip_url && (
            <section>
              <SectionLabel>Payment Slip</SectionLabel>
              <div className="fb-muted" style={{ fontSize: 13 }}>
                <a href={order.payment_slip_url} target="_blank" rel="noreferrer">
                  View slip ↗
                </a>
              </div>
            </section>
          )}
        </div>
      )}
    </Drawer>
  )
}
