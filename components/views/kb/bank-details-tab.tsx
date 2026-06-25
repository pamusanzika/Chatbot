'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Trash, Eye, EyeOff } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import {
  createBankDetailAction,
  updateBankDetailAction,
  deleteBankDetailAction,
} from '@/app/(dashboard)/knowledge-base/bank-actions'
import type { BankDetail } from '@/types'

const EMPTY_FORM = {
  bank_name: '',
  account_name: '',
  account_number: '',
  branch_name: '',
  branch_code: '',
  notes: '',
  is_active: true,
}

export function BankDetailsTab({ initialDetails }: { initialDetails: BankDetail[] }) {
  const router = useRouter()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const rows = initialDetails.filter((d) => showInactive || d.is_active)

  function openAdd() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setAdding(true)
  }

  function openEdit(d: BankDetail) {
    setEditingId(d.id)
    setForm({
      bank_name: d.bank_name,
      account_name: d.account_name,
      account_number: d.account_number,
      branch_name: d.branch_name,
      branch_code: d.branch_code,
      notes: d.notes,
      is_active: d.is_active,
    })
    setAdding(true)
  }

  function closeForm() {
    setAdding(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      alert('Bank name, account name, and account number are required.')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateBankDetailAction(editingId, form)
      } else {
        await createBankDetailAction(form)
      }
      closeForm()
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save bank detail')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bank account? This action is logged.')) return
    await deleteBankDetailAction(id)
    router.refresh()
  }

  async function handleToggleActive(d: BankDetail) {
    await updateBankDetailAction(d.id, { is_active: !d.is_active })
    router.refresh()
  }

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <p className="fb-page-sub">{initialDetails.filter((d) => d.is_active).length} active bank accounts</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="ghost" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </Button>
          <Button onClick={openAdd}>{adding && !editingId ? 'Close' : 'Add bank account'}</Button>
        </div>
      </div>

      {adding && (
        <Card>
          <SectionLabel>{editingId ? 'Edit bank account' : 'New bank account'}</SectionLabel>
          <div className="fb-form-grid" style={{ marginTop: 10 }}>
            <Field label="Bank Name">
              <Input full value={form.bank_name} placeholder="e.g. Commercial Bank" onChange={(v) => setForm((f) => ({ ...f, bank_name: v }))} />
            </Field>
            <Field label="Account Name">
              <Input full value={form.account_name} placeholder="e.g. SilkTrail Pvt Ltd" onChange={(v) => setForm((f) => ({ ...f, account_name: v }))} />
            </Field>
          </div>
          <div className="fb-form-grid" style={{ marginTop: 12 }}>
            <Field label="Account Number">
              <Input full value={form.account_number} placeholder="e.g. 8012345678" onChange={(v) => setForm((f) => ({ ...f, account_number: v }))} />
            </Field>
            <Field label="Branch Name">
              <Input full value={form.branch_name} placeholder="e.g. Colombo 07" onChange={(v) => setForm((f) => ({ ...f, branch_name: v }))} />
            </Field>
          </div>
          <div className="fb-form-grid" style={{ marginTop: 12 }}>
            <Field label="Branch Code">
              <Input full value={form.branch_code} placeholder="e.g. 001" onChange={(v) => setForm((f) => ({ ...f, branch_code: v }))} />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Additional Notes">
              <Textarea rows={2} value={form.notes} placeholder="Optional notes…" onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
            </Field>
          </div>
          <div className="fb-row-between" style={{ marginTop: 14 }}>
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update account' : 'Save account'}
            </Button>
          </div>
        </Card>
      )}

      <Card pad={0}>
        <div className="fb-table-scroll">
          <table className="fb-table">
            <thead>
              <tr>
                <th>Bank</th><th>Account Name</th><th>Account #</th>
                <th>Branch</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="fb-muted">No bank accounts yet. Click &quot;Add bank account&quot; to create one.</td></tr>
              )}
              {rows.map((d) => (
                <tr key={d.id} style={{ opacity: d.is_active ? 1 : 0.5 }}>
                  <td className="fb-strong">{d.bank_name}</td>
                  <td>{d.account_name}</td>
                  <td className="fb-mono">{d.account_number}</td>
                  <td>{d.branch_name}{d.branch_code ? ` (${d.branch_code})` : ''}</td>
                  <td>
                    <Badge tone={d.is_active ? 'teal' : 'amber'}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <div className="fb-actions">
                      <IconButton
                        icon={d.is_active ? EyeOff : Eye}
                        title={d.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleActive(d)}
                      />
                      <IconButton icon={Edit} title="Edit" onClick={() => openEdit(d)} />
                      <IconButton icon={Trash} tone="#ef4444" title="Delete" onClick={() => handleDelete(d.id)} />
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
