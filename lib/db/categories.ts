import { createServiceClient } from '@/lib/supabase-server'
import type { Category } from '@/types'

export async function getCategories(tenantId: string): Promise<Category[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCategory(
  tenantId: string,
  name: string,
  color: string = '#7c6dfa'
): Promise<Category> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('categories')
    .insert({ tenant_id: tenantId, name: name.trim(), color })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  changes: { name?: string; color?: string }
): Promise<Category> {
  const supabase = await createServiceClient()
  const patch: { name?: string; color?: string } = {}
  if (changes.name !== undefined) patch.name = changes.name.trim()
  if (changes.color !== undefined) patch.color = changes.color

  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', categoryId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(tenantId: string, categoryId: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', categoryId)
  if (error) throw error
}
