# Peach Craft — System Memory (AI Reference)

Dense, traceable reference for the Peach Craft storefront + admin (React 19 /
TanStack Start / Supabase / Cloudflare R2 / Vercel). Written for AI agents to
reconstruct working context fast. Every claim maps to a file:line; `[verify]`
marks something not confirmed in the last inspection pass. **Update this file
after every working session** — it is the authoritative session state.

---

## 1. Overview & Tech Stack

- **App**: Peach Craft — kawaii clay/craft e-commerce storefront + admin panel.
- **Framework**: TanStack Start v1.167.50 (file-based routing, SSR) + React 19.2 + Vite 7.3.
- **Build wiring**: `@lovable.dev/vite-tanstack-config` v2.3.1 wraps TanStack/Vite/Tailwind/nitro. `vite.config.ts` only sets `nitro: { preset: "vercel" }`, `tanstackStart.server.entry: "server"`, port 3000. **Do NOT add TanStack/React/Tailwind plugins manually** — the wrapper already does (`vite.config.ts:1-6`).
- **Data access**: no ORM — direct `@supabase/supabase-js` v2.107.0 queries from server functions. Sessions via `@supabase/ssr` v0.10.3.
- **All runtime deps** (`package.json`): `@hookform/resolvers`, radix-ui primitives (full set), `@supabase/ssr`, `@supabase/supabase-js`, `@tailwindcss/vite`, `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-plugin`, `browser-image-compression`, `class-variance-authority`, `clsx`, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `lucide-react`, `react`, `react-dom`, `react-hook-form`, `react-resizable-panels`, `recharts`, `sonner`, `tailwind-merge`, `tailwindcss`, `tw-animate-css`, `vaul`, `vite-tsconfig-paths`, `zod`.
- **Dev deps**: `@lovable.dev/vite-tanstack-config`, `nitro` (3.0.260429-beta), `vite` 7.3.1, `typescript` 5.8.3, `eslint` 9.x, `prettier`, `@vitejs/plugin-react`.
- **Scripts**: `dev` = `vite dev` (port 3000 **strict**), `build` = `vite build` (nitro `vercel` preset → `.vercel/output`), `build:dev` = dev-mode build, `preview`, `lint` = `eslint .`, `format` = `prettier --write .`.
- **Backend services** (reachable, verified live):
  - Supabase Postgres + Auth (GoTrue) + Storage.
  - Cloudflare R2 (object storage via REST API; verified 200 on PUT).
  - Cloudflare Turnstile (CAPTCHA: signup + checkout + login).
  - Resend (email) — key optional; app-side usage site `[verify]`.
  - Host: Vercel (nitro preset).
- **Currency**: PHP base; `src/lib/currency.ts` — 10 currencies, hardcoded static `CONVERSION_RATES`, `formatBasePrice` → `₱… PHP`; JPY/KRW round to 0 decimals.

---

## 2. Architecture, Routing & Build

### SSR entry & response handling
- `src/server.ts` (wired via `tanstackStart.server.entry`):
  - `normalizeCatastrophicSsrResponse` (`:23-38`) — h3 swallows in-handler throws into `{"unhandled":true,"message":"HTTPError"}` JSON 500s; this fn detects that shape and replaces with `renderErrorPage()` from `src/lib/error-page.ts` (no stack leaks).
  - `fetch()` intercepts `/api/images/*` (R2 image proxy, §7) then delegates to `@tanstack/react-start/server-entry`.
  - Security headers on every response (`:40-76`): CSP, HSTS, nosniff, `X-Frame-Options: DENY`, `Referrer-Policy`.
- **Routing rules** (`src/routes/README.md`): every `.tsx` under `src/routes/` is a route. Never create `src/pages/` or `app/layout.tsx`. `routeTree.gen.ts` is auto-generated — never edit.

### Full route map (from `src/routes/`)
- **Shell**: `__root.tsx` (app shell, keeps `<Outlet />`, `ErrorComponent` logs `console.error`).
- **Storefront public**:
  - `index.tsx` — home (hero gradient preserved; **section backgrounds are white** per latest design).
  - `shop.tsx` — shop layout shell; `shop/index.tsx` — grid + **availability filter + sort** (see §8 for the sort bug); `shop/$category.tsx`; `shop/$id.tsx` — product detail (Add to cart / **Buy it now**, see §9 M6).
  - `search.tsx` — live search via `searchProducts`.
  - `cart.tsx`, `checkout.tsx` (3-step state machine, §8), `order-confirmation.tsx`.
  - `login.tsx`, `signup.tsx`, `verify-email.tsx`, `profile.tsx`, `orders.tsx` (**guest email lookup, no login required — §8**), `account/*`.
  - `about.tsx`, `contact.tsx` (**form is decorative — §9 M3**), `shipping-policy.tsx`.
  - `$.tsx` — 404.
