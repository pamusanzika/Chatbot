'use client'

interface ToggleProps {
  on: boolean
  onChange?: (v: boolean) => void
  size?: 'md' | 'sm'
}

export function Toggle({ on, onChange, size = 'md' }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!on)}
      className={`fb-toggle ${on ? 'on' : ''} ${size === 'sm' ? 'sm' : ''}`}
      role="switch"
      aria-checked={on}
    >
      <span className="fb-toggle-knob" />
    </button>
  )
}
