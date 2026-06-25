'use client'
import { useState } from 'react'
import { PillNav } from '@/components/ui/inputs'
import { KnowledgeBaseTab } from './kb-tab'
import { BankDetailsTab } from './bank-details-tab'
import type { KbEntry, BankDetail } from '@/types'

const TABS = [
  { key: 'faq', label: 'FAQ Entries' },
  { key: 'bank', label: 'Bank Details' },
]

export function KnowledgeBaseContent({
  initialEntries,
  initialBankDetails,
}: {
  initialEntries: KbEntry[]
  initialBankDetails: BankDetail[]
}) {
  const [tab, setTab] = useState('faq')

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div>
        <h1 className="fb-page-title">Knowledge Base</h1>
        <p className="fb-page-sub">Manage FAQ entries and bank details for your chatbot</p>
      </div>

      <PillNav items={TABS} value={tab} onChange={setTab} />

      {tab === 'faq' && <KnowledgeBaseTab initialEntries={initialEntries} />}
      {tab === 'bank' && <BankDetailsTab initialDetails={initialBankDetails} />}
    </div>
  )
}
