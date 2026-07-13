'use client'
import { useState } from 'react'
import {
  Database, Image, Zap, Bot, Smartphone, Bell,
  CheckCircle, XCircle, Plus, Pencil, Trash2, Copy, Check,
  Facebook, Instagram, Youtube, Globe, Twitter,
} from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Avatar } from '@/components/ui/avatar'
import { Field, Input, Select, PillNav } from '@/components/ui/inputs'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { ACCENT_PRESETS, SETTINGS_SECTIONS, fmtNum } from '@/lib/constants'
import { useTheme, type FontSizeLabel } from '@/components/layout/theme-provider'
import { updateTenantSettingsAction } from '@/app/(dashboard)/settings/actions'
import { useCurrency } from '@/components/layout/currency-provider'
import type { SettingsSection } from '@/lib/constants'
import type { SocialLinks, Tenant, Usage } from '@/types'

const INDUSTRY_OPTIONS = [
  'Fashion / Apparel', 'Food & Beverage', 'Electronics', 'Beauty & Cosmetics',
  'Home & Living', 'Health & Wellness', 'Services', 'Other',
]

const CURRENCY_OPTIONS = ['LKR – Sri Lanka Rupee', 'USD – US Dollar']

const SOCIAL_PLATFORMS: { key: keyof SocialLinks; label: string; icon: any; placeholder: string }[] = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/yourpage' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourhandle' },
  { key: 'tiktok', label: 'TikTok', icon: Zap, placeholder: 'https://tiktok.com/@yourhandle' },
  { key: 'twitter', label: 'X (Twitter)', icon: Twitter, placeholder: 'https://x.com/yourhandle' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://yourbusiness.com' },
]

const USERS: { name: string; email: string; role: 'Owner' | 'Admin' | 'Staff'; status: 'Active' | 'Invited'; last: string; added: string; initials: string }[] = []
const INTEGRATIONS: { name: string; detail: string; icon: string; connected: boolean; color: string }[] = []
const NOTIF_ROWS: { label: string; desc: string; push: boolean; wa: boolean }[] = []
const WA_TEMPLATES: { name: string; body: string }[] = []
const TAB_PERMS: string[] = []
const PERM_MATRIX: Record<string, boolean[]> = { Owner: [], Admin: [], Staff: [] }
const USAGE: Usage = { id: '', tenant_id: '', month: '', tokens_used: 0, tokens_limit: 1, orders_processed: 0, active_customers: 0 }

const ICON_MAP: Record<string, any> = {
  Database, Image, Zap, Bot, Smartphone, Bell,
}

/* ── General ─────────────────────────────────────────────── */
function currencyToCode(label: string) {
  return label.startsWith('USD') ? 'USD' : 'LKR'
}
function codeToCurrency(code: string) {
  return code === 'USD' ? 'USD – US Dollar' : 'LKR – Sri Lanka Rupee'
}

function GeneralSection({ tenant }: { tenant: Tenant }) {
  const [name, setName] = useState(tenant.name ?? '')
  const [industry, setIndustry] = useState(tenant.industry ?? INDUSTRY_OPTIONS[0])
  const [email, setEmail] = useState(tenant.email ?? '')
  const [phone, setPhone] = useState(tenant.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(tenant.whatsapp_number ?? '')
  const [currency, setCurrency] = useState(codeToCurrency(tenant.currency))
  const [address, setAddress] = useState(tenant.address ?? '')
  const [social, setSocial] = useState<SocialLinks>(tenant.social_links ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { setCurrency: setGlobalCurrency } = useCurrency()

  const setSocialLink = (key: keyof SocialLinks, value: string) =>
    setSocial((s) => ({ ...s, [key]: value }))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateTenantSettingsAction({
        name,
        industry,
        email,
        phone,
        whatsapp_number: whatsapp,
        address,
        currency: currencyToCode(currency),
        social_links: social,
      })
      setGlobalCurrency(currencyToCode(currency))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fb-stack" style={{ gap: 16 }}>
      <Card>
        <SectionLabel>Business info</SectionLabel>
        <div className="fb-form-grid" style={{ marginTop: 12 }}>
          <Field label="Business name">
            <Input full value={name} onChange={setName} />
          </Field>
          <Field label="Industry">
            <Select full value={industry} onChange={setIndustry} options={INDUSTRY_OPTIONS} />
          </Field>
          <Field label="Primary contact email">
            <Input full value={email} onChange={setEmail} />
          </Field>
          <Field label="Phone number">
            <Input full value={phone} onChange={setPhone} mono />
          </Field>
          <Field label="WhatsApp number">
            <Input full value={whatsapp} onChange={setWhatsapp} mono />
          </Field>
          <Field label="Currency">
            <Select full value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} />
          </Field>
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label="Business address">
            <Input full value={address} onChange={setAddress} />
          </Field>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {saved && <span className="fb-muted" style={{ fontSize: 12, color: '#2dd4a0' }}>Saved</span>}
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
        </div>
      </Card>

      <Card>
        <SectionLabel>Social media links</SectionLabel>
        <div className="fb-form-grid" style={{ marginTop: 12 }}>
          {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, placeholder }) => (
            <Field key={key} label={label}>
              <Input
                full
                icon={Icon}
                value={social[key] ?? ''}
                onChange={(v) => setSocialLink(key, v)}
                placeholder={placeholder}
                mono
              />
            </Field>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {saved && <span className="fb-muted" style={{ fontSize: 12, color: '#2dd4a0' }}>Saved</span>}
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
        </div>
      </Card>
    </div>
  )
}

