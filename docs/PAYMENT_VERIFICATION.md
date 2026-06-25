# Bank Transfer Payment Verification

## Overview

Adds a payment verification workflow for bank transfer orders. When a customer pays via bank transfer and uploads a payment slip, the order enters a review queue. Admins inspect the proof and approve or reject — the customer is notified automatically via n8n.

---

## Flow

```
Customer places order (bank transfer)
        │
        ▼
  orders.status = "awaiting_payment"
        │
  Customer uploads payment slip + reference
        │
        ▼
  orders.status = "pending_verification"
  payment_proofs row created
        │
  Admin opens Payments page → Reviews proof
        │
   ┌────┴────┐
   ▼         ▼
 Approve   Reject
   │         │
   ▼         ▼
 confirmed  cancelled
   │         │
   └────┬────┘
        ▼
  audit_logs row written
  n8n webhook fires → customer notified via WhatsApp
```

---

## Database Changes

### Extended `orders.status` enum

```
pending → awaiting_payment → pending_verification → confirmed
                                                  → cancelled
(plus existing: preparing, shipped, delivered)
```

### New table: `payment_proofs`

| Column               | Type         | Notes                         |
| -------------------- | ------------ | ----------------------------- |
| `id`                 | uuid PK      |                               |
| `order_id`           | uuid UNIQUE  | One proof per order            |
| `tenant_id`          | uuid FK       |                               |
| `storage_path`       | text          | Path in `payment-proofs` bucket |
| `mime_type`          | text          | e.g. `image/jpeg`, `application/pdf` |
| `file_name`          | text          |                               |
| `customer_reference` | text nullable | Reference the customer typed   |
| `uploaded_at`        | timestamptz   |                               |

### New table: `audit_logs`

| Column        | Type         | Notes                           |
| ------------- | ------------ | ------------------------------- |
| `id`          | uuid PK       |                                 |
| `tenant_id`   | uuid FK       |                                 |
| `actor`       | text          | Clerk user ID or `"system"`      |
| `action`      | text          | e.g. `payment_approved`, `payment_rejected` |
| `entity_type` | text          | e.g. `order`                     |
| `entity_id`   | uuid          |                                 |
| `meta`        | jsonb         | `{ decision, reason, previous_status, new_status }` |
| `created_at`  | timestamptz   |                                 |

### Storage bucket

- **Bucket:** `payment-proofs` (private, signed-URL access only)
- Proofs are never served via public URLs

---

## Dashboard Files

### Pages & Routes

| File | Purpose |
| ---- | ------- |
| `app/(dashboard)/payments/page.tsx` | Server component — fetches orders and renders `PaymentsTab` |
| `app/(dashboard)/payments/actions.ts` | Server action `decidePaymentAction` — approve/reject with role gate, audit log, n8n notification |
| `app/api/dashboard/payments/route.ts` | `GET` — list orders filtered by status (default: `pending_verification`) |
| `app/api/dashboard/payments/[orderId]/route.ts` | `GET` — single order + signed proof URL + audit logs |
| `app/api/dashboard/payments/[orderId]/decision/route.ts` | `POST` — approve/reject with idempotency (409 on duplicate) |

### Components

| File | Purpose |
| ---- | ------- |
| `components/views/payments/payments-tab.tsx` | Queue table with status filters, search, time-waiting column |
| `components/views/payments/payment-review-drawer.tsx` | Review drawer: proof viewer, reference comparison, order summary, audit timeline, approve/reject modals |

### Modified Files

| File | Change |
| ---- | ------ |
| `types/index.ts` | Added `awaiting_payment`, `pending_verification` to `OrderStatus`; added `PaymentProof`, `AuditLog`, `PaymentOrder` types |
| `lib/constants.ts` | Added status badge colors (amber for awaiting, blue for pending_verification) |
| `lib/db/payments.ts` | All DB queries: list/get payment orders, signed URLs, audit logs, idempotent decision |
| `components/layout/sidebar.tsx` | Added "Payments" nav item with `CreditCard` icon |
| `components/views/orders/orders-tab.tsx` | New statuses in filter pills |
| `components/views/orders/order-drawer.tsx` | New statuses in status dropdown |

---

## API Contracts

### `GET /api/dashboard/payments?status=pending_verification`

Returns orders with joined `payment_proofs`. Clerk-session authenticated, tenant-scoped.

