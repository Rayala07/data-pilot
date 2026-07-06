-- DataPilot seed database: a deliberately messy e-commerce schema.
-- Realistic ugliness on purpose: abbreviated/inconsistent column names,
-- mixed-case status values, and NULLs — this is what the introspection,
-- retrieval, and retry-loop layers are built to survive.
--
-- Run against an EMPTY Postgres database (a fresh Supabase project works well).
-- See seed/README.md for load instructions.

-- ============================================================================
-- Schema
-- ============================================================================

CREATE TABLE usr (
  id          SERIAL PRIMARY KEY,
  full_nm     TEXT,
  email_addr  TEXT,
  signup_dt   DATE,
  usr_status  TEXT
);

CREATE TABLE prod_cat (
  cat_id         SERIAL PRIMARY KEY,
  cat_nm         TEXT NOT NULL,
  parent_cat_id  INT REFERENCES prod_cat (cat_id)
);

CREATE TABLE products (
  prod_id         SERIAL PRIMARY KEY,
  prod_title      TEXT NOT NULL,
  cat_id          INT REFERENCES prod_cat (cat_id),
  unit_price_inr  NUMERIC(10, 2) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE ord_hdr (
  ord_id      SERIAL PRIMARY KEY,
  usr_id      INT REFERENCES usr (id),
  ord_dt      TIMESTAMP NOT NULL,
  ord_status  TEXT NOT NULL,
  ship_city   TEXT
);

CREATE TABLE ord_line (
  line_id       SERIAL PRIMARY KEY,
  ord_id        INT REFERENCES ord_hdr (ord_id),
  prod_id       INT REFERENCES products (prod_id),
  qty           INT NOT NULL,
  line_amt_inr  NUMERIC(10, 2) NOT NULL,
  disc_pct      NUMERIC(5, 2) NOT NULL DEFAULT 0
);

CREATE TABLE pay_txn (
  txn_id       SERIAL PRIMARY KEY,
  ord_id       INT REFERENCES ord_hdr (ord_id),
  txn_dt       TIMESTAMP NOT NULL,
  txn_amt_inr  NUMERIC(10, 2) NOT NULL,
  pay_mode     TEXT,
  txn_status   TEXT NOT NULL
);

CREATE TABLE support_tix (
  tix_id         SERIAL PRIMARY KEY,
  usr_id         INT REFERENCES usr (id),
  opened_dt      TIMESTAMP NOT NULL,
  closed_dt      TIMESTAMP,
  tix_cat        TEXT,
  resolution_nm  TEXT
);

CREATE TABLE inventory_snap (
  snap_id      SERIAL PRIMARY KEY,
  prod_id      INT REFERENCES products (prod_id),
  snap_dt      DATE NOT NULL,
  on_hand_qty  INT NOT NULL
);

-- ============================================================================
-- Data — generated relative to CURRENT_DATE so "last month" / "last 18 months"
-- style benchmark questions stay meaningful no matter when this is loaded.
-- ============================================================================

-- Categories: a few top-level, a few nested under them.
INSERT INTO prod_cat (cat_nm, parent_cat_id) VALUES
  ('Electronics', NULL),
  ('Fashion', NULL),
  ('Home & Kitchen', NULL),
  ('Beauty', NULL),
  ('Sports', NULL),
  ('Books', NULL);

INSERT INTO prod_cat (cat_nm, parent_cat_id)
SELECT 'Mobiles', cat_id FROM prod_cat WHERE cat_nm = 'Electronics'
UNION ALL
SELECT 'Laptops', cat_id FROM prod_cat WHERE cat_nm = 'Electronics'
UNION ALL
SELECT 'Men''s Clothing', cat_id FROM prod_cat WHERE cat_nm = 'Fashion'
UNION ALL
SELECT 'Women''s Clothing', cat_id FROM prod_cat WHERE cat_nm = 'Fashion'
UNION ALL
SELECT 'Cookware', cat_id FROM prod_cat WHERE cat_nm = 'Home & Kitchen'
UNION ALL
SELECT 'Skincare', cat_id FROM prod_cat WHERE cat_nm = 'Beauty';

-- Users: ~800, signed up over the last 18 months, inconsistent status casing.
INSERT INTO usr (full_nm, email_addr, signup_dt, usr_status)
SELECT
  'User ' || g,
  'user' || g || '@example.com',
  (CURRENT_DATE - (INTERVAL '18 months') * random())::date,
  (ARRAY['ACTIVE', 'active', 'Active', 'INACTIVE', 'inactive', 'SUSPENDED'])[floor(random() * 6 + 1)]
FROM generate_series(1, 800) AS g;

-- Products: ~200, spread across categories.
INSERT INTO products (prod_title, cat_id, unit_price_inr, is_active)
SELECT
  'Product ' || g,
  (floor(random() * (SELECT COUNT(*) FROM prod_cat)) + 1)::int,
  round((random() * 49000 + 199)::numeric, 2),
  random() > 0.1
FROM generate_series(1, 200) AS g;

-- Orders: ~5000, mixed-case statuses including CANCELLED and REFUNDED,
-- occasional missing ship_city.
INSERT INTO ord_hdr (usr_id, ord_dt, ord_status, ship_city)
SELECT
  (floor(random() * 800) + 1)::int,
  CURRENT_TIMESTAMP - (INTERVAL '18 months') * random(),
  (ARRAY['PLACED', 'Placed', 'SHIPPED', 'Shipped', 'DELIVERED', 'Delivered', 'CANCELLED', 'Cancelled', 'REFUNDED', 'Refunded'])[floor(random() * 10 + 1)],
  CASE WHEN random() < 0.05 THEN NULL
       ELSE (ARRAY['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata', 'Pune', 'Hyderabad', 'Ahmedabad'])[floor(random() * 8 + 1)]
  END
FROM generate_series(1, 5000) AS g;

-- Order lines: 1-3 lines per order, amount derived from the chosen product's price.
--
-- NOTE on a subtle Postgres pitfall: a `CROSS JOIN LATERAL (subquery)` whose
-- subquery does NOT reference any outer column is not actually correlated,
-- and Postgres is free to evaluate it once for the whole query rather than
-- once per outer row — silently giving every row the same "random" value.
-- (Confirmed empirically while building this script: every ord_line row came
-- out with an identical prod_id/qty/disc_pct.) Random-per-row values must
-- come from a plain SELECT list over real rows, never from an uncorrelated
-- LATERAL subquery — hence the two-step CTE below.
WITH line_counts AS (
  SELECT ord_id, (floor(random() * 3) + 1)::int AS n_lines
  FROM ord_hdr
),
lines AS (
  SELECT lc.ord_id
  FROM line_counts lc
  CROSS JOIN LATERAL generate_series(1, lc.n_lines) AS gs(line_num)
),
lines_randomized AS (
  SELECT
    ord_id,
    (floor(random() * 200) + 1)::int AS prod_id,
    (floor(random() * 4) + 1)::int AS qty,
    (ARRAY[0, 5, 10, 15, 20])[floor(random() * 5 + 1)] AS disc_pct
  FROM lines
)
INSERT INTO ord_line (ord_id, prod_id, qty, line_amt_inr, disc_pct)
SELECT
  lr.ord_id,
  p.prod_id,
  lr.qty,
  round((p.unit_price_inr * lr.qty * (1 - lr.disc_pct / 100.0))::numeric, 2),
  lr.disc_pct
FROM lines_randomized lr
JOIN products p ON p.prod_id = lr.prod_id;

-- Payment transactions: one per order (amount reconciled to its line items,
-- status derived from the order's own status so cancelled/refunded orders
-- don't show a bare SUCCESS transaction), plus occasional failed retries.
INSERT INTO pay_txn (ord_id, txn_dt, txn_amt_inr, pay_mode, txn_status)
SELECT
  o.ord_id,
  o.ord_dt + (random() * INTERVAL '2 hours'),
  COALESCE(ol.total, round((random() * 2000 + 100)::numeric, 2)),
  (ARRAY['CARD', 'UPI', 'NETBANKING', 'COD', 'Card', 'Upi'])[floor(random() * 6 + 1)],
  CASE
    WHEN lower(o.ord_status) = 'cancelled' THEN (ARRAY['FAILED', 'failed', 'CANCELLED'])[floor(random() * 3 + 1)]
    WHEN lower(o.ord_status) = 'refunded' THEN (ARRAY['REFUNDED', 'refunded'])[floor(random() * 2 + 1)]
    ELSE (ARRAY['SUCCESS', 'success', 'Success'])[floor(random() * 3 + 1)]
  END
FROM ord_hdr o
LEFT JOIN (
  SELECT ord_id, SUM(line_amt_inr) AS total FROM ord_line GROUP BY ord_id
) ol ON ol.ord_id = o.ord_id;

INSERT INTO pay_txn (ord_id, txn_dt, txn_amt_inr, pay_mode, txn_status)
SELECT o.ord_id, o.ord_dt + INTERVAL '10 minutes', t.txn_amt_inr, t.pay_mode, 'FAILED'
FROM ord_hdr o
JOIN pay_txn t ON t.ord_id = o.ord_id
WHERE random() < 0.08;

-- Support tickets: a subset of users, ~25% still open (closed_dt/resolution_nm NULL).
-- Same pitfall as ord_line above: `ts` must be a plain (non-LATERAL) subquery
-- so its random() columns are computed once per row of generate_series,
-- not once for the whole query.
WITH ts AS (
  SELECT
    g,
    CURRENT_TIMESTAMP - (INTERVAL '18 months') * random() AS opened,
    random() < 0.25 AS is_open
  FROM generate_series(1, 600) AS g
)
INSERT INTO support_tix (usr_id, opened_dt, closed_dt, tix_cat, resolution_nm)
SELECT
  (floor(random() * 800) + 1)::int,
  ts.opened,
  CASE WHEN ts.is_open THEN NULL ELSE ts.opened + (random() * INTERVAL '10 days') END,
  (ARRAY['SHIPPING', 'PAYMENT', 'PRODUCT_DEFECT', 'REFUND_REQUEST', 'OTHER'])[floor(random() * 5 + 1)],
  CASE WHEN ts.is_open THEN NULL
       ELSE (ARRAY['Resolved - replaced', 'Resolved - refunded', 'Resolved - explained', 'Closed - no response'])[floor(random() * 4 + 1)]
  END
FROM ts;

-- Inventory snapshots: monthly, per product, for the last 18 months.
INSERT INTO inventory_snap (prod_id, snap_dt, on_hand_qty)
SELECT
  p.prod_id,
  (date_trunc('month', CURRENT_DATE) - (m || ' months')::interval)::date,
  floor(random() * 500)::int
FROM products p
CROSS JOIN generate_series(0, 17) AS m;

-- ============================================================================
-- Read-only role — DataPilot connects as this role, not as a superuser.
-- The session-level `default_transaction_read_only` flag (set by the backend)
-- is defense in depth on top of this; the credential itself cannot write
-- independent of that flag.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datapilot_readonly') THEN
    CREATE ROLE datapilot_readonly WITH LOGIN PASSWORD 'CHANGE_ME_BEFORE_USE';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO datapilot_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datapilot_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datapilot_readonly;
