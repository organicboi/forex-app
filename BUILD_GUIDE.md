# Forex Live App — Complete Build Guide

Production deployment roadmap. Follow phases in order — each is independently testable before the next begins.

---

## Current State (Done)

| Item | Status | Files |
|---|---|---|
| Database schema | Done | `DB/schema.sql` |
| Demo seed data | Done | `DB/seed_demo.sql` |
| TV live display (`/live`) | Done | `app/live/page.tsx`, `app/live/LiveDisplay.tsx` |
| TV data API | Done | `app/api/tv/data/route.ts` |
| TV heartbeat API | Done | `app/api/tv/heartbeat/route.ts` |
| Supabase client helpers | Done | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts` |
| Auth middleware | Done | `middleware.ts` |

**Not yet built:** Login, Admin panel, Branch user panel, Distributor panel, Realtime, R2 ads, Reports, Excel import.

---

## Prerequisites Before Writing Any Code

### 1. Read the Next.js docs in the repo
```
node_modules/next/dist/docs/
```
This is Next.js 16 — APIs differ from 14/15. Specifically check: routing, server actions, async params.

### 2. Create `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...   # anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # service role — server-side only

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=forex-ads
R2_PUBLIC_URL=https://pub-xxx.r2.dev          # R2 public bucket URL

JWT_SECRET=                                   # used to sign license keys (openssl rand -hex 32)
DISTRIBUTOR_SECRET=                           # plaintext password for /distributor login

FOREX_API_KEY=                                # if enabling live rate mode
FOREX_API_URL=https://v6.exchangerate-api.com/v6
```

### 3. Run schema and seed
In Supabase SQL Editor, run in order:
1. `DB/schema.sql`
2. `DB/seed_demo.sql` — copy the `branch_token` output

### 4. Download flag SVGs
```powershell
$flags = @{ "in"="IN";"pk"="PK";"bd"="BD";"ph"="PH";"np"="NP";"lk"="LK";"id"="ID";
             "us"="US";"gb"="GB";"eu"="EU";"cn"="CN";"jp"="JP";"sa"="SA";"kw"="KW";
             "qa"="QA";"bh"="BH";"om"="OM";"au"="AU";"ca"="CA";"my"="MY" }
foreach ($f in $flags.GetEnumerator()) {
  Invoke-WebRequest "https://flagcdn.com/$($f.Key).svg" -OutFile "public/flags/$($f.Key).svg"
}
```

### 5. Install missing packages (add as needed per phase)
```bash
npm install xlsx @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install jose                   # JWT for license keys
```

---

## Database Quick Reference

### Tables and their purpose

| Table | Purpose | Key fields |
|---|---|---|
| `plans` | Subscription tiers | `max_branches`, `storage_mb`, `allow_branch_rate_edit` |
| `customers` | Forex business accounts | `plan_id`, `is_active`, `plan_expires_at`, `primary_color`, `base_currency`, `branch_ad_mode` |
| `users` | Admins + branch users | `customer_id`, `role` (`admin`\|`branch_user`), `is_active` |
| `branches` | Branch locations | `customer_id`, `branch_token`, `layout`, `allow_user_rate_edit` |
| `branch_user_assignments` | Which branch a user belongs to | `user_id` → `branch_id` (1:1) |
| `screen_sessions` | TV heartbeat tracking | `session_key`, `last_seen_at` (online if < 90s ago) |
| `currencies` | Master list of 20 currencies | `code`, `flag_path`, `default_decimals` |
| `customer_currencies` | Which currencies a customer shows | `is_enabled`, `display_order`, `decimal_places` |
| `rates` | Customer-wide rates | `buy`, `sell`, `transfer`, `mode` (`manual`\|`live`) |
| `branch_rate_overrides` | Branch-specific rate overrides | Takes priority over `rates` for that branch's TV |
| `rate_history` | Immutable audit log | Written by triggers only — never insert directly |
| `ads` | Ad media metadata | `branch_id=null` = all branches, R2 URLs |
| `ticker_messages` | TV footer messages | `branch_id=null` = all branches |
| `license_keys` | One-time registration keys | `key_hash` (SHA-256), `redeemed_at` |
| `excel_imports` | Excel upload audit log | `rows_total`, `rows_failed`, `error_summary` (jsonb) |

### Views

| View | Use |
|---|---|
| `v_branch_screen_status` | Online TV count per branch |
| `v_customer_storage` | Storage used vs limit per customer |
| `v_distributor_overview` | All customers with plan/usage metrics |

### Key DB functions

| Function | When to call |
|---|---|
| `get_tv_data(branch_id)` | TV data endpoint — returns full jsonb payload |
| `customer_storage_used_mb(customer_id)` | Before accepting ad upload |
| `can_add_branch(customer_id)` | Before creating a branch |

### Rate source tagging (for history)
Before any rate `INSERT`/`UPDATE`, set:
```sql
SET LOCAL app.rate_source = 'excel';  -- or 'api', 'manual', 'system'
```
The `log_rate_change` trigger reads this and writes to `rate_history`.

---

## Route Structure

```
/                          Login (license key or email/password)
/auth/callback             Supabase OAuth callback

