# FlowBot

A multi-tenant WhatsApp/web commerce assistant dashboard for small Sri Lankan retail
businesses (sarongs, apparel, etc.). Store owners manage products, orders, customers,
delivery zones, complaints and a chat-based knowledge base, while a chatbot (separate
service, not included in this repo) uses the same Supabase data to answer customer
questions and place orders.

This document focuses on the **Products module** (catalog, categories, variants, and
stock management), which has been fully wired to Supabase with real CRUD operations,
image uploads, and a stock-movement audit trail. The same patterns apply to the other
modules in `app/(dashboard)/*`.

---

## 1. Project Overview

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript, Tailwind-based custom
  CSS classes (`fb-*`).
- **Auth**: Clerk (organizations = tenants, users = staff members).
- **Database & Storage**: Supabase (Postgres + Row Level Security + Storage buckets).
- **Multi-tenancy**: every table has a `tenant_id`. RLS policies scope all reads/writes
  to the tenant the logged-in user belongs to. Server code uses the Supabase
  service-role client but always filters explicitly by `tenant_id` as a second layer
  of defense.

---

## 2. Features Implemented (Products module)

### Products tab
- List all products for the current tenant as cards with image, category, price, and
  aggregate stock badge (computed from variant stock).
- **Add product**: name, category, base price, description, and image upload.
- **Edit product**: opens the same drawer pre-filled with existing data and variants.
- **Delete product**: cascades to its variants (and stock movement history) via FK
  `on delete cascade`.
- Image upload goes directly to a Supabase Storage bucket (`product-images`), scoped
  by `tenant_id/` folder, returning a public URL stored in `products.image_urls`.

### Categories tab
- Categories are derived dynamically from the products table (plus a starter set of
  defaults), with a live count of products per category — no separate categories
  table needed.

### Stock Manager tab
- Lists every product variant across the tenant with SKU, price, current stock.
- **+ / −** steppers adjust stock immediately via a server action.
- Each adjustment is tagged with a **reason** (`Restock`, `Sale`, `Damaged`, `Return`,
  `Adjustment`) and written to a `stock_movements` audit table.
- Stock can never go negative (clamped server-side).

### Variants
- Each product can have N variants (size × colour combination), each with its own
  price, stock, low-stock threshold, and unique SKU.
- Variants can be added, edited, or removed inline from the product drawer.

---

## 3. System Architecture & Workflow

```
┌─────────────┐      Server Components       ┌──────────────────────┐
│  Browser     │ ───────────────────────────▶ │ Next.js App Router    │
│  (Dashboard) │ ◀─────────────────────────── │ app/(dashboard)/...   │
└─────────────┘      Server Actions ('use     └──────────┬───────────┘
                       server')                           │
                                                            │ getTenant()
                                                            ▼
                                                  ┌──────────────────────┐
                                                  │ lib/auth.ts (Clerk)  │
                                                  │ resolves tenant_id   │
                                                  └──────────┬───────────┘
                                                             │
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │ lib/db/products.ts   │
                                                  │ (service-role client)│
                                                  └──────────┬───────────┘
                                                             │
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │ Supabase Postgres    │
                                                  │ + Storage (images)   │
                                                  │ RLS-scoped by tenant │
                                                  └──────────────────────┘
```

**Request flow for the Products page:**

1. `app/(dashboard)/products/page.tsx` is a Server Component. It calls
   `getTenant()` (Clerk → Supabase lookup) to resolve the current `tenant_id`,
   then fetches `products` (with nested `variants`) and a flat `product_variants`
   list via `lib/db/products.ts`.
2. Data is passed as props to the client component `ProductsTab`.
3. User interactions (add/edit/delete product, save variant, adjust stock) call
   **Server Actions** defined in `app/(dashboard)/products/actions.ts`. Each
   action re-resolves `getTenant()` server-side (never trusts a client-supplied
   tenant id for writes) and calls the corresponding `lib/db/products.ts`
   function.
4. After a mutation, `revalidatePath('/products')` invalidates the cached page
   and `router.refresh()` re-fetches fresh server data into the client component.
