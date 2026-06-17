'use client'
import { useState } from 'react'
import { Eye, MessageCircle } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge, LangBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import { Avatar } from '@/components/ui/avatar'
import { Drawer } from '@/components/ui/drawer'
import { fmtNum, LANG_META, STATUS_COLORS } from '@/lib/constants'
import { useCurrency } from '@/components/layout/currency-provider'
import type { Customer, ChatMessage, Lang, Order } from '@/types'

const CUSTOMERS: Customer[] = []
const ORDERS: Order[] = []
const ORDER_THREAD: ChatMessage[] = []

function CustomerDrawer({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { fmt } = useCurrency()
  if (!customer) return null
  const initials = customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
  const color = LANG_META[customer.language]?.color ?? '#7c6dfa'
  const orders = ORDERS.slice(0, 3)

  return (
    <Drawer
      open={!!customer}
      onClose={onClose}
      title={customer.name}
      subtitle="Customer profile"
      headerRight={<Button variant="secondary" size="sm">Send WA</Button>}
    >
      <div className="fb-stack" style={{ gap: 22 }}>
        {/* Profile header */}
        <div className="fb-profile-top" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar initials={initials} color={color} size={56} />
          <div>
            <div className="fb-card-title">{customer.name}</div>
            <div className="fb-muted mono">{customer.phone}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="fb-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Lifetime Value</div>
            <div className="mono fb-strong" style={{ fontSize: 22 }}>{fmt(customer.total_spent)}</div>
          </div>
        </div>

        {/* Orders */}
        <section>
          <SectionLabel>Orders ({customer.total_orders})</SectionLabel>
          <div className="fb-items" style={{ marginTop: 10 }}>
            {orders.map((o) => (
              <div className="fb-item-row" key={o.id}>
                <span className="mono fb-strong" style={{ minWidth: 80 }}>{o.order_ref}</span>
                <div style={{ flex: 1, minWidth: 0 }} className="fb-muted fb-truncate">
                  {o.items[0]?.name}
                </div>
                <span className="mono fb-strong" style={{ flexShrink: 0 }}>{fmt(o.total)}</span>
                <Badge tone={o.status}>{o.status[0].toUpperCase() + o.status.slice(1)}</Badge>
              </div>
            ))}
          </div>
        </section>

        {/* Chat history */}
        <section>
          <SectionLabel>Recent chat</SectionLabel>
          <div className="fb-chat">
            {ORDER_THREAD.slice(0, 3).map((m, i) => (
              <div key={i} className={`fb-bubble-row ${m.role}`}>
                <div className={`fb-bubble ${m.role}`}>
                  <div>{m.content}</div>
                  <div className="fb-bubble-meta"><span>{m.created_at}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Drawer>
  )
}

export function CustomersTab() {
  const { fmt } = useCurrency()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<Customer | null>(null)

  const rows = CUSTOMERS.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Customers</h1>
          <p className="fb-page-sub">{CUSTOMERS.length} active customers</p>
        </div>
        <Input placeholder="Search customers…" value={search} onChange={setSearch} style={{ width: 220 }} />
      </div>

      <Card pad={0}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>Customer</th><th>Phone</th><th className="num">Orders</th>
                <th className="num">Lifetime value</th><th>Last order</th><th>Lang</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const initials = c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
                const color = LANG_META[c.language]?.color ?? '#7c6dfa'
                return (
                  <tr key={c.id} className="fb-row-click" onClick={() => setActive(c)}>
                    <td>
                      <div className="fb-user-cell">
                        <Avatar initials={initials} color={color} />
                        <span className="fb-strong">{c.name}</span>
                      </div>
                    </td>
                    <td className="mono fb-muted" style={{ fontSize: 13 }}>{c.phone}</td>
                    <td className="num mono">{c.total_orders}</td>
                    <td className="num mono fb-strong">{fmt(c.total_spent)}</td>
                    <td className="fb-muted">{c.last_order_at?.slice(5, 10).replace('-', ' ')}</td>
                    <td><LangBadge code={c.language as Lang} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="fb-actions">
                        <IconButton icon={MessageCircle} tone="#25d366" title="WhatsApp" />
                        <IconButton icon={Eye} title="View" onClick={() => setActive(c)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <CustomerDrawer customer={active} onClose={() => setActive(null)} />
    </div>
  )
}
