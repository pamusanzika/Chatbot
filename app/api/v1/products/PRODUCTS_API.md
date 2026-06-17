# Products API (for n8n)

Endpoint for the n8n bot workflow to read the product catalog (with
variants/stock), and to create new products.

## Auth
Same as the other `/api/v1/*` endpoints — send the shared secret as a header:

```
x-api-key: <FLOWBOT_API_KEY>
```

`FLOWBOT_API_KEY` must be set in the app's environment variables.

## GET /api/v1/products

```
GET /api/v1/products?tenant_id=<tenant_id>
```

Response:
```json
{
  "products": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "name": "Classic Tee",
      "category": "Apparel",
      "base_price": 2500,
      "description": "...",
      "image_urls": ["https://..."],
      "is_active": true,
      "sku": "TEE-001",
      "stock": 40,
      "low_stock_threshold": 5,
      "created_at": "2026-06-01T12:00:00Z",
      "variants": [
        {
          "id": "uuid",
          "product_id": "uuid",
          "size": "M",
          "color_name": "Black",
          "color_hex": "#000000",
          "price": 2500,
          "stock": 12,
          "low_stock_threshold": 5,
          "sku": "TEE-001-M-BLK"
        }
      ]
    }
  ]
}
```

## POST /api/v1/products

Body:
```json
{
  "tenant_id": "uuid",
  "name": "Classic Tee",
  "category": "Apparel",
  "base_price": 2500,
  "description": "Optional",
  "image_urls": ["https://..."],
  "sku": "TEE-001",
  "stock": 40,
  "is_active": true,
  "low_stock_threshold": 5
}
```

`tenant_id`, `name`, `category`, and `base_price` are required.

Response `201`:
```json
{ "product": { "id": "uuid", "name": "Classic Tee", "...": "..." } }
```

## n8n setup
1. **HTTP Request** node, method `GET` (or `POST` to add products).
2. URL: `https://<your-app-domain>/api/v1/products`
3. Query param: `tenant_id` (from your tenant config).
4. Header: `x-api-key` = `{{$env.FLOWBOT_API_KEY}}` (or however you store it
   in n8n credentials).
5. Use the `products` array (with `variants` for size/color/stock) to answer
   customer questions about catalog, pricing, and availability.