5. Image uploads happen directly from the browser to Supabase Storage using the
   anon client (`lib/supabase-browser.ts`), under a path prefixed with the
   tenant's UUID, then the resulting public URL is saved with the product.

---

## 4. Database Structure & Supabase Setup

All schema + RLS lives in [`supabase/schema.sql`](supabase/schema.sql). Run the whole
file once in the Supabase SQL editor for a new project. Key tables relevant to this
module:

### `products`
| column      | type          | notes                              |
|-------------|---------------|------------------------------------|
| id          | uuid (PK)     | default `uuid_generate_v4()`       |
| tenant_id   | uuid (FK)     | → `tenants.id`, cascade delete      |
| name        | text          | required                           |
| category    | text          | free-form, drives Categories tab   |
| base_price  | numeric(10,2) | required                           |
| description | text          | optional                            |
| image_urls  | text[]        | public Supabase Storage URLs       |
| is_active   | boolean       | default `true`                     |
| created_at  | timestamptz   | default `now()`                    |

### `product_variants`
| column              | type          | notes                          |
|---------------------|---------------|---------------------------------|
| id                  | uuid (PK)     |                                  |
| tenant_id           | uuid (FK)     |                                  |
| product_id          | uuid (FK)     | → `products.id`, cascade delete |
| size                | text          |                                  |
| color_name / hex    | text          | swatch shown in UI               |
| price               | numeric(10,2) | per-variant price override       |
| stock               | int           | current quantity                 |
| low_stock_threshold | int           | default 5                        |
| sku                 | text          | unique per tenant                |

### `stock_movements` (new — audit trail)
| column     | type        | notes                                              |
|------------|-------------|----------------------------------------------------|
| id         | uuid (PK)   |                                                      |
| tenant_id  | uuid (FK)   |                                                      |
| variant_id | uuid (FK)   | → `product_variants.id`, cascade delete             |
| delta      | int         | positive (restock/return) or negative (sale/damage) |
| reason     | text        | one of `Restock, Sale, Damaged, Return, Adjustment` |
| created_at | timestamptz | default `now()`                                     |

Every stock adjustment from the Stock Manager writes one row here, giving a full
history of who changed what and why (extend with a `created_by` column if you want
per-user attribution).

### Storage bucket: `product-images`
- Public-read bucket for product photos.
- Upload path convention: `<tenant_id>/<timestamp>-<filename>`.
- See the commented-out SQL at the bottom of `schema.sql` for the bucket creation
  and RLS policies (read = public, write = must be inside your own tenant folder).

### Row Level Security
All tables use `for all using (tenant_id = (select t.id from tenants t join
tenant_users tu on tu.tenant_id = t.id where tu.clerk_user_id = auth.uid()::text
limit 1))`. Server actions use the **service-role key** (bypasses RLS) but always
add `.eq('tenant_id', tenantId)` explicitly — RLS is the defense-in-depth layer for
any future client-side Supabase queries.

---

## 5. Business Logic Explanation

- **Aggregate stock per product**: a product's "in stock / out of stock" badge is
  computed by summing `stock` across all its variants. Products with no variants
  fall back to a "No variants" badge instead of guessing from `base_price`.
- **Categories are not a separate table**: keeping categories as a free-text column
  on `products` avoids a join and lets shop owners add new categories simply by
  typing a new value when creating a product. The Categories tab derives the list
  + counts client-side from the already-fetched products array.
- **Stock can't go negative**: `adjustVariantStock` clamps `newStock = max(0, stock +
  delta)` server-side, so rapid clicking or concurrent sales can't produce negative
  inventory.
- **Stock movements as audit log, not source of truth**: `product_variants.stock` is
  the authoritative current value (read directly, no need to sum movements), while
  `stock_movements` is an append-only ledger for reporting/debugging — this keeps
  reads fast (`O(1)` per variant) while still preserving history.
- **Variant upsert**: a single `saveVariantAction` handles both create (no `id`) and
  update (`id` present), simplifying the drawer's save logic into one loop over all
  variant rows.
- **Image upload is client-direct**: images go straight from the browser to Supabase
  Storage (not proxied through the Next.js server), avoiding payload-size limits on
  server actions and keeping the dashboard responsive.

---

## 6. Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Create a Supabase project, then run the schema
#    (Supabase Dashboard → SQL Editor → paste & run supabase/schema.sql)

# 3. Create the storage bucket (Dashboard → Storage → New bucket)
#    name: product-images, Public bucket: ON
#    Then run the storage RLS policies commented at the bottom of schema.sql.

# 4. Set up Clerk
#    - Create a Clerk application with Organizations enabled
#    - Add the keys to .env.local (see below)

# 5. Configure environment variables (see below), then:
npm run dev
```

