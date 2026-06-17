'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, SectionLabel } from '@/components/ui/card'
import { fmtNum } from '@/lib/constants'
import { useCurrency } from '@/components/layout/currency-provider'
import type { Usage } from '@/types'

const MSG_VOLUME: { d: string; EN: number; SI: number; TA: number; SL: number }[] = []
const INTENT_BREAKDOWN: { key: string; pct: number; color: string }[] = []
const CONVERSION_LINE: number[] = []
const TOP_QUESTIONS: { q: string; n: number }[] = []
const DELIVERY_BY_PROVINCE: { p: string; n: number }[] = []
const STOCK_MOVEMENT: { name: string; units: number; rev: number }[] = []
const USAGE: Usage = {
  id: '', tenant_id: '', month: '',
  tokens_used: 0, tokens_limit: 1,
  orders_processed: 0, active_customers: 0,
}

const CONVERSION_DATA = CONVERSION_LINE.map((v, i) => ({
  d: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  rate: v,
}))

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

export function AnalyticsTab() {
  const { fmt } = useCurrency()
  const tokPct = Math.round((USAGE.tokens_used / USAGE.tokens_limit) * 100)
  const totalMsgs = MSG_VOLUME.reduce((s, d) => s + d.EN + d.SI + d.TA + d.SL, 0)

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div>
        <h1 className="fb-page-title">Analytics</h1>
        <p className="fb-page-sub">Last 7 days · {fmtNum(totalMsgs)} messages</p>
      </div>

      {/* Top KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total messages', value: fmtNum(totalMsgs) },
          { label: 'Avg conversion', value: '31.6%' },
          { label: 'Orders via bot', value: fmtNum(USAGE.orders_processed) },
          { label: 'Active customers', value: fmtNum(USAGE.active_customers) },
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MSG_VOLUME} barSize={10} barGap={2}>
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
          <div style={{ marginTop: 8, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={INTENT_BREAKDOWN}
                  dataKey="pct"
                  nameKey="key"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={2}
                >
                  {INTENT_BREAKDOWN.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="fb-stack" style={{ gap: 6, marginTop: 4 }}>
            {INTENT_BREAKDOWN.map((e) => (
              <div key={e.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
                  <span className="fb-muted">{e.key}</span>
                </div>
                <span className="mono fb-strong">{e.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Conversion rate + Top questions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>
        <Card>
          <SectionLabel>Conversion rate (chat → order)</SectionLabel>
          <div style={{ marginTop: 12, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CONVERSION_DATA}>
                <CartesianGrid vertical={false} stroke="var(--border-faint)" />
                <XAxis dataKey="d" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 50]}
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
          </div>
        </Card>

        <Card>
          <SectionLabel>Top customer questions</SectionLabel>
          <div className="fb-stack" style={{ gap: 10, marginTop: 12 }}>
            {TOP_QUESTIONS.map((q, i) => {
              const max = (TOP_QUESTIONS[0]?.n ?? 0)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span className="fb-muted" style={{ flex: 1, paddingRight: 8 }}>{q.q}</span>
                    <span className="mono fb-strong">{fmtNum(q.n)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: 'var(--border)' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, background: '#7c6dfa',
                      width: `${Math.round((q.n / max) * 100)}%`,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Delivery by province + Stock movement */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionLabel>Orders by province</SectionLabel>
          <div style={{ marginTop: 12, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DELIVERY_BY_PROVINCE} layout="vertical" barSize={14}>
                <CartesianGrid horizontal={false} stroke="var(--border-faint)" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category" dataKey="p"
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false} width={74}
                />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="n" name="Orders" fill="#7c6dfa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card pad={0}>
          <div style={{ padding: '14px 16px 10px' }}>
            <SectionLabel>Stock movement</SectionLabel>
          </div>
          <table className="fb-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Units sold</th>
                <th className="num">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {STOCK_MOVEMENT.map((s) => (
                <tr key={s.name}>
                  <td className="fb-strong">{s.name}</td>
                  <td className="num mono">{fmtNum(s.units)}</td>
                  <td className="num mono fb-strong">{fmt(s.rev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Token usage */}
      <Card>
        <SectionLabel>Token usage · June 2026</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
            <span className="fb-muted">{fmtNum(USAGE.tokens_used)} used</span>
            <span className="fb-muted">{fmtNum(USAGE.tokens_limit)} limit</span>
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
      </Card>
    </div>
  )
}
