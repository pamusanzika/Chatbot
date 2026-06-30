import { getTenant } from '@/lib/auth'
import { getCustomers } from '@/lib/db/customers'
import { CustomersTab } from '@/components/views/customers/customers-tab'

export default async function CustomersPage() {
  const { tenantId } = await getTenant()
  const customers = await getCustomers(tenantId)
  return <CustomersTab initialCustomers={customers} />
}
