'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  width?: number
  title?: string
  subtitle?: string
  headerRight?: React.ReactNode
  children?: React.ReactNode
}

export function Drawer({
  open, onClose, width = 720, title, subtitle, headerRight, children,
}: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      <div className={`fb-backdrop${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`fb-drawer${open ? ' open' : ''}`} style={{ width }}>
        {open && (
          <>
            <header className="fb-drawer-head">
              <div style={{ minWidth: 0 }}>
                {subtitle && <div className="fb-drawer-sub">{subtitle}</div>}
                {title && <div className="fb-drawer-title">{title}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {headerRight}
                <button className="fb-iconbtn" onClick={onClose} title="Close">
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="fb-drawer-body">{children}</div>
          </>
        )}
      </aside>
    </>
  )
}
