import { getTenant } from '@/lib/auth'
import { getAnalyticsData, resolveRange, type AnalyticsRange } from '@/lib/db/analytics'
import { AnalyticsTab } from '@/components/views/analytics/analytics-tab'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const { range: rangeParam, from, to } = await searchParams
  const range = (rangeParam ?? 'this_month') as AnalyticsRange

  const { tenant, tenantId } = await getTenant()
  const data = await getAnalyticsData(tenantId, tenant.currency, resolveRange(range, from, to))

  return <AnalyticsTab {...data} range={range} from={from} to={to} />
}
