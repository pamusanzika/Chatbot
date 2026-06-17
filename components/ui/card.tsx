'use client'

interface CardProps {
  children: React.ReactNode
  pad?: number
  hover?: boolean
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export function Card({ children, pad = 20, hover, className = '', style, onClick }: CardProps) {
  return (
    <div
      className={`fb-card ${hover ? 'fb-card-hover' : ''} ${className}`}
      style={{ padding: pad, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHead({ children }: { children: React.ReactNode }) {
  return <div className="fb-card-head">{children}</div>
}

export function CardFoot({ children }: { children: React.ReactNode }) {
  return <div className="fb-card-foot">{children}</div>
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="fb-section-label" style={style}>{children}</div>
}
