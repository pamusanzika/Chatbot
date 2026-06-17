# FlowBot — Development Changelog

---

## 1. Tenant by Phone API (`/api/v1/tenant-by-phone`)

**Files created:**
- `app/api/v1/tenant-by-phone/route.ts`
- `lib/db/tenants.ts`
- `app/api/v1/tenant-by-phone/TENANT_BY_PHONE_API.md`

**What it does:**
n8n-facing GET endpoint that resolves a tenant from a WhatsApp `phone_number_id`.
Protected by `x-api-key` header (`FLOWBOT_API_KEY`). Returns full tenant record
including all WhatsApp credentials plus a `business_name` alias for `name` for
backwards compatibility with existing n8n workflows.

**DB query:**
```sql
SELECT id, name, phone, email, address, whatsapp_number,
       default_language, currency, social_links,
       phone_number_id, wa_access_token, wa_business_account_id,
       wa_phone_number, wa_verified
FROM tenants
WHERE phone_number_id = $1
```

---

## 2. Chat Logs Backend — Full Feature

### 2a. Types (`types/index.ts`)

Updated `ChatSession` and `ChatMessage` interfaces to match the actual DB schema:

| Old field | New field |
|-----------|-----------|
| `session_ref` | `session_id` |
| `customer_phone` | `phone` |
| `is_flagged` | `flagged` |
| `started_at` | `last_message_at`, `created_at` |
| `from` | `role` |
| `text` | `content` |
| `timestamp` | `created_at` |

Added new `ChatStats` interface.

### 2b. DB Helpers (`lib/db/chat-sessions.ts`)

Full rewrite. Functions:

| Function | Purpose |
|----------|---------|
| `getChatSessions(tenantId, filters, page)` | Paginated sessions with language/flagged/search filters + COUNT |
| `getChatMessages(tenantId, sessionId)` | All messages for a session ordered by created_at ASC |
| `flagChatSession(tenantId, sessionId, flagged, note)` | Set flagged + flag_note |
| `getChatStats(tenantId)` | Monthly totals: sessions, messages, flagged count, language breakdown |
| `upsertChatSession(...)` | Insert-if-new + read-then-increment message_count |
| `insertChatMessage(...)` | Insert a single message row, returns inserted row |
| `getSessionWithHistory(...)` | Session row + last 20 messages for n8n context restore |
| `deleteChatSession(tenantId, sessionId)` | Deletes messages then session (FK order) |

### 2c. Dashboard API Routes (Clerk-protected)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/chat-logs/sessions` | Paginated session list with filters |
| GET | `/api/chat-logs/sessions/[sessionId]/messages` | Message thread |
| PATCH | `/api/chat-logs/sessions/[sessionId]/flag` | Flag / unflag a session |
| DELETE | `/api/chat-logs/sessions/[sessionId]` | Delete session + all messages |
| GET | `/api/chat-logs/stats` | Monthly stats |

All routes call `getTenant()` first and filter every query by `tenant_id`.

### 2d. n8n-Facing API Routes (`x-api-key` protected)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/v1/chat/message` | Upsert session + insert message. Called after every WhatsApp message |
| GET | `/api/v1/chat/session` | Returns session + last 20 messages for conversation context |

**POST `/api/v1/chat/message` body:**
```json
{
  "tenant_id": "...",
  "session_id": "...",
  "phone": "+94771234567",
  "role": "user",
  "content": "Hello",
  "language": "EN",
  "intent": "Order",
  "tokens_used": 120,
  "channel": "whatsapp"
}
```

### 2e. Frontend (`components/views/chat-logs/chat-logs-tab.tsx`)

Full rewrite of the component from static stubs to live data:

- Fetches sessions from `/api/chat-logs/sessions` on mount and on filter change
- Fetches stats from `/api/chat-logs/stats` for the header summary
- Language, flagged, and phone search filters with debounce via state
- Pagination (20 per page) with Prev/Next controls
- Chat drawer fetches messages from `/api/chat-logs/sessions/[sessionId]/messages`
- Flag toggle in drawer calls PATCH and updates state optimistically
- Delete button in action row calls DELETE with confirmation dialog, removes row instantly
- `renderMessageContent()` function parses message content and renders:
  - Supabase Storage URLs → clickable `200×200` image thumbnails
  - Any `.jpg/.png/.webp/.gif/.svg` URL → image thumbnail
  - Other URLs → styled link
  - Plain text → `pre-wrap` span

---

## 3. Bug Fix — message_count Stuck at 2

**Problem:** The original `upsertChatSession` used Supabase `.upsert()` with
`message_count: 1` hardcoded, which overwrote the count on every conflict.
It also called a non-existent Postgres RPC `increment_message_count`.

**Fix:** Replaced with a two-step approach:
1. `INSERT` with `message_count: 0` (silently ignored if session exists)
2. `SELECT message_count` → `UPDATE message_count = count + 1`

This correctly increments on every message regardless of whether the session
is new or existing.

---

## 4. Image Rendering in Chat Bubbles

Added `renderMessageContent(content)` to `chat-logs-tab.tsx`.

Detects URLs in message content using a regex split and renders:
- **Images** (Supabase storage or image file extension) → `<img>` tag wrapped in
  `<a target="_blank">`, max 200×200, with `onError` hide fallback
- **Other URLs** → `<a>` link in accent colour
- **Plain text** → `<span style="white-space: pre-wrap">`

---

## 5. Component Compatibility Fixes

Fixed two components that broke when `ChatMessage` fields were renamed:

- `components/views/customers/customers-tab.tsx` — `m.from` → `m.role`, `m.text` → `m.content`, `m.timestamp` → `m.created_at`
- `components/views/orders/order-drawer.tsx` — same field renames + made `m.language` nullable-safe

---

## 6. WhatsApp Image Note

Images sent by customers via WhatsApp arrive as a `media_id`, not a URL.
To store and display them correctly, the n8n workflow must:

1. Call `GET https://graph.facebook.com/v18.0/<media_id>` with `Authorization: Bearer <wa_access_token>` to get a temporary download URL
2. Download the binary (auth header required)
3. Upload to Supabase Storage
4. Save the Supabase URL to `chat_messages.content`

The raw WhatsApp CDN URL expires in ~5 minutes. The dashboard renderer is
correct — this fix belongs in the n8n workflow.

---

## API Reference Summary

### Auth

| Route prefix | Auth method |
|---|---|
| `/api/v1/*` | `x-api-key` header = `FLOWBOT_API_KEY` env var |
| `/api/chat-logs/*` | Clerk session (via `getTenant()`) |

### Error format (all routes)

```json
{ "error": "Human readable message" }
```

HTTP status: `400` bad input · `401` unauthorized · `404` not found · `500` server error
