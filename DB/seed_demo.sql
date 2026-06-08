-- ================================================================
-- DEMO SEED — run this in Supabase SQL Editor after schema.sql
-- Creates one customer + one branch + currencies + rates + ticker
-- Then copy the branch_token at the bottom to open /live?token=...
-- ================================================================

do $$
declare
  v_plan_id      uuid;
  v_customer_id  uuid;
  v_branch_id    uuid;

  -- currency IDs
  c_inr uuid; c_pkr uuid; c_usd uuid; c_gbp uuid; c_eur uuid;
  c_bdt uuid; c_php uuid; c_npr uuid; c_lkr uuid; c_idr uuid;
  c_cny uuid; c_jpy uuid; c_sar uuid; c_kwd uuid; c_qar uuid;
  c_bh uuid;  c_omr uuid; c_aud uuid; c_cad uuid; c_myr uuid;

begin

  -- ── 1. Pick the "Pro" plan ─────────────────────────────────────
  select id into v_plan_id from public.plans where name = 'Pro' limit 1;

  -- ── 2. Create the demo customer ───────────────────────────────
  insert into public.customers (
    name, plan_id, plan_expires_at,
    business_name, primary_color, base_currency,
    branch_ad_mode
  ) values (
    'Nova Currency Exchange',
    v_plan_id,
    now() + interval '365 days',
    'NOVA CURRENCY',
    '#4c195a',
    'AED',
    'append'
  )
  on conflict do nothing
  returning id into v_customer_id;

  -- If already existed, fetch it
  if v_customer_id is null then
    select id into v_customer_id
    from public.customers
    where name = 'Nova Currency Exchange'
    limit 1;
  end if;

  -- ── 3. Create the branch ──────────────────────────────────────
  insert into public.branches (customer_id, name, location_note, layout)
  values (v_customer_id, 'City Centre', 'Ground floor, main entrance', 'split-standard')
  on conflict do nothing
  returning id into v_branch_id;

  if v_branch_id is null then
    select id into v_branch_id
    from public.branches
    where customer_id = v_customer_id and name = 'City Centre'
    limit 1;
  end if;

  -- ── 4. Resolve currency IDs ───────────────────────────────────
  select id into c_inr from public.currencies where code = 'INR';
  select id into c_pkr from public.currencies where code = 'PKR';
  select id into c_bdt from public.currencies where code = 'BDT';
  select id into c_php from public.currencies where code = 'PHP';
  select id into c_npr from public.currencies where code = 'NPR';
  select id into c_lkr from public.currencies where code = 'LKR';
  select id into c_idr from public.currencies where code = 'IDR';
  select id into c_usd from public.currencies where code = 'USD';
  select id into c_gbp from public.currencies where code = 'GBP';
  select id into c_eur from public.currencies where code = 'EUR';
  select id into c_cny from public.currencies where code = 'CNY';
  select id into c_jpy from public.currencies where code = 'JPY';
  select id into c_sar from public.currencies where code = 'SAR';
  select id into c_kwd from public.currencies where code = 'KWD';
  select id into c_qar from public.currencies where code = 'QAR';
  select id into c_bh  from public.currencies where code = 'BHD';
  select id into c_omr from public.currencies where code = 'OMR';
  select id into c_aud from public.currencies where code = 'AUD';
  select id into c_cad from public.currencies where code = 'CAD';
  select id into c_myr from public.currencies where code = 'MYR';

  -- ── 5. Enable all currencies for this customer ────────────────
  insert into public.customer_currencies (customer_id, currency_id, is_enabled, display_order)
  values
    (v_customer_id, c_inr,  true,  1),
    (v_customer_id, c_pkr,  true,  2),
    (v_customer_id, c_bdt,  true,  3),
    (v_customer_id, c_php,  true,  4),
    (v_customer_id, c_npr,  true,  5),
    (v_customer_id, c_lkr,  true,  6),
    (v_customer_id, c_idr,  true,  7),
    (v_customer_id, c_usd,  true,  8),
    (v_customer_id, c_gbp,  true,  9),
    (v_customer_id, c_eur,  true, 10),
    (v_customer_id, c_cny,  true, 11),
    (v_customer_id, c_jpy,  true, 12),
    (v_customer_id, c_sar,  true, 13),
    (v_customer_id, c_kwd,  true, 14),
    (v_customer_id, c_qar,  true, 15),
    (v_customer_id, c_bh,   true, 16),
    (v_customer_id, c_omr,  true, 17),
    (v_customer_id, c_aud,  true, 18),
    (v_customer_id, c_cad,  true, 19),
    (v_customer_id, c_myr,  true, 20)
  on conflict (customer_id, currency_id) do nothing;

  -- ── 6. Seed current rates (AED base) ──────────────────────────
  -- buy/sell/transfer are per 1 unit of foreign currency in AED
  insert into public.rates (customer_id, currency_id, buy, sell, transfer, mode)
  values
    (v_customer_id, c_inr, 0.040,  0.048,  23.030, 'manual'),
    (v_customer_id, c_pkr, 0.016,  0.016,  76.130, 'manual'),
    (v_customer_id, c_bdt, 0.026,  0.037,  33.850, 'manual'),
    (v_customer_id, c_php, 0.058,  0.067,  15.800, 'manual'),
    (v_customer_id, c_npr, 0.022,  0.032,  36.870, 'manual'),
    (v_customer_id, c_lkr, 0.010,  0.010,  78.980, 'manual'),
    (v_customer_id, c_idr, 0.0000, 0.0000, 4315.0, 'manual'),
    (v_customer_id, c_usd, 3.650,  3.680,  3.6730, 'manual'),
    (v_customer_id, c_gbp, 4.620,  4.680,  4.6610, 'manual'),
    (v_customer_id, c_eur, 4.010,  4.060,  4.0480, 'manual'),
    (v_customer_id, c_cny, 0.500,  0.520,  0.5140, 'manual'),
    (v_customer_id, c_jpy, 0.024,  0.026,  0.0250, 'manual'),
    (v_customer_id, c_sar, 0.975,  0.990,  0.9820, 'manual'),
    (v_customer_id, c_kwd, 11.940, 12.200, 12.080, 'manual'),
    (v_customer_id, c_qar, 1.010,  1.020,  1.0140, 'manual'),
    (v_customer_id, c_bh,  9.720,  9.880,  9.8020, 'manual'),
    (v_customer_id, c_omr, 9.540,  9.700,  9.6180, 'manual'),
    (v_customer_id, c_aud, 2.400,  2.440,  2.4210, 'manual'),
    (v_customer_id, c_cad, 2.680,  2.710,  2.6940, 'manual'),
    (v_customer_id, c_myr, 0.820,  0.840,  0.8310, 'manual')
  on conflict (customer_id, currency_id) do update
    set buy = excluded.buy,
        sell = excluded.sell,
        transfer = excluded.transfer,
        updated_at = now();

  -- ── 7. Ticker messages ────────────────────────────────────────
  insert into public.ticker_messages (customer_id, branch_id, message, display_order, is_active)
  values
    (v_customer_id, null, 'Rates updated every 15 minutes',                      1, true),
    (v_customer_id, null, 'Open daily from 8:00 AM to 10:00 PM',                 2, true),
    (v_customer_id, null, 'More than 40 currencies available at the counter',     3, true),
    (v_customer_id, null, 'Ask our team for today''s transfer offers',            4, true),
    (v_customer_id, null, 'Competitive rates on all major currencies',            5, true)
  on conflict do nothing;

end $$;


-- ── Show the branch token to copy into the URL ─────────────────────────────
select
  b.name         as branch_name,
  b.branch_token as "Use in URL: /live?token=<this>",
  c.name         as customer_name
from   public.branches b
join   public.customers c on c.id = b.customer_id
where  c.name = 'Nova Currency Exchange';
