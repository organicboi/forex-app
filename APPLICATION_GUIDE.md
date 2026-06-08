# Forex Live App — Application Guide

How each role uses the system, from first login to live TV display.

---

## Roles at a Glance

| Role | Who | How They Log In | What They Can Do |
|---|---|---|---|
| **Distributor** | Platform operator (you) | Separate secret / service key | Manage clients, plans, license keys |
| **Admin** | Forex business owner/manager | Email + password (after license key redemption) | Run their business: rates, branches, ads, users |
| **Branch User** | Counter staff at a branch | Email + password (created by Admin) | Edit rates / ads scoped to their one branch |
| **TV Screen** | Browser on a TV | Branch token in the URL (`?token=…`) | Read-only live display — no interaction |

---

## Role 1 — Distributor

The distributor is you (the platform operator). You onboard forex businesses, assign them a plan, and hand them their login credentials. You never touch their day-to-day data.

### First-time setup

1. Open the Supabase SQL editor and run `DB/schema.sql` — this creates all tables, triggers, RLS policies, and seeds the 20 currencies + 3 plan tiers.
2. Access the distributor panel (`/distributor`) using `DISTRIBUTOR_SECRET` from your `.env`.

### Onboarding a new client (forex business)

```
Distributor panel → Customers → New Customer
```

Fill in:
- **Business name** — e.g. "Nova Currency Exchange"
- **Contact email** — the admin's email address
- **Plan** — Starter / Pro / Enterprise
- **Primary colour** — hex code for their brand colour (shown on TV header)
- **Base currency** — what all exchange rates are quoted against (usually AED)

On save, the system:
1. Creates a row in `customers`
2. Creates a one-time **license key** (a random string; its SHA-256 hash is stored in `license_keys`)
3. Shows you the plaintext key — copy it and send to the client

> The plaintext key is shown once and never stored. Treat it like a password.

### What the distributor can see

| View | What it shows |
|---|---|
| `/distributor/customers` | All clients: plan, expiry date, branch count, storage used, active/inactive |
| `/distributor/plans` | Plan tiers — edit limits, price notes |
| `/distributor/keys` | All license keys — issued, redeemed, revoked |
| `/distributor/usage` | System-wide: total active TVs, storage across all clients |

### Enabling / Disabling a client

Toggle `customers.is_active = false`. Immediately:
- All admin panel routes for that client return "Account suspended"
- All branch TVs show "Service unavailable"
- Data is not deleted — re-enabling restores everything

### Plan expiry

When `customers.plan_expires_at < now()`:
- Admin panel becomes read-only
- All branch TVs show "Subscription expired — contact your provider"
- Distributor renews by extending `plan_expires_at`

---

## Role 2 — Admin (Customer)

The forex business owner or manager. There can be multiple Admin users per customer account. After the distributor sends the license key, the Admin follows this one-time setup, then manages day-to-day operations.

### First login (license key redemption)

```
/  →  "I have a license key"  →  enter key  →  set email + password  →  logged in
```

Behind the scenes:
1. Server hashes the entered key and looks it up in `license_keys`
2. Validates: not revoked, not expired, not already redeemed
3. Creates a Supabase Auth user with `raw_user_meta_data: { customer_id, role: "admin" }`
4. The `handle_new_auth_user` trigger creates a row in `public.users`
5. Key is marked `redeemed_at = now()`
6. Admin is redirected to `/admin/rates`

### Subsequent logins

```
/  →  email + password  →  /admin/rates
```

---

### Setting up currencies

```
/admin/currencies
```

The master list of 20 currencies is already in the system. The Admin:
1. Enables the currencies they want shown on TV (toggle each on/off)
2. Drags rows to set the display order (shown top-to-bottom on TV)
3. Optionally overrides decimal places per currency (e.g., IDR shows 0 decimals)

Changes take effect on the TV immediately on next data poll (within 30 s).

### Setting rates

```
/admin/rates
```

Three modes:

**Manual mode (default)**
- Inline table: click any cell, type the new rate, press Enter or click Save
- Rates persist until changed
- Every change is logged to `rate_history` (currency, old value, new value, who, when)

**Excel import**
- Click "Import from Excel"
- Upload a `.xlsx` file with columns: `Currency Code | Buy | Sell | Transfer`
- Server validates: rejects unknown currency codes, flags invalid numbers
- Preview screen shows "18 rows OK / 2 failed" before committing
- Approve → rates update, import logged to `excel_imports`

**Live API mode**
- Toggle "Live Mode" on
- System fetches from external Forex API every 15 minutes
- Rates auto-update on all TVs — Admin does not touch them
- Admin can still override individual currencies back to manual if needed

### Managing branches

```
/admin/branches
```

**Creating a branch:**
1. Click "New Branch"
2. Enter name (e.g., "City Centre"), optional location note
3. Choose layout template (see TV layouts below)
4. Choose whether branch staff can override rates (`allow_user_rate_edit`)
5. Save — system generates a `branch_token` automatically

