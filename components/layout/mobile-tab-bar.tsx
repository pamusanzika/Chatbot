'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingBag, Tag, BookOpen, MoreHorizontal,
  Truck, Users, MessageSquare, AlertCircle, BarChart2, Settings,
} from 'lucide-react'

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, ShoppingBag, Truck, Tag, BookOpen, Users,
  MessageSquare, AlertCircle, BarChart2, Settings,
}

const ALL_NAV = [
  { href: '/overview',       label: 'Overview',       icon: 'LayoutDashboard' },
  { href: '/orders',         label: 'Orders',         icon: 'ShoppingBag' },
  { href: '/delivery',       label: 'Delivery Fees',  icon: 'Truck' },
  { href: '/products',       label: 'Products',       icon: 'Tag' },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: 'BookOpen' },
  { href: '/customers',      label: 'Customers',      icon: 'Users' },
  { href: '/chat-logs',      label: 'Chat Logs',      icon: 'MessageSquare' },
  { href: '/complaints',     label: 'Complaints',     icon: 'AlertCircle' },
  { href: '/analytics',      label: 'Analytics',      icon: 'BarChart2' },
  { href: '/settings',       label: 'Settings',       icon: 'Settings' },
]

const MAIN_TABS = ALL_NAV.slice(0, 4)

export function MobileTabBar() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav className="fb-tabbar">
        {MAIN_TABS.map((item) => {
          const Icon = ICONS[item.icon]
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`fb-tabbar-item${active ? ' active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
        <button
          className={`fb-tabbar-item${sheetOpen ? ' active' : ''}`}
          onClick={() => setSheetOpen(true)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {sheetOpen && (
        <div className="fb-sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="fb-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fb-sheet-handle" />
            <div className="fb-sheet-grid">
              {ALL_NAV.map((item) => {
                const Icon = ICONS[item.icon]
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`fb-sheet-item${active ? ' active' : ''}`}
                    onClick={() => setSheetOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
