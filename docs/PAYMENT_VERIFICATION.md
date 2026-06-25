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

## Bot-Side Endpoints (n8n → FlowBot API)

These endpoints power the WhatsApp chatbot side — n8n calls them to detect awaiting-payment orders and upload proofs, so the slip never hits image search and goes straight to the dashboard.

### The Problem They Solve

Before these endpoints:
- Customer sends a payment slip image → n8n has no way to know it's a slip → routes to **image search** → slip "pollutes" the order with product matches
- Even if n8n knew, there was no endpoint to upload the proof → slip is lost, admin never sees it

After:
- n8n checks `active-awaiting-payment` first → if the customer has a bank transfer order waiting, n8n skips image search entirely → routes to `payment-proof` → slip is uploaded, order flips to `pending_verification`, dashboard receives the proof instantly

### n8n Image Routing Flow

```
Customer sends image via WhatsApp
              │
              ▼
   GET /api/v1/orders/active-awaiting-payment
         ?tenant_id=...&phone=...
              │
         ┌────┴────┐
         │         │
     awaiting    404
      found       │
         │        ▼
         ▼   POST /api/v1/products/image-search
   POST /api/v1/orders/payment-proof
         │        │
         ▼        ▼
   Order flips   Product
   to pending_   matches
   verification  returned
         │
         ▼
   Dashboard shows proof
   in Payments queue
```

### `GET /api/v1/orders/active-awaiting-payment`

**Purpose:** n8n calls this when a customer sends an image. If they have an `awaiting_payment` order, n8n routes to the proof upload branch instead of image search.

**Auth:** `x-api-key` header (FLOWBOT_API_KEY)

**Query params:**
- `tenant_id` (required)
- `phone` (required — customer's WhatsApp number)

**Response (found):**
```json
{
  "awaiting": true,
  "order": {
    "id": "uuid",
    "order_ref": "ORD-2026-0042",
    "status": "awaiting_payment",
    "total": 4500,
    "currency": "LKR",
    "customer_name": "John Doe",
    "payment_method": "bank_transfer",
    "created_at": "2026-06-25T10:00:00Z"
  }
}
```

**Response (no awaiting order):**
```json
{ "awaiting": false }    // 404
```

**File:** `app/api/v1/orders/active-awaiting-payment/route.ts`

---

### `POST /api/v1/orders/payment-proof`

**Purpose:** Receives the payment slip image from n8n, uploads it to Supabase Storage, creates a `payment_proofs` row, flips the order to `pending_verification`, and writes an audit log entry.

**Auth:** `x-api-key` header (FLOWBOT_API_KEY)

**Body:**
```json
{
  "tenant_id": "uuid",
  "order_id": "uuid",
  "image_base64": "base64-encoded-image-no-data-prefix",
  "mime_type": "image/jpeg",
  "file_name": "slip.jpg",
  "customer_reference": "ORD-2026-0042"
}
```

| Field                | Required | Notes |
| -------------------- | -------- | ----- |
| `tenant_id`          | Yes      |       |
| `order_id`           | Yes      | UUID from the `active-awaiting-payment` response |
| `image_base64`       | Yes      | Raw base64, no `data:` prefix |
| `mime_type`          | No       | Default: `image/jpeg` |
| `file_name`          | No       | Default: `payment-proof.jpg` |
| `customer_reference` | No       | What the customer typed as their reference |

**Response (success):**
```json
{
  "success": true,
  "order_ref": "ORD-2026-0042",
  "status": "pending_verification"
}
```

**Error responses:**
- `404` — order not found
- `409` — order not in `awaiting_payment` status, or proof already uploaded
- `500` — storage upload or DB error

**What it does internally:**
1. Validates order exists and is `awaiting_payment`
2. Checks no proof already exists (UNIQUE constraint)
3. Uploads image to `payment-proofs/{tenant_id}/{order_id}/{file_name}`
4. Creates `payment_proofs` row
5. Flips `orders.status` to `pending_verification` (with status guard against race)
6. Writes `audit_logs` entry with action `proof_uploaded`

**File:** `app/api/v1/orders/payment-proof/route.ts`

---

### Order Creation Change

**`POST /api/v1/orders`** — updated so that when `payment_method` is `bank_transfer`, the order starts as `awaiting_payment` instead of `pending`. The upsert-on-draft logic also matches `awaiting_payment` drafts.

**File:** `app/api/v1/orders/route.ts`

---

### n8n Workflow Setup (Image Branch)

Add this to your existing n8n WhatsApp workflow, **before** the image search node:

#### Node 1: HTTP Request — Check Awaiting Payment

```
Method: GET
URL: {{$env.FLOWBOT_API_URL}}/api/v1/orders/active-awaiting-payment
       ?tenant_id={{ $json.tenant_id }}&phone={{ $json.phone }}
Headers:
  x-api-key: {{$env.FLOWBOT_API_KEY}}
```

#### Node 2: IF Node — Route Decision

- **Condition:** `{{ $json.awaiting }}` equals `true`
- **True branch →** Upload proof
- **False branch →** Existing image search flow

#### Node 3: HTTP Request — Upload Proof (true branch)

```
Method: POST
URL: {{$env.FLOWBOT_API_URL}}/api/v1/orders/payment-proof
Headers:
  x-api-key: {{$env.FLOWBOT_API_KEY}}
  Content-Type: application/json
Body:
{
  "tenant_id": "{{ $json.tenant_id }}",
  "order_id": "{{ $node['Check Awaiting'].json.order.id }}",
  "image_base64": "{{ $json.image_base64 }}",
  "mime_type": "{{ $json.mime_type }}",
  "customer_reference": "{{ $json.customer_text }}"
}
```

#### Node 4: WhatsApp Reply — Proof Received

```
To: {{ $json.phone }}
Text:
  ✅ We received your payment slip for order {{ $json.order_ref }}.
  Our team will verify it shortly. You'll be notified once confirmed.
```

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
