import { getTenant } from '@/lib/auth'
import { getPaymentOrders } from '@/lib/db/payments'
import { PaymentsTab } from '@/components/views/payments/payments-tab'

export default async function PaymentsPage() {
  const { tenantId, tenantUser } = await getTenant()
  const orders = await getPaymentOrders(tenantId, 'all')
  return <PaymentsTab initialOrders={orders} userRole={tenantUser.role} />
}
