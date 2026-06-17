'use client'
import { LucideIcon, ChevronDown } from 'lucide-react'

// ── Input ──────────────────────────────────────────────────────
interface InputProps {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  icon?: LucideIcon
  type?: string
  full?: boolean
  mono?: boolean
  style?: React.CSSProperties
  disabled?: boolean
  readOnly?: boolean
}

export function Input({
  value, onChange, placeholder, icon: Icon, type = 'text',
  full, mono, style, disabled, readOnly,
}: InputProps) {
  return (
    <div className={`fb-input-wrap${full ? ' full' : ''}`} style={style}>
      {Icon && <Icon size={16} className="fb-input-icon" />}
      <input
        className={`fb-input${Icon ? ' has-icon' : ''}${mono ? ' mono' : ''}`}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        type={type}
        disabled={disabled}
        readOnly={readOnly}
      />
    </div>
  )
}

// ── Textarea ────────────────────────────────────────────────────
interface TextareaProps {
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  placeholder?: string
  rows?: number
}

export function Textarea({ value, defaultValue, onChange, placeholder, rows = 3 }: TextareaProps) {
  return (
    <textarea
      className="fb-textarea"
      value={value}
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
    />
  )
}

// ── Select ──────────────────────────────────────────────────────
interface SelectProps {
  value: string
  options: string[]
  onChange?: (v: string) => void
  full?: boolean
  style?: React.CSSProperties
}

export function Select({ value, options, onChange, full, style }: SelectProps) {
  return (
    <div className={`fb-select-wrap${full ? ' full' : ''}`} style={style}>
      <select
        className="fb-select"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={15} className="fb-select-chev" />
    </div>
  )
}

// ── Field ────────────────────────────────────────────────────────
interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="fb-field">
      <label className="fb-field-label">{label}</label>
      {children}
      {hint && <div className="fb-field-hint">{hint}</div>}
    </div>
  )
}

// ── PillNav ──────────────────────────────────────────────────────
interface PillNavItem { key: string; label: string }

interface PillNavProps {
  items: (string | PillNavItem)[]
  value: string
  onChange: (v: string) => void
  style?: React.CSSProperties
}

export function PillNav({ items, value, onChange, style }: PillNavProps) {
  return (
    <div className="fb-pillnav" style={style}>
      {items.map((it) => {
        const key = typeof it === 'string' ? it : it.key
        const label = typeof it === 'string' ? it : it.label
        return (
          <button
            key={key}
            type="button"
            className={`fb-pill${value === key ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── IconButton ────────────────────────────────────────────────────
interface IconButtonProps {
  icon: LucideIcon
  onClick?: (e: React.MouseEvent) => void
  title?: string
  tone?: string
  style?: React.CSSProperties
}

export function IconButton({ icon: Icon, onClick, title, tone, style }: IconButtonProps) {
  return (
    <button
      type="button"
      className="fb-iconbtn"
      title={title}
      onClick={onClick}
      style={{ color: tone, ...style }}
    >
      <Icon size={16} />
    </button>
  )
}
