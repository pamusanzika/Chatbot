// ============================================================
// FlowBot — shared TypeScript types
// ============================================================

export type Theme = 'light' | 'dark'
export type Lang = 'EN' | 'SI' | 'TA' | 'SL'
export type OrderStatus = 'pending' | 'awaiting_payment' | 'pending_verification' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentMethod = 'COD' | 'Bank'
export type ComplaintStatus = 'open' | 'progress' | 'resolved'
export type UserRole = 'Owner' | 'Admin' | 'Staff'
export type UserStatus = 'Active' | 'Invited' | 'Suspended'
export type ChatIntent = 'Order' | 'Delivery' | 'Stock' | 'Complaint' | 'Handoff' | 'Other'
export type StockReason = 'Restock' | 'Sale' | 'Damaged' | 'Return' | 'Adjustment'

// ── Tenant ──────────────────────────────────────────────────
export interface SocialLinks {
  facebook?: string
  instagram?: string
  tiktok?: string
  twitter?: string
  website?: string
  youtube?: string
}

export interface ChatbotSettings {
  bot_name: string
  language_model: string
  system_prompt: string
  languages: { name: string; enabled: boolean }[]
  fallback_message: string
  handoff_triggers: string
  handoff_message: string
}

export interface Tenant {
  id: string
  clerk_org_id: string
  name: string
  phone: string
  whatsapp_number: string | null
  email: string
  address: string
  industry: string | null
  default_language: Lang
  timezone: string
  currency: string
  social_links: SocialLinks
  chatbot_settings: ChatbotSettings | null
  plan: 'free' | 'starter' | 'pro'
  trial_ends_at: string | null
  created_at: string
}

// ── Tenant User ─────────────────────────────────────────────
export interface TenantUser {
  id: string
  tenant_id: string
  clerk_user_id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  last_active_at: string | null
  created_at: string
}

// ── Order ───────────────────────────────────────────────────
export interface OrderItem {
  name: string
  variant?: string
  quantity: number
  unit_price: number
  line_total: number
  price_unverified?: boolean
}

export interface Order {
  id: string
  tenant_id: string
  order_ref: string
  // n8n / WhatsApp fields
  session_id: string | null
  phone: string | null
  channel: string
  language: string | null
  currency: string
  // Customer
  customer_name: string
  customer_phone: string | null
  delivery_address: string | null
  contact_number: string | null
  // Legacy dashboard fields (nullable for bot-created orders)
  customer_id: string | null
  delivery_zone: string | null
  estimated_days: string | null
  chat_session_id: string | null
  payment_slip_url: string | null
  // Order
  items: OrderItem[]
  payment_method: string
  status: OrderStatus
  subtotal: number
  delivery_fee: number
  total: number
  created_at: string
  updated_at: string
}

// ── Product ─────────────────────────────────────────────────
export interface ProductVariant {
  id: string
  product_id: string
  tenant_id: string
  size: string
  color_hex: string
  color_name: string
  price: number
  stock: number
  low_stock_threshold: number
  sku: string
}

export interface Product {
  id: string
  tenant_id: string
  name: string
  category: string
  base_price: number
  description: string | null
  image_urls: string[]
  is_active: boolean
  // Direct stock tracking for products with no variants (e.g. "White Socks")
  sku: string | null
  stock: number | null
  low_stock_threshold: number
  variants: ProductVariant[]
  created_at: string
}

// ── Category ─────────────────────────────────────────────────
export interface Category {
  id: string
  tenant_id: string
  name: string
  color: string
  created_at: string
}

// ── KB Entry ─────────────────────────────────────────────────
export interface KbEntry {
  id: string
  tenant_id: string
  category: string
  question: string
  answer: string
  keywords: string[]
  language: Lang
  created_at: string
}

// ── Customer ─────────────────────────────────────────────────
export interface Customer {
  id: string
  tenant_id: string
  name: string
  phone: string
  language: Lang
  total_orders: number
  total_spent: number
  last_order_at: string | null
  created_at: string
}

// ── Delivery Zone ────────────────────────────────────────────
export interface DeliveryZone {
  id: string
  tenant_id: string
  zone_type: 'province' | 'flat_rate' | 'worldwide'
  province: string
  district: string
  cities: string[]
  fee: number
  estimated_days: string
  free_delivery_threshold: number
  is_active: boolean
}

// ── Chat Session ─────────────────────────────────────────────
export interface ChatMessage {
  id: string
  session_id: string
  tenant_id: string
  role: 'user' | 'assistant'
  content: string
  language: Lang | null
  intent: ChatIntent | null
  tokens_used: number | null
  created_at: string
}

export interface ChatSession {
  id: string
  tenant_id: string
  session_id: string
  phone: string
  channel: string | null
  language: Lang | null
  intent: ChatIntent | null
  flagged: boolean
  flag_note: string | null
  message_count: number
  last_message_at: string
  created_at: string
}

export interface ChatStats {
  totalSessions: number
  totalMessages: number
  flaggedCount: number
  languageBreakdown: Record<string, number>
}

// ── Complaint ────────────────────────────────────────────────
export interface ComplaintNote {
  author: string
  text: string
  created_at: string
}

export interface Complaint {
  id: string
  tenant_id: string
  complaint_ref: string
  customer_id: string
  customer_name: string
  summary: string
  status: ComplaintStatus
  assigned_to: string | null
  notes: ComplaintNote[]
  language: Lang
  created_at: string
}

// ── Usage ────────────────────────────────────────────────────
export interface Usage {
  id: string
  tenant_id: string
  month: string
  tokens_used: number
  tokens_limit: number
  orders_processed: number
  active_customers: number
}

// ── Bank Detail ─────────────────────────────────────────────
export interface BankDetail {
  id: string
  tenant_id: string
  bank_name: string
  account_name: string
  account_number: string
  branch_name: string
  branch_code: string
  notes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BankDetailAuditLog {
  id: string
  tenant_id: string
  bank_detail_id: string | null
  action: 'create' | 'update' | 'delete'
  changes: Record<string, unknown>
  performed_by: string
  created_at: string
}

// ── Payment Proof ───────────────────────────────────────────
export interface PaymentProof {
  id: string
  order_id: string
  tenant_id: string
  storage_path: string
  mime_type: string
  file_name: string
  customer_reference: string | null
  uploaded_at: string
}

// ── Audit Log ───────────────────────────────────────────────
export interface AuditLog {
  id: string
  tenant_id: string
  actor: string
  action: string
  entity_type: string
  entity_id: string
  meta: Record<string, unknown>
  created_at: string
}

// ── Payment Review (joined) ─────────────────────────────────
export interface PaymentOrder extends Order {
  payment_proof: PaymentProof | null
  signed_proof_url?: string
  audit_logs?: AuditLog[]
}

// ── UI helpers ───────────────────────────────────────────────
export interface StatCard {
  id: string
  label: string
  value: string
  icon: string
  tone: 'purple' | 'teal' | 'amber' | 'red'
  trend: number
  up: boolean
  sub: string
}

export interface ActivityEvent {
  type: 'order' | 'chat' | 'complaint' | 'handoff'
  dot: string
  text: string
  time: string
}

export interface NavItem {
  id: string
  label: string
  icon: string
  badge?: number
}
