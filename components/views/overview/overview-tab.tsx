'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, Zap, Users, AlertCircle } from 'lucide-react'
import { Card, CardHead, CardFoot, SectionLabel } from '@/components/ui/card'
import { Badge, Trend } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillNav, Input } from '@/components/ui/inputs'
import { Donut } from '@/components/ui/charts'
import { LANG_META } from '@/lib/constants'
import { fmtNum } from '@/lib/constants'
import type { StatCard, ActivityEvent, Usage, Lang } from '@/types'

type OverviewRange = 'this_month' | 'last_month' | 'custom'

const RANGE_ITEMS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
]

const STAT_ICONS: Record<string, React.ElementType> = { ShoppingBag, Zap, Users, AlertCircle }
const TONE_COLORS: Record<string, string> = {
  purple: '#7c6dfa', teal: '#2dd4a0', amber: '#f5a623', red: '#ef4444',
}

interface OverviewTabProps {
  stats: StatCard[]
  activity: ActivityEvent[]
  langBreakdown: { key: Lang; pct: number; sessions: number }[]
  usage: Usage | null
  currency: string
  userName: string
  businessName: string
  range: OverviewRange
  from?: string
  to?: string
}

function StatCardItem({ stat }: { stat: StatCard }) {
  const Icon = STAT_ICONS[stat.icon]
  const c = TONE_COLORS[stat.tone]
  return (
    <Card hover className="fb-stat">
      <div className="fb-row-between" style={{ alignItems: 'flex-start' }}>
        <Trend value={stat.trend} up={stat.up} />
        <span className="fb-stat-icon" style={{ background: `${c}18`, color: c }}>
          {Icon && <Icon size={18} />}
        </span>
      </div>
      <div className="fb-stat-value">{stat.value}</div>
      <div className="fb-stat-label">{stat.label}</div>
      <div className="fb-stat-sub">{stat.sub}</div>
    </Card>
  )
}

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <div className="fb-feed-empty fb-feed">No recent activity yet.</div>
  }
  return (
    <div className="fb-feed">
      {events.map((a, i) => (
        <div className="fb-feed-row" key={i}>
          <span className="fb-feed-dot" style={{ background: a.dot }} />
          <span className="fb-feed-text">{a.text}</span>
          <span className="fb-feed-time">{a.time}</span>
        </div>
      ))}
    </div>
  )
}

function LanguageDonut({ breakdown }: { breakdown: { key: Lang; pct: number; sessions: number }[] }) {
  const totalSessions = breakdown.reduce((s, l) => s + l.sessions, 0)
  const segments = breakdown.map((l) => ({ pct: l.pct, color: LANG_META[l.key]?.color ?? '#9ca3af' }))
  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <SectionLabel>Conversations</SectionLabel>
        <div className="fb-card-title" style={{ marginTop: 4 }}>Language breakdown</div>
      </div>
      <div className="fb-donut-wrap">
        <Donut
          segments={segments}
          centerTop={fmtNum(totalSessions)}
          centerBottom="sessions"
        />
      </div>
      <div className="fb-legend">
        {breakdown.length === 0 && <div className="fb-legend-row">No conversations this month.</div>}
        {breakdown.map((l) => (
          <div className="fb-legend-row" key={l.key}>
            <span className="fb-legend-dot" style={{ background: LANG_META[l.key]?.color ?? '#9ca3af' }} />
            <span className="fb-legend-name">{LANG_META[l.key]?.name ?? l.key}</span>
            <span className="fb-legend-pct">{l.pct}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function TokenMeter({ usage }: { usage: Usage | null }) {
  if (!usage || usage.tokens_limit <= 0) {
    return (
      <Card>
        <SectionLabel>Usage</SectionLabel>
        <div className="fb-card-title" style={{ marginTop: 4, marginBottom: 12 }}>Token usage this month</div>
        <div className="fb-meter-label">No usage data yet.</div>
      </Card>
    )
  }

  const pct = Math.min(100, Math.round((usage.tokens_used / usage.tokens_limit) * 100))
  const warn = pct >= 80
  const usedM = (usage.tokens_used / 1_000_000).toFixed(1)
  const limitM = (usage.tokens_limit / 1_000_000).toFixed(0)
  return (
    <Card>
      <div className="fb-row-between" style={{ marginBottom: 14 }}>
        <div>
          <SectionLabel>Usage</SectionLabel>
          <div className="fb-card-title" style={{ marginTop: 4 }}>Token usage this month</div>
        </div>
        <Badge tone={warn ? 'amber' : 'purple'} dot>{pct}% used</Badge>
      </div>
      <div className={`fb-meter${warn ? ' warn' : ''}`}>
        <div className="fb-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="fb-row-between" style={{ marginTop: 12 }}>
        <span className="fb-meter-label">
          <span className="mono">{usedM}M</span> / <span className="mono">{limitM}M</span> tokens
        </span>
        <span className="fb-meter-label">
          <span className="mono">{fmtNum(usage.orders_processed)}</span> orders processed
        </span>
      </div>
    </Card>
  )
}

export function OverviewTab({
  stats, activity, langBreakdown, usage, userName, businessName, range, from, to,
}: OverviewTabProps) {
  const router = useRouter()
  const [selectedRange, setSelectedRange] = useState<OverviewRange>(range)
  const [customFrom, setCustomFrom] = useState(from ?? '')
  const [customTo, setCustomTo] = useState(to ?? '')

  function applyRange(key: string) {
    setSelectedRange(key as OverviewRange)
    if (key === 'custom') return // wait for date pickers + Apply
    router.push(`/overview?range=${key}`)
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return
    router.push(`/overview?range=custom&from=${customFrom}&to=${customTo}`)
  }

  return (
    <div className="fb-stack" style={{ gap: 20 }}>
      {/* Header + date range */}
      <div className="fb-row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="fb-page-title">Overview</h1>
          <p className="fb-page-sub">Welcome back, {userName}. Here&apos;s how {businessName} is performing.</p>
        </div>
        <div className="fb-stack" style={{ gap: 8, alignItems: 'flex-end' }}>
          <PillNav
            items={RANGE_ITEMS}
            value={selectedRange}
            onChange={applyRange}
          />
          {selectedRange === 'custom' && (
            <div className="fb-row" style={{ gap: 8, alignItems: 'center' }}>
              <Input value={customFrom} onChange={setCustomFrom} type="date" />
              <Input value={customTo} onChange={setCustomTo} type="date" />
              <Button size="sm" onClick={applyCustomRange}>Apply</Button>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="fb-grid-4">
        {stats.map((s) => <StatCardItem key={s.id} stat={s} />)}
      </div>

      {/* Activity feed + language donut */}
      <div className="fb-grid-60-40">
        <Card pad={0}>
          <CardHead>
            <div>
              <SectionLabel>Live Activity</SectionLabel>
              <div className="fb-card-title" style={{ marginTop: 4 }}>Recent events</div>
            </div>
            <span className="fb-live-dot">● Live</span>
          </CardHead>
          <ActivityFeed events={activity} />
          <CardFoot>
            <Button variant="ghost" size="sm">View all activity</Button>
          </CardFoot>
        </Card>
        <LanguageDonut breakdown={langBreakdown} />
      </div>

      {/* Token usage meter */}
      <TokenMeter usage={usage} />
    </div>
  )
}
