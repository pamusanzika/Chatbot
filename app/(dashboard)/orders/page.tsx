import { OrdersTab } from '@/components/views/orders/orders-tab'
import { getTenant } from '@/lib/auth'
import { getOrders } from '@/lib/db/orders'

export default async function OrdersPage() {
  const { tenantId } = await getTenant()
  const orders = await getOrders(tenantId)
  return <OrdersTab initialOrders={orders} />
}
