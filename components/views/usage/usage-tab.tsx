'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, SectionLabel } from '@/components/ui/card'
import { PillNav } from '@/components/ui/inputs'
import { fmtNum, fmtCompact } from '@/lib/constants'
import type { UsageSummary, UsageDailyPoint } from '@/lib/db/token-usage'

const RANGE_ITEMS = [
  { key: '7', label: '7d' },
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
]

const METRIC_ITEMS = [
  { key: 'tokens', label: 'Tokens' },
  { key: 'messages', label: 'Messages' },
]

function dayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          {p.name}: {fmtNum(p.value)}
        </div>
      ))}
    </div>
  )
}

interface UsageTabProps {
  summary: UsageSummary
  initialDaily: UsageDailyPoint[]
}

export function UsageTab({ summary, initialDaily }: UsageTabProps) {
  const [range, setRange] = useState('30')
  const [metric, setMetric] = useState<'tokens' | 'messages'>('tokens')
  const [daily, setDaily] = useState<UsageDailyPoint[]>(initialDaily)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (range === '30' && daily === initialDaily) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/usage/daily?days=${range}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDaily(d.series ?? []) })
      .catch(() => { if (!cancelled) setDaily([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const chartData = daily.map((d) => ({ d: dayLabel(d.date), value: metric === 'tokens' ? d.tokens : d.messages }))

  const cards = [
    { label: 'Today', value: fmtCompact(summary.today) },
    { label: 'This Month', value: fmtCompact(summary.this_month) },
    { label: 'All Time', value: fmtCompact(summary.all_time) },
    { label: 'Messages Today', value: fmtNum(summary.messages_today) },
  ]

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div>
        <h1 className="fb-page-title">Usage</h1>
        <p className="fb-page-sub">Estimated token usage — not a billing invoice</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {cards.map((k) => (
          <Card key={k.label}>
            <div className="fb-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
            <div className="mono fb-strong" style={{ fontSize: 22, marginTop: 4 }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="fb-row-between" style={{ alignItems: 'flex-start' }}>
          <SectionLabel>Daily usage</SectionLabel>
          <div className="fb-row" style={{ gap: 8 }}>
            <PillNav items={METRIC_ITEMS} value={metric} onChange={(v) => setMetric(v as 'tokens' | 'messages')} />
            <PillNav items={RANGE_ITEMS} value={range} onChange={setRange} />
          </div>
        </div>
        <div style={{ marginTop: 12, height: 280 }}>
          {loading ? (
            <div className="fb-muted" style={{ fontSize: 13, padding: '80px 0', textAlign: 'center' }}>Loading…</div>
          ) : chartData.every((c) => c.value === 0) ? (
            <div className="fb-muted" style={{ fontSize: 13, padding: '80px 0', textAlign: 'center' }}>No usage in range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={Number(range) > 30 ? 4 : 10}>
                <CartesianGrid vertical={false} stroke="var(--border-faint)" />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="value" name={metric === 'tokens' ? 'Tokens' : 'Messages'} fill="#7c6dfa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  )
}
