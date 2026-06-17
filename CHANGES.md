# Products Module — Implementation Notes

This document summarizes everything implemented to turn the static Products UI into a
fully working, Supabase-backed feature: catalog CRUD, category management, and stock
management. It complements [`README.md`](README.md), which covers overall setup.

---

## 1. What was built

### A. Products (catalog CRUD)
- Real list of products fetched server-side from Supabase, scoped to the logged-in
  tenant.
- **Add product**: name, category (from a dynamic list), base price, description,
  and image upload (direct-to-Supabase-Storage).
- **Edit product**: same drawer, pre-filled, including its variants.
- **Delete product**: removes the product and (via `on delete cascade`) its variants
  and stock-movement history.
- Aggregate stock badge per product, computed by summing variant stock.

### B. Categories (new — full CRUD)
- New `categories` table (`id, tenant_id, name, color, created_at`, unique per
  tenant+name).
- **Create category**: name + colour picker, via `createCategoryAction` →
  `lib/db/categories.ts#createCategory`.
- **Delete category**: via `deleteCategoryAction`, blocked client-side if any product
  is still assigned to that category (prevents orphaned products).
- The Categories tab shows every category (both ones explicitly created and any
  legacy/default ones still referenced by products) with live product counts.
- The product form's "Category" dropdown is populated from this same merged list, so
  newly created categories are immediately selectable when adding/editing a product.

### C. Stock Manager (full working flow)
- Lists every variant across the tenant (SKU, price, current stock).
- `+` / `-` steppers call `adjustStockAction(variantId, delta, reason)`.
- Reason dropdown per row: `Restock | Sale | Damaged | Return | Adjustment`.
- Server-side logic (`lib/db/products.ts#adjustVariantStock`):
  1. Reads current `stock`.
  2. Computes `newStock = max(0, stock + delta)` — stock can never go negative.
  3. Updates `product_variants.stock`.
  4. Inserts an audit row into `stock_movements` (`variant_id, delta, reason,
     created_at`).
- This gives a permanent, queryable history of every stock change and why it
  happened, while `product_variants.stock` remains the fast-to-read current value.

---

## 2. New / changed files

| File | Change |
|------|--------|
| `supabase/schema.sql` | Added `categories` table + RLS, `stock_movements` table + RLS, `tenant_insert` policy on `tenants`, storage bucket policy notes. |
| `types/index.ts` | Added `Category` and `StockReason` types. |
| `lib/db/categories.ts` | **New.** `getCategories`, `createCategory`, `deleteCategory`. |
| `lib/db/products.ts` | Added `createProduct`, `updateProduct`, `deleteProduct`, `upsertVariant`, `deleteVariant`, `adjustVariantStock` (with audit logging). |
| `app/(dashboard)/products/actions.ts` | **New.** Server actions for products, variants, stock adjustments, and categories — each re-resolves the tenant via `getTenant()`. |
| `app/(dashboard)/products/page.tsx` | Now a server component: fetches tenant, products+variants, categories, and passes them to `ProductsTab`. |
| `app/(dashboard)/layout.tsx` | Now calls `getOrCreateTenant()` so a `tenants`/`tenant_users` row is created on first sign-in (fixes "Tenant not found"). |
| `components/views/products/products-tab.tsx` | Rewritten as a full CRUD client component (products, categories, stock manager). |
| `lib/auth.ts` | Surfaced the underlying Supabase error message in `getOrCreateTenant` for easier debugging. |

---

## 3. End-to-end flow recap

1. **`app/(dashboard)/layout.tsx`** runs `getOrCreateTenant()` on every dashboard
   request — ensures the Clerk org has a matching `tenants` row and the Clerk user
   has a `tenant_users` row.
2. **`app/(dashboard)/products/page.tsx`** (server component) resolves `tenantId`
   via `getTenant()`, then fetches:
   - `getProducts(tenantId)` — products with nested variants
   - `getProductVariants(tenantId)` — flat variant list for Stock Manager
   - `getCategories(tenantId)` — explicit categories
3. **`ProductsTab`** (client component) renders three sub-views (Products,
   Categories, Stock Manager) from this data.
4. Every mutation (add/edit/delete product, save/delete variant, adjust stock,
   create/delete category) is a **Server Action** in
   `app/(dashboard)/products/actions.ts`. Each action:
   - Re-derives `tenantId` server-side via `getTenant()` (never trusts the client).
   - Calls the corresponding `lib/db/*.ts` function, which always filters by
     `tenant_id`.
   - Calls `revalidatePath('/products')`.
5. The client then calls `router.refresh()` to pull the updated server data.

---

## 4. Key decisions & rationale

- **Categories as their own table, but additive**: rather than forcing a migration
  of existing free-text categories, the UI merges three sources — default starter
  categories, rows from the new `categories` table, and any category strings already
  used by products — into one deduplicated list. This means the feature works
  immediately on existing data without a backfill step, while still enabling proper
  category management going forward.
- **Category delete guard**: deleting a category that still has products assigned is
  blocked client-side (with a clear message) rather than silently leaving products
  with a "dangling" category string, since `products.category` is a plain text
  column with no FK to `categories`.
- **Stock audit trail is append-only and separate from current stock**: `stock`
  on `product_variants` is the source of truth for "how many do we have right now"
  (O(1) read); `stock_movements` is purely a log for reporting/debugging and never
  read on the hot path.
- **Stock floor at zero**: prevents a burst of "+/-" clicks or concurrent sales from
  driving inventory negative, which would corrupt downstream availability checks
  (e.g., a chatbot checking stock before confirming an order).
- **Server Actions over REST routes**: keeps mutation logic colocated with the page,
  avoids hand-rolling request validation/serialization, and gets automatic
  revalidation via `revalidatePath`.

---

## 5. Manual setup still required

1. Apply the updated `supabase/schema.sql` (or just the new `categories` /
   `stock_movements` / `tenant_insert` portions if your DB already has the rest).
2. Create the `product-images` storage bucket (public) and apply its policies — see
   the bottom of `schema.sql`.
3. Ensure `.env.local` has matching Supabase keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   (all from the **same** Supabase project/key generation).

---

## 6. Known limitations

- `products.category` is still a plain text column (not a FK to `categories.id`), so
  renaming a category in the `categories` table won't retroactively update products
  that reference the old name by string.
- No bulk re-assignment UI when deleting/renaming a category — the delete guard is
  the only safeguard against orphaned references.
- Stock movements aren't yet surfaced in the UI (no "history" view) — the data is
  captured but not displayed.
