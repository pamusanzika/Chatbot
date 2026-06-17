import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from './supabase-server'
import type { Tenant, TenantUser } from '@/types'

export interface TenantContext {
  tenant: Tenant
  tenantUser: TenantUser
  tenantId: string
}

/**
 * getTenant() — call in any Server Component or Route Handler.
 * Returns the current tenant + user context, throwing if not found.
 * Every DB query must filter by tenantId from this return value.
 */
export async function getTenant(): Promise<TenantContext> {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    throw new Error('Not authenticated or no organisation selected.')
  }

  const supabase = await createServiceClient()

  // Look up tenant by Clerk org ID
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('clerk_org_id', orgId)
    .single()

  if (tErr || !tenant) {
    throw new Error(`Tenant not found for org ${orgId}`)
  }

  // Look up tenant user by Clerk user ID
  const { data: tenantUser, error: uErr } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('clerk_user_id', userId)
    .single()

  if (uErr || !tenantUser) {
    throw new Error(`TenantUser not found for user ${userId}`)
  }

  return { tenant, tenantUser, tenantId: tenant.id }
}

/**
 * getOrCreateTenant() — called on first sign-in via webhook or onboarding.
 * Creates the tenant + owner user row if they don't exist yet.
 */
export async function getOrCreateTenant(): Promise<TenantContext> {
  const { userId, orgId } = await auth()
  const clerkUser = await currentUser()

  if (!userId || !orgId || !clerkUser) {
    throw new Error('Not authenticated.')
  }

  const supabase = await createServiceClient()

  // Upsert tenant
  let orgName = 'My Business'
  try {
    const client = await clerkClient()
    const org = await client.organizations.getOrganization({ organizationId: orgId })
    orgName = org.name ?? orgName
  } catch {}

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .upsert({ clerk_org_id: orgId, name: orgName }, { onConflict: 'clerk_org_id' })
    .select()
    .single()

  if (tErr || !tenant) throw new Error(`Failed to upsert tenant: ${tErr?.message}`)

  // Upsert tenant user
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'Owner'
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
  const { data: tenantUser, error: uErr } = await supabase
    .from('tenant_users')
    .upsert(
      { tenant_id: tenant.id, clerk_user_id: userId, name, email, role: 'Owner', status: 'Active' },
      { onConflict: 'tenant_id,clerk_user_id' }
    )
    .select()
    .single()

  if (uErr || !tenantUser) throw new Error('Failed to upsert tenant user')

  return { tenant, tenantUser, tenantId: tenant.id }
}
