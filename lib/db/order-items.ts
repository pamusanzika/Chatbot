import { createServiceClient } from '@/lib/supabase-server'
import type { OrderItem } from '@/types'

type OrderClient = Awaited<ReturnType<typeof createServiceClient>>

/** Thrown when a chat- or dashboard-supplied line item can't be resolved to a real
 * product/variant row. Callers should surface this as 422 rather than guessing a price. */
export class UnknownItemError extends Error {
  constructor(public itemName: string) {
    super(`unknown_item: ${itemName}`)
    this.name = 'UnknownItemError'
  }
}

/**
 * Resolves each raw line item to a real products/product_variants row scoped to the
 * tenant and takes unit_price from the database — never from the caller. This is what
 * stops a hallucinated LLM price (or a stale one) from ever reaching the orders table.
 */
export async function resolveOrderItems(
  supabase: OrderClient,
  tenantId: string,
  rawItems: Record<string, unknown>[]
): Promise<OrderItem[]> {
  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase.from('products').select('id, name, base_price').eq('tenant_id', tenantId),
    supabase
      .from('product_variants')
      .select('id, product_id, size, color_name, price')
      .eq('tenant_id', tenantId),
  ])

  type ProductRow = { id: string; name: string; base_price: number }
  type VariantRow = { id: string; product_id: string; size: string; color_name: string; price: number }

  return rawItems.map((item) => {
    const itemName = String(item.name ?? '').trim()
    const itemVariant = item.variant ? String(item.variant).trim() : null
    const quantity = Number(item.quantity ?? 0)
    const productId = typeof item.product_id === 'string' ? item.product_id : null

    const product = productId
      ? (products as ProductRow[] ?? []).find((p) => p.id === productId)
      : (products as ProductRow[] ?? []).find((p) => p.name.toLowerCase() === itemName.toLowerCase())

    if (!product) throw new UnknownItemError(itemName || productId || 'unknown')

    let unit_price = product.base_price
    if (itemVariant) {
      const variant = (variants as VariantRow[] ?? []).find(
        (v) =>
          v.product_id === product.id &&
          (v.size.toLowerCase() === itemVariant.toLowerCase() ||
            v.color_name.toLowerCase() === itemVariant.toLowerCase())
      )
      if (!variant) throw new UnknownItemError(`${product.name} (${itemVariant})`)
      unit_price = variant.price
    }

    const line_total = quantity * unit_price
    return {
      name: product.name,
      ...(itemVariant ? { variant: itemVariant } : {}),
      quantity,
      unit_price,
      line_total,
      product_id: product.id,
    }
  })
}
