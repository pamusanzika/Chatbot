'use client'
import { LucideIcon } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps {
  children?: React.ReactNode
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  full?: boolean
  disabled?: boolean
  style?: React.CSSProperties
  className?: string
}

export function Button({
  children, variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight,
  onClick, type = 'button', full, disabled, style, className = '',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`fb-btn fb-btn-${variant} ${size === 'sm' ? 'fb-btn-sm' : ''} ${className}`}
      style={{ width: full ? '100%' : undefined, opacity: disabled ? 0.5 : 1, ...style }}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children && <span>{children}</span>}
      {IconRight && <IconRight size={size === 'sm' ? 14 : 16} />}
    </button>
  )
}