**Branch token → TV URL:**
```
https://yourapp.com/live?token=<branch_token>
```
Open this URL on the TV browser. That's it.

**Regenerating a token:**
If a TV token is compromised, click "Regenerate Token". The old token stops working immediately. Update the URL on the TV.

**Screen health:**
Each branch card shows a green/red dot per connected TV screen:
- Green = screen posted a heartbeat within the last 90 seconds
- Red = no heartbeat — TV is offline or connection dropped

### Managing branch users

```
/admin/users  →  New User
```

1. Enter their name, email, set a temporary password
2. Assign them to a branch
3. Save — system creates a Supabase Auth user + `branch_user_assignments` row
4. Send the staff member their email and password

Branch users can only see and affect their assigned branch. RLS in the database enforces this.

### Managing ads

```
/admin/ads
```

**Customer-wide ads** (shown on all branches):
1. Click "Upload" → select image (JPG/PNG/WebP) or video (MP4)
2. Server checks: `current_storage + file_size ≤ plan.storage_mb` — rejects if over limit
3. Server returns a pre-signed Cloudflare R2 upload URL
4. File uploads directly to R2 from the browser (no server bandwidth used)
5. Metadata saved to `ads` table (`branch_id = null` = all branches)
6. Set duration (how many seconds it shows), drag to reorder, toggle active/inactive

**Branch-specific ads:**
Go to `/admin/branches/[id]` → Ads tab. Same upload flow but `branch_id` is set. These ads only appear on that branch's TV.

**How branch and customer-wide ads mix** is set per customer (`branch_ad_mode`):
- `append` — branch ads shown after customer-wide ads (default)
- `prepend` — branch ads shown before customer-wide ads
- `replace` — branch ads replace customer-wide ads entirely for that branch

### Managing ticker messages

```
/admin/ticker
```

Add, edit, order, and enable/disable the scrolling messages at the bottom of the TV. Can be customer-wide or branch-specific (same as ads).

### Viewing reports

```
/admin/reports
```

| Report | What it shows |
|---|---|
| Rate history | Every rate change: currency, old/new value, who changed it, when, source (manual/excel/api) |
| Screen uptime | Which TVs were online/offline and for how long, per branch |
| Excel import log | History of every Excel upload with row-level success/error detail |
| Storage usage | MB used vs plan limit, per ad file |

### TV layout options

Set per branch under `/admin/branches/[id]` → Layout.

| Layout | Description |
|---|---|
| `split-standard` | 64% rates / 36% ads — landscape 16:9 **(default)** |
| `rates-full` | Full screen rates only — no ads panel |
| `ads-full` | Full screen ads only — for lobby/waiting area screens |
| `portrait` | Vertical screen: rates on top half, ads on bottom |
| `rates-wide` | 75% rates / 25% narrow ad strip |

---

## Role 3 — Branch User

A staff member at a specific branch. Created by the Admin and assigned to one branch. Their scope is strictly limited — they cannot see other branches or other customers.

### Login

```
/  →  email + password  →  /branch/rates
```

Same login page as Admin, different redirect based on `role` from `public.users`.

### What they see

The branch user panel is a stripped-down version of the admin panel, scoped to their branch only:

```
/branch/rates          View and edit rates for their branch
/branch/ads            Manage ads for their branch (if enabled)
/branch/screen         See which TVs at their branch are online/offline
```

### Editing rates (if allowed)

Controlled by `branches.allow_user_rate_edit`. If `true`:

```
/branch/rates  →  click a cell  →  type new value  →  Save
```

This writes to `branch_rate_overrides`, not `rates`. The TV for this branch will show the override value. Other branches are not affected. The override is logged to `rate_history` with `branch_id` set.

If `allow_user_rate_edit = false`, the rates table is read-only for this user.

### Uploading rates via Excel

Same format as Admin Excel upload, but writes to `branch_rate_overrides` for their branch only.

### Managing branch ads

If the Admin has given permission, the Branch User can upload, order, and toggle ads specifically for their branch. The `ads.branch_id` is set to their branch — other branches are not affected.

---

## Role 4 — TV Screen

The TV screen is not a user — it's a browser tab. It authenticates via a URL token and shows read-only data. No one interacts with it; it runs autonomously.

### Setup (one-time)

1. Open the TV's browser (Chrome/Chromium recommended)
2. Navigate to:
   ```
   https://yourapp.com/live?token=<branch_token>
   ```
3. Set the browser to fullscreen (`F11` on most systems)
4. Done — the screen runs indefinitely

> Tip: Set the OS to auto-launch the browser on boot and disable sleep/screensaver.

### What the TV does automatically

