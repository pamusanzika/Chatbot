# Orders: full ground-truth snapshot + server-trusted pricing

Backend work fixing the production bug where the bot showed a customer a revised
summary (T-shirt ×2, LKR 3,500) but sent the **previous** item list (×1, LKR 2,000) in
its machine block, and `PATCH /orders/current` faithfully re-saved the stale order.
Root cause: the bot had no ground truth for what was actually on the order and no
guarantee that a saved price came from the catalog rather than the model.

Scope: P0 (ground-truth snapshot, `status_changed_at`) + P1 (trusted pricing, full
echo, optimistic concurrency) from the original spec. P2 (audit trail, API key
rotation, rate limiting) explicitly deferred — not implemented here.

## `GET /api/v1/orders/current` — full snapshot, not just `{order_ref, status}`

`app/api/v1/orders/current/route.ts`

Now returns the full order so n8n can inject it verbatim into the model's system
prompt and the model edits *that* list instead of reconstructing one from chat
memory:

```jsonc
{
  "order": {
    "order_ref": "ORD-2026-0067",
    "status": "pending",
    "currency": "LKR",
    "items": [{ "name": "T-shirt", "quantity": 1, "unit_price": 1500, "line_total": 1500, "product_id": "..." }],
    "subtotal": 1500,
    "delivery_fee": 500,
    "total": 2000,
    "customer_name": "...",
    "delivery_address": "...",
    "contact_number": "...",
    "payment_method": "...",
    "created_at": "...",
    "updated_at": "...",
    "status_changed_at": "..."
  },
  "support_number": "..."
}
```

Additive change — auth, 400s, `order: null` + `support_number` on no-order, and the
non-terminal-order preference all behave as before. Numbers are coerced to real JSON
numbers (`toOrderSnapshot` in `lib/db/orders.ts`), never strings.

## `status_changed_at`

New column, distinct from `updated_at` (which also moves on every chat PATCH).
n8n uses it to know when to cut chat history and start fresh.

- Migration: `supabase/migrations/add_order_status_changed_at.sql` — adds the
  column, backfills existing rows from `updated_at`.
- Written wherever `status` changes: `updateOrderStatus` and `createOrder`
  (`lib/db/orders.ts`), the payment-proof status flip (`payment-proof/route.ts`),
  `decidePayment` (dashboard confirm/reject, `lib/db/payments.ts`), and both
  insert/update paths in `POST /orders`.
- Returned as part of the snapshot above.

## Never trust LLM-supplied prices or delivery fees

New `lib/db/order-items.ts` — `resolveOrderItems(supabase, tenantId, rawItems)`:
- Resolves each line to a real `products`/`product_variants` row (by `product_id`
  when present, else exact name+variant match scoped to the tenant).
- Takes `unit_price` **from the database**, always — the caller's `unit_price` is
  discarded.
- Throws `UnknownItemError` if a line can't be resolved (unknown product, or a
  variant that doesn't exist) — callers turn this into `422 { error: "unknown_item", name }`
  instead of guessing.

New `resolveDeliveryFee` / `cityFromAddress` in `lib/db/delivery-zones.ts` — delivery
fee always comes from the tenant's delivery zones for the (derived or hinted) city,
never from the request body.

Wired into both:
- `PATCH /api/v1/orders/current` (`app/api/v1/orders/current/route.ts`)
- `POST /api/v1/orders` (`app/api/v1/orders/route.ts`) — replaces the old inline
  price-matching logic that silently fell back to the LLM's price with a
  `price_unverified` flag.

## Full order echoed back

Both endpoints now return the full saved order (same shape as the GET snapshot)
instead of a thin subset:
- `PATCH /orders/current`: `{ ok: true, order: <snapshot> }` (was
  `{ order_ref, status, total }`).
- `POST /orders`: keeps the existing top-level `order_id`/`mode`/`subtotal`/
  `delivery_fee`/`total` fields for backward compatibility, and adds a new
  `order: <snapshot>` field alongside them.

This alone would have made the original 3,500-vs-2,000 bug visible immediately —
the bot renders its confirmation from what the database actually saved.

## Optimistic concurrency on PATCH

`PATCH /orders/current` accepts an optional `expected_updated_at` (ISO string from
the last snapshot the bot saw). It's added to the update's `WHERE` clause alongside
the existing editable-status guard.

- Zero rows matched **and** the order is no longer editable → existing
  `409 { error: "order_locked", status, order_ref }`.
- Zero rows matched **but** the order is still editable (a second near-simultaneous
  chat edit lost the race) → new `409 { error: "order_changed", order: <fresh snapshot> }`.

## Files changed

| File | Change |
|---|---|
| `types/index.ts` | `OrderItem.product_id`, new `OrderSnapshot` type, `Order.status_changed_at` |
| `lib/db/orders.ts` | `ORDER_SNAPSHOT_COLUMNS`, `toOrderSnapshot()`, `status_changed_at` writes in `createOrder`/`updateOrderStatus` |
| `lib/db/order-items.ts` | **new** — `resolveOrderItems`, `UnknownItemError` |
| `lib/db/delivery-zones.ts` | `cityFromAddress`, `resolveDeliveryFee` |
| `lib/db/payments.ts` | `decidePayment` writes `status_changed_at` |
| `app/api/v1/orders/current/route.ts` | full snapshot on GET; trusted pricing, full echo, optimistic concurrency on PATCH |
| `app/api/v1/orders/route.ts` | trusted pricing via `resolveOrderItems`/`resolveDeliveryFee`, echoes full snapshot, `status_changed_at` on write |
| `app/api/v1/orders/payment-proof/route.ts` | writes `status_changed_at` on the `pending_verification` flip |
| `supabase/migrations/add_order_status_changed_at.sql` | **new** — column + backfill |
| `scripts/test-order-current-flow.ts` | **new** — automated acceptance test (see below) |

## Acceptance test

`scripts/test-order-current-flow.ts` automates the spec's 6-step acceptance test
against a live dev server + Supabase project. It reads expected prices/fees from
the DB itself (not hardcoded), creates its own throwaway order(s), and deletes them
on exit.

```
FLOWBOT_API_KEY=... TEST_TENANT_ID=... TEST_ADDRESS="12 Main St, Colombo" \
  npx tsx scripts/test-order-current-flow.ts
```

Requires `npm run dev` running and a tenant with an active product (default name
"T-shirt", override with `TEST_PRODUCT_NAME`) and a delivery zone covering
`TEST_ADDRESS`'s city.

## Not done (deferred by explicit choice)

- **`order_revisions` audit trail** (P2) — before/after diffs per edit.
- **Security** (P2) — rotating the n8n API key out of the exported workflow JSON,
  storing it as an n8n credential, per-tenant rate limiting on `/api/v1/*`. These
  need action in n8n/infra, not just this codebase.

## Supabase SQL still to run

See chat history for the full SQL, or apply the migration files directly:
- `supabase/migrations/add_order_status_changed_at.sql` (this work)
- `supabase/migrations/add_orders_current_lookup_index.sql`
- `supabase/migrations/add_chat_messages_usage_index.sql`
- `supabase/migrations/add_support_tickets.sql`

The latter three predate this chat and may already be applied to your project —
all four are idempotent and safe to re-run.
