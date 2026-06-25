'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import { MapPin, CheckCircle, XCircle, Clock, Upload, ShieldCheck } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/inputs'
import { useCurrency } from '@/components/layout/currency-provider'
import { decidePaymentAction } from '@/app/(dashboard)/payments/actions'
import type { PaymentOrder, AuditLog, UserRole } from '@/types'

const AUDIT_ICONS: Record<string, typeof Clock> = {
  order_placed: Clock,
  proof_uploaded: Upload,
  payment_approved: CheckCircle,
  payment_rejected: XCircle,
}

const AUDIT_LABELS: Record<string, string> = {
  order_placed: 'Order placed',
  proof_uploaded: 'Payment proof uploaded',
  payment_approved: 'Payment approved',
  payment_rejected: 'Payment rejected',
}

function ProofViewer({ url, mimeType }: { url: string; mimeType: string }) {
  if (mimeType.startsWith('image/')) {
    return (
      <div style={{ position: 'relative', cursor: 'zoom-in' }}>
        <img
          src={url}
          alt="Payment proof"
          style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
          onClick={() => window.open(url, '_blank')}
        />
        <div className="fb-muted" style={{ fontSize: 12, marginTop: 4 }}>
          Click to open full size
        </div>
      </div>
    )
  }

  if (mimeType === 'application/pdf') {
    return (
      <div>
        <iframe
          src={url}
          style={{ width: '100%', height: 400, borderRadius: 8, border: '1px solid var(--border)' }}
          title="Payment proof PDF"
        />
        <div style={{ marginTop: 6 }}>
          <a href={url} target="_blank" rel="noreferrer" className="fb-muted" style={{ fontSize: 13 }}>
            Download PDF
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="fb-muted">
      <a href={url} target="_blank" rel="noreferrer">Download proof ({mimeType})</a>
    </div>
  )
}

function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return <div className="fb-muted">No audit history yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {logs.map((log) => {
        const Icon = AUDIT_ICONS[log.action] ?? Clock
        const label = AUDIT_LABELS[log.action] ?? log.action
        return (
          <div key={log.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface)', border: '1px solid var(--border)', flexShrink: 0,
            }}>
              <Icon size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fb-strong" style={{ fontSize: 13 }}>{label}</div>
              {'reason' in log.meta && typeof log.meta.reason === 'string' && log.meta.reason !== '' && (
                <div className="fb-muted" style={{ fontSize: 12 }}>
                  Reason: {log.meta.reason as string}
                </div>
              )}
              <div className="fb-muted" style={{ fontSize: 12 }}>
                {new Date(log.created_at).toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function PaymentReviewDrawer({
  orderId,
  userRole,
  onClose,
}: {
  orderId: string | null
  userRole: UserRole
  onClose: () => void
}) {
  const { fmt } = useCurrency()
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showApprove, setShowApprove] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDecide = userRole === 'Owner' || userRole === 'Admin'
  const isDecided = order?.status === 'confirmed' || order?.status === 'cancelled'

  const fetchOrder = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/payments/${id}`)
      if (!res.ok) throw new Error('Failed to load order')
      const data = await res.json()
      setOrder(data)
    } catch {
      setError('Failed to load order details')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId)
    } else {
      setOrder(null)
      setError(null)
    }
  }, [orderId, fetchOrder])

  function handleDecision(decision: 'approve' | 'reject', reason?: string) {
    if (!order) return
    startTransition(async () => {
      const result = await decidePaymentAction(order.id, decision, reason)
      if (!result.ok) {
        setError(result.error ?? 'Action failed')
        if (result.error?.includes('already made')) {
          fetchOrder(order.id)
        }
        return
      }
      setShowApprove(false)
      setShowReject(false)
      setRejectReason('')
      fetchOrder(order.id)
    })
  }

  return (
    <>
      <Drawer
        open={!!orderId}
        onClose={onClose}
        width={720}
        subtitle={order ? `Order ${order.order_ref}` : ''}
        title={order ? order.customer_name : 'Loading...'}
        headerRight={
          order ? (
            <Badge tone={order.status} dot>
              {order.status === 'pending_verification' ? 'Pending Verification'
                : order.status === 'awaiting_payment' ? 'Awaiting Payment'
                : order.status[0].toUpperCase() + order.status.slice(1)}
            </Badge>
          ) : undefined
        }
      >
        {loading && <div className="fb-muted" style={{ padding: 32, textAlign: 'center' }}>Loading...</div>}
        {error && <div style={{ padding: 16, color: '#ef4444' }}>{error}</div>}
        {order && !loading && (
          <div className="fb-stack" style={{ gap: 22 }}>
            {/* Decision buttons */}
            {!isDecided && (
              <section style={{ display: 'flex', gap: 10 }}>
                <Button
                  variant="primary"
                  icon={CheckCircle}
                  onClick={() => setShowApprove(true)}
                  disabled={isPending || !canDecide}
                  style={{ flex: 1 }}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  icon={XCircle}
                  onClick={() => setShowReject(true)}
                  disabled={isPending || !canDecide}
                  style={{ flex: 1 }}
                >
                  Reject
                </Button>
                {!canDecide && (
                  <div className="fb-muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                    Only Owner/Admin can approve or reject
                  </div>
                )}
              </section>
            )}

            {isDecided && (
              <section className="fb-panel">
                <div className="fb-panel-icon" style={{
                  background: order.status === 'confirmed' ? '#22c55e18' : '#ef444418',
                  color: order.status === 'confirmed' ? '#22c55e' : '#ef4444',
                }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="fb-strong">
                    Payment {order.status === 'confirmed' ? 'Approved' : 'Rejected'}
                  </div>
                  <div className="fb-muted" style={{ fontSize: 13 }}>
                    This order has already been decided.
                  </div>
                </div>
              </section>
            )}

            {/* Payment reference block */}
            <section>
              <SectionLabel>Payment Reference</SectionLabel>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8,
              }}>
                <div style={{
                  padding: 12, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}>
                  <div className="fb-muted" style={{ fontSize: 11, marginBottom: 4 }}>
                    Order Reference (told to customer)
                  </div>
                  <div className="mono fb-strong" style={{ fontSize: 15 }}>{order.order_ref}</div>
                </div>
                <div style={{
                  padding: 12, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}>
                  <div className="fb-muted" style={{ fontSize: 11, marginBottom: 4 }}>
                    Customer Entered Reference
                  </div>
                  <div className="mono fb-strong" style={{
                    fontSize: 15,
                    color: order.payment_proof?.customer_reference
                      && order.payment_proof.customer_reference !== order.order_ref
                      ? '#f5a623' : undefined,
                  }}>
                    {order.payment_proof?.customer_reference ?? '—'}
                  </div>
                </div>
              </div>
            </section>

            {/* Proof viewer */}
            <section>
              <SectionLabel>Payment Proof</SectionLabel>
              <div style={{ marginTop: 8 }}>
                {order.signed_proof_url ? (
                  <ProofViewer
                    url={order.signed_proof_url}
                    mimeType={order.payment_proof?.mime_type ?? 'application/octet-stream'}
                  />
                ) : (
                  <div className="fb-muted" style={{
                    padding: 24, textAlign: 'center', borderRadius: 8,
                    border: '1px dashed var(--border)',
                  }}>
                    No payment proof uploaded yet
                  </div>
                )}
              </div>
            </section>

            {/* Order summary */}
            <section>
              <SectionLabel>Order Items</SectionLabel>
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
              <div className="fb-totals">
                <div><span>Subtotal</span><span className="mono">{fmt(order.subtotal)}</span></div>
                <div><span>Delivery</span><span className="mono">{order.delivery_fee ? fmt(order.delivery_fee) : 'Free'}</span></div>
                <div className="fb-total-row"><span>Total</span><span className="mono">{fmt(order.total)}</span></div>
              </div>
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
                {order.contact_number && (
                  <div className="fb-kv"><span>Contact</span><b className="mono">{order.contact_number}</b></div>
                )}
                <div className="fb-kv">
                  <span>Payment</span>
                  <b><Badge tone="gray" outline>{order.payment_method}</Badge></b>
                </div>
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

            {/* Audit timeline */}
            <section>
              <SectionLabel>Audit History</SectionLabel>
              <div style={{ marginTop: 8 }}>
                <AuditTimeline logs={order.audit_logs ?? []} />
              </div>
            </section>
          </div>
        )}
      </Drawer>

      {/* Approve confirmation */}
      <Modal open={showApprove} onClose={() => setShowApprove(false)} title="Approve Payment">
        <div className="fb-stack" style={{ gap: 16 }}>
          <p>Confirm that you have verified the payment proof for <b>{order?.order_ref}</b> and want to approve this order?</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowApprove(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={CheckCircle}
              onClick={() => handleDecision('approve')}
              disabled={isPending}
            >
              {isPending ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject confirmation */}
      <Modal open={showReject} onClose={() => { setShowReject(false); setRejectReason('') }} title="Reject Payment">
        <div className="fb-stack" style={{ gap: 16 }}>
          <p>Reject payment for <b>{order?.order_ref}</b>? The customer will be notified.</p>
          <Textarea
            value={rejectReason}
            onChange={setRejectReason}
            placeholder="Reason for rejection (optional — sent to customer)"
            rows={3}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setShowReject(false); setRejectReason('') }}>Cancel</Button>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={() => handleDecision('reject', rejectReason || undefined)}
              disabled={isPending}
            >
              {isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
