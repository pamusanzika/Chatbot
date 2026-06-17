'use client'
import { usePathname } from 'next/navigation'
import { Search, Bell, Sun, Moon, Menu, ChevronRight } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useTheme } from '@/components/layout/theme-provider'

const LABELS: Record<string, string> = {
  '/overview':       'Overview',
  '/orders':         'Orders',
  '/delivery':       'Delivery Fees',
  '/products':       'Products',
  '/knowledge-base': 'Knowledge Base',
  '/customers':      'Customers',
  '/chat-logs':      'Chat Logs',
  '/complaints':     'Complaints',
  '/analytics':      'Analytics',
  '/settings':       'Settings',
}

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const label = LABELS[pathname] ?? LABELS[Object.keys(LABELS).find((k) => pathname.startsWith(k)) ?? ''] ?? ''

  return (
    <header className="fb-topbar">
      <button className="fb-menu-btn" onClick={onMenuClick} aria-label="Menu">
        <Menu size={20} />
      </button>

      <div className="fb-breadcrumb">
        <span className="fb-muted" style={{ fontSize: 13 }}>FlowBot</span>
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="fb-strong" style={{ fontSize: 14 }}>{label}</span>
      </div>

      <div className="fb-search-global">
        <Search size={16} />
        <input placeholder="Search orders, customers, products…" />
        <kbd>⌘K</kbd>
      </div>

      <div className="fb-topbar-right">
        <button
          className="fb-iconbtn"
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="fb-iconbtn fb-bell" title="Notifications">
          <Bell size={18} />
          <span className="fb-bell-dot" />
        </button>

        <div style={{ marginLeft: 4 }}>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}
