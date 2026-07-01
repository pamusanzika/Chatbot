'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { Card, SectionLabel } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PillNav, Input } from '@/components/ui/inputs'
import { fmtNum } from '@/lib/constants'
import { useCurrency } from '@/components/layout/currency-provider'
import type { Usage, ChatIntent } from '@/types'

type AnalyticsRange = 'this_month' | 'last_month' | 'custom'

const RANGE_ITEMS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
]

interface AnalyticsTabProps {
  msgVolume: { d: string; EN: number; SI: number; TA: number; SL: number }[]
  intentBreakdown: { key: ChatIntent; pct: number; color: string }[]
  conversionData: { d: string; rate: number }[]
  topQuestions: { q: string; n: number }[]
  deliveryByZone: { p: string; n: number }[]
  stockMovement: { name: string; units: number; rev: number }[]
  usage: Usage | null
  totalMsgs: number
  avgConversion: number
  ordersViaBot: number
  activeCustomers: number
  currency: string
  range: AnalyticsRange
  from?: string
  to?: string
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

export function AnalyticsTab({
  msgVolume, intentBreakdown, conversionData, topQuestions, deliveryByZone,
  stockMovement, usage, totalMsgs, avgConversion, ordersViaBot, activeCustomers,
  range, from, to,
}: AnalyticsTabProps) {
  const { fmt } = useCurrency()
  const router = useRouter()
  const [selectedRange, setSelectedRange] = useState<AnalyticsRange>(range)
  const [customFrom, setCustomFrom] = useState(from ?? '')
  const [customTo, setCustomTo] = useState(to ?? '')

  function applyRange(key: string) {
    setSelectedRange(key as AnalyticsRange)
    if (key === 'custom') return
    router.push(`/analytics?range=${key}`)
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return
    router.push(`/analytics?range=custom&from=${customFrom}&to=${customTo}`)
  }

  const tokPct = usage && usage.tokens_limit > 0
    ? Math.min(100, Math.round((usage.tokens_used / usage.tokens_limit) * 100))
    : 0

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="fb-page-title">Analytics</h1>
          <p className="fb-page-sub">{fmtNum(totalMsgs)} messages in range</p>
        </div>
        <div className="fb-stack" style={{ gap: 8, alignItems: 'flex-end' }}>
          <PillNav items={RANGE_ITEMS} value={selectedRange} onChange={applyRange} />
          {selectedRange === 'custom' && (
            <div className="fb-row" style={{ gap: 8, alignItems: 'center' }}>
              <Input value={customFrom} onChange={setCustomFrom} type="date" />
              <Input value={customTo} onChange={setCustomTo} type="date" />
              <Button size="sm" onClick={applyCustomRange}>Apply</Button>
            </div>
          )}
        </div>
      </div>

      {/* Top KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total messages', value: fmtNum(totalMsgs) },
          { label: 'Avg conversion', value: `${avgConversion}%` },
          { label: 'Orders via bot', value: fmtNum(ordersViaBot) },
          { label: 'Active customers', value: fmtNum(activeCustomers) },
        ].map((k) => (
          <Card key={k.label}>
            <div className="fb-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
            <div className="mono fb-strong" style={{ fontSize: 22, marginTop: 4 }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Message volume + Intent donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 }}>
        <Card>
          <SectionLabel>Message volume by language</SectionLabel>
          <div style={{ marginTop: 12, height: 220 }}>
            {msgVolume.length === 0 ? (
              <div className="fb-muted" style={{ fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No messages in range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={msgVolume} barSize={10} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--border-faint)" />
                  <XAxis dataKey="d" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipBox />} />
                  <Bar dataKey="EN" name="English"  stackId="a" fill="#7c6dfa" radius={[0,0,0,0]} />
                  <Bar dataKey="SI" name="Sinhala"  stackId="a" fill="#2dd4a0" radius={[0,0,0,0]} />
                  <Bar dataKey="TA" name="Tamil"    stackId="a" fill="#f5a623" radius={[0,0,0,0]} />
                  <Bar dataKey="SL" name="Singlish" stackId="a" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { k: 'English', c: '#7c6dfa' }, { k: 'Sinhala', c: '#2dd4a0' },
              { k: 'Tamil', c: '#f5a623' }, { k: 'Singlish', c: '#3b82f6' },
            ].map((l) => (
              <div key={l.k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: l.c, display: 'inline-block' }} />
                <span className="fb-muted">{l.k}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel>Intent breakdown</SectionLabel>
          {intentBreakdown.length === 0 ? (
            <div className="fb-muted" style={{ fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No sessions in range.</div>
          ) : (
            <>
              <div style={{ marginTop: 8, height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={intentBreakdown}
                      dataKey="pct"
                      nameKey="key"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={2}
                    >
                      {intentBreakdown.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="fb-stack" style={{ gap: 6, marginTop: 4 }}>
                {intentBreakdown.map((e) => (
                  <div key={e.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
                      <span className="fb-muted">{e.key}</span>
                    </div>
                    <span className="mono fb-strong">{e.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Conversion rate + Top questions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>
        <Card>
          <SectionLabel>Conversion rate (chat → order)</SectionLabel>
          <div style={{ marginTop: 12, height: 200 }}>
            {conversionData.length === 0 ? (
              <div className="fb-muted" style={{ fontSize: 13, padding: '60px 0', textAlign: 'center' }}>No data in range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={conversionData}>
                  <CartesianGrid vertical={false} stroke="var(--border-faint)" />
                  <XAxis dataKey="d" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip formatter={(v: any) => `${v}%`} content={<TooltipBox />} />
                  <Line
                    type="monotone" dataKey="rate" name="Conversion"
                    stroke="#7c6dfa" strokeWidth={2.5}
                    dot={{ fill: '#7c6dfa', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <SectionLabel>Top customer questions</SectionLabel>
          <div className="fb-stack" style={{ gap: 10, marginTop: 12 }}>
            {topQuestions.length === 0 && (
              <div className="fb-muted" style={{ fontSize: 13 }}>No messages in range.</div>
            )}
            {topQuestions.map((q, i) => {
              const max = (topQuestions[0]?.n ?? 0)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span className="fb-muted" style={{ flex: 1, paddingRight: 8 }}>{q.q}</span>
                    <span className="mono fb-strong">{fmtNum(q.n)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: 'var(--border)' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, background: '#7c6dfa',
                      width: `${max > 0 ? Math.round((q.n / max) * 100) : 0}%`,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Delivery by zone + Stock movement */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionLabel>Orders by delivery zone</SectionLabel>
          <div style={{ marginTop: 12, height: 200 }}>
            {deliveryByZone.length === 0 ? (
              <div className="fb-muted" style={{ fontSize: 13, padding: '60px 0', textAlign: 'center' }}>No orders in range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deliveryByZone} layout="vertical" barSize={14}>
                  <CartesianGrid horizontal={false} stroke="var(--border-faint)" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category" dataKey="p"
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                    axisLine={false} tickLine={false} width={90}
                  />
                  <Tooltip content={<TooltipBox />} />
                  <Bar dataKey="n" name="Orders" fill="#7c6dfa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card pad={0}>
          <div style={{ padding: '14px 16px 10px' }}>
            <SectionLabel>Stock movement</SectionLabel>
          </div>
          {stockMovement.length === 0 ? (
            <div className="fb-muted" style={{ fontSize: 13, padding: '0 16px 16px' }}>No orders in range.</div>
          ) : (
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Units sold</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stockMovement.map((s) => (
                  <tr key={s.name}>
                    <td className="fb-strong">{s.name}</td>
                    <td className="num mono">{fmtNum(s.units)}</td>
                    <td className="num mono fb-strong">{fmt(s.rev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Token usage */}
      <Card>
        <SectionLabel>Token usage · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</SectionLabel>
        {!usage || usage.tokens_limit <= 0 ? (
          <div className="fb-muted" style={{ fontSize: 13, marginTop: 12 }}>No usage data yet.</div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span className="fb-muted">{fmtNum(usage.tokens_used)} used</span>
              <span className="fb-muted">{fmtNum(usage.tokens_limit)} limit</span>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: 'var(--border)' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: tokPct > 80 ? '#ef4444' : tokPct > 60 ? '#f5a623' : '#7c6dfa',
                width: `${tokPct}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }} className="fb-muted">{tokPct}% used</div>
          </div>
        )}
      </Card>
    </div>
  )
}
