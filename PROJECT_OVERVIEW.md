# Forex Live App — Project Overview

## 1. What Is This?

A **multi-tenant TV dashboard platform** for forex exchange businesses. It displays live or manually-set exchange rates on branch TVs alongside rotating ad media (images and videos). The system is three-tiered: a distributor sells access to clients (forex businesses), each client manages their branches and branch-level staff.

---

## 2. Distribution Model

```
Developer (you)
    └── Distributor
            ├── Manages subscription plans + license keys
            ├── Creates customer (Admin) accounts
            │
            └── Customer A (forex business — "Nova Currency")
            │       ├── Admin User 1
            │       ├── Admin User 2
            │       ├── Branch User — Branch Dubai Marina
            │       ├── Branch User — Branch Deira
            │       └── Branch User — Branch Abu Dhabi
            │               └── TV Screen (displays /live)
            │
            └── Customer B ...
            └── Customer C ... (up to ~10 on free tier)
```

---

## 3. User Roles & Permissions

### 3.1 Distributor

The single operator who sells and manages access to the platform.

| Capability | Notes |
|---|---|
| Create customer accounts | Set name, email, assign a subscription plan |
| Create Admin users per customer | Can create multiple admins per customer |
| Generate & manage license keys | Signed tokens for initial customer login |
| Manage subscription plans | Define plan tiers (branch limits, storage, features) |
| Define branch limits per customer | Enforced at branch creation time |
| Enable / Disable customer accounts | Instant revoke or restore of access |
| View all customers and branches | Full system overview |
| Monitor system usage | Storage per client, active TVs, API usage |

### 3.2 Admin (Customer)

The forex business owner or manager. Can have multiple admin users per customer account.

| Capability | Notes |
|---|---|
| Manage branches | Create, rename, delete branches |
| Manage branch users | Create/delete Branch User accounts; assign to branch |
| Configure currency rates | Manual edit with buy/sell/transfer per currency |
| Upload rates via Excel | Bulk rate import from `.xlsx` file |
| Fetch rates from APIs | Enable Live Mode; choose rate source |
| Manage advertisements | Upload images/videos; set order and duration |
| Configure TV screen layouts | Choose from predefined layout templates |
| View reports and logs | Rate change history, audit log, screen uptime |

### 3.3 Branch User

Staff at a specific branch. Scoped strictly to their assigned branch — cannot see or affect other branches.

| Capability | Notes |
|---|---|
| Update rates for their branch | Only if Admin has allowed branch-level rate overrides |
| Upload rates via Excel | Same format as Admin; scoped to their branch |
| Manage branch advertisements | Upload/order/enable ads for their branch only |
| Monitor assigned screens | See which TVs at their branch are online/offline |

### 3.4 TV Screen (Branch Display)

Not a logged-in user. The `/live` page is opened in a browser on a TV. It authenticates via a branch token (not a user session) and displays read-only data.

---

## 4. Subscription Plans

Distributor creates and manages plan tiers. Each customer is assigned a plan.

| Field | Description |
|---|---|
| `name` | e.g., "Starter", "Pro", "Enterprise" |
| `max_branches` | Max number of branches this plan allows |
| `storage_mb` | Max ad storage per client (e.g., 500 MB) |
| `allow_live_rates` | Whether the client can enable Live Mode |
| `allow_excel_import` | Whether Excel import is available |
| `allow_layout_config` | Whether TV layout customization is enabled |
| `duration_days` | Plan validity period |
| `price` | For distributor's reference only (billing is external) |

---

## 5. Auth & Access Model

### 5.1 License Key (Registration)

1. Distributor creates a customer account + generates a **signed license key** (JWT) containing: `customer_id`, `email`, `plan_id`, `issued_at`.
2. Admin user receives the key and uses it on the login page to activate their account.
3. Key is single-use. After redemption, Admin logs in via email/password or magic link.
4. Account locks on plan expiry → dashboard shows "Plan Expired" screen; admin panel is read-only.

### 5.2 Branch User Access

- Admin creates Branch User accounts in the admin panel (email/password).
- Each Branch User is assigned exactly one branch.
- Supabase Row Level Security (RLS) enforces they can only read/write their own branch's data.