Open `http://localhost:3000`, sign in/sign up via Clerk, create or join an
organization (this becomes your tenant), and the Products page will be empty until
you add your first product.

---

## 7. Environment Variables

Create a `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never expose to client

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx
CLERK_SECRET_KEY=sk_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

> `SUPABASE_SERVICE_ROLE_KEY` must **never** be prefixed with `NEXT_PUBLIC_` — it is
> only read inside server actions / server components (`lib/supabase-server.ts`).

---

## 8. API Endpoints & Integrations

This module does not expose REST routes; instead it uses **Next.js Server Actions**
(co-located in `app/(dashboard)/products/actions.ts`), which are callable directly
from client components like RPC functions:

| Action                    | Purpose                                              |
|---------------------------|-------------------------------------------------------|
| `createProductAction`     | Insert a new product (+ optional initial variants)   |
| `updateProductAction`     | Patch a product's fields                              |
| `deleteProductAction`     | Delete a product (cascades to variants & movements)  |
| `saveVariantAction`       | Create or update a single variant                     |
| `deleteVariantAction`     | Remove a variant                                      |
| `adjustStockAction`       | +/- stock with a reason, logs a `stock_movements` row|

**Integrations:**
- **Clerk** — authentication & organization (tenant) management (`lib/auth.ts`).
- **Supabase Postgres** — all relational data (`lib/db/*.ts`).
- **Supabase Storage** — product images (`product-images` bucket).

---

## 9. Deployment

1. Push the repo to GitHub/GitLab.
2. Import the project into Vercel (or any Next.js-compatible host).
3. Add all environment variables from section 7 to the project settings.
4. Ensure the Supabase project has the schema + storage bucket + policies applied
   (run `supabase/schema.sql` once against production).
5. Deploy. Each Clerk organization that signs up gets its own `tenants` row on first
   login (`getOrCreateTenant()` in `lib/auth.ts`), so no manual tenant provisioning
   is required.

---

## 10. Assumptions & Limitations

- Categories are free-text; typos create new "categories" (no normalization/merge UI
  yet).
- Image uploads are not validated for size/type beyond the browser's `accept`
  attribute — add server-side checks or Supabase Storage policies for production
  hardening.
- No pagination on the products list — fine for small catalogs (tens to low hundreds
  of products); will need pagination/infinite scroll for larger catalogs.
- Stock adjustments are not attributed to a specific staff user (no `created_by` on
  `stock_movements`); add this column + populate from `getTenant().tenantUser` if
  per-user accountability is needed.
- No optimistic UI updates — every mutation triggers a `router.refresh()`, which is
  simple and correct but causes a brief loading flicker on slow connections.
- Deleting a product permanently removes its variants and stock history (cascade
  delete) — there is no "archive" / soft-delete option (the `is_active` flag exists
  on `products` but isn't yet exposed in the UI).

---

## 11. Future Improvements

- Add a dedicated `categories` table with ordering/icons, while keeping
  `products.category` as a foreign key for referential integrity.
- Soft-delete products via `is_active` instead of hard delete, and surface an
  "archived products" view.
- Add `created_by` / `updated_by` to `stock_movements` and `products` for full
  audit trails.
- Bulk import/export (CSV) for products and variants.
- Image management: reordering, deletion, and removing orphaned files from Storage
  when a product is deleted.
- Low-stock alerts/notifications based on `low_stock_threshold`.
- Pagination, search, and category filters on the Products tab for larger catalogs.
- Optimistic UI updates for stock adjustments to remove refresh flicker.