/live                      TV display (no auth — token in URL)

/admin                     → redirect to /admin/rates
/admin/rates               Rate editor
/admin/currencies          Enable/order/decimals
/admin/ads                 Upload + manage ads
/admin/branches            Branch list
/admin/branches/[id]       Branch detail, layout, token, branch ads
/admin/users               Branch user management
/admin/ticker              Ticker messages
/admin/reports/rates       Rate history log
/admin/reports/screens     Screen uptime log
/admin/reports/storage     Storage usage
/admin/plan                Plan info

/branch                    → redirect to /branch/rates
/branch/rates              Branch user rate view/edit
/branch/ads                Branch user ad management
/branch/screen             Screen status for their branch

/distributor               Distributor login
/distributor/customers     Customer list
/distributor/customers/new Create customer + generate license key
/distributor/customers/[id] Edit customer
/distributor/plans         Plan tier management
/distributor/keys          License key list
/distributor/usage         System usage

API routes (all under /api/):
  auth/redeem-key          POST — license key redemption
  currencies               GET / PATCH
  rates                    GET / POST (upsert)
  rates/excel              POST — parse xlsx, validate, commit
  rates/live-fetch         POST — trigger live API rate fetch
  branches                 GET / POST / PATCH / DELETE
  branches/[id]/token      POST — regenerate branch token
  users                    GET / POST / PATCH / DELETE
  ads                      GET / POST / PATCH / DELETE
  ads/upload-url           GET — R2 presigned PUT URL
  ticker                   GET / POST / PATCH / DELETE
  reports/rates            GET
  reports/screens          GET
  distributor/customers    GET / POST / PATCH
  distributor/plans        GET / POST / PATCH / DELETE
  distributor/keys         GET / POST / DELETE
```

---

## Phase 1 — Auth + Login Page

**Goal:** Working login that routes admin → `/admin/rates` and branch users → `/branch/rates`.

### Files to create
```
app/page.tsx                      Replace Next.js default with login UI
app/auth/callback/route.ts        Supabase auth callback handler
app/api/auth/redeem-key/route.ts  License key redemption
lib/auth.ts                       Auth helpers (get session, get role, redirect guards)
```

### Login page logic (`app/page.tsx`)

Two modes on the same page, toggled by a tab:

**Tab 1 — Email/Password login:**
- `supabase.auth.signInWithPassword({ email, password })`
- On success, redirect based on `public.users.role`:
  - `admin` → `/admin/rates`
  - `branch_user` → `/branch/rates`

**Tab 2 — License key (first time only):**
- Shows one text field: "Enter your license key"
- POSTs to `/api/auth/redeem-key`
- On success: redirects to a "Set your password" form (or use Supabase magic link)

### License key redemption (`/api/auth/redeem-key`)

```
POST body: { key: string, email: string, password: string, full_name: string }

Steps:
1. Hash the key: encode(sha256(key::bytea), 'hex') — use node crypto
2. Query license_keys where key_hash = hash AND redeemed_at IS NULL AND is_revoked = false
3. If not found → 401 "Invalid or already used key"
4. If expires_at < now() → 401 "Key expired"
5. Get customer_id from the license key row
6. Call supabase.auth.admin.createUser({
     email, password,
     email_confirm: true,
     user_metadata: { customer_id, role: "admin", full_name }
   })
   → The handle_new_auth_user trigger creates the public.users row automatically
