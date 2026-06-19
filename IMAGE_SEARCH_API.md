# Image Search API

Visual product search endpoint for the n8n bot workflow. A customer sends a product photo on WhatsApp, and the API returns the most visually similar products from that tenant's catalogue.

## Endpoint

`POST /api/v1/products/image-search`

### Headers

```
x-api-key: <FLOWBOT_API_KEY>
Content-Type: application/json
```

### Request Body

```json
{
  "tenant_id": "uuid",
  "image_base64": "<base64 of the image, no data: prefix>",
  "mime_type": "image/jpeg",
  "top_k": 5
}
```

| Field          | Type   | Required | Description                          |
| -------------- | ------ | -------- | ------------------------------------ |
| `tenant_id`    | string | Yes      | UUID of the tenant                   |
| `image_base64` | string | Yes      | Base64-encoded image (no data: prefix) |
| `mime_type`    | string | No       | MIME type (default `image/jpeg`)     |
| `top_k`        | number | No       | Max results to return (default `5`)  |

### Response `200`

```json
{
  "matches": [
    {
      "product_id": "uuid",
      "name": "Floral Frock",
      "image_url": "https://...",
      "similarity_score": 0.83
    }
  ]
}
```

- `similarity_score` is cosine similarity in `[0, 1]`, sorted descending.
- Only matches with `similarity_score >= IMAGE_MATCH_THRESHOLD` are returned.
- If no matches qualify or an error occurs, returns `{ "matches": [] }` (HTTP 200).

### Error Responses

| Status | Condition                              |
| ------ | -------------------------------------- |
| `401`  | Missing or invalid `x-api-key`         |
| `400`  | Missing `tenant_id` or `image_base64`  |

## Architecture

### Files Added/Modified

| File | Description |
| ---- | ----------- |
| `lib/imageEmbeddings.ts` | Embedding client — exports `embedImage()` (base64 input) and `embedImageFromUrl()` (URL input). Uses Voyage AI multimodal API. L2-normalizes output vectors. |
| `app/api/v1/products/image-search/route.ts` | The search endpoint. Embeds the query image, calls `match_products_by_image` RPC, filters by threshold, returns matches. |
| `supabase/migrations/add_image_embedding.sql` | Adds pgvector extension, `image_embedding vector(1024)` column on `products`, HNSW index, and `match_products_by_image` SQL function. |
| `scripts/backfill-image-embeddings.ts` | One-time script to embed all existing active products that have images but no embedding. |
| `app/api/v1/products/route.ts` | Modified — POST handler now auto-embeds the primary image after product creation (failure does not block product save). |

### How It Works

1. **Indexing**: When a product is created via `POST /api/v1/products` with `image_urls`, the primary image is sent to the Voyage AI multimodal embedding API and the resulting 1024-dim vector is stored in the `image_embedding` column.
2. **Search**: When a customer photo arrives, the search endpoint embeds the photo into the same vector space and calls the `match_products_by_image` Postgres function, which performs cosine similarity search using pgvector's HNSW index, scoped to the tenant's active products.
3. **Backfill**: For existing products, run the backfill script to populate embeddings.

## Environment Variables

| Variable                 | Required | Default                | Description                                    |
| ------------------------ | -------- | ---------------------- | ---------------------------------------------- |
| `EMBED_API_KEY`          | Yes      | —                      | Voyage AI API key                              |
| `EMBED_MODEL`            | No       | `voyage-multimodal-3`  | Embedding model name                           |
| `EMBED_DIM`              | No       | `1024`                 | Embedding dimension (must match migration)     |
| `IMAGE_MATCH_THRESHOLD`  | No       | `0.20`                 | Minimum cosine similarity to include in results |

## Setup

### 1. Run the migration

Apply the SQL migration to your Supabase database:

```bash
supabase db push
# or run supabase/migrations/add_image_embedding.sql manually
```

### 2. Set environment variables

Add to your `.env.local` (and Vercel environment):

```
EMBED_API_KEY=your-voyage-ai-key
EMBED_MODEL=voyage-multimodal-3
IMAGE_MATCH_THRESHOLD=0.20
```

### 3. Backfill existing products

```bash
npx tsx scripts/backfill-image-embeddings.ts
```

This loops over all active products with images but no embedding, rate-limited at 500ms between calls.

### 4. n8n Setup

1. **HTTP Request** node, method `POST`.
2. URL: `https://<your-app-domain>/api/v1/products/image-search`
3. Header: `x-api-key` = `{{$env.FLOWBOT_API_KEY}}`
4. Body: JSON with `tenant_id`, `image_base64` (from the WhatsApp image), `mime_type`, and optionally `top_k`.
5. Use the `matches` array to show the customer visually similar products. If empty, fall back to text-based search or a generic response.
