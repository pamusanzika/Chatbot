import { SettingsTab } from '@/components/views/settings/settings-tab'
import { getTenant } from '@/lib/auth'

export default async function SettingsPage() {
  const { tenant } = await getTenant()
  return <SettingsTab tenant={tenant} />
}
