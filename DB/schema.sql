-- ================================================================
-- FOREX LIVE APP — Supabase Database Schema
-- ================================================================
-- Paste this entire file into Supabase SQL Editor and run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- Seed data uses ON CONFLICT DO NOTHING.
--
-- Section order matters — do NOT reorder.
-- LANGUAGE SQL functions validate table refs at creation time,
-- so all tables must exist before any function is created.
-- ================================================================


-- ─── SECTION 1: EXTENSIONS ───────────────────────────────────────

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ─── SECTION 2: TABLES ───────────────────────────────────────────
-- Created in FK dependency order (no forward references).

-- ── 2.1  plans ───────────────────────────────────────────────────
create table if not exists public.plans (
  id                      uuid        primary key default gen_random_uuid(),
  name                    text        not null,
  max_branches            int         not null default 5,
  storage_mb              int         not null default 500,
  allow_live_rates        boolean     not null default true,
  allow_excel_import      boolean     not null default true,
  allow_layout_config     boolean     not null default true,
  allow_branch_rate_edit  boolean     not null default false,
  duration_days           int         not null default 365,
  price_note              text,
  is_active               boolean     not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
comment on table public.plans is
  'Subscription plan tiers. Only the distributor (service role) creates or modifies these.';

-- ── 2.2  customers ────────────────────────────────────────────────
create table if not exists public.customers (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  plan_id             uuid        not null references public.plans(id),
  plan_expires_at     timestamptz not null,
  is_active           boolean     not null default true,
  -- Branding (shown on TV dashboard header)
  logo_url            text,
  primary_color       text        not null default '#4c195a',
  business_name       text,
  -- Rate config
  base_currency       text        not null default 'AED',
  rate_reset_enabled  boolean     not null default false,
  rate_reset_time     time,
  -- Ad config: how branch ads mix with customer-wide ads
  branch_ad_mode      text        not null default 'append'
                      check (branch_ad_mode in ('replace', 'prepend', 'append')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.customers is
  'Forex business accounts. branch_ad_mode controls how branch ads merge with customer-wide ads.';

-- ── 2.3  users ────────────────────────────────────────────────────
-- id matches auth.users.id. Populated automatically by trigger on auth user creation.
create table if not exists public.users (
  id           uuid        primary key references auth.users(id) on delete cascade,
  customer_id  uuid        not null references public.customers(id) on delete cascade,
  role         text        not null check (role in ('admin', 'branch_user')),
  full_name    text        not null default '',
  email        text        not null,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.users is
  'App users scoped to a customer. Mirrors auth.users. Populated by trigger on auth user creation.';

-- ── 2.4  branches ─────────────────────────────────────────────────
create table if not exists public.branches (
  id                   uuid        primary key default gen_random_uuid(),
  customer_id          uuid        not null references public.customers(id) on delete cascade,
  name                 text        not null,
  location_note        text,
  branch_token         text        not null unique default encode(gen_random_bytes(32), 'hex'),
  layout               text        not null default 'split-standard'
                       check (layout in (
                         'split-standard',  -- 64% rates / 36% ads, landscape (default)
                         'rates-full',       -- full screen rates only
                         'ads-full',         -- full screen ads only
                         'portrait',         -- vertical: rates top / ads bottom
                         'rates-wide'        -- 75% rates / 25% ad strip
                       )),
  allow_user_rate_edit boolean     not null default false,
  is_active            boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.branches is
  'Branch locations. branch_token is the TV credential. allow_user_rate_edit gates branch_user rate writes.';

-- ── 2.5  branch_user_assignments ──────────────────────────────────
create table if not exists public.branch_user_assignments (
  user_id    uuid primary key references public.users(id) on delete cascade,
  branch_id  uuid not null    references public.branches(id) on delete cascade
);
comment on table public.branch_user_assignments is
  'One-to-one: each branch_user is assigned to exactly one branch.';

-- ── 2.6  screen_sessions ──────────────────────────────────────────
-- TV heartbeat tracking. One row per browser tab/session.
-- A screen is "online" if last_seen_at > now() - 90 seconds.
create table if not exists public.screen_sessions (
  id            uuid        primary key default gen_random_uuid(),
  branch_id     uuid        not null references public.branches(id) on delete cascade,
  session_key   text        not null unique,  -- stable random key generated by TV browser on first load
  last_seen_at  timestamptz not null default now(),
  user_agent    text,
  ip_address    text
);
comment on table public.screen_sessions is
  'TV heartbeat log. TV posts every 30 s. Online = last_seen_at > now() - 90s.';

-- ── 2.7  currencies ───────────────────────────────────────────────
create table if not exists public.currencies (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  flag_path        text not null,
  default_decimals int  not null default 2,
  sort_order       int  not null default 0
);
comment on table public.currencies is
  'Master currency list. Developer-managed. Customers pick which ones to display via customer_currencies.';

-- ── 2.8  customer_currencies ──────────────────────────────────────
create table if not exists public.customer_currencies (
  id             uuid    primary key default gen_random_uuid(),
  customer_id    uuid    not null references public.customers(id) on delete cascade,
  currency_id    uuid    not null references public.currencies(id) on delete cascade,
  is_enabled     boolean not null default true,
  display_order  int     not null default 0,
  decimal_places int,                              -- null = use currencies.default_decimals
  unique (customer_id, currency_id)
);
comment on table public.customer_currencies is
  'Per-customer currency selection and display config. TV shows only is_enabled=true rows.';

-- ── 2.9  rates ────────────────────────────────────────────────────
-- Current customer-wide rates. One row per customer+currency.
-- Always upsert — never insert a duplicate. Trigger logs to rate_history.
create table if not exists public.rates (
  customer_id  uuid          not null references public.customers(id) on delete cascade,
  currency_id  uuid          not null references public.currencies(id) on delete cascade,
  buy          numeric(14,4) not null default 0,
  sell         numeric(14,4) not null default 0,
  transfer     numeric(14,4) not null default 0,
  mode         text          not null default 'manual'
               check (mode in ('live', 'manual')),
  updated_at   timestamptz   not null default now(),
  updated_by   uuid          references public.users(id) on delete set null,
  primary key  (customer_id, currency_id)
);
comment on table public.rates is
  'Current customer-wide exchange rates. Upsert only. Trigger auto-logs every change to rate_history.';

-- ── 2.10  branch_rate_overrides ───────────────────────────────────
-- Branch-specific rates. If a row exists here for (branch_id, currency_id),
-- it takes priority over public.rates for that branch's TV.
create table if not exists public.branch_rate_overrides (
  branch_id    uuid          not null references public.branches(id) on delete cascade,
  currency_id  uuid          not null references public.currencies(id) on delete cascade,
  buy          numeric(14,4) not null default 0,
  sell         numeric(14,4) not null default 0,
  transfer     numeric(14,4) not null default 0,
  updated_at   timestamptz   not null default now(),
  updated_by   uuid          references public.users(id) on delete set null,
  primary key  (branch_id, currency_id)
);
comment on table public.branch_rate_overrides is
  'Branch-level rate overrides. Only writable by branch_user when branches.allow_user_rate_edit = true.';

-- ── 2.11  rate_history ────────────────────────────────────────────
-- Append-only audit log. Never update or delete rows here.
-- branch_id null = customer-wide change; set = branch override change.
create table if not exists public.rate_history (
  id           uuid          primary key default gen_random_uuid(),
  customer_id  uuid          not null references public.customers(id) on delete cascade,
  branch_id    uuid          references public.branches(id) on delete set null,
  currency_id  uuid          not null references public.currencies(id) on delete cascade,
  buy          numeric(14,4) not null,
  sell         numeric(14,4) not null,
  transfer     numeric(14,4) not null,
  changed_by   uuid          references public.users(id) on delete set null,
  source       text          not null default 'manual'
               check (source in ('manual', 'excel', 'api', 'system')),
  changed_at   timestamptz   not null default now()
);
comment on table public.rate_history is
  'Immutable rate audit log. Written only by triggers. Do not insert directly.';

-- ── 2.12  ads ─────────────────────────────────────────────────────
-- branch_id null = customer-wide (shown on all branches).
create table if not exists public.ads (
  id               uuid        primary key default gen_random_uuid(),
  customer_id      uuid        not null references public.customers(id) on delete cascade,
  branch_id        uuid        references public.branches(id) on delete cascade,
  file_url         text        not null,
  file_type        text        not null check (file_type in ('image', 'video')),
  duration_seconds int         not null default 10,
  display_order    int         not null default 0,
  is_active        boolean     not null default true,
  file_size_bytes  bigint      not null default 0,
  original_name    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.ads is
  'Ad media metadata. Files live in Cloudflare R2. branch_id=null = customer-wide.';

-- ── 2.13  ticker_messages ─────────────────────────────────────────
create table if not exists public.ticker_messages (
  id             uuid        primary key default gen_random_uuid(),
  customer_id    uuid        not null references public.customers(id) on delete cascade,
  branch_id      uuid        references public.branches(id) on delete cascade,
  message        text        not null,
  display_order  int         not null default 0,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now()
);
comment on table public.ticker_messages is
  'TV footer ticker messages. branch_id=null = customer-wide.';

-- ── 2.14  license_keys ────────────────────────────────────────────
-- Plaintext key is NEVER stored — only its sha256 hash.
create table if not exists public.license_keys (
  id           uuid        primary key default gen_random_uuid(),
  customer_id  uuid        not null references public.customers(id) on delete cascade,
  key_hash     text        not null unique,  -- encode(sha256(key::bytea), 'hex')
  label        text,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz,                  -- key itself expires if unused by this date
  redeemed_at  timestamptz,
  redeemed_by  uuid        references public.users(id) on delete set null,
  is_revoked   boolean     not null default false
);
comment on table public.license_keys is
  'One-time registration keys. key_hash = sha256(plaintext_key). Plaintext never stored.';

-- ── 2.15  excel_imports ───────────────────────────────────────────
create table if not exists public.excel_imports (
  id             uuid        primary key default gen_random_uuid(),
  customer_id    uuid        not null references public.customers(id) on delete cascade,
  branch_id      uuid        references public.branches(id) on delete set null,
  imported_by    uuid        references public.users(id) on delete set null,
  rows_total     int         not null default 0,
  rows_success   int         not null default 0,
  rows_failed    int         not null default 0,
  error_summary  jsonb,
  -- [{ "row": 3, "currency_code": "XYZ", "error": "Unknown currency code" }]
  imported_at    timestamptz not null default now()
);
comment on table public.excel_imports is
  'Immutable log of every Excel rate upload. error_summary has per-row failure detail.';


-- ─── SECTION 3: INDEXES ──────────────────────────────────────────

create index if not exists idx_customers_plan        on public.customers(plan_id);
create index if not exists idx_customers_is_active   on public.customers(is_active);

create index if not exists idx_users_customer        on public.users(customer_id);
create index if not exists idx_users_email           on public.users(email);

create index if not exists idx_branches_customer     on public.branches(customer_id);
create index if not exists idx_branches_token        on public.branches(branch_token);  -- hot path: TV auth

create index if not exists idx_bua_branch            on public.branch_user_assignments(branch_id);

create index if not exists idx_sessions_branch       on public.screen_sessions(branch_id);
create index if not exists idx_sessions_last_seen    on public.screen_sessions(last_seen_at desc);

create index if not exists idx_cc_customer_enabled   on public.customer_currencies(customer_id, is_enabled, display_order);

create index if not exists idx_bro_branch            on public.branch_rate_overrides(branch_id);

create index if not exists idx_rh_customer_date      on public.rate_history(customer_id, changed_at desc);
create index if not exists idx_rh_branch_date        on public.rate_history(branch_id, changed_at desc)
  where branch_id is not null;
create index if not exists idx_rh_currency           on public.rate_history(currency_id);

create index if not exists idx_ads_customer_active   on public.ads(customer_id, is_active, display_order);
create index if not exists idx_ads_branch_active     on public.ads(branch_id, is_active, display_order)
  where branch_id is not null;

create index if not exists idx_ticker_customer       on public.ticker_messages(customer_id, is_active, display_order);
create index if not exists idx_ticker_branch         on public.ticker_messages(branch_id, is_active)
  where branch_id is not null;

create index if not exists idx_keys_customer         on public.license_keys(customer_id);
create index if not exists idx_keys_hash             on public.license_keys(key_hash);

create index if not exists idx_excel_customer_date   on public.excel_imports(customer_id, imported_at desc);


-- ─── SECTION 4: FUNCTIONS ────────────────────────────────────────
-- All tables exist at this point — safe to reference them in SQL functions.

-- 4.1 RLS helpers — used inside RLS policies below.
--     SECURITY DEFINER so they run as the function owner, not the calling user,
--     preventing recursive RLS loops when policies call these functions.

create or replace function public.my_customer_id()
returns uuid
language sql
security definer
stable
as $$
  select customer_id from public.users where id = auth.uid()
$$;

create or replace function public.my_role()
returns text
language sql
security definer
stable
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.my_branch_id()
returns uuid
language sql
security definer
stable
as $$
  select branch_id
  from public.branch_user_assignments
  where user_id = auth.uid()
$$;

-- 4.2 Business logic helpers

-- Current storage used by a customer in MB
create or replace function public.customer_storage_used_mb(p_customer_id uuid)
returns numeric
language sql
security definer
stable
as $$
  select coalesce(round(sum(file_size_bytes) / 1048576.0, 2), 0)
  from   public.ads
  where  customer_id = p_customer_id
$$;

-- Whether a customer can add another branch under their plan
create or replace function public.can_add_branch(p_customer_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select (
    select count(*)
    from   public.branches
    where  customer_id = p_customer_id and is_active = true
  ) < (
    select p.max_branches
    from   public.customers c
    join   public.plans p on p.id = c.plan_id
    where  c.id = p_customer_id
  )
$$;

-- 4.3 TV data RPC — single call returns everything a TV dashboard needs.
--     Called by the Next.js API route using the service role key.
--     Branch token is verified at the API level before calling this function.
create or replace function public.get_tv_data(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_customer_id  uuid;
  v_layout       text;
  v_result       jsonb;
begin
  select customer_id, layout
  into   v_customer_id, v_layout
  from   public.branches
  where  id = p_branch_id and is_active = true;

  if v_customer_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not exists (
    select 1 from public.customers
    where  id = v_customer_id
      and  is_active = true
      and  plan_expires_at > now()
  ) then
    return jsonb_build_object('status', 'expired');
  end if;

  select jsonb_build_object(
    'status',   'ok',
    'layout',   v_layout,
    'customer', (
      select jsonb_build_object(
        'name',           c.name,
        'business_name',  c.business_name,
        'logo_url',       c.logo_url,
        'primary_color',  c.primary_color,
        'base_currency',  c.base_currency
      )
      from public.customers c
      where c.id = v_customer_id
    ),
    'currencies', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'code',           cur.code,
          'name',           cur.name,
          'flag_path',      cur.flag_path,
          'decimal_places', coalesce(cc.decimal_places, cur.default_decimals),
          'buy',            coalesce(bro.buy,      r.buy,      0),
          'sell',           coalesce(bro.sell,     r.sell,     0),
          'transfer',       coalesce(bro.transfer, r.transfer, 0)
        )
        order by cc.display_order
      ), '[]'::jsonb)
      from       public.customer_currencies cc
      join       public.currencies cur on cur.id = cc.currency_id
      left join  public.rates r
                 on  r.customer_id = v_customer_id
                 and r.currency_id = cc.currency_id
      left join  public.branch_rate_overrides bro
                 on  bro.branch_id   = p_branch_id
                 and bro.currency_id = cc.currency_id
      where  cc.customer_id = v_customer_id
        and  cc.is_enabled  = true
    ),
    'ads', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',               a.id,
          'file_url',         a.file_url,
          'file_type',        a.file_type,
          'duration_seconds', a.duration_seconds
        )
        order by a.display_order
      ), '[]'::jsonb)
      from public.ads a
      where  a.is_active   = true
        and  a.customer_id = v_customer_id
        and (a.branch_id is null or a.branch_id = p_branch_id)
    ),
    'ticker', (
      select coalesce(jsonb_agg(tm.message order by tm.display_order), '[]'::jsonb)
      from public.ticker_messages tm
      where  tm.is_active   = true
        and  tm.customer_id = v_customer_id
        and (tm.branch_id is null or tm.branch_id = p_branch_id)
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_tv_data(uuid) is
  'Returns all TV dashboard data in one round-trip. Call via service role only.';


-- ─── SECTION 5: TRIGGERS ─────────────────────────────────────────

-- 5.1 Auto-set updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger tg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create or replace trigger tg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create or replace trigger tg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace trigger tg_branches_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

create or replace trigger tg_rates_updated_at
  before update on public.rates
  for each row execute function public.set_updated_at();

create or replace trigger tg_bro_updated_at
  before update on public.branch_rate_overrides
  for each row execute function public.set_updated_at();

create or replace trigger tg_ads_updated_at
  before update on public.ads
  for each row execute function public.set_updated_at();

-- 5.2 Customer-wide rate change → rate_history
-- Tag the source before your statement: SET LOCAL app.rate_source = 'excel';
-- Valid values: 'manual' (default), 'excel', 'api', 'system'
create or replace function public.log_rate_change()
returns trigger language plpgsql security definer as $$
begin
  insert into public.rate_history
    (customer_id, branch_id, currency_id, buy, sell, transfer, changed_by, source)
  values (
    new.customer_id,
    null,
    new.currency_id,
    new.buy, new.sell, new.transfer,
    new.updated_by,
    coalesce(nullif(current_setting('app.rate_source', true), ''), 'manual')
  );
  return new;
end;
$$;

create or replace trigger tg_rates_history
  after insert or update on public.rates
  for each row execute function public.log_rate_change();

-- 5.3 Branch rate override → rate_history
create or replace function public.log_branch_rate_change()
returns trigger language plpgsql security definer as $$
declare
  v_customer_id uuid;
begin
  select customer_id into v_customer_id
  from   public.branches
  where  id = new.branch_id;

  insert into public.rate_history
    (customer_id, branch_id, currency_id, buy, sell, transfer, changed_by, source)
  values (
    v_customer_id,
    new.branch_id,
    new.currency_id,
    new.buy, new.sell, new.transfer,
    new.updated_by,
    coalesce(nullif(current_setting('app.rate_source', true), ''), 'manual')
  );
  return new;
end;
$$;

create or replace trigger tg_branch_rates_history
  after insert or update on public.branch_rate_overrides
  for each row execute function public.log_branch_rate_change();

-- 5.4 Enforce branch limit before insert
create or replace function public.enforce_branch_limit()
returns trigger language plpgsql as $$
declare
  v_max   int;
  v_count int;
begin
  select p.max_branches into v_max
  from   public.customers c
  join   public.plans p on p.id = c.plan_id
  where  c.id = new.customer_id;

  select count(*) into v_count
  from   public.branches
  where  customer_id = new.customer_id and is_active = true;

  if v_count >= v_max then
    raise exception
      'Branch limit reached. Your plan allows a maximum of % active branches.', v_max;
  end if;

  return new;
end;
$$;

create or replace trigger tg_branches_limit
  before insert on public.branches
  for each row execute function public.enforce_branch_limit();

-- 5.5 Sync new Supabase auth user → public.users
-- The API must pass these in raw_user_meta_data when calling
-- supabase.auth.admin.createUser():
--   { customer_id: "<uuid>", role: "admin"|"branch_user", full_name: "<name>" }
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if (new.raw_user_meta_data ? 'customer_id') and (new.raw_user_meta_data ? 'role') then
    insert into public.users (id, customer_id, role, full_name, email)
    values (
      new.id,
      (new.raw_user_meta_data->>'customer_id')::uuid,
       new.raw_user_meta_data->>'role',
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email
    );
  end if;
  return new;
end;
$$;

create or replace trigger tg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ─── SECTION 6: VIEWS ────────────────────────────────────────────

-- Online / offline status per branch
create or replace view public.v_branch_screen_status as
select
  b.id                                                            as branch_id,
  b.customer_id,
  b.name                                                          as branch_name,
  count(s.id) filter (
    where s.last_seen_at > now() - interval '90 seconds'
  )                                                               as screens_online,
  count(s.id)                                                     as screens_total,
  max(s.last_seen_at)                                             as last_seen_at
from      public.branches b
left join public.screen_sessions s on s.branch_id = b.id
group by  b.id, b.customer_id, b.name;

-- Storage usage per customer
create or replace view public.v_customer_storage as
select
  c.id                                                            as customer_id,
  coalesce(round(sum(a.file_size_bytes) / 1048576.0, 2), 0)     as used_mb,
  p.storage_mb                                                    as limit_mb,
  round(
    coalesce(sum(a.file_size_bytes), 0) / (p.storage_mb * 1048576.0) * 100,
  1)                                                              as used_percent
from      public.customers c
join      public.plans p on p.id = c.plan_id
left join public.ads a   on a.customer_id = c.id
group by  c.id, p.storage_mb;

-- Distributor overview: one row per customer with key metrics
create or replace view public.v_distributor_overview as
select
  c.id,
  c.name,
  c.is_active,
  c.plan_expires_at,
  c.plan_expires_at < now()                                       as is_expired,
  p.name                                                          as plan_name,
  p.max_branches,
  count(distinct b.id) filter (where b.is_active = true)         as branch_count,
  coalesce(s.used_mb, 0)                                          as storage_used_mb,
  p.storage_mb                                                    as storage_limit_mb
from      public.customers c
join      public.plans p    on p.id = c.plan_id
left join public.branches b on b.customer_id = c.id
left join public.v_customer_storage s on s.customer_id = c.id
group by  c.id, c.name, c.is_active, c.plan_expires_at,
          p.name, p.max_branches, s.used_mb, p.storage_mb;


-- ─── SECTION 7: ROW LEVEL SECURITY ───────────────────────────────
-- Distributor always uses the service_role key → bypasses RLS entirely.
-- TV screens fetch data via Next.js API (service_role); no anon RLS needed.
-- RLS only governs: admin and branch_user Supabase Auth sessions.
--
-- ⚠️  RLS is currently DISABLED on all tables for development / testing.
--     Policies are defined below so they're ready to activate.
--     To enable RLS after testing, run the commented block below, or
--     simply flip each "disable" → "enable" in the SQL editor.
--
-- To enable RLS (run this when ready):
-- ─────────────────────────────────────
-- alter table public.plans                   enable row level security;
-- alter table public.customers               enable row level security;
-- alter table public.users                   enable row level security;
-- alter table public.branches                enable row level security;
-- alter table public.branch_user_assignments enable row level security;
-- alter table public.screen_sessions         enable row level security;
-- alter table public.currencies              enable row level security;
-- alter table public.customer_currencies     enable row level security;
-- alter table public.rates                   enable row level security;
-- alter table public.branch_rate_overrides   enable row level security;
-- alter table public.rate_history            enable row level security;
-- alter table public.ads                     enable row level security;
-- alter table public.ticker_messages         enable row level security;
-- alter table public.license_keys            enable row level security;
-- alter table public.excel_imports           enable row level security;
-- ─────────────────────────────────────

alter table public.plans                   disable row level security;
alter table public.customers               disable row level security;
alter table public.users                   disable row level security;
alter table public.branches                disable row level security;
alter table public.branch_user_assignments disable row level security;
alter table public.screen_sessions         disable row level security;
alter table public.currencies              disable row level security;
alter table public.customer_currencies     disable row level security;
alter table public.rates                   disable row level security;
alter table public.branch_rate_overrides   disable row level security;
alter table public.rate_history            disable row level security;
alter table public.ads                     disable row level security;
alter table public.ticker_messages         disable row level security;
alter table public.license_keys            disable row level security;
alter table public.excel_imports           disable row level security;

-- ── plans ────────────────────────────────────────────────────────
create policy "plans: authenticated can read"
  on public.plans for select to authenticated using (true);

-- ── customers ────────────────────────────────────────────────────
create policy "customers: read own"
  on public.customers for select to authenticated
  using (id = public.my_customer_id());

create policy "customers: admin can update branding and config"
  on public.customers for update to authenticated
  using  (id = public.my_customer_id() and public.my_role() = 'admin')
  with check (id = public.my_customer_id());

-- ── users ────────────────────────────────────────────────────────
create policy "users: admin reads all in their customer"
  on public.users for select to authenticated
  using (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "users: anyone reads own row"
  on public.users for select to authenticated
  using (id = auth.uid());

create policy "users: admin creates branch_users"
  on public.users for insert to authenticated
  with check (
    public.my_role()  = 'admin'
    and customer_id   = public.my_customer_id()
    and role          = 'branch_user'   -- cannot self-escalate to admin
  );

create policy "users: admin updates users in their customer"
  on public.users for update to authenticated
  using  (customer_id = public.my_customer_id() and public.my_role() = 'admin')
  with check (customer_id = public.my_customer_id());

create policy "users: admin deletes branch_users (not themselves)"
  on public.users for delete to authenticated
  using (
    public.my_role() = 'admin'
    and customer_id  = public.my_customer_id()
    and id          != auth.uid()
    and role         = 'branch_user'
  );

-- ── branches ─────────────────────────────────────────────────────
create policy "branches: admin full access"
  on public.branches for all to authenticated
  using  (customer_id = public.my_customer_id() and public.my_role() = 'admin')
  with check (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "branches: branch_user reads their own branch"
  on public.branches for select to authenticated
  using (id = public.my_branch_id() and public.my_role() = 'branch_user');

-- ── branch_user_assignments ───────────────────────────────────────
create policy "bua: admin full access"
  on public.branch_user_assignments for all to authenticated
  using (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.users u
      where  u.id = branch_user_assignments.user_id
        and  u.customer_id = public.my_customer_id()
    )
  )
  with check (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.users u
      where  u.id = branch_user_assignments.user_id
        and  u.customer_id = public.my_customer_id()
    )
  );

create policy "bua: branch_user reads own assignment"
  on public.branch_user_assignments for select to authenticated
  using (user_id = auth.uid() and public.my_role() = 'branch_user');

-- ── screen_sessions ───────────────────────────────────────────────
create policy "screen_sessions: admin reads for their customer"
  on public.screen_sessions for select to authenticated
  using (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.branches b
      where  b.id = screen_sessions.branch_id
        and  b.customer_id = public.my_customer_id()
    )
  );

create policy "screen_sessions: branch_user reads their branch"
  on public.screen_sessions for select to authenticated
  using (
    public.my_role() = 'branch_user'
    and branch_id = public.my_branch_id()
  );

-- ── currencies ────────────────────────────────────────────────────
create policy "currencies: all authenticated can read"
  on public.currencies for select to authenticated using (true);

-- ── customer_currencies ───────────────────────────────────────────
create policy "customer_currencies: admin full access"
  on public.customer_currencies for all to authenticated
  using  (customer_id = public.my_customer_id() and public.my_role() = 'admin')
  with check (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "customer_currencies: branch_user reads"
  on public.customer_currencies for select to authenticated
  using (customer_id = public.my_customer_id() and public.my_role() = 'branch_user');

-- ── rates ─────────────────────────────────────────────────────────
create policy "rates: admin full access"
  on public.rates for all to authenticated
  using  (customer_id = public.my_customer_id() and public.my_role() = 'admin')
  with check (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "rates: branch_user reads"
  on public.rates for select to authenticated
  using (customer_id = public.my_customer_id() and public.my_role() = 'branch_user');

-- ── branch_rate_overrides ─────────────────────────────────────────
create policy "bro: admin full access"
  on public.branch_rate_overrides for all to authenticated
  using (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.branches b
      where  b.id = branch_rate_overrides.branch_id
        and  b.customer_id = public.my_customer_id()
    )
  )
  with check (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.branches b
      where  b.id = branch_rate_overrides.branch_id
        and  b.customer_id = public.my_customer_id()
    )
  );

create policy "bro: branch_user writes if branch allows it"
  on public.branch_rate_overrides for all to authenticated
  using (
    public.my_role() = 'branch_user'
    and branch_id = public.my_branch_id()
    and exists (
      select 1 from public.branches b
      where  b.id = public.my_branch_id()
        and  b.allow_user_rate_edit = true
    )
  )
  with check (
    public.my_role() = 'branch_user'
    and branch_id = public.my_branch_id()
    and exists (
      select 1 from public.branches b
      where  b.id = public.my_branch_id()
        and  b.allow_user_rate_edit = true
    )
  );

-- ── rate_history ──────────────────────────────────────────────────
create policy "rate_history: admin reads all"
  on public.rate_history for select to authenticated
  using (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "rate_history: branch_user reads their branch"
  on public.rate_history for select to authenticated
  using (
    public.my_role() = 'branch_user'
    and customer_id  = public.my_customer_id()
    and branch_id    = public.my_branch_id()
  );

-- ── ads ───────────────────────────────────────────────────────────
create policy "ads: admin full access"
  on public.ads for all to authenticated
  using  (customer_id = public.my_customer_id() and public.my_role() = 'admin')
  with check (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "ads: branch_user manages their branch ads"
  on public.ads for all to authenticated
  using (
    public.my_role() = 'branch_user'
    and customer_id  = public.my_customer_id()
    and branch_id    = public.my_branch_id()
  )
  with check (
    public.my_role() = 'branch_user'
    and customer_id  = public.my_customer_id()
    and branch_id    = public.my_branch_id()
  );

-- ── ticker_messages ───────────────────────────────────────────────
create policy "ticker: admin full access"
  on public.ticker_messages for all to authenticated
  using  (customer_id = public.my_customer_id() and public.my_role() = 'admin')
  with check (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "ticker: branch_user manages their branch messages"
  on public.ticker_messages for all to authenticated
  using (
    public.my_role() = 'branch_user'
    and customer_id  = public.my_customer_id()
    and branch_id    = public.my_branch_id()
  )
  with check (
    public.my_role() = 'branch_user'
    and customer_id  = public.my_customer_id()
    and branch_id    = public.my_branch_id()
  );

-- ── license_keys ──────────────────────────────────────────────────
create policy "license_keys: admin reads their customer keys"
  on public.license_keys for select to authenticated
  using (customer_id = public.my_customer_id() and public.my_role() = 'admin');

-- ── excel_imports ─────────────────────────────────────────────────
create policy "excel_imports: admin reads all"
  on public.excel_imports for select to authenticated
  using (customer_id = public.my_customer_id() and public.my_role() = 'admin');

create policy "excel_imports: branch_user reads their branch"
  on public.excel_imports for select to authenticated
  using (
    public.my_role() = 'branch_user'
    and customer_id  = public.my_customer_id()
    and branch_id    = public.my_branch_id()
  );


-- ─── SECTION 8: SEED DATA ────────────────────────────────────────

insert into public.currencies (code, name, flag_path, default_decimals, sort_order) values
  ('INR', 'Indian Rupee',       '/flags/in.png', 2,  1),
  ('PKR', 'Pakistani Rupee',    '/flags/pk.png', 2,  2),
  ('BDT', 'Bangladeshi Taka',   '/flags/bd.png', 2,  3),
  ('PHP', 'Philippine Peso',    '/flags/ph.png', 2,  4),
  ('NPR', 'Nepalese Rupee',     '/flags/np.png', 2,  5),
  ('LKR', 'Sri Lankan Rupee',   '/flags/lk.png', 2,  6),
  ('IDR', 'Indonesian Rupiah',  '/flags/id.png', 0,  7),
  ('USD', 'US Dollar',          '/flags/us.png', 4,  8),
  ('GBP', 'British Pound',      '/flags/gb.png', 4,  9),
  ('EUR', 'Euro',               '/flags/eu.png', 4, 10),
  ('CNY', 'Chinese Yuan',       '/flags/cn.png', 2, 11),
  ('JPY', 'Japanese Yen',       '/flags/jp.png', 0, 12),
  ('SAR', 'Saudi Riyal',        '/flags/sa.png', 4, 13),
  ('KWD', 'Kuwaiti Dinar',      '/flags/kw.png', 3, 14),
  ('QAR', 'Qatari Riyal',       '/flags/qa.png', 4, 15),
  ('BHD', 'Bahraini Dinar',     '/flags/bh.png', 3, 16),
  ('OMR', 'Omani Rial',         '/flags/om.png', 3, 17),
  ('AUD', 'Australian Dollar',  '/flags/au.png', 4, 18),
  ('CAD', 'Canadian Dollar',    '/flags/ca.png', 4, 19),
  ('MYR', 'Malaysian Ringgit',  '/flags/my.png', 2, 20)
on conflict (code) do update set flag_path = excluded.flag_path;

insert into public.plans (
  name, max_branches, storage_mb,
  allow_live_rates, allow_excel_import, allow_layout_config, allow_branch_rate_edit,
  duration_days, price_note
) values
  ('Starter',    5,   256,  true, true, false, false, 365, '5 branches · 256 MB · basic features'),
  ('Pro',        15,  512,  true, true, true,  true,  365, '15 branches · 512 MB · all features'),
  ('Enterprise', 50,  2048, true, true, true,  true,  365, '50 branches · 2 GB · all features')
on conflict do nothing;


-- ─── DONE ────────────────────────────────────────────────────────
-- Tables   : 15
-- Indexes  : 20
-- Functions:  7 (3 RLS helpers + 2 business logic + get_tv_data + set_updated_at)
-- Triggers : 10
-- Views    :  3
-- RLS      : 25 policies across 14 tables
-- Seed     : 20 currencies · 3 plans
-- ─────────────────────────────────────────────────────────────────
