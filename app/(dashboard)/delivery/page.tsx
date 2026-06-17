import { DeliveryTab } from '@/components/views/delivery/delivery-tab'
import { getTenant } from '@/lib/auth'
import { getDeliveryZones } from '@/lib/db/delivery-zones'

export default async function DeliveryPage() {
  const { tenantId } = await getTenant()
  const zones = await getDeliveryZones(tenantId)

  return <DeliveryTab initialZones={zones} />
}
