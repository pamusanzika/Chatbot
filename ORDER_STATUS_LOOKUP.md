# Order Status Lookup + Order Update Endpoints

Backend work for the n8n chatbot extension that lets the bot (a) know whether a
customer's order is still editable and (b) apply customer edits to it.

## Important: real status enum (differs from the assumed spec)

The task brief assumed a 13-value status enum (`pending_payment`, `draft`,
`processing`, `packed`, `out_for_delivery`, `completed`, etc.). The actual
`OrderStatus` type (`types/index.ts`) only has **8** values, confirmed against
`components/views/orders/order-drawer.tsx`:

```
pending | awaiting_payment | pending_verification | confirmed | preparing | shipped | delivered | cancelled
```

These were mapped onto the task's groups in `lib/db/orders.ts`:

| Group | Statuses |
|---|---|
| **Editable** (customer may still change via chat) | `pending`, `awaiting_payment`, `pending_verification` |
| **Locked** (team-confirmed on the dashboard) | `confirmed`, `preparing`, `shipped`, `delivered` |
| **Terminal** (excluded when picking the "current" order) | `cancelled`, `delivered` |

The n8n classifier needs to be aligned to these 8 real strings, not the
assumed 13 — nothing was silently remapped.

## Files changed / added

### `app/api/v1/orders/current/route.ts` (new)
- **`GET /api/v1/orders/current?tenant_id=&phone=`**
  - Auth via `x-api-key` (401), validates `tenant_id`/`phone` (400).
  - Finds the customer's most relevant order: prefers a non-terminal order
    (not `cancelled`/`delivered`), falling back to the newest order overall
    (including terminal) if that's all there is.
  - Phone lookup falls back to a normalized-phone `LIKE` match, same pattern
    as the existing `active-awaiting-payment` route.
  - Always returns `200`, never `404` for "no order":
    `{ order: { order_ref, status } | null, support_number }`.
- **`PATCH /api/v1/orders/current`**
  - Auth + validates `tenant_id` and (`order_ref` OR `phone`), plus
    `customer_name`, `delivery_address`, `payment_method`, non-empty `items`.
  - Locates the order by `order_ref` (scoped to tenant) if given, else the
    newest order for `tenant_id + phone`.
  - **Guard**: if the order's status isn't in the editable set, returns `409`
    `{ error: "order_locked", status, order_ref }` and changes nothing.
  - Recomputes `subtotal`/`total` server-side from `items` + `delivery_fee` —
    client-sent totals are never trusted.
  - Updates `customer_name`, `delivery_address`, `contact_number`,
    `payment_method`, `currency`, `items`, `subtotal`, `delivery_fee`,
    `total`, `language`, `updated_at`. **Never touches `status`.**
  - **Concurrency**: the actual `UPDATE` is conditioned on
    `status IN (editable...)` (same technique already used by
    `POST /api/v1/orders`'s draft-upsert). If a dashboard confirmation wins
    the race between the guard check and the update, zero rows match and the
    endpoint re-fetches the fresh status and returns `409 order_locked`
    instead of silently succeeding.

### `lib/db/orders.ts`
- Added exported constants: `EDITABLE_ORDER_STATUSES`, `TERMINAL_ORDER_STATUSES`,
  `ALL_ORDER_STATUSES`, `NON_TERMINAL_ORDER_STATUSES`.

### Support number (customer-facing contact number)
There was no customer-facing support number stored anywhere (`bank_details`
only has bank/account fields; `tenant.phone_number_id` is a WhatsApp Business
ID, not dialable). Added `support_number` as a new field **inside the existing
`chatbot_settings` JSONB blob** (same place as `bot_name`, `fallback_message`,
etc.) rather than a new physical column — no migration required, and it flows
through automatically wherever `chatbot_settings` is already returned.

- `types/index.ts` — added `support_number?: string` to `ChatbotSettings`.
- `app/api/v1/chatbot-settings/route.ts` — added `support_number: ''` to the
  defaults object returned when a tenant has no settings saved yet.
- `components/views/settings/settings-tab.tsx` — new "Support" card with a
  "Support contact number" field, wired into the existing chatbot-settings
  save action.
- `app/api/v1/n8n/webhook/route.ts`'s `get_config` action needed no change —
  it already returns the whole `chatbot_settings` object as-is.
- `GET /api/v1/orders/current` also returns `support_number` directly (read
  from `tenant.chatbot_settings.support_number`), so n8n doesn't have to make
  a second call just to get it.

### `supabase/migrations/add_orders_current_lookup_index.sql` (new)
- `create index on public.orders (tenant_id, phone, created_at desc)` — the
  exact access pattern used by `/orders/current`, which is called on every
  inbound chat message and needs to stay fast.

## What was deliberately NOT done
- No new order is ever created by either endpoint (creation stays on
  `POST /api/v1/orders`).
- Neither endpoint can change `status`.
- Client-sent `subtotal`/`total` are never trusted — always recomputed.

## Verification performed
- `npx tsc --noEmit` — clean, no type errors.
- Not yet tested against a live Supabase instance or the actual n8n workflow —
  recommend a smoke test (create a `pending` order, hit both endpoints, then
  confirm it and retry the `PATCH` to see the `409`) before wiring up n8n.
