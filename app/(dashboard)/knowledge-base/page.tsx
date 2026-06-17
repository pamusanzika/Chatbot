import { KnowledgeBaseTab } from '@/components/views/kb/kb-tab'
import { getTenant } from '@/lib/auth'
import { getKbEntries } from '@/lib/db/kb'

export default async function KnowledgeBasePage() {
  const { tenantId } = await getTenant()
  const entries = await getKbEntries(tenantId)

  return <KnowledgeBaseTab initialEntries={entries} />
}
