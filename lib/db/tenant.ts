import { createServiceClient } from '@/lib/supabase-server'
import type { ChatbotSettings, SocialLinks, Tenant } from '@/types'

export type TenantSettingsInput = Partial<
  Pick<
    Tenant,
    'name' | 'industry' | 'email' | 'phone' | 'whatsapp_number' | 'address' | 'currency' | 'default_language'
  >
> & { social_links?: SocialLinks; chatbot_settings?: ChatbotSettings }

export async function updateTenantSettings(tenantId: string, changes: TenantSettingsInput): Promise<Tenant> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('tenants')
    .update(changes)
    .eq('id', tenantId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getTenantById(tenantId: string): Promise<Tenant> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  return data
}
