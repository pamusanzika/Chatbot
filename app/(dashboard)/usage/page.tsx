import { getTenant } from '@/lib/auth'
import { getUsageSummary, getDailyUsage } from '@/lib/db/token-usage'
import { UsageTab } from '@/components/views/usage/usage-tab'

export default async function UsagePage() {
  const { tenantId } = await getTenant()
  const [summary, daily] = await Promise.all([
    getUsageSummary(tenantId),
    getDailyUsage(tenantId, 30),
  ])

  return <UsageTab summary={summary} initialDaily={daily} />
}