Every **30 seconds**, the TV:
- Sends a heartbeat POST to `/api/tv/heartbeat` with its `session_key` (a stable ID stored in `localStorage`)
- Fetches fresh data from `/api/tv/data` — rates, ads, ticker, customer branding

On the API side, the server:
1. Validates the `branch_token` against `branches.branch_token`
2. Checks `customers.is_active = true` and `plan_expires_at > now()`
3. Calls the `get_tv_data(branch_id)` database function which returns all display data in one query
4. The function merges: customer-wide rates + any branch override rates, customer-wide ads + branch ads, customer-wide ticker + branch ticker

### What's shown on screen

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] NOVA CURRENCY           LIVE EXCHANGE RATES   BRANCH  17:42  │
│                                                        CITY CENTRE  Sun 8 Jun 2025 │
├──────────────────────────────────────┬──────────────────────────┤
│  BASE AED          PAGE 01 / 02      │                          │
│  ─────────────────────────────────── │                          │
│  CURRENCY           BUY   SELL  TRSF │                          │
│  ════════════════════════════════════│      Ad / Image          │
│  🇮🇳 INR  Indian Rupee  0.040  0.048 │      (rotating)          │
│  🇵🇰 PKR  Pakistani Rupee 0.016 0.016│                          │
│  🇧🇩 BDT  Bangladeshi Taka 0.026 ...│                          │
│  ... (10 rows, rotates to page 2)   │                          │
│                                      │──────────────────────────│
│                                      │  NOVA CURRENCY   01 / 03 │
├──────────────────────────────────────┴──────────────────────────┤
│  Rates updated every 15 minutes  /  Open daily 8AM–10PM  /  ...  │
└─────────────────────────────────────────────────────────────────┘
```

**Header** — Customer brand colour, logo, business name, branch name, live clock/date  
**Left panel** — Rate table, paginated 10 rows at a time, auto-rotates every 8 s with progress bar  
**Right panel** — Ad carousel, each ad shows for its configured `duration_seconds`  
**Footer** — Scrolling ticker with customer messages

### Error states

| What the TV shows | Why |
|---|---|
| "Screen not configured" | URL has no `?token=` |
| "Invalid token" | Token not found or branch is inactive |
| "Subscription expired" | `plan_expires_at` has passed — admin must renew |
| "Loading…" | First load, waiting for first data response |
| *(stale data from last fetch)* | Network dropped mid-session — last known data stays visible |

---

## End-to-End Flow Summary

```
DISTRIBUTOR
    │
    ├─ Creates plan tiers (Starter / Pro / Enterprise)
    ├─ Creates customer account → generates license key
    └─ Sends license key to Admin

ADMIN (first time)
    │
    ├─ Redeems license key → sets email/password → logs in
    ├─ Enables currencies + sets display order
    ├─ Sets rates (manual or live API)
    ├─ Creates branches → gets branch_token per branch
    ├─ Uploads ads + writes ticker messages
    └─ Creates Branch User accounts + assigns to branches

BRANCH USER
    │
    ├─ Logs in with email/password
    └─ (If allowed) edits rates → writes to branch_rate_overrides

TV SCREEN
    │
    ├─ Browser opens /live?token=<branch_token>
    ├─ Every 30 s: fetches data from /api/tv/data
    │       └─ Server runs get_tv_data(branch_id):
    │               ├─ Customer rates + branch overrides merged
    │               ├─ Customer ads + branch ads merged (per branch_ad_mode)
    │               └─ Customer ticker + branch ticker merged
    ├─ Every 30 s: posts heartbeat to /api/tv/heartbeat
    └─ Displays: rate table → ad carousel → ticker footer

ADMIN (ongoing)
    │
    ├─ Changes a rate → TV picks it up within 30 s (polling)
    ├─ Uploads a new ad → TV includes it in next data fetch
    ├─ Views /admin/branches → sees green dots for online TVs
    └─ Views /admin/reports → rate history, screen uptime
```

---

## Key Rules to Remember

**One license key = one Admin account.** The key is single-use. A second Admin for the same customer is created by the first Admin from within their panel.

**Branch tokens are permanent** until explicitly regenerated. Store them securely.

**`branch_rate_overrides` takes priority** over `rates` for a branch's TV. If no override exists for a currency, the customer-wide rate is shown. Deleting an override reverts the TV to the customer-wide rate.

**Ads with `branch_id = null`** are customer-wide and show on every branch. Ads with a `branch_id` show only on that branch's TV.

**The TV never requires auth.** It only needs the branch token in the URL. Anyone with the URL can view the display — this is intentional (it's a public-facing screen).

**Plan limits are hard-enforced at the database level** (via trigger `enforce_branch_limit`). Creating a 6th branch on a 5-branch plan raises a database error, regardless of what the UI shows.

**RLS is currently disabled** (development mode). Before going to production, run the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` block at the bottom of `schema.sql`. All RLS policies are already defined and ready.
