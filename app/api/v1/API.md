# FlowBot n8n API

All `/api/v1/*` endpoints sit outside the Clerk-protected dashboard and are
secured with a shared API key header.

## Auth

```
x-api-key: <FLOWBOT_API_KEY>
```

`FLOWBOT_API_KEY` must be set in the app's environment variables (and
`.env.local`). All requests must also include `tenant_id` (the tenant's
UUID, found in Supabase Studio → `tenants` table, or via `GET /api/v1/tenant`).

---

## GET /api/v1/tenant

Returns business profile info (name, industry, contact details, social
links) for prompt context and for surfacing contact info to customers.

```
GET /api/v1/tenant?tenant_id=<uuid>
```

**Response `200`:**
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Acme Store",
    "industry": "Apparel",
    "email": "hello@acme.com",
    "phone": "+94...",
    "whatsapp_number": "+94...",
    "address": "...",
    "default_language": "EN",
    "currency": "LKR",
    "social_links": { "instagram": "...", "facebook": "..." }
  }
}
```

---

## Knowledge Base — `/api/v1/kb`

### GET /api/v1/kb

Fetch FAQ/knowledge base entries to ground the bot's RAG/prompt step.

```
GET /api/v1/kb?tenant_id=<uuid>&language=EN
```

| Param | Required | Description |
|---|---|---|
| `tenant_id` | yes | UUID of the tenant |
| `language` | no | Filter by `EN`, `SI`, `TA`, or `SL` |

**Response `200`:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "category": "Delivery",
      "question": "How long does delivery take?",
      "answer": "2-5 business days island-wide.",
      "keywords": ["delivery", "shipping"],
      "language": "EN",
      "created_at": "2026-06-01T12:00:00Z"
    }
  ]
}
```

### POST /api/v1/kb

Log new Q&A pairs (e.g. unanswered customer questions reviewed by staff)
back into the knowledge base.

Body:
```json
{
  "tenant_id": "uuid",
  "category": "Delivery",
  "question": "Do you ship to Jaffna?",
  "answer": "Yes, 3-5 business days.",
  "keywords": ["shipping", "jaffna"],
  "language": "EN"
}
```

`tenant_id`, `question`, `answer` are required. `category` defaults to
`General`, `language` defaults to `EN`.

**Response `201`:** `{ "entry": { ... } }`

---

## Delivery Zones — `/api/v1/delivery`

### GET /api/v1/delivery

**Lookup fee for a city:**
```
GET /api/v1/delivery?tenant_id=<uuid>&city=Dehiwala
```

Response (match found):
```json
{
  "zone": {
    "id": "uuid",
    "tenant_id": "uuid",
    "province": "Western",
    "district": "Colombo",
    "cities": ["Dehiwala", "Mount Lavinia"],
    "fee": 350,
    "estimated_days": "1-2",
    "free_delivery_threshold": 5000,
    "is_active": true
  }
}
```

Response (no match, or zone inactive): `{ "zone": null }`

**List all zones for a tenant:**
```
GET /api/v1/delivery?tenant_id=<uuid>
```

Response: `{ "zones": [ { "id": "...", "province": "Western", ... }, ... ] }`

---

## Products — `/api/v1/products`

### GET /api/v1/products

Returns the product catalog with variants/stock — use to answer customer
questions about products, pricing, and availability.

```
GET /api/v1/products?tenant_id=<uuid>
```

**Response `200`:**
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

### POST /api/v1/products

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

**Response `201`:** `{ "product": { ... } }`

---

## n8n setup (general)

1. **HTTP Request** node, method `GET`/`POST` as needed.
2. URL: `https://<your-app-domain>/api/v1/<endpoint>`
3. Query/body param: `tenant_id` (from your tenant config).
4. Header: `x-api-key` = `{{$env.FLOWBOT_API_KEY}}` (or however you store it
   in n8n credentials).
5. Reference response fields (e.g. `{{$json.products}}`, `{{$json.entries}}`,
   `{{$json.zone.fee}}`) in the bot's prompt/reply nodes.
