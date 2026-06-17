# Knowledge Base — Implementation Notes

## What was built

The Knowledge Base tab (`/knowledge-base`) is now fully wired to Supabase with
real CRUD, replacing the old hardcoded empty array + non-functional buttons.

- **`lib/db/kb.ts`** — added `updateKbEntry()` (alongside existing
  `getKbEntries`, `createKbEntry`, `deleteKbEntry`). All functions are scoped
  to `tenant_id`.
- **`app/(dashboard)/knowledge-base/actions.ts`** (new) — server actions
  `createKbEntryAction`, `updateKbEntryAction`, `deleteKbEntryAction`. Each
  resolves the current tenant via `getTenant()` (Clerk org → tenant), runs the
  DB op, and revalidates `/knowledge-base`.
- **`app/(dashboard)/knowledge-base/page.tsx`** — now a server component that
  loads `getKbEntries(tenantId)` and `getCategories(tenantId)` and passes them
  to the client tab.
- **`components/views/kb/kb-tab.tsx`** — full rewrite:
  - Add entry (category, language, question, answer, comma-separated keywords)
  - Edit entry (same form, pre-filled, in-place via "Edit" icon)
  - Delete entry (with confirm)
  - Filter by language (All / EN / SI / TA / SL)
  - Empty state message
  - Categories pulled from the real Categories table (Products tab), with a
    fallback list if none exist yet.

### Business logic / data model

Table `kb_entries` (already existed in `supabase/schema.sql`):

```
id, tenant_id, category, question, answer, keywords text[], language, created_at
```

RLS restricts rows to the tenant the logged-in user belongs to. All
dashboard CRUD goes through the service-role client but is always filtered by
`tenant_id` from the authenticated session — no cross-tenant leakage.

## n8n integration — REST API

A new public API was added so your n8n bot workflow can read (and append to)
the knowledge base. It lives outside the Clerk-protected dashboard and is
secured with a shared API key header.

### Setup

Add to your `.env.local` (and Vercel project env vars):

```
FLOWBOT_API_KEY=<generate-a-long-random-secret>
```

Send this value as the `x-api-key` header on every request from n8n.

You'll also need your tenant's UUID (`tenants.id`) — find it in Supabase
Studio → `tenants` table, or log it from `getTenant()`.

### Endpoints

#### `GET /api/v1/kb`

Fetch the knowledge base for a tenant — use this in your n8n workflow to load
FAQ context for the bot's RAG/prompt step.

| Param | Required | Description |
|---|---|---|
| `tenant_id` | yes | UUID of the tenant |
| `language` | no | Filter by `EN`, `SI`, `TA`, or `SL` |

**Headers:** `x-api-key: <FLOWBOT_API_KEY>`

**Example:**
```
GET https://your-app.vercel.app/api/v1/kb?tenant_id=<uuid>&language=EN
x-api-key: <secret>
```

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

#### `POST /api/v1/kb`

Create a new KB entry — use this to let n8n log unanswered customer questions
(reviewed/answered by staff, or auto-generated) back into the knowledge base
so the dashboard and bot both pick it up.

**Headers:**
```
x-api-key: <FLOWBOT_API_KEY>
Content-Type: application/json
```

**Body:**
```json
{
  "tenant_id": "uuid",
  "category": "Delivery",
  "question": "Do you deliver to Jaffna?",
  "answer": "Yes, 3-5 business days.",
  "keywords": ["jaffna", "delivery"],
  "language": "EN"
}
```

`category` defaults to `"General"`, `keywords` defaults to `[]`,
`language` defaults to `"EN"` if omitted.

**Response `201`:**
```json
{ "entry": { "id": "uuid", "tenant_id": "uuid", "category": "Delivery", ... } }
```

**Errors:** `401` (bad/missing `x-api-key`), `400` (missing fields),
`404` (unknown `tenant_id`).

## Settings → General tab — implementation notes

The General settings tab (`components/views/settings/settings-tab.tsx`) is now
wired to Supabase via `tenants` table:

- **`supabase/schema.sql`** / **`supabase/migrations/add_tenant_settings_fields.sql`**
  — added `industry`, `whatsapp_number`, `social_links` (jsonb) columns to `tenants`.
  Run the migration file against existing databases.
- **`lib/db/tenant.ts`** (new) — `getTenantById`, `updateTenantSettings`.
- **`app/(dashboard)/settings/actions.ts`** (new) — `updateTenantSettingsAction`
  server action, resolves tenant via `getTenant()`, updates row, revalidates `/settings`.
- **`app/(dashboard)/settings/page.tsx`** — now a server component, loads the
  tenant via `getTenant()` and passes it to `<SettingsTab tenant={...}>`.
- **General section** — Business name, Industry (input/select), email, phone,
  WhatsApp number, currency, address are all controlled fields bound to the
  tenant row, saved via `updateTenantSettingsAction`.
- **Social media links** — new card with Facebook, Instagram, TikTok,
  X (Twitter), YouTube, Website fields, stored in `tenants.social_links` (jsonb).

### n8n integration — `GET /api/v1/tenant`

New endpoint, same auth pattern as `/api/v1/kb` (`x-api-key: <FLOWBOT_API_KEY>`):

```
GET https://your-app.vercel.app/api/v1/tenant?tenant_id=<uuid>
x-api-key: <secret>
```

**Response `200`:**
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Silk Trail",
    "industry": "Fashion / Apparel",
    "email": "aruni@silktrail.lk",
    "phone": "+94 77 123 4567",
    "whatsapp_number": "+94 77 999 0001",
    "address": "No. 42, Galle Road, Colombo 03",
    "default_language": "EN",
    "currency": "LKR",
    "social_links": { "facebook": "https://facebook.com/...", "instagram": "https://instagram.com/..." }
  }
}
```

Use this in n8n to give the bot business context (industry, contact details)
and to share social media links with customers when asked.

## Not yet wired

- "Test bot" action (was a non-functional button in the old UI, removed —
  no test-bot endpoint exists yet).
- KB entries are not yet consumed anywhere inside this app's own chat logic
  (there's no in-app chatbot runtime — that lives in your n8n workflow, which
  is why the API above exists).
