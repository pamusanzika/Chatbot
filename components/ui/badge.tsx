'use client'
import { STATUS_COLORS } from '@/lib/constants'
import { LANG_META } from '@/lib/constants'
import type { Lang } from '@/types'

interface BadgeProps {
  children?: React.ReactNode
  tone?: string
  dot?: boolean
  outline?: boolean
}

export function Badge({ children, tone = 'gray', dot, outline }: BadgeProps) {
  const c = STATUS_COLORS[tone] ?? tone
  return (
    <span
      className="fb-badge"
      style={
        outline
          ? { color: c, border: `1px solid ${c}55`, background: 'transparent' }
          : { color: c, background: `${c}1f` }
      }
    >
      {dot && <span className="fb-badge-dot" style={{ background: c }} />}
      {children}
    </span>
  )
}

export function LangBadge({ code }: { code: Lang }) {
  const l = LANG_META[code]
  if (!l) return null
  return (
    <span className="fb-badge" style={{ color: l.color, background: `${l.color}1f` }}>
      <span style={{ fontSize: 11 }}>{l.flag}</span>
      {l.label}
    </span>
  )
}

export function Trend({ value, up }: { value: number; up: boolean }) {
  const c = up ? '#2dd4a0' : '#ef4444'
  const arrow = up ? '↑' : '↓'
  return (
    <span className="fb-trend" style={{ color: c, background: `${c}1a` }}>
      {arrow} {value}%
    </span>
  )
}
