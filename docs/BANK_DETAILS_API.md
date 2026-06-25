# Bank Details — API & n8n Integration Guide

## Base URL

```
https://your-domain.vercel.app
```

## Authentication

All endpoints require the `x-api-key` header:

```
x-api-key: YOUR_FLOWBOT_API_KEY
```

This must match the `FLOWBOT_API_KEY` environment variable set in your Vercel/deployment.

---

## API Endpoints

### 1. List All Bank Accounts

```
GET /api/v1/bank-details?tenant_id=<uuid>&active_only=true
```

| Query Param   | Required | Description                          |
|---------------|----------|--------------------------------------|
| `tenant_id`   | Yes      | Your tenant UUID                     |
| `active_only` | No       | Set `true` to hide inactive accounts |

**Response (200):**
```json
{
  "bank_details": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "bank_name": "Commercial Bank",
      "account_name": "SilkTrail Pvt Ltd",
      "account_number": "8012345678",
      "branch_name": "Colombo 07",
      "branch_code": "001",
      "notes": "",
      "is_active": true,
      "created_at": "2026-06-25T10:00:00Z",
      "updated_at": "2026-06-25T10:00:00Z"
    }
  ]
}
```

---

### 2. Get Single Bank Account

```
GET /api/v1/bank-details/<id>?tenant_id=<uuid>
```

**Response (200):**
```json
{
  "bank_detail": { ... }
}
```

**Response (404):**
```json
{
  "error": "Bank detail not found"
}
```

---

### 3. Create Bank Account

```
POST /api/v1/bank-details
Content-Type: application/json
```

**Body:**
```json
{
  "tenant_id": "uuid",
  "bank_name": "Commercial Bank",
  "account_name": "SilkTrail Pvt Ltd",
  "account_number": "8012345678",
  "branch_name": "Colombo 07",
  "branch_code": "001",
  "notes": "Main business account",
  "is_active": true
}
```

| Field            | Required | Type    | Description               |
|------------------|----------|---------|---------------------------|
| `tenant_id`      | Yes      | string  | Your tenant UUID          |
| `bank_name`      | Yes      | string  | Name of the bank          |
| `account_name`   | Yes      | string  | Account holder name       |
| `account_number` | Yes      | string  | Bank account number       |
| `branch_name`    | No       | string  | Branch name               |
| `branch_code`    | No       | string  | Branch code               |
| `notes`          | No       | string  | Additional notes          |
| `is_active`      | No       | boolean | Default: `true`           |

**Response (201):**
```json
{
  "bank_detail": { ... }
}
```

---

### 4. Update Bank Account

```
PUT /api/v1/bank-details/<id>
Content-Type: application/json
```

**Body (only include fields you want to update):**
```json
{
  "tenant_id": "uuid",
  "bank_name": "Updated Bank Name",
  "is_active": false
}
```

**Response (200):**
```json
{
  "bank_detail": { ... }
}
```

---

### 5. Delete Bank Account

```
DELETE /api/v1/bank-details/<id>?tenant_id=<uuid>
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Error Responses

| Status | Meaning                         |
|--------|---------------------------------|
| 401    | Missing or invalid `x-api-key`  |
| 400    | Missing required field           |
| 404    | Tenant or bank detail not found  |
| 500    | Server error                     |

All errors return: `{ "error": "description" }`

---

## n8n Integration — Step by Step

### Workflow 1: Fetch Bank Details (for Chatbot)

This is the workflow your chatbot calls when a customer asks about bank/payment info.

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Webhook  │───▶│ HTTP Request │───▶│ Format       │───▶│ Respond to      │
│ (trigger)│    │ (GET API)    │    │ Response     │    │ Webhook         │
└──────────┘    └──────────────┘    └──────────────┘    └─────────────────┘
```

#### Node 1: Webhook

- **HTTP Method:** POST
- **Path:** `bank-details-lookup`
- **Authentication:** None (internal call from your chatbot workflow)

Incoming body from chatbot:
```json
{
  "tenant_id": "your-tenant-uuid"
}
```

#### Node 2: HTTP Request

- **Method:** GET
- **URL:**
  ```
  {{$env.FLOWBOT_BASE_URL}}/api/v1/bank-details?tenant_id={{$json.tenant_id}}&active_only=true
  ```
