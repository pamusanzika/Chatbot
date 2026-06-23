'use server'

import { revalidatePath } from 'next/cache'
import { getTenant } from '@/lib/auth'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  upsertVariant,
  deleteVariant,
  adjustVariantStock,
  adjustProductStock,
  type ProductInput,
  type VariantInput,
  type StockReason,
} from '@/lib/db/products'
import { createCategory, updateCategory, deleteCategory } from '@/lib/db/categories'
import { createServiceClient } from '@/lib/supabase-server'
import { embedImageFromUrl } from '@/lib/imageEmbeddings'

async function updateImageEmbedding(productId: string, imageUrls?: string[]) {
  if (!imageUrls || imageUrls.length === 0) return
  try {
    const embedding = await embedImageFromUrl(imageUrls[0])
    const supabase = await createServiceClient()
    await supabase
      .from('products')
      .update({ image_embedding: `[${embedding.join(',')}]` })
      .eq('id', productId)
  } catch (err) {
    console.error('Failed to update image embedding:', err)
  }
}

export async function createProductAction(product: ProductInput, variants: VariantInput[]) {
  const { tenantId } = await getTenant()
  const created = await createProduct(tenantId, product, variants)
  await updateImageEmbedding(created.id, product.image_urls)
  revalidatePath('/products')
  return created
}

export async function updateProductAction(productId: string, product: Partial<ProductInput>) {
  const { tenantId } = await getTenant()
  await updateProduct(tenantId, productId, product)
  if (product.image_urls) {
    await updateImageEmbedding(productId, product.image_urls)
  }
  revalidatePath('/products')
}

export async function deleteProductAction(productId: string) {
  const { tenantId } = await getTenant()
  await deleteProduct(tenantId, productId)
  revalidatePath('/products')
}

export async function saveVariantAction(productId: string, variant: VariantInput) {
  const { tenantId } = await getTenant()
  const saved = await upsertVariant(tenantId, productId, variant)
  revalidatePath('/products')
  return saved
}

export async function deleteVariantAction(variantId: string) {
  const { tenantId } = await getTenant()
  await deleteVariant(tenantId, variantId)
  revalidatePath('/products')
}

export async function adjustStockAction(variantId: string, delta: number, reason: StockReason) {
  const { tenantId } = await getTenant()
  const updated = await adjustVariantStock(tenantId, variantId, delta, reason)
  revalidatePath('/products')
  return updated
}

export async function adjustProductStockAction(productId: string, delta: number, reason: StockReason) {
  const { tenantId } = await getTenant()
  const updated = await adjustProductStock(tenantId, productId, delta, reason)
  revalidatePath('/products')
  return updated
}

export async function createCategoryAction(name: string, color: string) {
  const { tenantId } = await getTenant()
  const created = await createCategory(tenantId, name, color)
  revalidatePath('/products')
  return created
}

export async function updateCategoryAction(
  categoryId: string,
  changes: { name?: string; color?: string },
  previousName?: string
) {
  const { tenantId } = await getTenant()
  const updated = await updateCategory(tenantId, categoryId, changes)

  // Keep existing products' free-text category in sync with a rename.
  if (changes.name && previousName && changes.name !== previousName) {
    const supabase = await createServiceClient()
    await supabase
      .from('products')
      .update({ category: changes.name })
      .eq('tenant_id', tenantId)
      .eq('category', previousName)
  }

  revalidatePath('/products')
  return updated
}

export async function deleteCategoryAction(categoryId: string) {
  const { tenantId } = await getTenant()
  await deleteCategory(tenantId, categoryId)
  revalidatePath('/products')
}
