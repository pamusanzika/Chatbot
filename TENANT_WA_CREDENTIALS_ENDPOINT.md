# New Endpoint: `GET /api/v1/tenant-wa-credentials`

## Why

When an admin approves or rejects a payment, the dashboard fires an `order.status_updated` webhook to n8n, and the notifier branch sends the customer a WhatsApp message ("Payment Confirmed" / "Payment Not Verified"). The webhook payload only carries `tenant_id`, `customer_phone`, `order_ref`, etc. — it does **not** include WhatsApp send credentials. This endpoint lets the notifier fetch a tenant's `wa_access_token` and `phone_number_id` given its `tenant_id`.

## Why a new path instead of reusing `/api/v1/tenant`

`GET /api/v1/tenant` already exists (`app/api/v1/tenant/route.ts`) and is used by the n8n **bot** workflow for prompt context — it returns business profile fields (`name`, `industry`, `email`, `phone`, `social_links`, etc.), not WhatsApp credentials, and has different error shapes. Overwriting it would have broken that existing consumer, so the new lookup was added at a separate path instead: `GET /api/v1/tenant-wa-credentials`.

## Endpoint

```
GET /api/v1/tenant-wa-credentials?tenant_id=<uuid>
x-api-key: <FLOWBOT_API_KEY>
```

Auth reuses the same `x-api-key` / `FLOWBOT_API_KEY` scheme as the other `/api/v1/*` bot endpoints (server-to-server call from n8n, no Clerk session). The key check runs before any DB access.

### Responses

| Case | Status | Body |
|---|---|---|
| Success | `200` | `{ "tenant": { "id", "wa_access_token", "phone_number_id" } }` |
| Missing/invalid `x-api-key` | `401` | `{ "error": "unauthorized" }` |
| Missing `tenant_id` | `400` | `{ "error": "tenant_id_required" }` |
| No tenant with that id | `404` | `{ "error": "tenant_not_found" }` |
| Unexpected DB error | `500` | `{ "error": "<message>" }` |

Only `id`, `wa_access_token`, and `phone_number_id` are returned — never the full tenant row.

## Files changed

- **Added** `app/api/v1/tenant-wa-credentials/route.ts` — the route handler.
- **Added** `getTenantWaCredentialsById(tenantId)` to `lib/db/tenants.ts` — selects just `id, wa_access_token, phone_number_id` via the service-role Supabase client.
- **No schema/migration changes** — the `wa_access_token` and `phone_number_id` columns already exist on `tenants` and are used by the existing `GET /api/v1/tenant-by-phone` route.
- **Untouched**: `GET /api/v1/tenant`, `active-awaiting-payment`, `payment-proof`, `orders`, and all other existing routes.

## n8n setup required

The notifier's **Get Tenant** HTTP Request node must be pointed at the new path:

```
GET https://flowbot-steel.vercel.app/api/v1/tenant-wa-credentials?tenant_id={{ $json.tenant_id }}
x-api-key: <FLOWBOT_API_KEY>
```

Downstream, the **Build Notification** node keeps reading `tenant.wa_access_token` and `tenant.phone_number_id` unchanged, since the field names match what it already expects.

## Verify

```bash
curl -s "https://flowbot-steel.vercel.app/api/v1/tenant-wa-credentials?tenant_id=<TENANT_UUID>" \
  -H "x-api-key: <FLOWBOT_API_KEY>"
```

Expected: `200` with `{ "tenant": { "id", "wa_access_token", "phone_number_id" } }`.

Then approve a payment in the dashboard and confirm the notifier's `Get Tenant` node (after being repointed) returns those fields and `Send WA Notification` delivers the message.
