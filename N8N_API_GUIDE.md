# FlowBot n8n Integration API Guide

## Authentication

All endpoints require the `x-api-key` header set to your `FLOWBOT_API_KEY` environment variable.

```
x-api-key: <FLOWBOT_API_KEY>
```

---

## Endpoints

### 1. Get Chatbot Settings

```
GET /api/v1/chatbot-settings?tenant_id=<TENANT_ID>
```

**Response:**

```json
{
  "chatbot_settings": {
    "bot_name": "Silk Bot",
    "language_model": "",
    "system_prompt": "You are Silk Bot...",
    "languages": [
      { "name": "English", "enabled": true },
      { "name": "Sinhala", "enabled": true },
      { "name": "Tamil", "enabled": true },
      { "name": "Singlish", "enabled": true }
    ],
    "fallback_message": "Sorry, I didn't understand that. Can you rephrase?",
    "handoff_triggers": "speak to agent, human, real person",
    "handoff_message": "Connecting you to a team member, please hold"
  }
}
```

---

### 2. n8n Webhook (Unified Endpoint)

```
POST /api/v1/n8n/webhook
Content-Type: application/json
```

All requests require an `action` field in the JSON body.

#### Action: `ping`

Health check to verify the API is reachable.

**Request:**

```json
{ "action": "ping" }
```

**Response:**

```json
{ "status": "ok", "timestamp": "2026-06-18T12:00:00.000Z" }
```

---

#### Action: `get_config`

Returns tenant profile and chatbot settings. Use this in n8n to configure AI agent behavior dynamically.

**Request:**

```json
{
  "action": "get_config",
  "tenant_id": "tenant_abc123"
}
```

**Response:**

```json
{
  "tenant": {
    "id": "tenant_abc123",
    "name": "Silk Trail",
    "industry": "fashion",
    "phone": "+94771234567",
    "whatsapp_number": "+94771234567",
    "currency": "LKR",
    "default_language": "EN"
  },
  "chatbot_settings": {
    "bot_name": "Silk Bot",
    "system_prompt": "You are Silk Bot...",
    "languages": [...],
    "fallback_message": "...",
    "handoff_triggers": "speak to agent, human, real person",
    "handoff_message": "..."
  }
}
```

---

#### Action: `save_message`

Persists a chat message from the n8n workflow. Creates the session if it doesn't exist.

**Request:**

```json
{
  "action": "save_message",
  "tenant_id": "tenant_abc123",
  "session_id": "sess_xyz789",
  "phone": "+94771234567",
  "role": "user",
  "content": "What sizes do you have?",
  "language": "EN",
  "intent": "product_inquiry",
  "tokens_used": 42,
  "channel": "whatsapp"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `tenant_id` | Yes | Tenant identifier |
| `session_id` | Yes | Chat session identifier |
| `phone` | Yes | Customer phone number |
| `role` | Yes | `"user"` or `"assistant"` |
| `content` | Yes | Message text |
| `language` | No | Language code (EN, SI, TA, SL) |
| `intent` | No | Detected intent |
| `tokens_used` | No | Token count for the message |
| `channel` | No | Channel source (e.g. `"whatsapp"`) |

**Response (201):**

```json
{
  "message": {
    "id": "msg_...",
    "session_id": "sess_xyz789",
    "role": "user",
    "content": "What sizes do you have?",
    "language": "EN",
    "intent": "product_inquiry",
    "tokens_used": 42,
    "created_at": "2026-06-18T12:00:00.000Z"
  }
}
```

---

## n8n Setup

1. Add an **HTTP Request** node in your n8n workflow
2. Set **Method** to `POST`
3. Set **URL** to `https://your-domain.com/api/v1/n8n/webhook`
4. Add header `x-api-key` with your `FLOWBOT_API_KEY` value
5. Set body to JSON with the desired `action`

### Example n8n Flow

```
WhatsApp Trigger → HTTP Request (get_config) → AI Agent → HTTP Request (save_message)
```

---

## Supabase Setup

Run this SQL in your Supabase SQL Editor to add the chatbot settings column:

```sql
ALTER TABLE tenants ADD COLUMN chatbot_settings jsonb DEFAULT NULL;
```

---

## Changes Made

- **Settings Chatbot Tab**: All fields (bot name, system prompt, languages, fallback/handoff messages) are fully functional and save to the database via `chatbot_settings` JSONB column
- **Removed**: Response temperature slider and language model selector from the Chatbot settings UI
- **Added**: `ChatbotSettings` type in `types/index.ts`
- **Added**: `chatbot_settings` field to `Tenant` type and `TenantSettingsInput`
- **Created**: `GET /api/v1/chatbot-settings` endpoint
- **Created**: `POST /api/v1/n8n/webhook` unified endpoint with `ping`, `get_config`, and `save_message` actions