### 5.3 TV Screen Auth

- Admin generates a **branch token** (long-lived, non-expiring unless regenerated).
- Branch token is pasted into the TV browser URL or login screen: `/live?token=xxx`.
- The token identifies which branch + customer the TV belongs to.
- No user session on the TV — only the branch token.

---

## 6. Features In Detail

### 6.1 TV Dashboard (`/live`)

Full-screen display for branch TVs. No user interaction — auto-rotating, auto-updating.

| Feature | Detail |
|---|---|
| Rate table (left panel) | Paginated, auto-rotates every 8 s. Progress bar. Fade+slide transition. |
| Ad carousel (right panel) | Images and videos. Per-item duration. Smooth transition. |
| Header | Customer logo, business name, real-time clock, date, blinking LIVE indicator |
| Footer | Continuously scrolling ticker with custom messages |
| Layout | Determined by Admin's layout config (see Section 6.5) |
| Offline fallback | If network drops: show last known rates with "Rates as of [time]" label. Never go blank. |
| Plan expiry | If plan expired: overlay shows "Service Expired — Contact your provider" |
| Real-time updates | Supabase Realtime WebSocket — rate changes push instantly without page reload |

### 6.2 Rate Management

**Three rate modes:**

| Mode | How it works |
|---|---|
| Live (API) | Fetch from external Forex API every 15 minutes. Rates auto-update on all TVs. |
| Manual | Admin or Branch User sets rates. Persists until changed. |
| Scheduled | (Future) Set different rates for different time windows (e.g., morning vs evening). |

**Input methods:**
- Inline table editor: edit buy/sell/transfer per currency row
- Excel upload: `.xlsx` file with columns `[Currency Code, Buy, Sell, Transfer]`. Server validates format, rejects unknown currency codes, shows error summary before applying.
- API fetch: connects to configured Forex API source; Admin can choose the API and base currency.

**Currency configuration:**
- Admin selects which currencies are visible on their TV (from the master list of 20+)
- Admin sets display order
- Admin sets decimal precision per currency (0, 2, or 3 decimal places)
- All changes push via Realtime to all branch TVs instantly

**Rate history:**
- Every rate change is logged: who changed it, when, from what value, to what value.
- Admin can view this log filtered by date range and currency.

### 6.3 Ad Management

- Upload images (JPG, PNG, WebP) and videos (MP4, max resolution 1080p).
- Set display duration per item (in seconds).
- Drag-and-drop reorder.
- Enable/disable individual items.
- Storage limit enforced per client (set by subscription plan).
- Files stored in Cloudflare R2 under `clients/{client_id}/ads/`.
- Branch Users can manage ads **for their own branch only**. Branch-level ads take precedence over customer-level ads for that branch (or are merged — Admin configures this).

### 6.4 Branch Management

