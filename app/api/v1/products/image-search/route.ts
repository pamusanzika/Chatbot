import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { embedImage } from '@/lib/imageEmbeddings'

const IMAGE_MATCH_THRESHOLD = parseFloat(process.env.IMAGE_MATCH_THRESHOLD ?? '0.20')

function checkApiKey(req: NextRequest): boolean {
  const expected = process.env.FLOWBOT_API_KEY
  if (!expected) return false
  return req.headers.get('x-api-key') === expected
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, image_base64, mime_type, top_k } = body as Record<string, unknown>

  if (!tenant_id || typeof tenant_id !== 'string') {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }
  if (!image_base64 || typeof image_base64 !== 'string') {
    return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 })
  }

  const limit = typeof top_k === 'number' && top_k > 0 ? top_k : 5
  const mimeType = typeof mime_type === 'string' ? mime_type : 'image/jpeg'

  try {
    const queryVec = await embedImage({ base64: image_base64, mimeType })

    const supabase = await createServiceClient()
    const { data, error } = await supabase.rpc('match_products_by_image', {
      p_tenant: tenant_id,
      p_query: `[${queryVec.join(',')}]`,
      p_limit: limit,
    })

    if (error) {
      console.error('match_products_by_image RPC error:', error)
      return NextResponse.json({ matches: [] })
    }

    const matches = (data ?? [])
      .filter((row: { similarity: number }) => row.similarity >= IMAGE_MATCH_THRESHOLD)
      .map((row: { product_id: string; name: string; image_url: string; similarity: number }) => ({
        product_id: row.product_id,
        name: row.name,
        image_url: row.image_url,
        similarity_score: row.similarity,
      }))

    return NextResponse.json({ matches })
  } catch (err) {
    console.error('Image search error:', err)
    return NextResponse.json({ matches: [] })
  }
}
