import { getTenant } from '@/lib/auth'
import { getOverviewData, resolveRange, type OverviewRange } from '@/lib/db/overview'
import { OverviewTab } from '@/components/views/overview/overview-tab'

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const { range: rangeParam, from, to } = await searchParams
  const range = (rangeParam ?? 'this_month') as OverviewRange

  const { tenant, tenantUser, tenantId } = await getTenant()
  const data = await getOverviewData(tenantId, tenant.currency, resolveRange(range, from, to))

  return (
    <OverviewTab
      {...data}
      range={range}
      from={from}
      to={to}
      userName={tenantUser.name}
      businessName={tenant.name}
    />
  )
}
