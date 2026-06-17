import { ProductsTab } from '@/components/views/products/products-tab'
import { getTenant } from '@/lib/auth'
import { getProducts, getProductVariants } from '@/lib/db/products'
import { getCategories } from '@/lib/db/categories'

export default async function ProductsPage() {
  const { tenantId } = await getTenant()
  const [products, variants, categories] = await Promise.all([
    getProducts(tenantId),
    getProductVariants(tenantId),
    getCategories(tenantId),
  ])

  return (
    <ProductsTab
      initialProducts={products}
      initialVariants={variants}
      initialCategories={categories}
      tenantId={tenantId}
    />
  )
}
