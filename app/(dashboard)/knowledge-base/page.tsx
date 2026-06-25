import { KnowledgeBaseContent } from '@/components/views/kb/kb-content'
import { getTenant } from '@/lib/auth'
import { getKbEntries } from '@/lib/db/kb'
import { getBankDetails } from '@/lib/db/bank-details'

export default async function KnowledgeBasePage() {
  const { tenantId } = await getTenant()
  const [entries, bankDetails] = await Promise.all([
    getKbEntries(tenantId),
    getBankDetails(tenantId),
  ])

  return <KnowledgeBaseContent initialEntries={entries} initialBankDetails={bankDetails} />
}
