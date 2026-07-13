# Complaints tab → live human-handoff support chat

## What this is

The Complaints tab (`/complaints`) was previously a UI stub — hardcoded empty
list, no API, no drawer logic. This work turns it into the real feature: when
a customer explicitly asks for a human (or the bot escalates a complaint),
n8n opens a ticket and pauses the bot for that customer; an agent handles it
from this tab as a live WhatsApp chat; resolving the ticket resumes the bot.

## Decisions made (and why)

- **Reused the existing `complaints` table/tab instead of a new `support_tickets`
  table/`/support` route.** The original ask assumed a `support_tickets` table
  that doesn't exist — `complaints` already covers the same concept (open
  stub, unwired). Extending it in place avoided two parallel, overlapping
  systems. Confirmed with the user before building.
- **Drawer on `/complaints`, not a dedicated `/complaints/[id]` page.** Matches
  how Chat Logs already does list+detail in this app.
- **API routes under `/api/complaints/...`, not `/api/dashboard/support/...`.**
  Matches the sibling `/api/chat-logs/...` convention already used for the
  other client-fetch, live-filtered tab.

## Schema gaps found (none of this existed before)

- No `support_tickets` table — closest match was the unwired `complaints` table.
- No persisted "who's driving this conversation" (bot vs human) state
  anywhere — `chat_sessions` had `intent = 'Handoff'` (just a classification)
  and `flagged`/`flag_note` (a manual review flag), but nothing that actually
  gates the bot.
- No ticket-creation path existed at all — the spec described "the n8n
  workflow escalates it" as current behavior, but there was no endpoint or
  Supabase write anywhere in the repo for it.
- `lib/db/complaints.ts` called a Postgres RPC (`append_complaint_note`) that
  was never defined anywhere — would have thrown at runtime the first time
  anyone added a note.

## Schema changes

New migration: **`supabase/migrations/add_support_tickets.sql`** — not yet
run against your Supabase project. Run it in the SQL editor. It:

- Adds `phone`, `reason`, `resolved_at` to `complaints`
- Adds `control` (`bot`|`human`), `handoff_reason`, `handoff_at` to `chat_sessions`
- Defines the missing `append_complaint_note()` function
- Adds two supporting indexes

Also depends on the `audit_logs` table from the earlier
`add_payment_verification.sql` migration (resolving a ticket writes an audit
row there). If that's already applied from the Payments feature, nothing
further is needed.

## Code changes

**Types** (`types/index.ts`)
- `Complaint`: added `phone`, `reason`, `resolved_at`; `customer_id` now nullable
- `ChatSession`: added `control`, `handoff_reason`, `handoff_at`
- Added `ConversationControl = 'bot' | 'human'`
- `ChatIntent` extended with `'agent_reply'` — how a bot message vs. an
  agent's message is told apart in the thread

**Data layer**
- `lib/db/complaints.ts` — added `getComplaintById`, `createComplaintTicket`,
  `resolveComplaintTicket` (flips control back to bot + writes an audit log),
  `claimComplaintTicket`; `getComplaints` now takes a status filter and
  orders oldest-first (queue semantics, was newest-first)
- `lib/db/chat-sessions.ts` — added `getControlByPhone`, `setControlByPhone`,
  `getMessagesByPhone`. Control is read/written across *all* of a phone's
  session rows, since a phone can span multiple `chat_sessions` rows over
  time and there's no dedicated "conversation" row to hang state off of.

**n8n integration**
- `lib/n8n-webhook.ts` — added `sendAgentReply()`, posts to
  `N8N_AGENT_REPLY_WEBHOOK_URL`. The dashboard never sends WhatsApp or saves
  the message itself — the workflow does both, this just triggers it.
- `app/api/v1/n8n/webhook/route.ts` — added a `create_ticket` action to the
  existing action-router (alongside `ping`/`get_config`/`save_message`).
  This is the missing piece that lets an escalation actually create a row —
  n8n needs to be pointed at it (see below).

**API routes** (new)
- `GET /api/complaints?status=open|resolved|all`
- `GET /api/complaints/[id]` → ticket + control state + full cross-session
  thread + up to 5 recent orders by phone
- `POST /api/complaints/[id]/reply` → proxies to n8n
- `POST /api/complaints/[id]/resolve` → resolves + flips control + audit log
- `POST /api/complaints/[id]/claim`

**UI**
- `components/views/complaints/complaints-tab.tsx` — full rewrite: Open /
  Resolved / All filter, oldest-first queue with relative "waiting" time,
  drawer with three-style bubbles (customer / bot / agent), a red "bot
  paused" banner while `control = human`, a composer (Enter to send,
  optimistic bubble reconciled against the next poll), resolve with confirm,
  4.5s polling while the drawer is open, recent-orders context peek.
- `components/layout/sidebar.tsx` — the Complaints nav badge was a hardcoded
  `3`; now polls `/api/complaints?status=open` every 15s for a live count.
- `app/globals.css` — added `.fb-bubble.agent`, `.fb-bubble.bot` (customer
  bubble reuses the existing style), `.fb-banner-paused`, `.fb-banner-resumed`.

**Env**
- `.env.local.example` — documented `N8N_AGENT_REPLY_WEBHOOK_URL` (new) and
  the pre-existing but previously-undocumented `FLOWBOT_API_KEY` /
  `N8N_ORDER_STATUS_WEBHOOK_URL`.

## What you still need to do

1. **Run the Supabase migration** (`supabase/migrations/add_support_tickets.sql`,
   or the consolidated SQL block from earlier in this chat).
2. **Set `N8N_AGENT_REPLY_WEBHOOK_URL`** in your env, pointing at the n8n
   workflow that sends the agent's WhatsApp reply and saves it.
3. **Wire the n8n escalation step** to call the new `create_ticket` action:
   ```
   POST /api/v1/n8n/webhook
   headers: x-api-key: <FLOWBOT_API_KEY>
   body: { "action": "create_ticket", "tenant_id": "...", "phone": "...", "summary": "...", "customer_name": "...", "reason": "complaint" }
   ```
4. **Tag agent-reply saves with `intent: 'agent_reply'`** in the n8n
   agent-reply workflow's `save_message` call — that's how the UI tells a
   bot bubble apart from an agent bubble.

## Verified vs. not verified

- `tsc --noEmit` and `next build` both pass clean.
- Did **not** click through the live UI — this app's Clerk auth is real and
  I have no test credentials, so an authenticated browser smoke-test wasn't
  possible. Confirmed via `curl` that the new routes 404 identically to
  pre-existing, untouched pages under an unauthenticated request (expected
  Clerk handshake behavior, not a regression). Recommend clicking through
  the actual flow once a real ticket exists, before calling this done.
