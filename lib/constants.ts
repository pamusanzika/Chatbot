import type { Lang, NavItem } from '@/types'

export const LANG_META: Record<Lang, { label: string; name: string; flag: string; color: string }> = {
  EN: { label: 'EN', name: 'English',  flag: '🇬🇧', color: '#7c6dfa' },
  SI: { label: 'SI', name: 'Sinhala',  flag: '🇱🇰', color: '#2dd4a0' },
  TA: { label: 'TA', name: 'Tamil',    flag: '🇱🇰', color: '#f5a623' },
  SL: { label: 'SL', name: 'Singlish', flag: '💬',  color: '#9ca3af' },
}

export const STATUS_COLORS: Record<string, string> = {
  pending:              '#f5a623',
  awaiting_payment:     '#f5a623',
  pending_verification: '#3b82f6',
  confirmed:            '#22c55e',
  preparing:  '#3b82f6',
  processing: '#3b82f6',
  shipped:    '#7c6dfa',
  delivered:  '#2dd4a0',
  cancelled:  '#ef4444',
  open:       '#f5a623',
  progress:   '#3b82f6',
  resolved:   '#2dd4a0',
  Owner:      '#7c6dfa',
  Admin:      '#3b82f6',
  Staff:      '#6b7280',
  Active:     '#2dd4a0',
  Invited:    '#f5a623',
  Suspended:  '#ef4444',
  purple:     '#7c6dfa',
  teal:       '#2dd4a0',
  amber:      '#f5a623',
  red:        '#ef4444',
  blue:       '#3b82f6',
  gray:       '#6b7280',
  green:      '#22c55e',
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview',       label: 'Overview',       icon: 'LayoutDashboard' },
  { id: 'orders',         label: 'Orders',         icon: 'ShoppingBag' },
  { id: 'delivery',       label: 'Delivery Fees',  icon: 'Truck' },
  { id: 'products',       label: 'Products',       icon: 'Tag' },
  { id: 'knowledge-base', label: 'Knowledge Base', icon: 'BookOpen' },
  { id: 'customers',      label: 'Customers',      icon: 'Users' },
  { id: 'chat-logs',      label: 'Chat Logs',      icon: 'MessageSquare' },
  { id: 'complaints',     label: 'Complaints',     icon: 'AlertCircle', badge: 3 },
  { id: 'analytics',      label: 'Analytics',      icon: 'BarChart2' },
]

export const MOBILE_NAV_IDS = ['overview', 'orders', 'products', 'knowledge-base']

export const ACCENT_PRESETS = [
  { name: 'Purple', c: '#7c6dfa' },
  { name: 'Teal',   c: '#2dd4a0' },
  { name: 'Blue',   c: '#3b82f6' },
  { name: 'Orange', c: '#f5a623' },
  { name: 'Pink',   c: '#ec4899' },
  { name: 'Green',  c: '#22c55e' },
]

export const SETTINGS_SECTIONS = [
  'General',
  'Appearance',
  'Notifications',
  'Users & Roles',
  'WhatsApp',
  'Chatbot',
  'Integrations',
  'Billing',
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const CURRENCY_SYMBOLS: Record<string, string> = {
  LKR: 'Rs',
  USD: '$',
}

export const fmtCurrency = (n: number, currency: string = 'LKR') =>
  `${CURRENCY_SYMBOLS[currency] ?? currency} ${n.toLocaleString('en-LK')}`

/** @deprecated use useCurrency().fmt instead — kept for non-tenant-scoped contexts */
export const fmtLKR = (n: number) => fmtCurrency(n, 'LKR')
export const fmtNum = (n: number) => n.toLocaleString('en-LK')

export function fmtCompact(n: number): string {
  if (n < 1000) return fmtNum(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}
