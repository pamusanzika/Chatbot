'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingBag, Truck, Tag, BookOpen, Users,
  MessageSquare, AlertCircle, BarChart2, Settings, Bot, CreditCard,
} from 'lucide-react'

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, ShoppingBag, Truck, Tag, BookOpen, Users,
  MessageSquare, AlertCircle, BarChart2, Settings, Bot, CreditCard,
}

const NAV = [
  { id: 'overview',       label: 'Overview',       icon: 'LayoutDashboard', href: '/overview' },
  { id: 'orders',         label: 'Orders',         icon: 'ShoppingBag',     href: '/orders' },
  { id: 'payments',       label: 'Payments',       icon: 'CreditCard',      href: '/payments' },
  { id: 'delivery',       label: 'Delivery Fees',  icon: 'Truck',           href: '/delivery' },
  { id: 'products',       label: 'Products',       icon: 'Tag',             href: '/products' },
  { id: 'knowledge-base', label: 'Knowledge Base', icon: 'BookOpen',        href: '/knowledge-base' },
  { id: 'customers',      label: 'Customers',      icon: 'Users',           href: '/customers' },
  { id: 'chat-logs',      label: 'Chat Logs',      icon: 'MessageSquare',   href: '/chat-logs' },
  { id: 'complaints',     label: 'Complaints',     icon: 'AlertCircle',     href: '/complaints', badge: 3 },
  { id: 'analytics',      label: 'Analytics',      icon: 'BarChart2',       href: '/analytics' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fb-sidebar">
      {/* Brand */}
      <div className="fb-brand">
        <span className="fb-logo"><Bot size={20} /></span>
        <div>
          <div className="fb-brand-name">FlowBot</div>
          <div className="fb-brand-sub">SilkTrail</div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="fb-nav">
        {NAV.map((item) => {
          const Icon = ICONS[item.icon]
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.id} href={item.href} className={`fb-navitem${active ? ' active' : ''}`}>
              <Icon size={18} />
              <span className="fb-navlabel">{item.label}</span>
              {item.badge ? <span className="fb-nav-count">{item.badge}</span> : null}
            </Link>
          )
        })}
      </nav>

      {/* Settings pinned at bottom */}
      <div className="fb-nav-bottom">
        <Link
          href="/settings"
          className={`fb-navitem${pathname.startsWith('/settings') ? ' active' : ''}`}
        >
          <Settings size={18} />
          <span className="fb-navlabel">Settings</span>
        </Link>
      </div>
    </aside>
  )
}
