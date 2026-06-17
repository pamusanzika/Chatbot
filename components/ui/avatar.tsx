'use client'

interface AvatarProps {
  initials: string
  color?: string
  size?: number
}

export function Avatar({ initials, color = '#7c6dfa', size = 32 }: AvatarProps) {
  return (
    <span
      className="fb-avatar"
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        color,
        fontSize: size * 0.38,
        minWidth: size,
      }}
    >
      {initials}
    </span>
  )
}
