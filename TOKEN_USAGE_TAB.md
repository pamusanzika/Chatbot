# Token Usage Display — Dashboard + Backend

Summary of work done to add a tenant-scoped token usage view, aggregating the
existing `chat_messages.tokens_used` column written per-message by the n8n
workflow. No schema migration was required for the feature itself; one index
was added for query performance.

## Backend

**`lib/db/token-usage.ts`** (new) — aggregation functions, all scoped by
`tenant_id`, day/month buckets computed on UTC calendar boundaries (matching
the existing convention in `lib/db/analytics.ts`):

- `getUsageSummary(tenantId)` → `{ today, this_month, all_time, messages_today }`
- `getDailyUsage(tenantId, days)` → daily `{ date, tokens, messages }[]`, gaps filled with `0`
- `getMonthlyUsage(tenantId, months)` → same shape grouped by month

**Routes** (Clerk-session auth via `getTenant()`, tenant id never trusted from the client):

- `GET /api/usage/summary`
- `GET /api/usage/daily?days=30` (clamped 1–90)
- `GET /api/usage/monthly?months=12` (clamped 1–24)

**Migration** — `supabase/migrations/add_chat_messages_usage_index.sql`:
```sql
create index if not exists chat_messages_tenant_created_at on chat_messages(tenant_id, created_at);
```
This is the only Supabase change needed — run it once. Everything else
(`tokens_used`, `role`, `content`, `created_at`, `intent`) already existed on
`chat_messages` and is already populated by the n8n workflow.

## Dashboard

- **Sidebar**: new "Usage" nav entry (`BarChart3` icon) → `/usage`.
- **`app/(dashboard)/usage/page.tsx`** (new): server component, fetches
  summary + 30-day daily series via `getTenant()` + the lib functions above.
- **`components/views/usage/usage-tab.tsx`** (new): client component —
  4 summary cards (Today / This Month / All Time / Messages Today, `K`/`M`
  formatted via a new `fmtCompact` in `lib/constants.ts`), a daily bar chart
  (recharts) with a 7/30/90-day range switch and a tokens/messages metric
  toggle, gaps rendered as `0` bars. Labeled "Estimated token usage — not a
  billing invoice" per spec.
- **Chat Logs** (`components/views/chat-logs/chat-logs-tab.tsx`): each
  assistant message bubble now shows `· N tokens` when `tokens_used > 0`,
  giving the drill-down from a daily total to individual messages without a
  separate per-message table.

## Verification

Browser/curl verification of the page itself wasn't possible in this session
(Clerk middleware blocks unauthenticated access to all dashboard routes,
including the pre-existing ones — confirmed `/analytics` and `/chat-logs`
404 the same way un-authed). Instead verified directly against the live
Supabase DB with the service-role key:

- Confirmed `chat_messages` really has `role`, `content`, `tokens_used`,
  `created_at`, `intent` columns (the table's definition in `schema.sql` is
  stale/out of date relative to the live DB — pre-existing drift, not
  something this task touched).
- A tenant with zero messages returns clean zeros, no errors (empty state).
- Two different tenants returned different, isolated totals.
- Real message rows matched the acceptance-criteria pattern exactly: normal
  LLM replies carried 720/980 tokens; agent-handoff and order-status replies
  carried `0`; user messages carried `0`.
- Replicated the daily gap-fill logic against real rows — days with no
  activity render as `0`, not missing entries.
- `tsc --noEmit` clean.

**Not done**: an actual signed-in browser click-through of `/usage` — do that
once to confirm the cards/chart render as expected.

## Note

While starting the dev server to test, a `pkill -f "next dev"` cleanup step
was too broad and killed an unrelated dev server that was already running on
port 3000 before this session started. If that was yours, you'll need to
restart it.