**Admin view:**
- Create branches (enforced against plan's `max_branches` limit).
- Name and describe branches (e.g., "Dubai Marina Branch").
- Generate a branch TV token for each branch.
- See screen health: which TVs at each branch are online/offline, last-seen timestamp.
- Assign Branch Users to branches.

**Branch User view:**
- See only their assigned branch.
- View their branch's TV connection status.

### 6.5 TV Screen Layout Configuration

Admin picks a layout template from predefined options. Changes apply immediately on the TV (via Realtime).

| Layout | Description |
|---|---|
| `split-standard` | 64% rates / 36% ads — landscape, 16:9 (default, current implementation) |
| `rates-full` | Full screen rates only, no ads panel |
| `ads-full` | Full screen ad display only, no rates (for lobbies/waiting areas) |
| `portrait` | Vertical screen: rates top half, ads bottom half |
| `rates-wide` | 75% rates / 25% narrow ad strip |

Layout is stored per-branch (each branch can have a different layout).

### 6.6 Reports & Logs (Admin)

| Report | Description |
|---|---|
| Rate change log | Every change: who, when, what currency, old value, new value |
| Screen uptime log | Which TVs were connected, for how long, per day |
| Ad impression log | Which ad was shown, for how long (estimated from rotation) |
| Excel import log | History of Excel uploads with success/error summary |
| Storage usage | Current MB used vs plan limit |

### 6.7 Distributor Dashboard

| Feature | Detail |
|---|---|
| Customer list | All customers, plan tier, plan expiry, branch count, storage used, account status |
| Create customer | Name, email, assign plan, generate license key |
| Create admin users | Add additional admin users to a customer account |
| Enable/Disable customer | Instantly toggles access to the entire account |
| Subscription plans | Create, edit, delete plan tiers |
| System usage monitor | Total active TVs, total storage, API call counts |
| License key management | View issued keys, status (used/unused), revoke unused keys |

---

## 7. Data Model (Supabase Postgres)

```sql
-- Subscription plan tiers (managed by distributor)
plans (
  id               uuid primary key,
  name             text,                 -- "Starter", "Pro"
  max_branches     int,
  storage_mb       int,
  allow_live_rates boolean default true,
  allow_excel_import boolean default true,
  allow_layout_config boolean default true,
  duration_days    int,
  price_note       text,                 -- informational only
  created_at       timestamptz default now()
)

-- Forex business customers
customers (
  id               uuid primary key,
  name             text,
  plan_id          uuid references plans,
  plan_expires_at  timestamptz,
  is_active        boolean default true,
  logo_url         text,                 -- R2 URL for customer logo
  primary_color    text,                 -- hex color for branding
  base_currency    text default 'AED',  -- rates are expressed against this
  created_at       timestamptz default now()
)

-- Users: both Admins and Branch Users (role field distinguishes them)
users (
  id               uuid primary key,    -- matches Supabase Auth user id
  customer_id      uuid references customers,
  role             text check (role in ('admin', 'branch_user')),
  full_name        text,
  email            text unique,
  is_active        boolean default true,
  created_at       timestamptz default now()
)

-- Branches within a customer
branches (
  id               uuid primary key,
  customer_id      uuid references customers,
  name             text,
  location_note    text,
  branch_token     text unique,          -- long-lived TV auth token
  layout           text default 'split-standard',
  is_active        boolean default true,
  created_at       timestamptz default now()
)

-- Which branch a branch_user is assigned to (one user → one branch)
branch_user_assignments (
  user_id          uuid references users primary key,
  branch_id        uuid references branches
)

-- TV screen heartbeat (each TV posts every 30s)
screen_sessions (
  id               uuid primary key,
  branch_id        uuid references branches,
  last_seen_at     timestamptz,
  user_agent       text,
  ip_address       text
)

-- Master currency list
currencies (
  id               uuid primary key,
  code             text unique,          -- "INR", "USD"
  name             text,                -- "Indian Rupee"
  flag_path        text,               -- "/flags/in.svg"
  default_decimals int default 2
)

-- Per-customer currency config (which currencies to show, in what order)
customer_currencies (
  id               uuid primary key,
  customer_id      uuid references customers,
  currency_id      uuid references currencies,
  is_enabled       boolean default true,
  display_order    int,
  decimal_places   int,                -- overrides currency default
  constraint unique (customer_id, currency_id)
)

-- Current rates (one row per customer per currency; updated in place)
rates (
  id               uuid primary key,
  customer_id      uuid references customers,
  currency_id      uuid references currencies,
  buy              numeric(14,4),
  sell             numeric(14,4),
  transfer         numeric(14,4),
  mode             text check (mode in ('live', 'manual')),
  updated_at       timestamptz default now(),
  updated_by       uuid references users,
  constraint unique (customer_id, currency_id)
)

-- Append-only rate change history (audit log)
rate_history (
  id               uuid primary key,
  customer_id      uuid references customers,
  currency_id      uuid references currencies,
  buy              numeric(14,4),
  sell             numeric(14,4),
  transfer         numeric(14,4),
  changed_by       uuid references users,
  source           text check (source in ('manual', 'excel', 'api', 'system')),
  changed_at       timestamptz default now()
)

-- Ad media (customer-level; branch-level ads use branch_id)
ads (
  id               uuid primary key,
  customer_id      uuid references customers,
  branch_id        uuid references branches,  -- null = applies to all branches
  file_url         text,
  file_type        text check (file_type in ('image', 'video')),
  duration_seconds int,
  display_order    int,
  is_active        boolean default true,
  file_size_bytes  bigint,
  created_at       timestamptz default now()
)

-- Ticker footer messages
ticker_messages (
  id               uuid primary key,
  customer_id      uuid references customers,
  branch_id        uuid references branches,  -- null = all branches
  message          text,
  display_order    int,
  is_active        boolean default true
)

-- License keys (one-time registration keys)
license_keys (
  id               uuid primary key,
  customer_id      uuid references customers,
  key_hash         text unique,
  issued_at        timestamptz default now(),
  expires_at       timestamptz,           -- key itself can expire if unused
  redeemed_at      timestamptz,           -- null until used
  redeemed_by      uuid references users
)

-- Excel import log
excel_imports (
  id               uuid primary key,
  customer_id      uuid references customers,
  imported_by      uuid references users,
  branch_id        uuid references branches,  -- null if admin-level
  rows_total       int,
  rows_success     int,
  rows_failed      int,
  error_summary    jsonb,              -- [{row, currency_code, error}]
  imported_at      timestamptz default now()
)
```

---

## 8. Route & Page Structure

```
-- Public / Auth
/                          Login — enter license key (first time) or email/password
/auth/callback             Supabase Auth OAuth callback

-- TV Display
/live                      Branch TV dashboard (auth via ?token=branch_token)

-- Admin Panel (Customer)
/admin                     → redirects to /admin/rates
/admin/rates               Rate management: mode toggle, table editor, Excel upload
/admin/currencies          Enable/disable/order currencies shown on TV
/admin/ads                 Ad library: upload, order, enable/disable
/admin/branches            Branch list: create, manage, view screen status, generate TV token
/admin/branches/[id]       Individual branch: assign users, layout, branch ads, screen status
/admin/users               Manage branch users (create, assign, deactivate)
/admin/ticker              Ticker message management
/admin/reports             Reports hub
/admin/reports/rates       Rate change audit log
/admin/reports/screens     Screen uptime log
/admin/reports/storage     Storage usage
/admin/plan                Plan info and expiry

-- Distributor Panel
/distributor               Distributor login (separate auth, 2FA recommended)
/distributor/customers     Customer list with status and usage
/distributor/customers/new Create customer + generate license key
/distributor/customers/[id] Edit customer, enable/disable, view branches
/distributor/plans         Manage subscription plan tiers
/distributor/keys          All license keys: issued, used, revoked
/distributor/usage         System-wide usage monitor

-- API Routes
/api/auth/redeem-key       POST — redeem license key, create user session
/api/rates                 GET (TV) / POST (admin) rates for a customer
/api/rates/excel           POST — parse and apply Excel rate file
/api/rates/fetch-live      POST — trigger manual live API fetch
/api/currencies            GET/PATCH — customer currency config
/api/ads/upload-url        GET — generate R2 presigned PUT URL
/api/ads                   GET / POST / DELETE / PATCH
/api/ticker                GET / POST / DELETE / PATCH
/api/branches              GET / POST / PATCH / DELETE
/api/branches/heartbeat    POST — TV posts every 30 s to register presence
/api/branches/token        POST — generate/regenerate branch TV token
/api/users                 GET / POST / PATCH / DELETE (branch users)
/api/reports/rates         GET — filtered rate history
/api/reports/screens       GET — screen session log
/api/distributor/customers GET / POST / PATCH
/api/distributor/plans     GET / POST / PATCH / DELETE
/api/distributor/keys      GET / POST / DELETE
```

---

## 9. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 16 (App Router) | Full-stack: UI + API in one deployment |
| Language | TypeScript | Already in place; enforces correctness |
| Styling | Tailwind CSS + inline styles | Admin UI → Tailwind; TV dashboard → inline (pixel-precise) |
| Database | Supabase (PostgreSQL) | Managed, free tier, built-in Auth + Realtime + RLS |
| Auth | Supabase Auth | JWT sessions, magic links, RLS integration |
| Real-time | Supabase Realtime | Push rate changes + layout changes to TVs via WebSocket |
| Media Storage | Cloudflare R2 | 10 GB free, zero egress fees — critical for video-heavy TVs |
| App Hosting | KVM2 VPS | Runs Next.js via PM2 + Nginx. ~150–200 MB RAM. |
| Forex Data | ExchangeRate-API or Fixer.io | Live mode rate source |
| Excel Parsing | `xlsx` (SheetJS) | Parse `.xlsx` files server-side in API route |

---

## 10. Media Handling (Cloudflare R2)

**Upload flow:**
1. Admin/Branch User selects a file.
2. Frontend → `/api/ads/upload-url` with `filename`, `file_size`, `customer_id`.
3. Server checks: `current_storage_used + file_size ≤ plan.storage_mb`. Reject if over.
4. Server returns a presigned R2 PUT URL (5-minute expiry).
5. Frontend uploads directly to R2 (no server bandwidth used).
6. Frontend → `/api/ads` POST to record metadata in Supabase.

**R2 file structure:**
```
clients/
  {customer_id}/
    logo.png
    ads/
      {branch_id or "global"}/
        {uuid}.mp4
        {uuid}.jpg
```

**Serving:** R2 bucket public subdomain → TVs pull files directly. Zero egress cost.

---

## 11. Excel Rate Import Format

Expected `.xlsx` structure (validated server-side):

| Column A | Column B | Column C | Column D |
|---|---|---|---|
| Currency Code | Buy | Sell | Transfer |
| INR | 22.50 | 22.80 | 22.60 |
| PKR | 0.130 | 0.135 | 0.132 |

**Validation rules:**
- Row 1 is a header (skipped).
- Currency code must match a code in the master `currencies` table.
- Buy/Sell/Transfer must be positive numbers.
- Unknown currency codes → logged as errors, skipped (rest still imports).
- Import result shown as: "18 rows imported, 2 failed" with error detail per row.
- Rate history records each imported row with `source = 'excel'`.

---

## 12. Infrastructure

### Architecture

```
KVM2 VPS
└── Next.js app (PM2 + Nginx)
    ├── Port 3000 → proxied to 443 by Nginx
    ├── RAM: ~150–200 MB
    └── Cron: rate fetch job every 15 min (node-cron or VPS crontab)

Supabase Cloud (free tier)
├── PostgreSQL — all app data
├── Auth — user sessions + JWT verification
├── Realtime — WebSocket channels per customer (rate/layout pushes to TVs)
└── Row Level Security — enforces data isolation between customers

Cloudflare R2 (free tier)
└── Ad images and videos (served directly to TV browsers)
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=forex-ads
R2_PUBLIC_URL=

JWT_SECRET=                   # for signing license keys
DISTRIBUTOR_SECRET=           # password/token for distributor panel access
FOREX_API_KEY=
FOREX_API_URL=
```

---

## 13. Scalability Thresholds (Free Tier)

| Resource | Free Limit | @ 10 clients × 15 branches | Action |
|---|---|---|---|
| Supabase DB | 500 MB | ~100 MB | Fine |
| Supabase Realtime connections | 200 | 150 TVs | At limit — use 1 channel per customer, not per TV |
| Supabase API calls | 50K/month | Near zero if using Realtime subscriptions | Fine |
| R2 Storage | 10 GB | ~5 GB (500 MB × 10) | Fine |
| R2 read ops | 10M/month | Monitor video-heavy setups | Fine initially |
| KVM2 RAM | 4–8 GB | 200 MB | Plenty |

**Realtime architecture note:** Subscribe all TVs of one customer to a single Supabase channel: `customer:{customer_id}`. Broadcast rate changes + layout changes to that channel. This caps Realtime connections at number of *customers* (10), not *TVs* (150) — keeps you well within the free limit.

---

## 14. Gaps & Decisions Needed Before Building

These are things **not yet decided** that will affect implementation. Resolve these first.

### Critical

| # | Gap | Why It Matters |
|---|---|---|
| 1 | **Branch-level rate overrides** | Can a Branch User set different rates than the customer-wide rates? Or are branch rates always inherited from Admin? If yes → `rates` table needs a `branch_id` field and merge logic. |
| 2 | **Rate reset schedule** | Do manual rates reset at midnight? At a configured opening time? Or only when Admin manually changes them? Needs a setting per customer. |
| 3 | **Base currency** | What currency are all rates expressed against? (AED? USD?) This must be per-customer configurable and displayed on the TV. |
| 4 | **Branch ad priority** | When both customer-level and branch-level ads exist: do branch ads replace, prepend, or append to customer ads? |

### Important

| # | Gap | Why It Matters |
|---|---|---|
| 5 | **Offline fallback** | If the TV's internet drops, show last-known rates from `localStorage` with a "Rates as of [time]" indicator. Without this, the TV goes blank during any network hiccup. |
| 6 | **Notifications / Alerts** | Plan expiry warning emails (7d, 3d, 1d before). Admin email when a TV goes offline for >5 min. Storage usage warning at 80%. Need to decide: build in-app or use Supabase + external email (Resend/SendGrid). |
| 7 | **Distributor 2FA** | Distributor controls all customer data. A compromised distributor account exposes everything. At minimum, use a strong separate password + consider TOTP 2FA. |
| 8 | **Excel column format agreement** | Lock in the exact Excel format before building the importer. Changing it later breaks existing client files. |
| 9 | **Rate approval workflow** | When Branch User changes rates: does it go live immediately, or does Admin need to approve? Immediate is simpler; approval adds an `approved_by` and `status` field to `rates`. |

### Nice to Have

| # | Feature | Notes |
|---|---|---|
| 10 | **Scheduled rate windows** | Different rates for morning vs evening (e.g., 08:00–13:00 and 13:00–22:00). Adds a `rate_schedules` table. |
| 11 | **Screen health alerts** | Visual dashboard in Admin showing each TV as a green/red dot (online/offline). Already partially covered by `screen_sessions` heartbeat. |
| 12 | **Branding per customer** | Customer logo + primary color already in the schema. Dashboard should use these instead of the default "Nova Currency" name/color. |
| 13 | **Multi-language ticker** | Some customers may want Arabic/Urdu ticker text. Ensure the font stack includes Arabic-supporting fonts. |
| 14 | **Rate change push confirmation** | After Admin saves rates, show "Pushed to X TVs" confirmation so they know the change is live. |

---

## 15. Build Order

Build in this sequence — each step is deployable and testable before moving to the next.

| Phase | What to Build |
|---|---|
| 1 | Supabase schema + RLS policies for all tables |
| 2 | Distributor panel: plans, create customer, generate license key |
| 3 | Auth flow: license key redemption → create admin user session |
| 4 | TV dashboard: connect `/live` to Supabase (rates, ads, ticker, layout) |
| 5 | Supabase Realtime: subscribe TV to `customer:{id}` channel; push on rate change |
| 6 | Admin: currency config (which currencies, order, decimals) |
| 7 | Admin: manual rate editor + mode toggle |
| 8 | Admin: Excel rate upload (SheetJS parser + validation + rate_history logging) |
| 9 | Admin: ad management (R2 presigned upload + carousel config) |
| 10 | Admin: branch management (create branches, generate TV tokens, layout config) |
| 11 | Admin: branch user management (create, assign, deactivate) |
| 12 | Branch User: scoped rate edit + Excel upload + ad management |
| 13 | Admin: reports (rate history log, screen uptime, storage usage) |
| 14 | Offline fallback on TV (localStorage cache of last-known rates) |
| 15 | Plan expiry enforcement (guard all routes; TV overlay; email warnings) |
| 16 | Distributor: system usage monitor, enable/disable customers |

---

## 16. Current State of the Codebase

`/live` page is a fully functional **static mockup** — all data is hardcoded:
- 20 currencies with placeholder rates
- 3 promotional slides (hardcoded images/text)
- 4 ticker messages
- Real-time clock works
- All animations, layout, and TV sizing are production-ready

Everything else (auth, Supabase, admin panel, distributor panel, API routes, R2 integration, Realtime) is to be built from scratch.
