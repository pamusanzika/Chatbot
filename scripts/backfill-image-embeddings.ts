/**
 * Backfill image embeddings for products that have images but no embedding.
 *
 * Usage: npx tsx scripts/backfill-image-embeddings.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * EMBED_API_KEY, EMBED_MODEL (optional).
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { embedImageFromUrl } from '../lib/imageEmbeddings'

const BATCH_SIZE = 20
const DELAY_MS = 500

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let processed = 0
  let offset = 0

  while (true) {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, image_urls')
      .is('image_embedding', null)
      .eq('is_active', true)
      .not('image_urls', 'eq', '{}')
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error('Query error:', error)
      break
    }
    if (!products || products.length === 0) break

    for (const product of products) {
      const url = product.image_urls?.[0]
      if (!url) continue

      try {
        const embedding = await embedImageFromUrl(url)
        const { error: updateErr } = await supabase
          .from('products')
          .update({ image_embedding: `[${embedding.join(',')}]` })
          .eq('id', product.id)

        if (updateErr) {
          console.error(`Failed to update ${product.id} (${product.name}):`, updateErr)
        } else {
          processed++
          console.log(`[${processed}] Embedded: ${product.name}`)
        }
      } catch (err) {
        console.error(`Failed to embed ${product.id} (${product.name}):`, err)
      }

      await new Promise((r) => setTimeout(r, DELAY_MS))
    }

    offset += BATCH_SIZE
  }

  console.log(`Done. Processed ${processed} products.`)
}

main().catch(console.error)
