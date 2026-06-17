'use client'

// ── SVG Donut ──────────────────────────────────────────────────
interface DonutSegment { pct: number; color: string }

interface DonutProps {
  segments: DonutSegment[]
  size?: number
  stroke?: number
  centerTop?: React.ReactNode
  centerBottom?: React.ReactNode
}

export function Donut({ segments, size = 160, stroke = 14, centerTop, centerBottom }: DonutProps) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.pct, 0)
  let offset = 0

  return (
    <div className="fb-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((seg, i) => {
            const len = (seg.pct / total) * circ
            const el = (
              <circle
                key={i}
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += len
            return el
          })}
        </g>
      </svg>
      <div className="fb-donut-center">
        <div className="fb-donut-num">{centerTop}</div>
        <div className="fb-donut-label">{centerBottom}</div>
      </div>
    </div>
  )
}

// ── SVG Line Chart ─────────────────────────────────────────────
interface LineChartProps {
  values: number[]
  color?: string
  height?: number
  labels?: string[]
}

export function LineChart({ values, color = '#7c6dfa', height = 180, labels }: LineChartProps) {
  const W = 100, H = 60
  const max = Math.max(...values)
  const min = Math.min(...values)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / (max - min || 1)) * (H - 8) - 4
    return [x, y] as [number, number]
  })
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${d} L ${W} ${H} L 0 ${H} Z`

  return (
    <div style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: height - (labels ? 24 : 0) }}
      >
        <defs>
          <linearGradient id={`lg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#lg-${color.replace('#', '')})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="1.4" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {labels && (
        <div className="fb-line-labels">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  )
}

// ── Simple SVG bar chart ────────────────────────────────────────
interface SimpleBar { p: string; n: number }

interface SimpleBarsProps {
  data: SimpleBar[]
  color?: string
  height?: number
}

export function SimpleBars({ data, color = '#7c6dfa', height = 180 }: SimpleBarsProps) {
  const max = Math.max(...data.map((d) => d.n))
  return (
    <div className="fb-bars" style={{ height }}>
      {data.map((d, i) => (
        <div className="fb-bar-col" key={i}>
          <div className="fb-bar-stack" style={{ height: `${(d.n / max) * 100}%` }}>
            <div className="fb-bar-seg" style={{ height: '100%', background: color, borderRadius: '4px 4px 0 0' }} />
          </div>
          <div className="fb-bar-label">{d.p}</div>
        </div>
      ))}
    </div>
  )
}

// ── Stacked bar chart (SVG-based, for Overview & Analytics) ─────
interface StackedBar { d: string; [key: string]: string | number }

interface StackedBarsProps {
  data: StackedBar[]
  keys: string[]
  colors: string[]
  height?: number
}

export function StackedBars({ data, keys, colors, height = 200 }: StackedBarsProps) {
  const max = Math.max(...data.map((d) => keys.reduce((s, k) => s + (d[k] as number), 0)))
  return (
    <div className="fb-bars" style={{ height }}>
      {data.map((d, i) => {
        const tot = keys.reduce((s, k) => s + (d[k] as number), 0)
        return (
          <div className="fb-bar-col" key={i}>
            <div className="fb-bar-stack" style={{ height: `${(tot / max) * 100}%` }}>
              {keys.map((k, j) => (
                <div
                  key={k}
                  className="fb-bar-seg"
                  title={`${k}: ${d[k]}`}
                  style={{ height: `${((d[k] as number) / tot) * 100}%`, background: colors[j] }}
                />
              ))}
            </div>
            <div className="fb-bar-label">{d.d}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Image placeholder ───────────────────────────────────────────
interface ImgPlaceholderProps {
  label?: string
  height?: number
  width?: number | string
  radius?: number
}

export function ImgPlaceholder({ label = '', height = 200, width = '100%', radius = 0 }: ImgPlaceholderProps) {
  return (
    <div className="fb-imgph" style={{ height, width, borderRadius: radius }}>
      <span className="fb-imgph-text">{label}</span>
    </div>
  )
}
