'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import {
  upsertDeliveryZone,
  toggleZone,
  deleteZone,
} from '@/lib/db/delivery-zones'
import type { DeliveryZone } from '@/types'

export async function saveZoneAction(zone: Omit<DeliveryZone, 'id' | 'tenant_id'> & { id?: string }) {
  const { tenantId } = await getTenant()
  await upsertDeliveryZone(tenantId, zone)
  revalidatePath('/delivery')
}

export async function toggleZoneAction(id: string, isActive: boolean) {
  const { tenantId } = await getTenant()
  await toggleZone(tenantId, id, isActive)
  revalidatePath('/delivery')
}

export async function deleteZoneAction(id: string) {
  const { tenantId } = await getTenant()
  await deleteZone(tenantId, id)
  revalidatePath('/delivery')
}
