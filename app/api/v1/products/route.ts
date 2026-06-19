import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getProducts, createProduct } from '@/lib/db/products'
import { embedImageFromUrl } from '@/lib/imageEmbeddings'

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  const provided = req.headers.get('x-api-key')
  return provided === expected
}

/**
 * GET /api/v1/products?tenant_id=...
 * Returns all products (with variants) for a tenant. Used by the n8n bot
 * workflow to look up catalog/stock info when answering customer questions.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param is required' }, { status: 400 })
  }

  try {
    const products = await getProducts(tenantId)
    return NextResponse.json({ products })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch products' }, { status: 500 })
  }
}

/**
 * POST /api/v1/products
 * Body: { tenant_id, name, category, base_price, description?, image_urls?, sku?, stock?, is_active? }
 * Lets the n8n workflow create new products (e.g. from a supplier feed).
 */
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, name, category, base_price, description, image_urls, sku, stock, is_active, low_stock_threshold } =
    body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string') {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || !category || typeof category !== 'string') {
    return NextResponse.json({ error: 'name and category are required' }, { status: 400 })
  }
  if (typeof base_price !== 'number') {
    return NextResponse.json({ error: 'base_price (number) is required' }, { status: 400 })
  }

  try {
    const supabase = await createServiceClient()
    const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenant_id).single()
    if (!tenant) {
      return NextResponse.json({ error: 'Unknown tenant_id' }, { status: 404 })
    }

    const created = await createProduct(tenant_id, {
      name: name.trim(),
      category: category.trim(),
      base_price,
      description: typeof description === 'string' ? description : null,
      image_urls: Array.isArray(image_urls) ? image_urls.map(String) : [],
      sku: typeof sku === 'string' ? sku : null,
      stock: typeof stock === 'number' ? stock : null,
      is_active: typeof is_active === 'boolean' ? is_active : true,
      low_stock_threshold: typeof low_stock_threshold === 'number' ? low_stock_threshold : 5,
    })
    if (created.id && Array.isArray(image_urls) && image_urls.length > 0) {
      try {
        const embedding = await embedImageFromUrl(String(image_urls[0]))
        const supabaseForEmbed = await createServiceClient()
        await supabaseForEmbed
          .from('products')
          .update({ image_embedding: `[${embedding.join(',')}]` })
          .eq('id', created.id)
      } catch (embErr) {
        console.error('Failed to generate image embedding for new product:', embErr)
      }
    }

    return NextResponse.json({ product: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create product' }, { status: 500 })
  }
}