- **Admin** (guarded by `src/lib/adminMiddleware.ts` + server `verifyAdmin()`):
  - `admin.tsx` — layout; `admin/index.tsx` — dashboard (crashes — §9 #1); `admin/analytics.tsx`.
  - `admin/products/index.tsx`, `admin/products/new.tsx`, `admin/products/$id.tsx` (+ `src/components/admin/products/`).
  - `admin/orders/index.tsx`, `admin/orders/$id.tsx`, `admin/orders/tracking.tsx`, `admin/orders/returns.tsx`.
  - `admin/payments/index.tsx` (list + approve/reject; **XSS render site — §9 #3**).
  - `admin/customers/index.tsx`, `admin/website-settings.tsx` (store details + **GCash fields**).
- **Query/client plumbing**: React Query v5 for admin/storefront data. Client Supabase singleton on `window.__peachcraft_supabase` (`src/lib/supabase.ts`). React Query provider file `[verify]`.

### Build & deploy facts
- `vite build` succeeds locally (nitro vercel preset), emitting `.vercel/output/`.
- **`.vercel/output/**` IS TRACKED IN GIT.** Before committing source, discard build changes: `git checkout -- .vercel/output`.
- `npx tsc --noEmit` is the typecheck gate (currently clean at HEAD `9fb0966`).
- **Vercel 500 is OPEN** (§9 #2): deployed `_ssr/index.mjs` imports `/var/task/_ssr/server-CUcuYyFi.mjs` which never exists; local build produces a different valid hash. Not a stale-cache issue (same hash across redeploys).
- SSR smoke test 2026-08-20: all public routes 200; `/admin*` 307 (redirect to login) without admin session — correct.

---

## 3. Data Model (Supabase)

### Base tables (created in dashboard; docs in `Fully-Detailed-Schema.md` + `supabase-current-schema.md`)
- `products` — `id uuid pk, name, price numeric, description text, images jsonb[], tag, swatch, category, stock_qty int, is_active bool, created_at, brand`.
- `orders` — `id uuid pk, user_id uuid (NULLABLE — live data has NULLs), total_amount numeric, status (pending|confirmed|shipped|delivered|cancelled), shipping_address jsonb, payment_method (cash_on_delivery|gcash|null), payment_status (pending|paid|awaiting_verification|failed|null), created_at`.
- `order_items` — `order_id → orders (cascade), product_id → products, qty, price_at_purchase`.
- `gcash_payments` — `id, order_id → orders, gcash_reference_number (UNIQUE), screenshot_url, customer_email, status (pending|verified|rejected), submitted_at, verified_at`.
- `users` (auth), `profiles` — `id → auth.users (FK fk_profiles_auth_user — CANNOT insert fake ids), email, username, address, email_verified bool, created_at`.

### Migration-created tables (`sql/migrations/001-006`)
- `001`: `signup_attempts` (IP rate limit 5/hr), `carts` (`user_id` NOT NULL unique, `items jsonb`).
- `002`: `cart_items` (`user_id, product_id, qty`, unique per user+product).
- `003`: `cart_add_attempts` (rate limit).
- `004`: RLS on carts + `gcash_payments` support (order `payment_method`/`payment_status`).
- `005`: `login_attempts` (**columns: `ip` + nullable `user_id` + `created_at` — NO `email` column**), `order_attempts` (`ip`, `user_id`).
- `006` (`006_add_gcash_settings.sql`, NEW, **COMMITTED BUT NOT APPLIED to Supabase**): adds `gcash_number`, `gcash_account_name`, `gcash_qr` to `website_settings`. Until applied, admin GCash settings save fails with column-not-found.

### Constraints & gotchas
- `gcash_reference_number` UNIQUE (app catches PG `23505`).
- RLS: enabled on `carts` (insert/select where `user_id = auth.uid()`); server fns use service-role client (`getSupabaseServer()`) so RLS is bypassed server-side.
- **Live data reality (2026-08-20): 6 of 7 `orders` have `user_id = NULL`** — manually inserted test data, NOT created through the app. App-created orders always set `user_id`. Effects:
  - `submitGCashProof` / `getCustomerOrderById` reject these (ownership `null !== userId`) — correct behavior, not a bug.
  - Admin `getOrderDetails` must tolerate null `user_id` (fixed — §5).
- `profiles.id` has `FK → auth.users`, so E2E tests must use a **real** auth user (e.g. `testing@gmail.com` = `f6341218-3d1d-404c-b8e9-ae3f399641b6`, verified, 0 active orders).
- `website_settings` singleton row: `id = 'singleton'`, currently has `store_name` etc. — no gcash columns until 006 applied.

---

## 4. Authentication & Admin Authorization

### Clients
- **Client**: `getSupabaseClient()` (`src/lib/supabase.ts`) — browser singleton on `window.__peachcraft_supabase`; `clearAuthCookies()` on sign-out.
- **Server**: `getSupabaseServer(accessToken?, { authOnly })` — `authOnly: true` creates a client that CANNOT persist cookies; used for token-verified calls. Plain `getSupabaseServer()` = service-role client (bypasses RLS).
- **Session context**: `src/lib/auth-context.tsx` `AuthProvider`:
  - `withTimeout(promise, ms, msg)` helper (`:19`).
  - Session resolution 5s timeout; `validSession` 24h expiry buffer.
  - Invalid/expired tokens = graceful state (never logout loop, never crash).

### Admin authorization (the authoritative gate)
- **Server-side `verifyAdmin()`** in `src/lib/api/admin-auth.ts`:
  - With `accessToken`: `authClient.auth.getUser(token)` then **email must equal `process.env.ADMIN_EMAIL`**.
  - Without token (all GET admin fns): reads the session from request cookies via AsyncLocalStorage → `createServerClient` with `getAll()` → `supabase.auth.getUser()`. **This cookie path is COMMITTED** (was the fix; `login.tsx` sets the `sb-admin-token` cookie).
  - Client-side admin checks (email === `VITE_ADMIN_EMAIL`) are **cosmetic only**.
- **Route guard**: `src/lib/adminMiddleware.ts` — server middleware on admin routes.
- **Admin credentials**: email `admin@peachcraft.com`. **Password is a Supabase Auth credential — never stored in repo; reset via Supabase Auth → Users.**
- **Login**: `login.tsx` — Turnstile + `verifyLoginAttempt` (5/hr per IP via `login_attempts`) + `recordLoginFailure` (inserts `{ ip }` only) + `sanitizeRedirect` (**same-origin relative paths only; rejects full URLs and `//`**).
- **Signup**: `signUpWithProfile` (`supabase.functions.ts:1625+`) — Turnstile (if token), IP rate limit `signup_attempts` 5/hr, zod: email, password ≥8, username 2-50, address 5-200.

---

## 5. Server Functions Catalog (`src/lib/api/`)

Convention: `createServerFn({ method })` with `.inputValidator(z.object(...))` (server-boundary validation). Call sites pass `{ data: {...} }`. **No payload/validator mismatches found** in the 2026-08-20 audit.

### `supabase.functions.ts` (~2337 lines)
| Function | Line | Method | Key behavior |
|---|---|---|---|
| `getFeaturedProducts` | 122 | GET | active products tagged featured |
| `getAllProducts` | 138 | GET | active products, ordered |
| `getAdminDashboardData` | 153 | GET | (uncalled — dead) |
| `getAdminNotifications` | 264 | GET | low-stock + pending-payment counts |
| `getUserActiveOrderStatus` | 338 | POST | any order in pending/confirmed/shipped for user |
| `createOrder` | 384 | POST | see §6; **trusts client amounts — §9 #4**; **IP order rate limit REMOVED (no `order_attempts` insert/check)** |
| `uploadPaymentProof` | 609 | POST | magic bytes + ≤10MB → R2 (payment-proofs/) |
| `checkDuplicateReference` | 686 | GET | gcash ref already used (not rejected) |
| `submitGCashProof` | 701 | POST | dup check, ownership, method/status; insert payment + flip order |
| `verifyGCashPayment` | 784 | POST | admin; approve/reject; idempotent on `pending` guard |
| `getAdminPayments` | 840 | GET | payments + inner join orders |
| `getAdminPaymentsPendingOrders` | 880 | GET | gcash + pending |
| `getAdminPaymentSummary` | 896 | GET | 4 counts |
| `getAdminPayment` | 930 | GET | single payment + order |
| `getAdminProducts` | 956 | GET | **selects fewer fields than type → thumbnails/tag-search broken (§9 L7)** |
| `toggleProductActive` | 971 | POST | admin |
| `deleteProduct` | 989 | POST | deletes images from R2/Supabase storage then row |
| `getProductById` | 1100 | POST | full product row |
| `createProduct` | 1117 | POST | admin insert |
| `updateProduct` | 1159 | POST | admin update |
| `getOrdersList` | 1203 | GET | admin; user_email = profile email, **falls back to `shipping_address.email` for guests** ("Unknown" only if neither exists) |
| `getOrderDetails` | 1236 | GET | admin; **FIXED: `let user=null; if(order.user_id){…maybeSingle()}` — no throw on null/missing profile**; **customer.name/email fall back to `shipping_address` for guest orders** |
| `updateOrderStatus` | 1319 | POST | admin; **restores stock when status → cancelled** |
| `getAnalyticsData` | 1377 | GET | 30-day revenue series, status counts, top products, growth |
| `uploadProductImage` | 1550 | POST | magic bytes → R2 (public/) |
| `signUpWithProfile` | 1625 | POST | Turnstile + rate limit + insert profile |
| `validateCartItems` | 1788 | POST | returns available/unavailable lists |
| `saveCartForUser` | 1829 | POST | upsert `carts` on `user_id` |
| `getCartForUser` | 1869 | POST | read cart items |
| `getMyOrders` | 1876 | POST | user orders (short) |
| `getCustomerOrders` | 1913 | POST | user orders + items + product names/images |
| `getCustomerOrderById` | 1963 | POST | ownership-guarded order fetch (resume) |
| `getGuestOrders` | 2012 | POST | **guest list by shipping_address.email (user_id IS NULL, case-insensitive, ≤50) + items** |
| `getGuestOrder` | 2061 | POST | **guest single by orderId + email match + items (checkout resume)** |
| `cancelCustomerOrder` | 2116 | POST | ownership; **restores stock**; status → cancelled |
| `cancelGuestOrder` | 2181 | POST | **guest cancel: user_id IS NULL + email match; restores stock; status → cancelled** |
| `verifyEmail` | 2234 | POST | token/email verification |
| `checkEmailVerification` | 2144 | POST | |
| `updateProfile` | 2162 | POST | username 2-50, address 5-200 |
| `changePassword` | 2217 | POST | |
| `checkIsAdmin` | 2278 | POST | |
| `verifyLoginAttempt` | 2289 | POST | 5/hr per IP |
| `recordLoginFailure` | 2324 | POST | insert `{ ip }` |

### Other modules
- `storeDetails.functions.ts` — `uploadStoreImage` (`:23`), `getStoreDetails` (`:74`), `updateStoreDetails` (`:86`, upsert on `id`; **now includes `gcash_number`, `gcash_account_name`, `gcash_qr`**).
- `search.functions.ts` — `searchProducts` (`:245`), `getAutocompleteSuggestions` (`:262`): fully in-memory search; tokenize + Levenshtein + weighted (name 10, category 6, brand 6, tag 4, description 2) + log-scaled popularity; virtual brands via `getVirtualBrand()`.
- `customers.functions.ts` — `getCustomers` (`:17`): profiles + per-user order aggregation (count/total/last date).
- `dashboard.functions.ts` — `getDashboardData` (`:44`): counts + **`revenueByMonth` (12 buckets)** + categories + top products + recent activity (the dashboard crash source, §9 #1).

---

## 6. Payments — GCash Flow

- **Admin-managed config**: `DEFAULT_GCASH_CONFIG` (`checkout.tsx:17-21`: number `0917 123 4567`, name `Peach Craft PH`, placeholder QR) → replaced by `gcashConfig` state loaded from `getStoreDetails()` on mount, per-field fallback to defaults (`checkout.tsx:110-126`). After migration 006, admin edits number/name/QR via `admin/website-settings.tsx`.
- **Order ID for the customer**: `PTT-yyyymmdd-XXX` (`generateOrderId`, `supabase.functions.ts:583-588`; client uses `generateDisplayOrderId`).
- **Flow**:
  1. `createOrder` → `orders(status: pending, payment_status: pending)` for gcash; `paid` for COD. **Deducts stock atomically** (per-item `.gte("stock_qty", qty)` conditional update), rolls back all prior deductions on any failure via `restoreStock`.
  2. Customer submits proof → `submitGCashProof`: dup-check ref (app + `23505`), ownership (`order.user_id === userId`), `payment_method === "gcash"`, `payment_status === "pending"`. Inserts `gcash_payments(pending)` + order → `awaiting_verification`.
  3. Admin `verifyGCashPayment`: **approve** → payment `verified` + order `paid`/`confirmed`; **reject** → payment `rejected` + order `payment_status: failed`. Idempotent via `payment.status !== "pending"` guard.
- **Client submit** (`checkout.tsx` `handleSubmitProof` ~`:322`): validates ref non-empty, screenshot file present, email non-empty **AND format `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`** → `uploadPaymentProof` → `submitGCashProof`. Button (`:796-807`) is `bg-wine`, label flips to "Submitting..." while `submitProofMutation || uploadMutation` is pending.
- **E2E status (2026-08-20)**: 53/53 DB procedure checks pass across the whole app; **user successfully submitted 2 real proofs** (`1e9f45eb`, `660c1c42`, pending) — submit-button fix confirmed.
- **Idempotency**: verify double-action blocked; proof dup blocked by unique ref.

---

## 7. Image Handling & R2 Storage

- **Upload**: client sends `{ fileName, base64, accessToken }`; server:
  - Decodes MIME from data URI; whitelist PNG/JPEG/GIF/WebP.
  - **Magic-byte validation** `validateMagicBytes` (`:590-607`) — never trusts client MIME/extension.
  - Payment proofs capped at **10 MB** server-side (`:647`).
  - Primary store: **Cloudflare R2 REST** `PUT …/accounts/{id}/r2/buckets/{bucket}/objects/{key}` with Bearer `CLOUDFLARE_R2_API_TOKEN`; `encodeR2ObjectKey` percent-encodes path segments. Keys: products → `public/`, proofs → `payment-proofs/`.
  - Fallback: Supabase Storage buckets `product-images` / `payment-proofs`.
- **Serving**: app always returns the **proxy** `/api/images/{encodedPath}` (never a direct R2 URL). `src/server.ts:84-128` proxies GET; sets `Content-Type` from R2, `Cache-Control: public, max-age=31536000`, `Access-Control-Allow-Origin: *`.
- **Verified live 2026-08-20**: R2 PUT returns 200 (~900ms).

---

## 8. Frontend Patterns, Checkout & Shop

### Design system (`src/styles.css`)
- oklch tokens; `@theme inline` semantic mapping; shadcn/ui tokens.
- Custom tokens: `blush`, `cream`, `sage`, `sage-deep`, `brown`, **`wine`**.
- **`wine` was dropped in the redesign → ALL `bg-wine`/`text-wine`/`border-wine/*` elements were invisible (white-on-white)**. **FIXED (committed)**: `--wine` light `oklch(0.45 0.14 20)`, dark `oklch(0.7 0.14 20)` + `--color-wine: var(--wine)` (`styles.css`). Verified `bg-wine` emits in built CSS. Also fixed PhotoSlot `var(--wine)`.
- `--primary` is **green** (`oklch(0.58 0.08 150)`) — admin "Approve" green button, storefront "Continue…" buttons.
- Dark mode via `.dark` class; `@custom-variant dark`.

### Checkout state machine (`checkout.tsx`)
- Steps `1|2|3` (`Shipping` → `Payment` → `Confirm`), indicator at `:502-517`.
- Step 1: shipping form (name/email/street/city/province/zip) + `formErrors` rendered here; "Continue to Payment" → `setStep(2)` (no validation).
- Step 2: payment method (only **GCash** selectable today; COD latent — §9 L5); "Continue to Review" → **`validateCheckout()` ONLY (zod + `validateCartItems`) — NO order creation** (`:795-816`, `step2Checking` pending state). **`formErrors` are NOT rendered in step 2 — §9 M1.**
- Step 3: GCash panel (QR/number/name/amount from `gcashConfig`; Order ID block only shown when `displayOrderId` exists, else "Generated when you submit your proof below") + proof form + Back / **Submit Payment Proof = the explicit confirm action** (`handleSubmitProof`: proof-field checks → dup-ref check → `validateCheckout()` → `placeOrder()` (creates order, reuses existing `orderId` on retry so partial failure never double-orders) → upload screenshot → `submitGCashProof`). COD step 3 = review summary + "Confirm Order" button (`handleConfirmCodOrder`). Success → `setStep(4)` success screen.
- **Deferred creation (2026-08-21)**: orders are created ONLY on the step-3 confirm click — never during navigation. A reload at any step leaves NO order behind.
- **Reload recovery**: draft (`step`, all shipping fields, `paymentMethod`, `displayOrderId`) persisted to `sessionStorage` key `peachcraft-checkout-draft` (`loadCheckoutDraft`/`saveCheckoutDraft`/`clearCheckoutDraft`); restored on mount (skipped when `?orderId=` resume flow active; step 4 restored only with a real `displayOrderId`); kept in sync via effect on every change; cleared by the two step-4 leave buttons. Profile prefill uses functional updates so it never clobbers restored/typed values.
- Resume: `/checkout?orderId=` → `getCustomerOrderById`; if gcash+pending → sets paymentMethod/orderId/displayOrderId/step 3. **Displayed amount is live-cart `totalAmount` — §9 H1.**
- Guard: **NONE** — guest checkout is fully supported. Unauthenticated visitors see the shipping form directly. Optional "Have an account? Log in" banner shown (user-initiated only, never forced). Previous auto-redirect to `/login` after 3s was removed. Cart page (`cart.tsx`) also allows unauthenticated checkout. Turnstile required for guest orders. `orders.user_id` is NULL for guest orders. Server-side: `createOrder` accepts optional `accessToken`; `submitGCashProof` verifies guest ownership via `shipping_address.email`. **IP order rate limit (`order_attempts`) REMOVED (2026-08-20) — no limit on orders per IP; the one-active-order guard still applies to authenticated users.**
- **Guest orders (2026-08-20)**: `/orders` no longer redirects logged-out visitors to `/login` — it shows a "Find your orders" email form → `getGuestOrders`. Guests get full parity: list w/ items, tabs, cancel (`cancelGuestOrder`), and checkout resume (`/checkout?orderId=` prompts for email → `getGuestOrder`). Ownership = `shipping_address.email` match (weak proof — §9 #22). Cart stays localStorage-only (same device).
- **Server total includes shipping (2026-08-21)**: `createOrder` recomputes `total_amount = Σ(price×qty) + SHIPPING_FEE(150) + TAX_AMOUNT(0)` — constants mirror `checkout.tsx` (`shippingFee=150`, `taxAmount=0`). If checkout ever shows different fees, BOTH sides must be updated together.

### Shop filters (`shop/index.tsx`)
- Availability: all / in-stock / out-of-stock (`:48-52`).
- Sort options `:54-64` — **4 of 9 are dead/mislabeled (all `newest-first`): Featured, Most relevant, Best selling, Date new→old; "Date, old to new" is real. — §9 M5.**

### Patterns
- `cn()` = `twMerge(clsx(...))` (`src/lib/utils.ts`).
- Forms: react-hook-form + zod resolvers (login/signup/profile/admin product form); raw `useState` forms in checkout.
- Toasts: **sonner**; Charts: **recharts**.
- Cart: `src/lib/cart.ts` hook — localStorage key `peachcraft-cart`, cross-tab event `peachcraft-cart-updated`, server sync via `saveCartForUser`/`getCartForUser`; `addToCart` throws on over-stock / >25 units.
- Every mutation invalidates the exact query keys it feeds (verified for checkout/profile/orders/login/signup/admin save flows).
- `useCurrency()` → `formatPrice`.

---

## 9. Security, Error Handling & Known Issues

### Security posture (implemented)
- Server-side zod on every server fn; client validation is UX only.
- Uploads: magic bytes + server size cap, rejected before any external I/O.
- Redirects: same-origin relative only.
- Rate limits: `signup_attempts` 5/hr, `login_attempts` 5/hr, `cart_add_attempts`. **`order_attempts` IP limit REMOVED from createOrder (2026-08-20); table/`order_attempts` migration remains unused.**
- Turnstile on signup + checkout (token provided) + login.
- CSP + security headers at `src/server.ts`; error page never leaks stacks.
- Never log tokens/sessions to console; admin identifiers never in `VITE_*`.

### Known issues — status 2026-08-20 (report as facts)
1. **Admin dashboard crash (OPEN)** — `admin/index.tsx:138` `data!.revenueByMonth` throws when `data` is `undefined` with `isLoading=false, error=null`. Same `data!` at ~143,162,221,230,239,266,270,307. Root cause unconfirmed; underlying DB queries verified working.
2. **Vercel 500 (OPEN)** — `_ssr/index.mjs` imports `/var/task/_ssr/server-CUcuYyFi.mjs` (never built; `ERR_MODULE_NOT_FOUND`); identical hash across redeploys → not stale cache. Local build emits different valid hash. Repo at `9fb0966`.
3. **Stored XSS (OPEN, High)** — `screenshot_url` client-supplied in `submitGCashProof`; rendered via `dangerouslySetInnerHTML` at `admin/payments/index.tsx` (~233-241). Fix: validate `/api/images/…` shape server-side and/or plain `<img src>`.
4. **Client-supplied amounts (FIXED 2026-08-21, was High — deferred Issue 1)** — `createOrder` now recomputes `total_amount` server-side from verified item prices (`serverTotal`, cent-rounded); client `total_amount` ignored. Per-item `price_at_purchase` was already verified against `products.price` (cent-exact, ~:480). Verified by `_fix_verify.cjs` V4.
5. **TOCTOU one-active-order (Medium)** — check + insert not atomic.
6. **Double-order on double-click (Medium)** — checkout submit has no in-flight lock.
7. **H1 (High, NEW)** — Checkout resume shows live-cart amount, not `resumeOrder.total_amount` (`checkout.tsx:98,703`) → wrong payment amount on resume.
8. **M1** — Step-2 validation failures invisible (`checkout.tsx:617-628`).
9. **M2 (FIXED)** — CartToast "Check out" navigated to `/cart` not `/checkout` → now fixed to `/checkout` (`CartToast.tsx:75`).
10. **M3** — Contact form submits nothing (`contact.tsx:67-68`).
11. **M4** — Newsletter signup submits nothing (`SiteFooter.tsx:142`).
12. **M5** — Shop sort dead/mislabeled options (`shop/index.tsx:54-64`).
13. **M6** — Buy It Now navigates to checkout even when add-to-cart fails (`shop/$id.tsx:380-383`).
14. **L1** — Admin payments approve/reject failures are `console.error`-only (`admin/payments/index.tsx:76`).
15. **L2** — `checkout.tsx` `resumeError` set but never rendered.
16. **L3** — Admin sign-out spinner dead code (`admin/header.tsx`).
17. **L4** — Wishlist heart cosmetic (`ProductCard.tsx` ~139).
18. **L5** — COD step-3 latent stuck-spinner branch (unreachable today).
19. **L6** — Admin orders realtime `user_email: "Loading..."` never resolves.
20. **L7** — `getAdminProducts` field gap → admin thumbnails + tag-search broken.
21. **L8** — username/address maxLength not mirrored client-side.
22. **Guest order email ownership (Medium, by design)** — `getGuestOrders`/`getGuestOrder`/`cancelGuestOrder`/`submitGCashProof` prove ownership via `shipping_address.email` match only (no account). Anyone holding the email can view the order (incl. full shipping address) and cancel a pending one. Accepted for this store; list view shows city/province only. Consider a device token + `guest_token` column if this becomes a problem.
23. **Guest resume race (Low)** — guest `?orderId=` resume passes `orderIdQuery!` — safe because the prompt only renders when `orderIdQuery` is truthy.
24. **Cancelled-order resurrection (FIXED 2026-08-21, was High)** — `verifyGCashPayment` approve path now checks `orders.status`; if `cancelled`, the stale proof is auto-rejected and approval throws (no resurrect to confirmed/paid). Both cancel fns (`cancelCustomerOrder`/`cancelGuestOrder`) auto-reject still-pending gcash proofs for the cancelled order. Verified by `_fix_verify.cjs` V1-V3.
25. **Arbitrary order status strings (FIXED 2026-08-21, was Medium)** — `updateOrderStatus` zod tightened to `z.enum(["pending","confirmed","shipped","delivered","cancelled"])`; `admin/orders/$id.tsx` status state typed `OrderStatus`. DB-level CHECK constraint on `orders.status` NOT added (optional follow-up migration).
26. **RLS verified solid (2026-08-21)** — anon-key probes with effect verification: INSERT orders/gcash_payments blocked (42501), SELECT returns 0 rows, UPDATE/DELETE no-op. Direct-DB attack surface from browser is closed; all ordering guards live in server fns. Note: PostgREST returns 200 for RLS-filtered DELETE/SELECT matching 0 rows — status-code-only probes give false positives; verify effects.

### Conventions for agents
- One concern per change; report unrelated issues, don't fix them in the same change.
- Server-side recompute/verify privileged data; idempotent payment/webhook mutations; DB constraints over app logic.
- Run `npx tsc --noEmit` after every change (currently clean).
- **Update memory.md after every session.**
- **`.vercel/output/**` is tracked — never commit its build changes; `git checkout -- .vercel/output` first.
- PowerShell/node quirk: DB check scripts must be `.cjs` files copied into the project root (`"type": "module"`), run `node _x.cjs`, then delete; `dotenv` is not installed — parse `.env.local` manually. `rg` is not installed (use grep tool / Select-String).

---

## 10. Environment Variables (`.env.local` / `.env.example`)

| Var | Use |
|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | R2 account id (upload URLs) |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket |
| `CLOUDFLARE_R2_API_TOKEN` | R2 REST bearer token |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role (server only; never bundle) |
| `ADMIN_EMAIL` (server) / `VITE_ADMIN_EMAIL` (client cosmetic) | admin gate |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Turnstile secret |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | optional email |

---

## 11. Git History (current)

- `9fb0966` fix: restore wine theme color (invisible submit button) + validate email before submit — **pushed**.
- `09d5d81` admin: editable GCash settings; fix order details for orders missing user profile (incl. `sql/migrations/006_add_gcash_settings.sql` + `memory.md`) — **pushed**.
- `e07cd1a` update checkout and removed some details.
- `d5107a8` fixed the unauthorized bug in admin panel (verifyAdmin cookie fallback).

---

## Self-Check
- ✅ HEAD `9fb0966`, `main` synced with `origin/main`; **guest-orders + admin guest-identity fixes + security fixes UNCOMMITTED** (supabase.functions.ts, orders.tsx, checkout.tsx, admin/orders/$id.tsx, memory.md).
- ✅ **Admin ↔ customer/guest connectivity: 25/27 → fixed 2 gaps (getOrdersList + getOrderDetails now fall back to `shipping_address.email`/`.name` for guests); re-test ALL PASS.**
- ✅ **Security adversarial test (`_sec_test.cjs`, deleted after run): cross-identity attacks BLOCKED (wrong-email cancel, authed-order-as-guest, non-pending cancel), dup ref blocked (409), dup order_number blocked (409 unique idx). Found+FIXED: cancelled-order resurrection (#24), client total tampering (#4), arbitrary status strings (#25). B4/C2/C3 were false positives — service-role bypass by design; RLS verified solid by effect (#26).**
- ✅ **Fix verification (`_fix_verify.cjs`): V1 resurrection guard fires (proof rejected, order stays cancelled), V2 cancel auto-rejects pending proofs, V3 stale-proof chain dead-ended, V4 server total recompute correct. Cleanup leftovers 0.**
- ✅ Wine token, getOrderDetails null-safe fix, GCash settings (code + migration 006), email validation — committed.
- ✅ 53/53 E2E DB procedure checks pass; submit button confirmed by 2 live pending proofs.
- ✅ **Guest orders feature: `getGuestOrders`/`cancelGuestOrder` added, `getGuestOrder` now returns items; `/orders` guest email lookup (no login redirect); `/checkout?orderId=` guest resume prompt. 12/12 new DB checks pass; `npx tsc --noEmit` clean.**
- ✅ Full route map, function catalog, env catalog, and known-issue status current.
- ✅ Guest checkout fully implemented and verified; manual trace clean.
- ✅ **Checkout reload fix (2026-08-21): order creation deferred to the step-3 confirm click (`placeOrder`, retry-safe via `orderId` reuse); step 2 only validates; sessionStorage draft restores step + typed info on reload (step 4 only with real displayOrderId); profile prefill no longer clobbers restored values; server total now includes SHIPPING_FEE 150 + TAX 0 (regression from tampering fix repaired, verified `_checkout_verify.cjs` 2/2 PASS). `npx tsc --noEmit` clean.**
- ✅ **Checkout reload follow-up fixes (2026-08-21): (1) `isVerified === false` gate + spinner while `null` — the old `!isVerified` treated "unknown" as unverified, flashing/sticking "Email Verification Required" on every authed reload; (2) draft-sync effect gated by `draftReady` so the first empty render can't overwrite the saved draft before restore reads it; (3) zod failures in `validateCheckout` also set `formErrors.general` so confirm never fails silently on the review step.**
- ✅ **Test-data cleanup debt paid (2026-08-21): `_sec_test.cjs` cleanup had crashed (`dupIds is not defined`) leaving 2 active orders on testing@gmail.com → one-active-order guard blocked all new orders ("submit not working" report). Both orders + items deleted; account now has 0 orders. LESSON: test scripts must define cleanup vars before try block / tolerate partial setup failure.**
- ⚠️ OPEN: migration 006 not applied to Supabase; Vercel 500 (#2); admin dashboard crash (#1); audit fixes H1/M1/M3-M6/L1-L8 pending user confirmation; optional DB CHECK constraint on orders.status (#25 follow-up).
- ⚠️ `[verify]`: Resend app-side usage site; React Query provider file; `brand` column presence in `products`.