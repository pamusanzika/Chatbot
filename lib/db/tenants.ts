import { createServiceClient } from '@/lib/supabase-server'
import type { Tenant } from '@/types'

const WHATSAPP_TENANT_FIELDS =
  'id, name, phone, email, address, whatsapp_number, default_language, currency, social_links, ' +
  'phone_number_id, wa_access_token, wa_business_account_id, wa_phone_number, wa_verified'

export async function getTenantByPhoneNumberId(phoneNumberId: string): Promise<Tenant | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(WHATSAPP_TENANT_FIELDS)
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()
  if (error) throw error
  return data as unknown as Tenant | null
}

export type TenantWaCredentials = { id: string; wa_access_token: string | null; phone_number_id: string | null }

export async function getTenantWaCredentialsById(tenantId: string): Promise<TenantWaCredentials | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, wa_access_token, phone_number_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (error) throw error
  return data as unknown as TenantWaCredentials | null
}
