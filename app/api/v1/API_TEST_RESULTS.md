# API Test Results

Manual smoke test of all `/api/v1/*` endpoints, run locally against
`http://localhost:3001` (dev server) with a real tenant from Supabase.

**Date:** 2026-06-11
**Tenant used:** `0459899d-3826-492f-b9ed-15c8af3dbe4b` (Axstar's Organization)
**Auth:** `x-api-key: <FLOWBOT_API_KEY>` (set in `.env.local`)

> Note: `FLOWBOT_API_KEY` was not previously set. Added a generated dev key
> to `.env.local` — replace with your own secret before deploying, and set
> the same value in Vercel env vars + your n8n credentials.

## Results

| Endpoint | Method | Status | Result |
|---|---|---|---|
| `/api/v1/tenant` | GET | 200 | Returned tenant profile (name, industry, currency, etc.) |
| `/api/v1/kb` | GET | 200 | `{"entries":[]}` (empty KB) |
| `/api/v1/kb` | POST | 201 | Created entry, then deleted (test cleanup) |
| `/api/v1/delivery` | GET | 200 | Returned 1 zone (Nugegoda, fee 200, 1 day) |
| `/api/v1/products` | GET | 200 | `{"products":[]}` (empty catalog) |
| `/api/v1/products` | POST | 201 | Created "Test Tee", then deleted (test cleanup) |
| `/api/v1/products` (bad key) | GET | 401 | `{"error":"Unauthorized"}` as expected |

## Sample requests used

```bash
TID=0459899d-3826-492f-b9ed-15c8af3dbe4b
KEY=<FLOWBOT_API_KEY>

curl "http://localhost:3001/api/v1/tenant?tenant_id=$TID" -H "x-api-key: $KEY"
curl "http://localhost:3001/api/v1/kb?tenant_id=$TID" -H "x-api-key: $KEY"
curl "http://localhost:3001/api/v1/delivery?tenant_id=$TID" -H "x-api-key: $KEY"
curl "http://localhost:3001/api/v1/products?tenant_id=$TID" -H "x-api-key: $KEY"

curl -X POST "http://localhost:3001/api/v1/products" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"tenant_id":"'$TID'","name":"Test Tee","category":"Apparel","base_price":2500}'
```

## Conclusion

All four `/api/v1/*` endpoints (`tenant`, `kb`, `delivery`, `products`) are
working correctly: auth (401 on bad key), GET reads, and POST writes all
behave as documented in [API.md](./API.md). Ready for n8n integration once
`FLOWBOT_API_KEY` is set in production.
