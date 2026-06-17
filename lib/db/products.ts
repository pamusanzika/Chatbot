import { createServiceClient } from '@/lib/supabase-server'
import type { Product, ProductVariant } from '@/types'

export async function getProducts(tenantId: string): Promise<Product[]> {
  const supabase = await createServiceClient()
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const productIds = (products ?? []).map((p) => p.id)
  if (productIds.length === 0) return []

  const { data: variants } = await supabase
    .from('product_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)

  return (products ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    variants: (variants ?? []).filter((v: Record<string, unknown>) => v.product_id === p.id),
  })) as unknown as Product[]
}

export async function getProductVariants(tenantId: string): Promise<ProductVariant[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface ProductInput {
  name: string
  category: string
  base_price: number
  description?: string | null
  image_urls?: string[]
  is_active?: boolean
  sku?: string | null
  stock?: number | null
  low_stock_threshold?: number
}

export interface VariantInput {
  id?: string
  size: string
  color_name: string
  color_hex: string
  price: number
  stock: number
  low_stock_threshold: number
  sku: string
}

export async function createProduct(
  tenantId: string,
  product: ProductInput,
  variants: VariantInput[] = []
): Promise<Product> {
  const supabase = await createServiceClient()

  const { data: created, error } = await supabase
    .from('products')
    .insert({
      tenant_id: tenantId,
      name: product.name,
      category: product.category,
      base_price: product.base_price,
      description: product.description ?? null,
      image_urls: product.image_urls ?? [],
      is_active: product.is_active ?? true,
      sku: product.sku ?? null,
      stock: product.stock ?? null,
      low_stock_threshold: product.low_stock_threshold ?? 5,
    })
    .select()
    .single()

  if (error) throw error

  let savedVariants: ProductVariant[] = []
  if (variants.length > 0) {
    const { data: insertedVariants, error: vErr } = await supabase
      .from('product_variants')
      .insert(
        variants.map((v) => ({
          tenant_id: tenantId,
          product_id: created.id,
          size: v.size,
          color_name: v.color_name,
          color_hex: v.color_hex,
          price: v.price,
          stock: v.stock,
          low_stock_threshold: v.low_stock_threshold,
          sku: v.sku,
        }))
      )
      .select()
    if (vErr) throw vErr
    savedVariants = insertedVariants ?? []
  }

  return { ...created, variants: savedVariants } as unknown as Product
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  product: Partial<ProductInput>
): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('products')
    .update(product)
    .eq('tenant_id', tenantId)
    .eq('id', productId)
  if (error) throw error
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', productId)
  if (error) throw error
}

export async function upsertVariant(
  tenantId: string,
  productId: string,
  variant: VariantInput
): Promise<ProductVariant> {
  const supabase = await createServiceClient()

  if (variant.id) {
    const { data, error } = await supabase
      .from('product_variants')
      .update({
        size: variant.size,
        color_name: variant.color_name,
        color_hex: variant.color_hex,
        price: variant.price,
        stock: variant.stock,
        low_stock_threshold: variant.low_stock_threshold,
        sku: variant.sku,
      })
      .eq('tenant_id', tenantId)
      .eq('id', variant.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      tenant_id: tenantId,
      product_id: productId,
      size: variant.size,
      color_name: variant.color_name,
      color_hex: variant.color_hex,
      price: variant.price,
      stock: variant.stock,
      low_stock_threshold: variant.low_stock_threshold,
      sku: variant.sku,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteVariant(tenantId: string, variantId: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', variantId)
  if (error) throw error
}

const STOCK_REASONS = ['Restock', 'Sale', 'Damaged', 'Return', 'Adjustment'] as const
export type StockReason = (typeof STOCK_REASONS)[number]

export async function adjustVariantStock(
  tenantId: string,
  variantId: string,
  delta: number,
  reason: StockReason = 'Adjustment'
): Promise<ProductVariant> {
  const supabase = await createServiceClient()
  const { data: variant, error: fetchErr } = await supabase
    .from('product_variants')
    .select('stock')
    .eq('tenant_id', tenantId)
    .eq('id', variantId)
    .single()
  if (fetchErr) throw fetchErr

  const newStock = Math.max(0, (variant?.stock ?? 0) + delta)
  const { data: updated, error } = await supabase
    .from('product_variants')
    .update({ stock: newStock })
    .eq('tenant_id', tenantId)
    .eq('id', variantId)
    .select()
    .single()
  if (error) throw error

  await supabase.from('stock_movements').insert({
    tenant_id: tenantId,
    variant_id: variantId,
    delta,
    reason,
  })

  return updated
}

export async function adjustProductStock(
  tenantId: string,
  productId: string,
  delta: number,
  reason: StockReason = 'Adjustment'
): Promise<Product> {
  const supabase = await createServiceClient()
  const { data: product, error: fetchErr } = await supabase
    .from('products')
    .select('stock')
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .single()
  if (fetchErr) throw fetchErr

  const newStock = Math.max(0, (product?.stock ?? 0) + delta)
  const { data: updated, error } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .select()
    .single()
  if (error) throw error

  await supabase.from('stock_movements').insert({
    tenant_id: tenantId,
    product_id: productId,
    delta,
    reason,
  })

  return updated as unknown as Product
}

// Backwards-compatible alias
export const updateVariantStock = (tenantId: string, variantId: string, delta: number) =>
  adjustVariantStock(tenantId, variantId, delta, 'Adjustment')
