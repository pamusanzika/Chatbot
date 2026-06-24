# Orders API

Base URL: `/api/v1/orders`

## Authentication

All endpoints require an API key passed via the `x-api-key` header.

```
x-api-key: <FLOWBOT_API_KEY>
```

Returns `401 Unauthorized` if the key is missing or incorrect.

---

## POST /api/v1/orders

Creates or updates a pending order. Uses upsert-on-draft to prevent duplicates — if the customer (by phone) already has a `pending` order, it updates that order in place instead of creating a new one.

### How it works

1. **Validates the API key** from the `x-api-key` header.
2. **Validates required fields** — returns `400` if any are missing.
3. **Re-prices items server-side** — fetches the product catalog and variant list from Supabase for the given `tenant_id`, then matches each item by name (case-insensitive). If a variant is provided, it matches by size or color name.
4. **Flags unverified prices** — if an item name doesn't match any product in the catalog, the client-supplied price is kept but the item is marked with `price_unverified: true`.
5. **Resolves delivery fee server-side** — looks up the delivery zone from the `city` field or parses it from the delivery address. The `delivery_fee` in the request body is **ignored**.
6. **Upserts on open draft** — if the customer already has a `pending` order (matched by `tenant_id` + `phone`), updates it in place. If the order was confirmed between check and update, returns `409 order_locked`.
7. **Handles race conditions** — a partial unique index (`orders_one_open_draft_per_customer`) prevents duplicate drafts even under concurrent webhook calls.
8. **Returns** `{ order_id, mode, subtotal, delivery_fee, total }`.

### Request body

```json
{
  "tenant_id": "uuid",
  "session_id": "whatsapp-session-id",
  "phone": "+94771234567",
  "channel": "whatsapp",
  "language": "EN",
  "customer_name": "John Doe",
  "delivery_address": "123 Main St, Colombo",
  "city": "Colombo",
  "contact_number": "+94771234567",
  "payment_method": "COD",
  "currency": "LKR",
  "items": [
    {
      "name": "White Socks",
      "variant": "Large",
      "quantity": 2,
      "unit_price": 500
    }
  ]
}
```

| Field              | Type     | Required | Default     | Description                                           |
| ------------------ | -------- | -------- | ----------- | ----------------------------------------------------- |
| `tenant_id`        | string   | Yes      |             | UUID of the tenant                                    |
| `customer_name`    | string   | Yes      |             | Customer's name                                       |
| `delivery_address` | string   | Yes      |             | Delivery address                                      |
| `payment_method`   | string   | Yes      |             | e.g. `COD`, `Bank`                                    |
| `items`            | array    | Yes      |             | Non-empty array of order items                        |
| `phone`            | string   | No       | `null`      | Customer phone (used for draft dedup)                 |
| `city`             | string   | No       | parsed from address | City for delivery zone lookup              |
| `session_id`       | string   | No       | `null`      | WhatsApp/n8n session identifier                       |
| `channel`          | string   | No       | `whatsapp`  | Source channel                                        |
| `language`         | string   | No       | `null`      | Language code (EN, SI, TA)                            |
| `currency`         | string   | No       | `LKR`       | Currency code                                         |
| `contact_number`   | string   | No       | `null`      | Alternate contact number                              |

#### Item object

| Field        | Type   | Required | Description                                      |
| ------------ | ------ | -------- | ------------------------------------------------ |
| `name`       | string | Yes      | Product name (matched against catalog)            |
| `variant`    | string | No       | Size or color name (matched against variants)     |
| `quantity`   | number | Yes      | Quantity ordered                                  |
| `unit_price` | number | Yes      | Client-side price (overridden if catalog matches) |

### Success response `200`

```json
{
  "order_id": "ORD-00042",
  "mode": "created",
  "subtotal": 1000,
  "delivery_fee": 350,
  "total": 1350
}
```

`mode` is either `"created"` (new order) or `"updated"` (existing draft was updated).

### Error responses

| Status | Body                                              | When                                        |
| ------ | ------------------------------------------------- | ------------------------------------------- |
| 400    | `{ "error": "tenant_id is required" }`            | Missing required field                      |
| 400    | `{ "error": "items must be a non-empty array" }`  | Items missing or empty                      |
| 401    | `{ "error": "Unauthorized" }`                     | Bad or missing API key                      |
| 409    | `{ "error": "order_locked" }`                     | Draft was confirmed before update completed |
| 500    | `{ "error": "Failed to create order" }`           | Database or server error                    |

---

## GET /api/v1/orders

Returns a list of orders for a tenant, sorted by most recent first (max 100).

### Query parameters