**Response:** `Order[]` with nested `payment_proof: PaymentProof | null`

### `GET /api/dashboard/payments/:orderId`

Returns single order + signed proof URL (5-min expiry) + audit logs.

**Response:**
```json
{
  "id": "...",
  "order_ref": "ORD-2026-0042",
  "status": "pending_verification",
  "payment_proof": { "customer_reference": "ORD-2026-0042", "mime_type": "image/jpeg", ... },
  "signed_proof_url": "https://...supabase.co/storage/v1/object/sign/...",
  "audit_logs": [{ "action": "order_placed", ... }, { "action": "proof_uploaded", ... }]
}
```

### `POST /api/dashboard/payments/:orderId/decision`

**Body:** `{ "decision": "approve" | "reject", "reason?": "string" }`

**Responses:**
- `200` — `{ "status": "confirmed" }` or `{ "status": "cancelled" }`
- `403` — role is not Owner/Admin
- `409` — already decided (idempotent, no double-notify)

---

## n8n Integration

### How it connects

When an admin approves or rejects a payment, the dashboard fires a webhook to n8n via `notifyOrderStatusChange()` in `lib/n8n-webhook.ts`.

**Env var required:**
```
N8N_ORDER_STATUS_WEBHOOK_URL=https://your-n8n-instance.com/webhook/order-status
```

### Webhook payload sent to n8n

```json
{
  "event": "order.status_updated",
  "order_id": "uuid",
  "order_ref": "ORD-2026-0042",
  "tenant_id": "uuid",
  "previous_status": "pending_verification",
  "new_status": "confirmed",
  "customer_name": "John Doe",
  "customer_phone": "94771234567",
  "channel": "whatsapp",
  "language": "EN",
  "total": 4500,
  "updated_at": "2026-06-25T10:30:00.000Z"
}
```

### n8n Workflow Setup

Build a workflow in n8n with these nodes:

```
[Webhook Trigger]
       │
       ▼
[Switch Node] ── route by new_status
       │
  ┌────┴────┐
  ▼         ▼
confirmed  cancelled
  │         │
  ▼         ▼
[WhatsApp   [WhatsApp
 Message]    Message]
```

#### 1. Webhook Trigger Node

- **Method:** POST
- **Path:** `/order-status` (or whatever you set as `N8N_ORDER_STATUS_WEBHOOK_URL`)
- **Authentication:** None (or add header auth matching `FLOWBOT_API_KEY`)

#### 2. Switch Node

- **Field:** `{{ $json.new_status }}`
- **Route 1:** equals `confirmed` → approval message
- **Route 2:** equals `cancelled` → rejection message

#### 3. WhatsApp Message — Approved

Use the **WhatsApp Business Cloud API** node or **HTTP Request** node:

```
To: {{ $json.customer_phone }}
Template or text:

  ✅ Payment Confirmed!

  Hi {{ $json.customer_name }},
  Your payment for order {{ $json.order_ref }} has been verified.
  Total: LKR {{ $json.total }}

  We're now preparing your order. Thank you!
```

#### 4. WhatsApp Message — Rejected

```
To: {{ $json.customer_phone }}
Template or text:

  ❌ Payment Not Verified

  Hi {{ $json.customer_name }},
  We could not verify the payment for order {{ $json.order_ref }}.

  Please re-upload your payment slip or contact us for help.
```

#### Optional: Include rejection reason

To pass the rejection reason to n8n, the webhook payload already includes the status change. To also include the reason, you can extend `lib/n8n-webhook.ts` to accept a `reason` parameter, or query the `audit_logs` table from n8n using the FlowBot API.

---

## Role Permissions

| Role   | View queue | Approve/Reject |
| ------ | ---------- | -------------- |
| Owner  | ✅         | ✅              |
| Admin  | ✅         | ✅              |
| Staff  | ✅         | ❌ (buttons disabled, tooltip shown) |

Enforced both in UI (disabled buttons) and server-side (403 from API + server action).

---

## Security

- **Tenant isolation:** All queries scoped by `tenant_id` via RLS. Never trust client-supplied `tenant_id`.
- **Signed URLs:** Proofs accessed via 5-minute signed URLs generated server-side. Never cached in client state.
- **Private bucket:** `payment-proofs` bucket is private — no public access.
- **Idempotency:** Double-decision returns 409, prevents duplicate notifications.
- **Confirmation required:** Both approve and reject show a confirmation modal before executing.
