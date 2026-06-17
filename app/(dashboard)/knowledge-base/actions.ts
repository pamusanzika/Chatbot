'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import { createKbEntry, updateKbEntry, deleteKbEntry } from '@/lib/db/kb'
import type { KbEntry } from '@/types'

export type KbEntryInput = Omit<KbEntry, 'id' | 'tenant_id' | 'created_at'>

export async function createKbEntryAction(entry: KbEntryInput) {
  const { tenantId } = await getTenant()
  const created = await createKbEntry(tenantId, entry)
  revalidatePath('/knowledge-base')
  return created
}

export async function updateKbEntryAction(id: string, changes: Partial<KbEntryInput>) {
  const { tenantId } = await getTenant()
  const updated = await updateKbEntry(tenantId, id, changes)
  revalidatePath('/knowledge-base')
  return updated
}

export async function deleteKbEntryAction(id: string) {
  const { tenantId } = await getTenant()
  await deleteKbEntry(tenantId, id)
  revalidatePath('/knowledge-base')
}