7. Mark key: UPDATE license_keys SET redeemed_at=now(), redeemed_by=new_user_id WHERE id=...
8. Return 200 — client signs in with the email/password just set
```

### `lib/auth.ts` helpers

```typescript
// Server-side helpers for use in Server Components and API routes
export async function getSessionUser()  // Returns auth user + public.users row
export async function requireRole(role: 'admin' | 'branch_user')  // Throws/redirects if wrong role
export async function requireAdmin()    // Shortcut
export async function requireBranchUser()
```

### Middleware update

`middleware.ts` already exists. Ensure it redirects:
- Unauthenticated requests to `/admin/*` → `/`
- Unauthenticated requests to `/branch/*` → `/`
- Authenticated admin trying to access `/branch/*` → `/admin/rates`
- Authenticated branch_user trying to access `/admin/*` → `/branch/rates`

---

## Phase 2 — Admin Panel Layout Shell

**Goal:** Sidebar layout wrapping all `/admin/*` routes with navigation and user info.

### Files to create
```
app/admin/layout.tsx              Admin shell — sidebar + topbar
app/admin/page.tsx                Redirect to /admin/rates
app/admin/rates/page.tsx          Placeholder
app/admin/currencies/page.tsx     Placeholder
app/admin/ads/page.tsx            Placeholder
app/admin/branches/page.tsx       Placeholder
app/admin/users/page.tsx          Placeholder
app/admin/ticker/page.tsx         Placeholder
app/admin/plan/page.tsx           Placeholder
app/admin/reports/rates/page.tsx  Placeholder
app/admin/reports/screens/page.tsx
app/admin/reports/storage/page.tsx
components/ui/                    Shared UI components (Button, Input, Table, Badge, etc.)
```

### Admin sidebar nav items
```
Rates          /admin/rates
Currencies     /admin/currencies
Ads            /admin/ads
Branches       /admin/branches
Users          /admin/users
Ticker         /admin/ticker
Reports →
  Rate History   /admin/reports/rates
  Screen Uptime  /admin/reports/screens
  Storage        /admin/reports/storage
Plan           /admin/plan
```

### Layout server component
- Reads session server-side (`getSessionUser()`)
- If no session or role ≠ `admin` → redirect to `/`
- Shows business name from `customers.business_name || customers.name`
- Shows plan expiry warning banner if `plan_expires_at < now() + 7 days`
- If plan expired: show a site-wide warning but keep panel functional (read-only enforcement happens per-feature)

### UI components to build once, reuse everywhere
Use Tailwind. Build minimal shared components:
- `Button` (variants: primary, secondary, danger, ghost)
- `Input`, `Textarea`
- `Table` (thead, tbody, pagination controls)
- `Badge` (green/red/yellow status dots)
- `Modal` / `Dialog`
- `Toast` / notification system
- `Spinner`

---

## Phase 3 — Admin: Currency Configuration

**Goal:** Admin can enable/disable currencies, set display order, and set decimal places.

### Files
```
app/admin/currencies/page.tsx
app/api/currencies/route.ts
```

### Page UI
- Drag-and-drop list (use `@dnd-kit/sortable` or similar)
- Each row: flag, code, name, toggle (enabled/disabled), decimal places selector (0/2/3/4)
- Save button — PATCH all changes in one request

### API (`/api/currencies`)

```
GET  /api/currencies
  → Returns customer_currencies joined with currencies for the session user's customer_id
  → Ordered by display_order ASC

PATCH /api/currencies
  Body: [{ currency_id, is_enabled, display_order, decimal_places }]
  → Upserts customer_currencies for all rows
  → Auth: admin only
```

### DB query pattern
```sql
SELECT cc.*, cur.code, cur.name, cur.flag_path, cur.default_decimals
FROM customer_currencies cc
JOIN currencies cur ON cur.id = cc.currency_id
WHERE cc.customer_id = $customer_id
ORDER BY cc.display_order ASC
```

---

## Phase 4 — Admin: Rate Editor

**Goal:** Inline rate table where admin can edit buy/sell/transfer for each currency.

### Files
```
app/admin/rates/page.tsx
app/admin/rates/RateTable.tsx     (client component for inline editing)
app/api/rates/route.ts
```

### Page structure
- Server component fetches currencies + rates, passes to `RateTable` (client)
- Mode toggle at the top: `Manual` | `Live API`

### Rate table (client component)
- Each row: flag, currency name, buy input, sell input, transfer input
- Clicking a cell makes it editable
- "Save all" button → PATCH `/api/rates`
- Mode toggle → POST `/api/rates/live-fetch` to enable live mode

### API (`/api/rates`)

```
GET /api/rates
  → Joins rates + customer_currencies + currencies for the user's customer
  → Returns { currencies: [{ code, name, flag_path, decimal_places, buy, sell, transfer, mode }] }

POST /api/rates
  Body: [{ currency_id, buy, sell, transfer }]
  Steps:
    1. Validate all are positive numbers
    2. SET LOCAL app.rate_source = 'manual'
    3. Upsert into rates for each row (ON CONFLICT (customer_id, currency_id) DO UPDATE)
    4. The tg_rates_history trigger fires automatically → rate_history is written
  Auth: admin only
```

### Important: rate save pattern in API
```typescript
// In the API route — must be in a single transaction for the SET LOCAL to apply
await supabase.rpc('exec_sql', ...) // OR use service role and raw postgres
// Or use the admin client with a transaction:
const { error } = await supabase.from('rates').upsert([...])
// The trigger reads app.rate_source — set it before the upsert
```
Note: `SET LOCAL` only works within a transaction. Use a Postgres function or ensure your upserts are in a transaction block if you need the source tag.

---

## Phase 5 — Admin: Excel Rate Import

**Goal:** Upload `.xlsx` file, validate it, preview results, commit to DB.

### Files
```
app/admin/rates/ExcelImport.tsx   Client component — upload + preview
app/api/rates/excel/route.ts
```

### Install
```bash
npm install xlsx
```

### Upload flow
1. User selects `.xlsx` file
2. POST to `/api/rates/excel` with FormData
3. Server parses with SheetJS, validates, returns preview (do not commit yet)
4. User sees: "18 rows OK / 2 failed" table with error detail
5. User clicks "Apply" → POST again with `{ confirm: true }`
6. Server commits valid rows, logs to `excel_imports`

### Server parser (`/api/rates/excel`)
```typescript
import * as XLSX from 'xlsx'

// Step 1: parse
const workbook = XLSX.read(buffer, { type: 'buffer' })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) // raw arrays
// rows[0] is header — skip it
// rows[1+]: [currency_code, buy, sell, transfer]

// Step 2: validate each row
//   - currency_code must exist in public.currencies
//   - buy/sell/transfer must be positive numbers

// Step 3: preview response or commit
// If committing:
//   SET LOCAL app.rate_source = 'excel'
//   Upsert into rates
//   INSERT into excel_imports with summary
```

### Expected Excel format
| A | B | C | D |
|---|---|---|---|
| Currency Code | Buy | Sell | Transfer |
| INR | 22.50 | 22.80 | 22.60 |
| PKR | 0.130 | 0.135 | 0.132 |

Row 1 = header (skipped). Codes must match exactly (e.g. `INR`, not `inr`).

---

## Phase 6 — Admin: Branch Management

**Goal:** Create and manage branches; view TV screen health; access branch token.

### Files
```
app/admin/branches/page.tsx
app/admin/branches/[id]/page.tsx
app/admin/branches/[id]/layout-config/page.tsx
app/api/branches/route.ts
app/api/branches/[id]/route.ts
app/api/branches/[id]/token/route.ts
```

### Branch list page (`/admin/branches`)
- List of branches with: name, location, layout, screen status (green/red dot), token button
- Screen status: query `v_branch_screen_status` → `screens_online` count
- "New Branch" button → modal with name, location_note, layout picker
- Branch limit enforcement: show `can_add_branch(customer_id)` result; disable button if false

### Branch detail page (`/admin/branches/[id]`)
- Tabs: Overview | Ads | Users | Layout | Settings
- **Overview tab**: screen status list, last seen timestamps
- **Layout tab**: radio buttons for the 5 layout options; updates `branches.layout`
- **Settings tab**: allow_user_rate_edit toggle, rename, delete

### Token management
- Show masked token with "Copy" and "Regenerate" buttons
- "Regenerate" → POST `/api/branches/[id]/token` → generates new `encode(gen_random_bytes(32), 'hex')`
- Warn: "The old token will stop working immediately on all TVs using it"

### API routes

```
GET  /api/branches
  → Returns all branches for user's customer + screen status

POST /api/branches
  Body: { name, location_note, layout }
  → Calls can_add_branch() first; rejects if over limit
  → INSERT into branches (customer_id auto-set from session)

PATCH /api/branches/[id]
  Body: any subset of { name, location_note, layout, allow_user_rate_edit, is_active }

DELETE /api/branches/[id]
  → Soft delete: SET is_active = false

POST /api/branches/[id]/token
  → UPDATE branches SET branch_token = encode(gen_random_bytes(32), 'hex')
  → Returns new token
```

---

## Phase 7 — Admin: Branch User Management

**Goal:** Admin creates branch user accounts, assigns them to a branch.

### Files
```
app/admin/users/page.tsx
app/api/users/route.ts
app/api/users/[id]/route.ts
```

### Page UI
- Table: name, email, branch assigned, status (active/inactive), actions
- "New User" button → modal:
  - Full name, email, temporary password
  - Branch selector (dropdown of branches)
- "Deactivate" → sets `users.is_active = false` (does not delete auth user)

### API

```
GET /api/users
  → Returns all branch_user records for user's customer
  → Joined with branch_user_assignments to get branch name

POST /api/users
  Body: { full_name, email, password, branch_id }
  Steps:
    1. Create Supabase auth user:
       supabase.auth.admin.createUser({
         email, password,
         email_confirm: true,
         user_metadata: { customer_id, role: 'branch_user', full_name }
       })
       → handle_new_auth_user trigger creates public.users row
    2. INSERT into branch_user_assignments (user_id, branch_id)

PATCH /api/users/[id]
  Body: { is_active, branch_id, full_name }
  → Updates public.users and optionally branch_user_assignments

DELETE /api/users/[id]
  → supabase.auth.admin.deleteUser(id) — cascades to public.users
```

---

## Phase 8 — Admin: Ad Management

**Goal:** Upload image/video ads to Cloudflare R2, manage order and duration.

### Install
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Files
```
app/admin/ads/page.tsx
app/admin/ads/AdManager.tsx       Client component
app/api/ads/route.ts
app/api/ads/upload-url/route.ts
lib/r2.ts                         R2 client helper
```

### `lib/r2.ts`
```typescript
import { S3Client } from '@aws-sdk/client-s3'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
```

### Upload flow
```
Client → GET /api/ads/upload-url?filename=&file_size=&file_type=
Server:
  1. Verify storage: customer_storage_used_mb(customer_id) + file_size_mb ≤ plan.storage_mb
  2. Generate R2 key: clients/{customer_id}/ads/{branch_id or 'global'}/{uuid}.{ext}
  3. Create presigned PutObject URL (5-minute expiry) via @aws-sdk/s3-request-presigner
  4. Return { upload_url, r2_key, public_url }

Client → PUT upload_url with file binary (direct to R2, no server)

Client → POST /api/ads with { r2_key, public_url, file_type, file_size_bytes, duration_seconds, branch_id? }
Server → INSERT into ads
```

### Ad list page
- Grid of cards with preview thumbnail + duration + order controls
- Drag to reorder → PATCH `/api/ads` with new display_order values
- Toggle active/inactive per item
- Delete → removes from R2 (PutObject delete) + removes from `ads` table
- Duration slider: 5 / 10 / 15 / 20 / 30 seconds
- Filter: Customer-wide | Branch-specific

### R2 public URL pattern
Files served via: `{R2_PUBLIC_URL}/clients/{customer_id}/ads/...`
Set this as the R2 bucket's custom subdomain in Cloudflare dashboard.

### API

```
GET  /api/ads?branch_id=optional
POST /api/ads          — record metadata after direct R2 upload
PATCH /api/ads         — bulk update display_order or duration
PATCH /api/ads/[id]    — update single ad
DELETE /api/ads/[id]   — delete from R2 + DB
GET  /api/ads/upload-url — presigned PUT URL
```

---

## Phase 9 — Admin: Ticker Messages

**Goal:** Manage scrolling footer messages on the TV.

### Files
```
app/admin/ticker/page.tsx
app/api/ticker/route.ts
```

### Page UI
- List with drag-to-reorder, enable/disable toggle, edit/delete per row
- Text area for message + "Add" button
- Filter: Customer-wide | Branch-specific (dropdown of branches)

### API
```
GET    /api/ticker?branch_id=optional
POST   /api/ticker   Body: { message, branch_id?, display_order }
PATCH  /api/ticker/[id]
DELETE /api/ticker/[id]
```

---

## Phase 10 — Branch User Panel

**Goal:** Scoped panel for branch users — see and edit rates for their branch only.

### Files
```
app/branch/layout.tsx
app/branch/page.tsx             → redirect to /branch/rates
app/branch/rates/page.tsx
app/branch/rates/BranchRateTable.tsx
app/branch/ads/page.tsx
app/branch/screen/page.tsx
```

### Branch layout (`app/branch/layout.tsx`)
- Same shell as admin but simpler nav: Rates | Ads | Screen
- Reads session, redirects if not `branch_user`
- Shows branch name from `branch_user_assignments → branches`

### Branch rates page
- Shows customer-wide rates + any branch overrides (highlight overridden cells)
- If `branches.allow_user_rate_edit = true`: cells are editable
- If false: read-only with message "Rate editing is disabled for this branch"
- Save → POST `/api/rates/branch-override`

### Branch rate override API
```
POST /api/rates/branch-override
  Body: [{ currency_id, buy, sell, transfer }]
  Auth: branch_user only
  Verify: branches.allow_user_rate_edit = true for their branch
  Action: Upsert into branch_rate_overrides
          SET LOCAL app.rate_source = 'manual'
          The tg_branch_rates_history trigger fires automatically
```

### Branch ads page
- Same as admin ads page but scoped to `branch_id = my_branch_id()`
- No customer-wide ads visible here (those are admin's domain)

### Screen status page
- Shows `v_branch_screen_status` for their branch
- List of session_keys currently online (last_seen < 90s ago)
- Last seen timestamp per session

---

## Phase 11 — Admin: Reports

**Goal:** Rate history, screen uptime, storage usage views.

### Files
```
app/admin/reports/rates/page.tsx
app/admin/reports/screens/page.tsx
app/admin/reports/storage/page.tsx
app/api/reports/rates/route.ts
app/api/reports/screens/route.ts
```

### Rate history (`/admin/reports/rates`)
```
GET /api/reports/rates?from=&to=&currency_id=&branch_id=
→ Query rate_history
  ORDER BY changed_at DESC
  Filters: date range, currency, branch
→ Returns: [{ changed_at, currency_code, buy, sell, transfer, changed_by_name, source, branch_name }]
```
Display as paginated table. Export to CSV button (client-side from fetched data).

### Screen uptime (`/admin/reports/screens`)
```
GET /api/reports/screens
→ Query screen_sessions for user's customer's branches
→ v_branch_screen_status for current status
→ Returns: per-branch session log with last_seen_at, user_agent, ip_address
```

### Storage usage (`/admin/reports/storage`)
```
→ Query v_customer_storage for used/limit
→ List all ads with file_size_bytes
→ Show: used MB, limit MB, percent bar, per-ad file list
```

---

## Phase 12 — Distributor Panel

**Goal:** Separate protected area for the platform operator.

### Files
```
app/distributor/page.tsx              Login
app/distributor/layout.tsx            Shell (checks DISTRIBUTOR_SECRET cookie)
app/distributor/customers/page.tsx
app/distributor/customers/new/page.tsx
app/distributor/customers/[id]/page.tsx
app/distributor/plans/page.tsx
app/distributor/keys/page.tsx
app/distributor/usage/page.tsx
app/api/distributor/customers/route.ts
app/api/distributor/plans/route.ts
app/api/distributor/keys/route.ts
lib/distributor-auth.ts
```

### Distributor auth
Simple: POST `/api/distributor/login` with `{ secret }`.
Compare to `DISTRIBUTOR_SECRET` env var.
On match: set a signed HttpOnly cookie (`jose` sign with `JWT_SECRET`).
Middleware for `/distributor/*`: verify cookie exists and is valid.

**No Supabase Auth** for the distributor — they use the service role key directly in all API routes.

### License key generation

```typescript
// In POST /api/distributor/customers — on customer creation:
import crypto from 'crypto'

const plaintext = crypto.randomBytes(32).toString('hex')  // 64-char hex
const hash = crypto.createHash('sha256').update(plaintext).digest('hex')

// Store hash:
await supabase.from('license_keys').insert({
  customer_id,
  key_hash: hash,
  label: `Initial key for ${customer_name}`,
  expires_at: null  // no expiry unless you want one
})

// Return plaintext to distributor — shown once, never stored
return { license_key: plaintext }
```

### Customer list page (`/distributor/customers`)
- Uses `v_distributor_overview` view
- Per row: name, plan, expiry date, branch count, storage used, active toggle
- Active toggle → PATCH `customers.is_active`
- Click → `/distributor/customers/[id]`

### Create customer page (`/distributor/customers/new`)
Form: name, plan (dropdown), expires in days, primary_color, base_currency, business_name
On submit:
1. INSERT into customers
2. Generate license key (above)
3. Show key in a copyable box with warning "Shown once only"

### Plans page (`/distributor/plans`)
CRUD for subscription tiers. Shows all fields from `plans` table.

### Keys page (`/distributor/keys`)
Table: customer name, issued_at, expires_at, redeemed_at, is_revoked
"Revoke" button → `UPDATE license_keys SET is_revoked = true`

---

## Phase 13 — Supabase Realtime (Rate Push to TV)

**Goal:** When admin saves rates, all branch TVs update instantly without waiting for the 30s poll.

### Architecture
One Supabase Realtime channel per customer: `customer:{customer_id}`

All TVs for that customer subscribe to the same channel. Rate saves broadcast to the channel.
This keeps Realtime connections at number of customers (~10), not number of TVs (~150).

### TV side (in `LiveDisplay.tsx`)

```typescript
import { createBrowserClient } from '@supabase/ssr'

// After initial data load, subscribe
const channel = supabase
  .channel(`customer:${tvData.customer.id}`)
  .on('broadcast', { event: 'rates_updated' }, () => {
    fetchData()  // re-fetch from /api/tv/data
  })
  .on('broadcast', { event: 'layout_updated' }, (payload) => {
    setLayout(payload.layout)
  })
  .subscribe()

// Cleanup on unmount
return () => { supabase.removeChannel(channel) }
```

### Admin side — broadcast after rate save

In `/api/rates` POST handler, after successful upsert:
```typescript
const adminClient = createAdminClient()
await adminClient
  .channel(`customer:${customer_id}`)
  .send({
    type: 'broadcast',
    event: 'rates_updated',
    payload: {}
  })
```

Similarly broadcast `layout_updated` when branch layout changes.

### Realtime channel naming
Channels are `customer:{customer_id}` — not per-branch. The TV re-fetches from the API which returns branch-specific data. This avoids needing per-branch channels (Realtime has a 200-connection limit on free tier).

---

## Phase 14 — TV Offline Fallback

**Goal:** If network drops, TV shows last-known rates with a "Rates as of [time]" indicator.

### In `LiveDisplay.tsx`

```typescript
// On successful fetch:
const data = await res.json()
localStorage.setItem('tv_last_data', JSON.stringify(data))
localStorage.setItem('tv_last_fetched', new Date().toISOString())

// On fetch failure:
const cached = localStorage.getItem('tv_last_data')
const cachedAt = localStorage.getItem('tv_last_fetched')
if (cached) {
  setTvData(JSON.parse(cached))
  setIsStale(true)
  setStaleAt(cachedAt)
  // Do NOT clear the data — keep showing it
}
```

Show a subtle banner on the TV (not blocking display) when `isStale = true`:
```
"Rates as of 14:32 — Network connection lost"
```
Banner disappears when connectivity restores and fresh data arrives.

---

## Phase 15 — Plan Expiry Guards + Storage Enforcement

### Plan expiry

**TV side** — already handled: `get_tv_data` returns `status: 'expired'` when plan is expired.
`LiveDisplay.tsx` shows full-screen "Subscription expired" overlay.

**Admin panel side:**
In `app/admin/layout.tsx`, read `customers.plan_expires_at`:
- If expired: show a red banner at top "Your subscription has expired. Contact your provider."
- Disable rate-saving, ad-uploading, and branch-creation (check in API routes too)
- Do NOT lock them out — keep data visible, just block writes

**API-level guard** (in every write API route):
```typescript
const { data: customer } = await supabase
  .from('customers').select('plan_expires_at, is_active').eq('id', customer_id).single()
if (!customer.is_active || new Date(customer.plan_expires_at) < new Date()) {
  return Response.json({ error: 'Plan expired or account inactive' }, { status: 403 })
}
```

### Storage enforcement

In `/api/ads/upload-url`:
```typescript
const { data } = await supabase
  .rpc('customer_storage_used_mb', { p_customer_id: customer_id })
const usedMb = data as number
const plan = await getCustomerPlan(customer_id)
const fileSizeMb = file_size_bytes / 1_048_576

if (usedMb + fileSizeMb > plan.storage_mb) {
  return Response.json({
    error: `Storage limit exceeded. Used: ${usedMb}MB, Limit: ${plan.storage_mb}MB`
  }, { status: 413 })
}
```

### Branch limit
Already enforced at DB level by `enforce_branch_limit` trigger — the insert will throw.
Catch the error in the API and return a 400 with a readable message.

---

## Phase 16 — Production Deployment

### 1. Enable RLS

Run this in Supabase SQL Editor (copy from the comment block in `schema.sql`):
```sql
alter table public.plans                   enable row level security;
alter table public.customers               enable row level security;
alter table public.users                   enable row level security;
alter table public.branches                enable row level security;
alter table public.branch_user_assignments enable row level security;
alter table public.screen_sessions         enable row level security;
alter table public.currencies              enable row level security;
alter table public.customer_currencies     enable row level security;
alter table public.rates                   enable row level security;
alter table public.branch_rate_overrides   enable row level security;
alter table public.rate_history            enable row level security;
alter table public.ads                     enable row level security;
alter table public.ticker_messages         enable row level security;
alter table public.license_keys            enable row level security;
alter table public.excel_imports           enable row level security;
```

### 2. Build the app
```bash
npm run build
```
Fix any TypeScript errors before deploying.

### 3. VPS setup (KVM2)
```bash
# Install Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
npm install -g pm2

# Clone and build
git clone ... /opt/forex-live-app
cd /opt/forex-live-app
npm ci
npm run build

# Create .env.local with production values
# Start with PM2
pm2 start npm --name "forex-live" -- start
pm2 save
pm2 startup
```

### 4. Nginx config
```nginx
server {
  listen 80;
  server_name yourdomain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name yourdomain.com;

  ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### 5. SSL
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 6. R2 bucket setup
1. Create bucket in Cloudflare R2 dashboard
2. Enable "Public access" on the bucket
3. Set `R2_PUBLIC_URL` to the public bucket URL (or custom subdomain)
4. Set CORS policy on the bucket to allow PUT from your domain:
```json
[{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 300
}]
```

### 7. Live rate cron (if using live API mode)
```bash
# Add to crontab on VPS
*/15 * * * * curl -X POST https://yourdomain.com/api/rates/live-fetch \
  -H "Authorization: Bearer $CRON_SECRET"
