'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Trash } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge, LangBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillNav, Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import { LANG_META } from '@/lib/constants'
import { createKbEntryAction, updateKbEntryAction, deleteKbEntryAction } from '@/app/(dashboard)/knowledge-base/actions'
import type { Lang, KbEntry } from '@/types'

const LANG_FILTERS = [
  { key: 'All', label: 'All' },
  { key: 'EN', label: 'English' },
  { key: 'SI', label: 'Sinhala' },
  { key: 'TA', label: 'Tamil' },
  { key: 'SL', label: 'Singlish' },
]

const LANG_OPTIONS: Lang[] = ['EN', 'SI', 'TA', 'SL']
const KB_CATEGORIES = [
  'Payment',
  'Delivery and Shipping',
  'Ordering Process',
  'Order Status',
  'Returns and Exchanges',
  'Promotions and Offers',
  'Other',
]

const EMPTY_FORM = {
  category: '',
  language: 'EN' as Lang,
  question: '',
  answer: '',
  keywords: '',
}

export function KnowledgeBaseTab({
  initialEntries,
}: {
  initialEntries: KbEntry[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState('All')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const entries = initialEntries

  const rows = entries.filter((e) => filter === 'All' || e.language === filter)

  function openAdd() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, category: KB_CATEGORIES[0] })
    setAdding(true)
  }

  function openEdit(e: KbEntry) {
    setEditingId(e.id)
    setForm({
      category: e.category,
      language: e.language as Lang,
      question: e.question,
      answer: e.answer,
      keywords: e.keywords.join(', '),
    })
    setAdding(true)
  }

  function closeForm() {
    setAdding(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.question.trim() || !form.answer.trim()) {
      alert('Question and answer are required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        category: form.category || KB_CATEGORIES[0],
        language: form.language,
        question: form.question.trim(),
        answer: form.answer.trim(),
        keywords: form.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      }
      if (editingId) {
        await updateKbEntryAction(editingId, payload)
      } else {
        await createKbEntryAction(payload)
      }
      closeForm()
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this knowledge base entry?')) return
    await deleteKbEntryAction(id)
    router.refresh()
  }

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Knowledge Base</h1>
          <p className="fb-page-sub">{entries.length} answers train your bot</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={openAdd}>{adding && !editingId ? 'Close' : 'Add entry'}</Button>
        </div>
      </div>

      <PillNav items={LANG_FILTERS} value={filter} onChange={setFilter} />

      {/* Inline add/edit form */}
      {adding && (
        <Card>
          <SectionLabel>{editingId ? 'Edit entry' : 'New entry'}</SectionLabel>
          <div className="fb-form-grid" style={{ marginTop: 10 }}>
            <Field label="Category">
              <Select
                full
                value={form.category}
                options={KB_CATEGORIES}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
              />
            </Field>
            <Field label="Language">
              <Select
                full
                value={LANG_META[form.language].name}
                options={LANG_OPTIONS.map((l) => LANG_META[l].name)}
                onChange={(v) => {
                  const lang = LANG_OPTIONS.find((l) => LANG_META[l].name === v) ?? 'EN'
                  setForm((f) => ({ ...f, language: lang }))
                }}
              />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Question">
              <Input
                full
                value={form.question}
                placeholder="Customer question…"
                onChange={(v) => setForm((f) => ({ ...f, question: v }))}
              />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Answer">
              <Textarea
                rows={2}
                value={form.answer}
                placeholder="Bot reply…"
                onChange={(v) => setForm((f) => ({ ...f, answer: v }))}
              />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Keywords" hint="Comma separated, used for bot matching">
              <Input
                full
                value={form.keywords}
                placeholder="delivery, shipping, courier"
                onChange={(v) => setForm((f) => ({ ...f, keywords: v }))}
              />
            </Field>
          </div>
          <div className="fb-row-between" style={{ marginTop: 14 }}>
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update entry' : 'Save entry'}
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card pad={0}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>Category</th><th>Question</th><th>Answer</th>
                <th>Keywords</th><th>Lang</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="fb-muted">No knowledge base entries yet. Click "Add entry" to create your first one.</td></tr>
              )}
              {rows.map((e) => (
                <tr key={e.id}>
                  <td><Badge tone="purple">{e.category}</Badge></td>
                  <td className="fb-strong" style={{ maxWidth: 200 }}>{e.question}</td>
                  <td
                    className="fb-muted fb-truncate"
                    style={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {e.answer}
                  </td>
                  <td>
                    <div className="fb-kw">
                      {e.keywords.slice(0, 2).map((t) => (
                        <span className="fb-tag-sm" key={t}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td><LangBadge code={e.language as Lang} /></td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <div className="fb-actions">
                      <IconButton icon={Edit} title="Edit" onClick={() => openEdit(e)} />
                      <IconButton icon={Trash} tone="#ef4444" title="Delete" onClick={() => handleDelete(e.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
