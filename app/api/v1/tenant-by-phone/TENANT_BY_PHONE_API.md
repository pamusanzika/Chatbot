# Tenant by Phone API

n8n-facing endpoint (not Clerk-protected) used to resolve a tenant from
the WhatsApp `phone_number_id` of an incoming message.

## Auth

Header `x-api-key` must match `process.env.FLOWBOT_API_KEY`.

- Missing/invalid -> `401 { "error": "Unauthorized" }`

## GET /api/v1/tenant-by-phone

### Query params

- `phone_number_id` (required) - WhatsApp Business phone number ID

Missing -> `400 { "error": "phone_number_id is required" }`

### Responses

- `404 { "error": "Tenant not found" }` if no tenant matches
- `200`:

```json
{
  "tenant": {
    "id": "...",
    "name": "...",
    "business_name": "...",
    "phone": "...",
    "email": "...",
    "address": "...",
    "whatsapp_number": "...",
    "default_language": "EN",
    "currency": "LKR",
    "social_links": {},
    "phone_number_id": "...",
    "wa_access_token": "...",
    "wa_business_account_id": "...",
    "wa_phone_number": "...",
    "wa_verified": true
  }
}
```

`business_name` is an alias of `name` for compatibility with existing
n8n workflows.

## Implementation

- Helper: `lib/db/tenants.ts` -> `getTenantByPhoneNumberId()`
- Uses the Supabase service-role client (`createServiceClient`), so this
  bypasses RLS - keep this route key-gated.
