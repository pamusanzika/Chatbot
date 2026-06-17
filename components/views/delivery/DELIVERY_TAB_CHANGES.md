# Delivery Fees Tab — Fixes & Changes

## Problem
The Delivery Fees tab was non-functional: `DELIVERY_ZONES` was a hardcoded empty
array, so the page always rendered "no zones", the calculator never matched
anything, and Add/Edit/Toggle/Delete had no handlers wired up.

## Changes

### `lib/db/delivery-zones.ts`
- Added `deleteZone(tenantId, id)` to remove a zone.
- `upsertDeliveryZone` now accepts an optional `id` so it can update an
  existing row (edit) or insert a new one (add).

### `app/(dashboard)/delivery/page.tsx`
- Now a server component that loads the tenant and fetches real zones via
  `getDeliveryZones(tenantId)`, passing them to `DeliveryTab` as
  `initialZones`.

### `app/(dashboard)/delivery/actions.ts` (new)
Server actions, each scoped to the current tenant and revalidating
`/delivery`:
- `saveZoneAction` — create or update a zone.
- `toggleZoneAction` — enable/disable a zone.
- `deleteZoneAction` — remove a zone.

### `components/views/delivery/delivery-tab.tsx`
- Removed the hardcoded empty `DELIVERY_ZONES` array; zones now come from
  `initialZones` (real data from Supabase).
- "Add zone" button opens a drawer form (province, district, cities, fee,
  estimated days, free-delivery threshold, active toggle) that saves via
  `saveZoneAction`.
- The pencil icon opens the same drawer pre-filled for editing an existing
  zone.
- Added a Trash icon button to delete a zone (with confirmation).
- The active/inactive `Toggle` is wired to `toggleZoneAction` with optimistic
  UI update.
- Removed the unused per-row checkbox that did nothing.
- Delivery calculator: starts empty (no default city), searches across all
  zone cities, and shows fee / ETA / free-delivery threshold for a match, or
  a "no zone found" / "start typing" message otherwise.
- After any save/toggle/delete, `router.refresh()` re-syncs with the server
  so data stays consistent with the database.

## Verified
- `tsc --noEmit` passes with no errors for the touched files.
