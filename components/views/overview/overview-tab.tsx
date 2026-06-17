'use client'
import { useState } from 'react'
import { ShoppingBag, Zap, Users, AlertCircle } from 'lucide-react'
import { Card, CardHead, CardFoot, SectionLabel } from '@/components/ui/card'
import { Badge, Trend } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillNav } from '@/components/ui/inputs'
import { Donut } from '@/components/ui/charts'
import { LANG_META } from '@/lib/constants'
import { fmtNum } from '@/lib/constants'
import type { StatCard, ActivityEvent, Usage } from '@/types'

const STATS: StatCard[] = []
const ACTIVITY: ActivityEvent[] = []
const LANG_BREAKDOWN: { key: 'EN' | 'SI' | 'TA' | 'SL'; pct: number; sessions: number }[] = []
const USAGE: Usage = { id: '', tenant_id: '', month: '', tokens_used: 0, tokens_limit: 1, orders_processed: 0, active_customers: 0 }

const STAT_ICONS: Record<string, React.ElementType> = { ShoppingBag, Zap, Users, AlertCircle }
const TONE_COLORS: Record<string, string> = {
  purple: '#7c6dfa', teal: '#2dd4a0', amber: '#f5a623', red: '#ef4444',
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

function LanguageDonut() {
  const totalSessions = LANG_BREAKDOWN.reduce((s, l) => s + l.sessions, 0)
  const segments = LANG_BREAKDOWN.map((l) => ({ pct: l.pct, color: LANG_META[l.key].color }))
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
        {LANG_BREAKDOWN.map((l) => (
          <div className="fb-legend-row" key={l.key}>
            <span className="fb-legend-dot" style={{ background: LANG_META[l.key].color }} />
            <span className="fb-legend-name">{LANG_META[l.key].name}</span>
            <span className="fb-legend-pct">{l.pct}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function TokenMeter() {
  const u = USAGE
  const pct = Math.round((u.tokens_used / u.tokens_limit) * 100)
  const warn = pct >= 80
  const usedM = (u.tokens_used / 1_000_000).toFixed(1)
  const limitM = (u.tokens_limit / 1_000_000).toFixed(0)
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
          Est. cost <span className="mono" style={{ color: 'var(--text)' }}>Rs 18,400</span>
        </span>
      </div>
    </Card>
  )
}

export function OverviewTab() {
  const [range, setRange] = useState('This Month')

  return (
    <div className="fb-stack" style={{ gap: 20 }}>
      {/* Header + date range */}
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Overview</h1>
          <p className="fb-page-sub">Welcome back, Aruni. Here's how SilkTrail is performing.</p>
        </div>
        <PillNav
          items={['This Month', 'Last Month', 'Custom']}
          value={range}
          onChange={setRange}
        />
      </div>

      {/* Stat cards */}
      <div className="fb-grid-4">
        {STATS.map((s) => <StatCardItem key={s.id} stat={s} />)}
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
          <ActivityFeed events={ACTIVITY} />
          <CardFoot>
            <Button variant="ghost" size="sm">View all activity</Button>
          </CardFoot>
        </Card>
        <LanguageDonut />
      </div>

      {/* Token usage meter */}
      <TokenMeter />
    </div>
  )
}
