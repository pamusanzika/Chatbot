'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import {
  createBankDetail,
  updateBankDetail,
  deleteBankDetail,
} from '@/lib/db/bank-details'
import type { BankDetail } from '@/types'

export type BankDetailInput = Omit<BankDetail, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>

export async function createBankDetailAction(detail: BankDetailInput) {
  const { tenantId, tenantUser } = await getTenant()
  const created = await createBankDetail(tenantId, detail, tenantUser.email)
  revalidatePath('/knowledge-base')
  return created
}

export async function updateBankDetailAction(id: string, changes: Partial<BankDetailInput>) {
  const { tenantId, tenantUser } = await getTenant()
  const updated = await updateBankDetail(tenantId, id, changes, tenantUser.email)
  revalidatePath('/knowledge-base')
  return updated
}

export async function deleteBankDetailAction(id: string) {
  const { tenantId, tenantUser } = await getTenant()
  await deleteBankDetail(tenantId, id, tenantUser.email)
  revalidatePath('/knowledge-base')
}