- **Authentication:** Generic Credential Type → Header Auth
  - **Header Name:** `x-api-key`
  - **Header Value:** Your `FLOWBOT_API_KEY`

Or set headers manually:
- **Header:** `x-api-key` = `{{$env.FLOWBOT_API_KEY}}`

#### Node 3: Code Node (Format Response)

```js
const accounts = $input.first().json.bank_details;

if (!accounts || accounts.length === 0) {
  return [{
    json: {
      found: false,
      message: "Sorry, no bank account details are available at the moment."
    }
  }];
}

const formatted = accounts.map(a => {
  let text = `🏦 ${a.bank_name}\n`;
  text += `Account Name: ${a.account_name}\n`;
  text += `Account Number: ${a.account_number}\n`;
  if (a.branch_name) text += `Branch: ${a.branch_name}`;
  if (a.branch_code) text += ` (${a.branch_code})`;
  if (a.branch_name) text += '\n';
  if (a.notes) text += `Note: ${a.notes}\n`;
  return text.trim();
});

return [{
  json: {
    found: true,
    count: accounts.length,
    message: formatted.join('\n\n---\n\n'),
    accounts: accounts
  }
}];
```

#### Node 4: Respond to Webhook

- **Respond With:** JSON
- **Response Body:** `{{ $json }}`

---

### Workflow 2: Chatbot Intent Detection

In your **main chatbot workflow**, add a **Switch** or **IF** node to detect bank-related questions:

#### IF Node — Detect Bank Intent

```
Condition: String → Contains
Value: {{ $json.message.toLowerCase() }}
Contains any of: bank, payment, account number, transfer, deposit, bank details, pay
```

**True branch →** Call the bank details webhook:

#### HTTP Request Node

- **Method:** POST
- **URL:** `http://localhost:5678/webhook/bank-details-lookup` (or your n8n webhook URL)
- **Body:**
  ```json
  {
    "tenant_id": "{{ $json.tenant_id }}"
  }
  ```

Then pass `{{ $json.message }}` into your chatbot's reply.

---

### n8n Environment Variables

Set these in **n8n Settings → Variables**:

| Variable           | Value                                    |
|--------------------|------------------------------------------|
| `FLOWBOT_BASE_URL` | `https://your-domain.vercel.app`         |
| `FLOWBOT_API_KEY`  | Your API key (same as in Vercel env)     |

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Admin)                         │
│  Add / Edit / Delete / Activate / Deactivate bank accounts  │
│  All changes are audit-logged                               │
└────────────────────────┬────────────────────────────────────┘
                         │ Server Actions
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                          │
│  bank_details (single source of truth)                      │
│  bank_detail_audit_logs (who changed what, when)            │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           │ RLS + Service Role               │ API (x-api-key)
           ▼                                  ▼
┌──────────────────┐              ┌───────────────────────────┐
│ Dashboard reads  │              │  /api/v1/bank-details     │
│ via Server       │              │  GET  → list / single     │
│ Components       │              │  POST → create            │
└──────────────────┘              │  PUT  → update            │
                                  │  DELETE → delete          │
                                  └─────────────┬─────────────┘
                                                │
                                  ┌─────────────▼─────────────┐
                                  │  n8n Workflow              │
                                  │  HTTP Request node calls   │
                                  │  GET with active_only=true │
                                  │  → Format response         │
                                  └─────────────┬─────────────┘
                                                │
                                  ┌─────────────▼─────────────┐
                                  │  CHATBOT (WhatsApp/Web)    │
                                  │  Customer asks about bank  │
                                  │  → n8n detects intent      │
                                  │  → Fetches live data       │
                                  │  → Returns formatted reply │
                                  │  (only active accounts)    │
                                  └───────────────────────────┘
```

---

## Security Summary

| Layer              | Protection                                                |
|--------------------|-----------------------------------------------------------|
| API Authentication | `x-api-key` header required on every request              |
| Tenant Isolation   | Every query filters by `tenant_id`; Supabase RLS enforced |
| Role-Based Access  | Dashboard protected by Clerk auth (Owner/Admin/Staff)     |
| Audit Logging      | Every create/update/delete logged with user + changes     |
| Data Validation    | Required fields validated before saving                   |
| Chatbot Safety     | `active_only=true` ensures inactive accounts never shown  |
