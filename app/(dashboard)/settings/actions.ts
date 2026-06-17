'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import { updateTenantSettings, type TenantSettingsInput } from '@/lib/db/tenant'

export async function updateTenantSettingsAction(changes: TenantSettingsInput) {
  const { tenantId } = await getTenant()
  const updated = await updateTenantSettings(tenantId, changes)
  revalidatePath('/settings')
  return updated
}