| Param       | Type   | Required | Description                                                        |
| ----------- | ------ | -------- | ------------------------------------------------------------------ |
| `tenant_id` | string | Yes      | UUID of the tenant                                                 |
| `status`    | string | No       | Filter by status: `pending`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled` |

### Example

```
GET /api/v1/orders?tenant_id=abc-123&status=pending
```

### Success response `200`

```json
{
  "orders": [
    {
      "id": "uuid",
      "order_ref": "ORD-00042",
      "customer_name": "John Doe",
      "status": "pending",
      "items": [...],
      "subtotal": 1000,
      "delivery_fee": 350,
      "total": 1350,
      "created_at": "2026-06-20T10:30:00Z"
    }
  ]
}
```

### Error responses

| Status | Body                                              | When                   |
| ------ | ------------------------------------------------- | ---------------------- |
| 400    | `{ "error": "tenant_id query param is required" }`| Missing tenant_id      |
| 401    | `{ "error": "Unauthorized" }`                     | Bad or missing API key |
| 500    | `{ "error": "Failed to fetch orders" }`           | Database error         |

---

## GET /api/v1/orders/lookup

Returns a single order by its `order_ref`. Used by n8n for the status-check flow — always returns live data, never cached.

### Query parameters

| Param       | Type   | Required | Description                |
| ----------- | ------ | -------- | -------------------------- |
| `tenant_id` | string | Yes      | UUID of the tenant         |
| `order_ref` | string | Yes      | Order reference (e.g. `ORD-2026-0042`) |

### Example

```
GET /api/v1/orders/lookup?tenant_id=abc-123&order_ref=ORD-2026-0042
```

### Success response `200`

```json
{
  "order_ref": "ORD-2026-0042",
  "status": "confirmed",
  "items": [...],
  "subtotal": 1000,
  "delivery_fee": 350,
  "total": 1350,
  "currency": "LKR",
  "tracking_number": "LK12345678",
  "estimated_delivery_date": "2026-06-28",
  "estimated_days": "3 days",
  "delivery_zone": "Colombo",
  "created_at": "2026-06-20T10:30:00Z"
}
```

Fields `tracking_number` and `estimated_delivery_date` are `null` until populated from the dashboard.

### Error responses

| Status | Body                                  | When                   |
| ------ | ------------------------------------- | ---------------------- |
| 400    | `{ "error": "tenant_id is required" }`| Missing tenant_id      |
| 400    | `{ "error": "missing_ref" }`         | Missing order_ref      |
| 401    | `{ "error": "Unauthorized" }`        | Bad or missing API key |
| 404    | `{ "error": "not_found" }`           | No order with that ref |
| 500    | `{ "error": "Failed to fetch order" }`| Database error        |

---

## PATCH /api/v1/orders

Updates the status of an existing order. Fires the n8n webhook after a successful update.

### Request body

```json
{
  "tenant_id": "uuid",
  "order_id": "uuid",
  "status": "confirmed"
}
```

| Field       | Type   | Required | Description                                                                    |
| ----------- | ------ | -------- | ------------------------------------------------------------------------------ |
| `tenant_id` | string | Yes      | UUID of the tenant                                                             |
| `order_id`  | string | Yes      | UUID of the order (the `id` field, not `order_ref`)                            |
| `status`    | string | Yes      | New status: `pending`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled` |

### Success response `200`

```json
{
  "order_id": "ORD-00042",
  "previous_status": "pending",
  "new_status": "confirmed"
}
```

### Error responses

| Status | Body                                                  | When                        |
| ------ | ----------------------------------------------------- | --------------------------- |
| 400    | `{ "error": "tenant_id is required" }`                | Missing required field      |
| 400    | `{ "error": "status must be one of: ..." }`          | Invalid status value        |
| 401    | `{ "error": "Unauthorized" }`                         | Bad or missing API key      |
| 404    | `{ "error": "Order not found" }`                      | No order with that id       |
| 500    | `{ "error": "Failed to update order status" }`        | Database error              |

---

## Order lifecycle

Orders follow this status flow:

```
pending → confirmed → preparing → shipped → delivered
                                          ↘ cancelled
```

- New orders are always created with status `pending`.
- A `pending` order is an editable draft — POST upserts on it.
- Once confirmed, the order is **locked** — further POSTs return `409 order_locked`.
- Status can be updated via the dashboard or the PATCH endpoint.
- Every status change fires a webhook to n8n (if `N8N_ORDER_STATUS_WEBHOOK_URL` is set).

---

## n8n Webhook — Order Status Change

When an order status changes (via dashboard or API), a POST is sent to `N8N_ORDER_STATUS_WEBHOOK_URL` (if configured).

### Webhook payload

```json
{
  "event": "order.status_updated",
  "order_id": "uuid",
  "order_ref": "ORD-00042",
  "tenant_id": "uuid",
  "previous_status": "pending",
  "new_status": "confirmed",
  "customer_name": "John Doe",
  "customer_phone": "+94771234567",
  "channel": "whatsapp",
  "language": "EN",
  "total": 1350,
  "updated_at": "2026-06-24T10:30:00Z"
}
```

### Setup

Add to `.env.local`:

```
N8N_ORDER_STATUS_WEBHOOK_URL=https://your-n8n-instance.com/webhook/order-status
```

If the env var is not set, the webhook is silently skipped.

---

## Database migration

Run once to enable the dedup guard and tracking columns:

```sql
-- One editable draft per customer per tenant
create unique index if not exists orders_one_open_draft_per_customer
  on public.orders (tenant_id, phone)
  where status = 'pending';

-- Tracking/fulfilment columns
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists estimated_delivery_date date;

-- Open-draft lookup index
create index if not exists orders_open_draft_lookup
  on public.orders (tenant_id, phone) where status = 'pending';
```

Migration file: `supabase/migrations/order_lifecycle_v67.sql`

---

## Delivery fee resolution

The delivery fee is **always resolved server-side** from the tenant's delivery zones. The request body's `delivery_fee` field is ignored.

```
Request has `city` field?
    │
    ├─ Yes → look up zone by city
    └─ No  → parse city from last part of delivery_address
                 │
                 └─ look up zone by city
                        │
                   ┌────┴────┐
                   │ Found   │ Not found
                   ▼         ▼
              Use zone fee   delivery_fee = 0
              + district
              + estimated_days
```

---

## Price verification flow

```
Client sends item name + unit_price
        │
        ▼
Server looks up product by name (case-insensitive)
        │
   ┌────┴────┐
   │ Found   │ Not found
   ▼         ▼
Match variant?   Keep client price
   │             Mark price_unverified: true
   ├─ Yes → use variant price
   └─ No  → use base_price
        │
        ▼
Recompute line_total = quantity × unit_price
Recompute subtotal, total server-side
```
