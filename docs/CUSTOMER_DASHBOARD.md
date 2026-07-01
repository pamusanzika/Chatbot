# 360° Customer Dashboard

## Overview

The Customers tab was previously fully mocked (hardcoded empty arrays — no real data ever rendered). This work wires it to a live "360° view": each customer's profile drawer shows lifetime spend, a payment-status breakdown, and their full order history in one screen, with each order clickable for full detail. It also fixes the underlying gap that made the `customers` table empty in the first place — no order-creation path had ever written to it.

---

## Why phone number, not `customer_id`

`orders.customer_id` exists as a nullable FK but is never set by any order-creation path (bot orders only ever set `customer_name`/`customer_phone`). Since phone number is already used for search and is reliably present, all customer↔order joins in this feature use **phone number**, not `customer_id`.

---

## What was built

### Data layer

| File | Change |
| ---- | ------ |
| `lib/db/orders.ts` | Added `getOrdersByCustomerPhone(tenantId, phone)` — full order history for a phone, newest first. |
| `lib/db/customers.ts` | Added `getCustomerDetail(tenantId, id)` — customer + their orders + a payment-status count breakdown. Added `upsertCustomerFromOrder(tenantId, phone, name, language)` — recomputes `total_orders`/`total_spent`/`last_order_at` from the customer's actual orders (excluding cancelled) and upserts the `customers` row. |

### API

| File | Change |
| ---- | ------ |
| `app/api/dashboard/customers/[customerId]/route.ts` | New route. Returns `{ customer, orders, paymentSummary }` for the drawer's on-demand fetch. |

### Dashboard UI

| File | Change |
| ---- | ------ |
| `app/(dashboard)/customers/page.tsx` | Converted to a server component — fetches real customers via `getCustomers()` instead of rendering an empty-array mock. |
| `components/views/customers/customers-tab.tsx` | Customer list table wired to real data. Removed the **Lang** column; **Last order** now shows a full formatted date instead of a truncated `MM-DD` slice. The customer drawer fetches live detail on open, shows a payment-status chip row, and lists the customer's full order history — each order row is clickable and opens the existing `OrderDrawer` (same component used on the Orders page) stacked on top for full order detail, including status updates. The "Recent chat" section was removed (no real per-customer chat-session query existed at production scale to justify keeping it). |

### Fixing the empty-table root cause

The Customers tab stayed blank even after the table existed, because **nothing wrote to `customers`** — `POST /api/v1/orders` (the real bot/n8n order-creation endpoint) only ever inserted into `orders`. Added `upsertCustomerFromOrder()` calls to:

- `POST /api/v1/orders` — both the "new order" and "update draft" paths
- `PATCH /api/v1/orders` — order status changes
- `app/(dashboard)/payments/actions.ts` → `decidePaymentAction` — payment approve/reject

`createOrder()` in `lib/db/orders.ts` was left alone — it has no callers anywhere in the codebase (dead code), and wiring it in would have created a circular import between `lib/db/orders.ts` and `lib/db/customers.ts`.

### Database

| File | Change |
| ---- | ------ |
| `supabase/migrations/add_customer_lookup_indexes.sql` | New indexes: `orders(tenant_id, customer_phone)`, `orders(tenant_id, phone)`, `chat_sessions(tenant_id, phone)` — needed since the new queries filter by phone, which wasn't previously indexed. |
| `app/globals.css` | Added `.fb-item-row.fb-row-click` hover/cursor styling — the existing `.fb-row-click` rule was scoped to `<table>` rows only, not the `<div>` rows used for the clickable order list. |

The `customers` table itself was already defined in `supabase/schema.sql` but had never actually been created in the live Supabase project — this was diagnosed via a `PGRST205` error (`Could not find the table 'public.customers' in the schema cache`) and fixed by running the table + RLS policy creation SQL directly against Supabase (not part of this repo's automated migrations).

---

## Known gaps / follow-ups

- **Historical backfill**: orders placed *before* this fix won't retroactively appear in `customers` — only new writes through the paths above trigger the upsert. A one-off backfill script was offered but not yet built.
- **Order→Customer navigation**: `order-drawer.tsx` still shows `customer_name`/`customer_phone` as plain text with no link back to the customer profile. Out of scope for this round.
- **`createOrder()` dead code**: if a dashboard "create order manually" feature is ever built on top of it, it will need its own `upsertCustomerFromOrder()` call added.

---

## Deploys

| Commit | What shipped |
| ------ | ------------ |
| `1fc0607` | Initial 360° dashboard: live data wiring, payment-status summary, order history, recent chat, customer upsert fix. |
| `72edfdb` | Follow-up cleanup: removed recent chat section, removed Lang column, full-date "Last order" column, clickable order rows opening `OrderDrawer`. |

Both deployed to Vercel production at `https://flowbot-steel.vercel.app`.