/* ── Appearance ───────────────────────────────────────────── */
function AppearanceSection() {
  const { theme, setTheme, accent, setAccent, fontSize, setFontSize } = useTheme()

  return (
    <div className="fb-stack" style={{ gap: 16 }}>
      <Card>
        <SectionLabel>Theme</SectionLabel>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          {([
            { t: 'light' as const, bg: '#ffffff', fg: '#111827', desc: 'Default light mode' },
            { t: 'dark'  as const, bg: '#0d0f14', fg: '#e5e7eb', desc: 'Easy on the eyes'   },
          ]).map(({ t, bg, fg, desc }) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                flex: 1, padding: '16px 20px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${theme === t ? 'var(--accent)' : 'var(--border)'}`,
                background: bg, color: fg,
                textAlign: 'left', transition: 'border 0.15s',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>{t}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>Accent colour</SectionLabel>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.c}
              title={p.name}
              onClick={() => setAccent(p.c)}
              style={{
                width: 36, height: 36, borderRadius: '50%', background: p.c,
                border: `3px solid ${accent === p.c ? p.c : 'transparent'}`,
                outline: accent === p.c ? `2px solid ${p.c}` : 'none',
                outlineOffset: 2, cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>Font size</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <Select
            value={fontSize}
            onChange={(v) => setFontSize(v as FontSizeLabel)}
            options={['Small (12px)', 'Medium (14px)', 'Large (16px)']}
            style={{ width: 200 }}
          />
        </div>
      </Card>
    </div>
  )
}

/* ── Notifications ────────────────────────────────────────── */
function NotificationsSection() {
  const [rows, setRows] = useState(NOTIF_ROWS)
  const toggle = (i: number, key: 'push' | 'wa') =>
    setRows((r) => r.map((row, j) => j === i ? { ...row, [key]: !row[key] } : row))

  return (
    <Card pad={0}>
      <div style={{ padding: '14px 16px 10px' }}>
        <SectionLabel>Notification preferences</SectionLabel>
      </div>
      <table className="fb-table">
        <thead>
          <tr>
            <th>Event</th>
            <th className="ctr" style={{ width: 90 }}>Push</th>
            <th className="ctr" style={{ width: 90 }}>WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label}>
              <td>
                <div className="fb-strong" style={{ fontSize: 13 }}>{r.label}</div>
                <div className="fb-muted" style={{ fontSize: 12 }}>{r.desc}</div>
              </td>
              <td className="ctr">
                <Toggle on={r.push} onChange={() => toggle(i, 'push')} size="sm" />
              </td>
              <td className="ctr">
                <Toggle on={r.wa} onChange={() => toggle(i, 'wa')} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/* ── Users & Roles ───────────────────────────────────────── */
function UsersSection() {
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="fb-stack" style={{ gap: 14 }}>
      <Card pad={0}>
        <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>Team members</SectionLabel>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus size={14} style={{ marginRight: 4 }} />Invite
          </Button>
        </div>
        <table className="fb-table">
          <thead>
            <tr><th>User</th><th>Role</th><th>Status</th><th>Last active</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {USERS.map((u) => (
              <tr key={u.email}>
                <td>
                  <div className="fb-user-cell">
                    <Avatar initials={u.initials} color={u.role === 'Owner' ? '#7c6dfa' : u.role === 'Admin' ? '#3b82f6' : '#2dd4a0'} size={28} />
                    <div>
                      <div className="fb-strong" style={{ fontSize: 13 }}>{u.name}</div>
                      <div className="fb-muted" style={{ fontSize: 12 }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge tone={u.role === 'Owner' ? 'purple' : u.role === 'Admin' ? 'teal' : 'gray'}>
                    {u.role}
                  </Badge>
                </td>
                <td>
                  <Badge tone={u.status === 'Active' ? 'teal' : 'amber'} dot>{u.status}</Badge>
                </td>
                <td className="fb-muted">{u.last}</td>
                <td>
                  <div className="fb-actions">
                    <button className="fb-iconbtn" title="Edit"><Pencil size={14} /></button>
                    {u.role !== 'Owner' && (
                      <button className="fb-iconbtn" title="Remove" style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card pad={0}>
        <div style={{ padding: '14px 16px 10px' }}>
          <SectionLabel>Permissions matrix</SectionLabel>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="fb-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Tab / Feature</th>
                {Object.keys(PERM_MATRIX).map((role) => (
                  <th key={role} className="ctr" style={{ width: 80 }}>{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TAB_PERMS.map((tab, i) => (
                <tr key={tab}>
                  <td style={{ fontSize: 13 }}>{tab}</td>
                  {Object.values(PERM_MATRIX).map((perms, j) => (
                    <td key={j} className="ctr">
                      {perms[i]
                        ? <CheckCircle size={14} style={{ color: '#2dd4a0' }} />
                        : <XCircle size={14} style={{ color: 'var(--text-muted)' }} />
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite team member">
        <div className="fb-stack" style={{ gap: 14 }}>
          <Field label="Email address">
            <Input full value="" placeholder="colleague@silktrail.lk" onChange={() => {}} />
          </Field>
          <Field label="Role">
            <Select full value="Staff" options={['Admin', 'Staff']} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => setInviteOpen(false)}>Send invite</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ── WhatsApp ─────────────────────────────────────────────── */
function WhatsAppSection() {
  const [copied, setCopied] = useState(false)
  const webhook = 'https://flowbot.app/webhook/wa/silktrail-prod'
  const copy = () => { navigator.clipboard.writeText(webhook); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="fb-stack" style={{ gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone size={18} color="#fff" />
          </div>
          <div>
            <div className="fb-strong">Meta WhatsApp Business API</div>
            <div className="fb-muted" style={{ fontSize: 12 }}>Connected · verified</div>
          </div>
          <div style={{ marginLeft: 'auto' }}><Badge tone="teal" dot>Connected</Badge></div>
        </div>

        <SectionLabel>Configuration</SectionLabel>
        <div className="fb-form-grid" style={{ marginTop: 12 }}>
          <Field label="Phone number ID">
            <Input full value="106783291234567" onChange={() => {}} mono />
          </Field>
          <Field label="WABA ID">
            <Input full value="876543210987654" onChange={() => {}} mono />
          </Field>
          <Field label="Access token">
            <Input full value="EAAxxxxxxxxxxxxxxxx" onChange={() => {}} mono />
          </Field>
          <Field label="Verify token">
            <Input full value="silktrail_verify_2025" onChange={() => {}} mono />
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Webhook URL (copy to Meta dashboard)">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input full value={webhook} onChange={() => {}} mono style={{ flex: 1 }} />
              <button className="fb-iconbtn" onClick={copy} title="Copy">
                {copied ? <Check size={15} style={{ color: '#2dd4a0' }} /> : <Copy size={15} />}
              </button>
            </div>
          </Field>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button>Save</Button>
        </div>
      </Card>

      <Card pad={0}>
        <div style={{ padding: '14px 16px 10px' }}>
          <SectionLabel>Message templates</SectionLabel>
        </div>
        <table className="fb-table">
          <thead>
            <tr><th>Template name</th><th>Preview</th></tr>
          </thead>
          <tbody>
            {WA_TEMPLATES.map((t) => (
              <tr key={t.name}>
                <td className="fb-strong" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{t.name}</td>
                <td className="fb-muted" style={{ fontSize: 12, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.body}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ── Chatbot ──────────────────────────────────────────────── */
const DEFAULT_LANGS = [
  { name: 'English', enabled: true },
  { name: 'Sinhala', enabled: true },
  { name: 'Tamil', enabled: true },
  { name: 'Singlish', enabled: true },
]

function ChatbotSection({ tenant }: { tenant: Tenant }) {
  const s = tenant.chatbot_settings
  const [botName, setBotName] = useState(s?.bot_name ?? 'Silk Bot')
  const [systemPrompt, setSystemPrompt] = useState(
    s?.system_prompt ??
      'You are Silk Bot, a friendly assistant for Silk Trail — a Sri Lankan fashion retailer. Help customers with orders, delivery, sizing, stock queries, and complaints. Always reply in the same language the customer uses. Keep replies concise.'
  )
  const [langs, setLangs] = useState(s?.languages ?? DEFAULT_LANGS)
  const [fallback, setFallback] = useState(s?.fallback_message ?? "Sorry, I didn't understand that. Can you rephrase?")
  const [handoffTriggers, setHandoffTriggers] = useState(s?.handoff_triggers ?? 'speak to agent, human, real person')
  const [handoffMsg, setHandoffMsg] = useState(s?.handoff_message ?? 'Connecting you to a team member, please hold')
  const [supportNumber, setSupportNumber] = useState(s?.support_number ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleLang = (i: number) =>
    setLangs((v) => v.map((l, j) => j === i ? { ...l, enabled: !l.enabled } : l))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateTenantSettingsAction({
        chatbot_settings: {
          bot_name: botName,
          language_model: '',
          system_prompt: systemPrompt,
          languages: langs,
          fallback_message: fallback,
          handoff_triggers: handoffTriggers,
          handoff_message: handoffMsg,
          support_number: supportNumber,
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fb-stack" style={{ gap: 14 }}>
      <Card>
        <SectionLabel>Bot identity</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <Field label="Bot name">
            <Input full value={botName} onChange={setBotName} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="System prompt">
            <textarea
              className="fb-textarea"
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Languages</SectionLabel>
        <div className="fb-stack" style={{ gap: 10, marginTop: 12 }}>
          {langs.map((l, i) => (
            <div key={l.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>{l.name}</span>
              <Toggle on={l.enabled} onChange={() => toggleLang(i)} size="sm" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>Fallback messages</SectionLabel>
        <div className="fb-stack" style={{ gap: 10, marginTop: 12 }}>
          <Field label="Default fallback">
            <Input full value={fallback} onChange={setFallback} />
          </Field>
          <Field label="Handoff trigger phrase">
            <Input full value={handoffTriggers} onChange={setHandoffTriggers} />
          </Field>
          <Field label="Handoff message">
            <Input full value={handoffMsg} onChange={setHandoffMsg} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Support</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <Field label="Support contact number">
            <Input full value={supportNumber} onChange={setSupportNumber} placeholder="+94771234567" />
          </Field>
          <div className="fb-muted" style={{ fontSize: 12, marginTop: 6 }}>
            Given to customers when the bot can&apos;t make changes to their order itself (e.g. it&apos;s already confirmed).
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {saved && <span className="fb-muted" style={{ fontSize: 12, color: '#2dd4a0' }}>Saved</span>}
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save chatbot settings'}</Button>
        </div>
      </Card>
    </div>
  )
}

/* ── Integrations ─────────────────────────────────────────── */
function IntegrationsSection() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {INTEGRATIONS.map((intg) => {
        const Icon = ICON_MAP[intg.icon] ?? Database
        return (
          <Card key={intg.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: intg.connected ? intg.color + '22' : 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} style={{ color: intg.connected ? intg.color : 'var(--text-muted)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fb-strong" style={{ fontSize: 13 }}>{intg.name}</div>
                <div className="fb-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{intg.detail}</div>
              </div>
              {intg.connected
                ? <Badge tone="teal" dot>Connected</Badge>
                : <Button size="sm" variant="secondary">Connect</Button>
              }
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/* ── Billing ──────────────────────────────────────────────── */
function BillingSection() {
  const { fmt } = useCurrency()
  const tokPct = Math.round((USAGE.tokens_used / USAGE.tokens_limit) * 100)

  const plans = [
    { name: 'Starter', price: 'Free', tokens: '1M tokens', orders: '100 orders/mo', current: false },
    { name: 'Growth', price: 'Rs 4,900/mo', tokens: '10M tokens', orders: '2,000 orders/mo', current: true },
    { name: 'Scale', price: 'Rs 14,900/mo', tokens: '50M tokens', orders: 'Unlimited orders', current: false },
  ]

  return (
    <div className="fb-stack" style={{ gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {plans.map((p) => (
          <Card key={p.name} style={p.current ? { border: '2px solid var(--accent)' } : {}}>
            {p.current && <div style={{ marginBottom: 8 }}><Badge tone="purple">Current plan</Badge></div>}
            <div className="fb-strong" style={{ fontSize: 16 }}>{p.name}</div>
            <div className="mono" style={{ fontSize: 20, margin: '6px 0', color: 'var(--accent)' }}>{p.price}</div>
            <div className="fb-stack" style={{ gap: 4, marginTop: 8 }}>
              <div className="fb-muted" style={{ fontSize: 12 }}>· {p.tokens}</div>
              <div className="fb-muted" style={{ fontSize: 12 }}>· {p.orders}</div>
            </div>
            {!p.current && (
              <Button variant="secondary" size="sm" style={{ marginTop: 12, width: '100%' }}>
                {plans.indexOf(p) > 1 ? 'Upgrade' : 'Downgrade'}
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <SectionLabel>This month's usage</SectionLabel>
        <div className="fb-stack" style={{ gap: 14, marginTop: 12 }}>
          {[
            { label: 'Tokens', used: fmtNum(USAGE.tokens_used), limit: fmtNum(USAGE.tokens_limit), pct: tokPct },
            { label: 'Orders processed', used: fmtNum(USAGE.orders_processed), limit: '2,000', pct: Math.round((USAGE.orders_processed / 2000) * 100) },
            { label: 'Active customers', used: fmtNum(USAGE.active_customers), limit: '5,000', pct: Math.round((USAGE.active_customers / 5000) * 100) },
          ].map((m) => (
            <div key={m.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>{m.label}</span>
                <span className="mono fb-muted">{m.used} / {m.limit}</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--border)' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: m.pct > 80 ? '#ef4444' : m.pct > 60 ? '#f5a623' : 'var(--accent)',
                  width: `${m.pct}%`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card pad={0}>
        <div style={{ padding: '14px 16px 10px' }}>
          <SectionLabel>Payment history</SectionLabel>
        </div>
        <table className="fb-table">
          <thead>
            <tr><th>Date</th><th>Description</th><th className="num">Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {[
              { date: '01 Jun 2026', desc: 'Growth Plan – June 2026', amt: 4900, status: 'Paid' },
              { date: '01 May 2026', desc: 'Growth Plan – May 2026',  amt: 4900, status: 'Paid' },
              { date: '01 Apr 2026', desc: 'Growth Plan – April 2026', amt: 4900, status: 'Paid' },
            ].map((inv) => (
              <tr key={inv.date}>
                <td className="fb-muted">{inv.date}</td>
                <td>{inv.desc}</td>
                <td className="num mono fb-strong">{fmt(inv.amt)}</td>
                <td><Badge tone="teal" dot>{inv.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ── Root ─────────────────────────────────────────────────── */
export function SettingsTab({ tenant }: { tenant: Tenant }) {
  const [active, setActive] = useState<SettingsSection>('General')

  const SECTION_CONTENT: Record<SettingsSection, React.ReactNode> = {
    'General': <GeneralSection tenant={tenant} />,
    'Appearance': <AppearanceSection />,
    'Notifications': <NotificationsSection />,
    'Users & Roles': <UsersSection />,
    'WhatsApp': <WhatsAppSection />,
    'Chatbot': <ChatbotSection tenant={tenant} />,
    'Integrations': <IntegrationsSection />,
    'Billing': <BillingSection />,
  }

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div>
        <h1 className="fb-page-title">Settings</h1>
        <p className="fb-page-sub">Manage your workspace preferences</p>
      </div>

      <div className="fb-settings-layout">
        <nav className="fb-settings-nav">
          {SETTINGS_SECTIONS.map((s) => (
            <button
              key={s}
              className={`fb-settings-navitem${active === s ? ' active' : ''}`}
              onClick={() => setActive(s)}
            >
              {s}
            </button>
          ))}
        </nav>
        <div className="fb-settings-content">
          {SECTION_CONTENT[active]}
        </div>
      </div>
    </div>
  )
}