```
Or use `node-cron` inside the Next.js app (simpler for single-server deployment).

### 8. Pre-production checklist
- [ ] RLS enabled on all tables
- [ ] `DISTRIBUTOR_SECRET` is a strong random value (not default)
- [ ] `JWT_SECRET` is 32+ bytes of random entropy
- [ ] R2 CORS set correctly
- [ ] All flag SVGs in `public/flags/`
- [ ] Test license key redemption end-to-end
- [ ] Test TV screen with real branch token
- [ ] Test plan expiry guard (set `plan_expires_at = now() - interval '1 day'` temporarily)
- [ ] Test storage limit (upload files until at 95% of plan limit)
- [ ] Test branch rate override (set `allow_user_rate_edit = true` on a branch)
- [ ] Confirm Realtime push works (change a rate, watch TV update within 2s)

---

## Implementation Order Summary

| Phase | What | Est. Complexity |
|---|---|---|
| **Phase 1** | Auth + Login page + license key redemption | Medium |
| **Phase 2** | Admin panel layout shell + UI components | Medium |
| **Phase 3** | Admin: Currency config | Low |
| **Phase 4** | Admin: Rate editor | Medium |
| **Phase 5** | Admin: Excel import | Medium |
| **Phase 6** | Admin: Branch management | Medium |
| **Phase 7** | Admin: User management | Low |
| **Phase 8** | Admin: Ad management (R2 upload) | High |
| **Phase 9** | Admin: Ticker messages | Low |
| **Phase 10** | Branch user panel | Medium |
| **Phase 11** | Admin: Reports | Low |
| **Phase 12** | Distributor panel | Medium |
| **Phase 13** | Supabase Realtime push | Medium |
| **Phase 14** | TV offline fallback | Low |
| **Phase 15** | Plan expiry + storage guards | Low |
| **Phase 16** | Production deployment + RLS enable | Medium |

---

## Key Invariants (Do Not Break)

1. **`branch_rate_overrides` takes priority over `rates`** — the `get_tv_data` function handles this with `COALESCE(bro.buy, r.buy, 0)`. Never merge these at the application layer.

2. **Never insert into `rate_history` directly** — it is written exclusively by the `tg_rates_history` and `tg_branch_rates_history` triggers. Direct inserts will create duplicate entries.

3. **Branch token = TV credential** — treat it like a password. Never expose it in client-side code other than as a URL parameter. Always validate server-side using service role.

4. **`handle_new_auth_user` trigger creates `public.users`** — you do not INSERT into `public.users` directly. Create the Supabase Auth user with the correct `raw_user_meta_data` and the trigger handles the rest.

5. **Admin routes must use service role key** — the TV API routes (`/api/tv/*`) use `createAdminClient()`. Admin panel routes should use the session-based Supabase client (`createServerClient`) so RLS applies correctly.

6. **Realtime channels are per-customer, not per-TV** — subscribe TVs to `customer:{id}`, not `branch:{id}`. This keeps Realtime connections at ~10 (number of customers), not ~150 (number of TVs).

7. **Excel `SET LOCAL app.rate_source`** — this must happen within the same database transaction as the `rates` upsert, or the trigger will fall back to `'manual'`. Use a DB function or ensure the client is in transaction mode.

8. **RLS is disabled in development** — never deploy to production without running the `enable row level security` block. Test RLS with a branch_user token before going live.
