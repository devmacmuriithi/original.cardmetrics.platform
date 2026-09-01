# **SportscardPro + PriceCharting Analytics V1**

**Supabase Ingest → Daily Deltas → Metabase Liquidity + Movers → Future Algolia**

## **0\. Goal Summary (Today vs Moving Forward)**

### **TODAY (One-time bootstrapping spike)**

We currently have:

- ~33,500 CSV files/day
- ~10 days of high-volume scrape
- Full universe must be loaded once because we do NOT yet know what matters/liquid

**Goal today:**

✅ Load full card universe into Supabase once  
✅ Compute daily deltas across ~15 price fields + sales-volume  
✅ Visualize movers + liquidity in Metabase  
✅ Then decide what subset becomes the smaller daily pipeline

### **MOVING FORWARD (steady-state daily)**

After bootstrapping:

- Daily scrape drops to hundreds/thousands files/day
- Only liquid + important sets/cards will be kept updating
- Incremental diffs only

But we cannot filter until we see the full baseline universe.

# **1\. Source Data + Master Mapping (Required)**

We have a master file listing every set:

Fields:

- category (Basketball, Baseball, etc.)
- console_uid (key)
- slug
- page_name
- csv_url

Example:

G1096 → basketball-cards-1948-bowman

This must be loaded into Supabase as the set-level dimension table so Metabase can filter by category/set.

## **Table: sets_master**

****create table sets_master (

console_uid text primary key,

slug text,

category text,

page_name text,

url text,

csv_url text

);

✅ Metabase must be able to filter by:

- category
- console_uid
- set name

# **2\. Supabase Architecture (Medallion Model)**

We must implement the correct layered model:

### **Bronze = Raw landing**

### **Silver = Normalized daily facts**

### **Gold = Diff + liquidity analytics**

This prevents Supabase overload.

## **Layer 1 (Bronze): Raw Landing Table**

Purpose:

- Capture full universe without guessing columns
- Temporary staging only
- Not queried directly in Metabase

### **Table: cards_raw_ingests**

****create unlogged table cards_raw_ingests (

id bigserial primary key,

ingest_date date not null,

console_uid text not null,

card_id bigint not null,

payload jsonb not null,

filename text

);

### **Notes (Gemini + performance)**

- Use **UNLOGGED** to speed writes (safe because raw can be reloaded)
- JSONB payload preserves all fields without schema decisions yet

✅ This table is staging only.

## **Layer 2 (Silver): Normalized Daily Market Facts**

This is the core analytics table.

One row per card per day.

### **Table: card_market_daily**

****create table card_market_daily (

card_id bigint not null,

console_uid text not null,

date date not null,

loose_price numeric,

graded_price numeric,

psa10_price numeric,

bgs10_price numeric,

retail_loose_buy numeric,

retail_loose_sell numeric,

sales_volume numeric,

primary key(card_id, date)

);

This table stores the daily snapshot metrics.

## **Layer 3 (Gold): Delta + Liquidity View**

We compute changes using SQL window functions (NOT application logic).

### **View: card_market_diff**

****create view card_market_diff as

select

t.card_id,

t.console_uid,

t.date,

t.loose_price,

t.sales_volume,

t.loose_price -

lag(t.loose_price)

over (partition by t.card_id order by t.date)

as loose_price_diff,

t.sales_volume -

lag(t.sales_volume)

over (partition by t.card_id order by t.date)

as sales_volume_diff,

greatest(

0,

t.sales_volume -

lag(t.sales_volume)

over (partition by t.card_id order by t.date)

) as daily_sales_est

from card_market_daily t;

✅ Matches canonical liquidity spec:

daily_sales_est = max(0, sales_volume_today − sales_volume_yesterday)

# **3\. Core Rule: Latest Snapshot + Delta History Only**

We do NOT store raw CSV rows forever.

Correct storage model:

- Latest snapshot values
- Daily delta history

Raw staging is only temporary.

This matches V1 explicitly.

# **4\. Ingestion Requirements (Critical)**

## **Absolute Rule: NO row-by-row inserts**

Supabase fails because of micro inserts.

✅ Required: Merge + COPY bulk load

## **Step 1: Merge all CSVs per day into ONE snapshot file**

Instead of 33,500 COPY operations/day:

- Build YYYY-MM-DD_snapshot.csv

So ingestion becomes:

- 10 COPY loads total
- Not 330,000 jobs

## **Step 2: Bulk Load Into Raw Table via COPY**

****COPY cards_raw_ingests(ingest_date, console_uid, card_id, payload)

FROM '/tmp/2026-01-21_snapshot.csv'

CSV HEADER;

COPY is mandatory.

## **Step 3: Extract Into card_market_daily**

Using JSON extraction or jsonb_to_recordset:

insert into card_market_daily(card_id, console_uid, date,

loose_price, graded_price,

psa10_price, bgs10_price,

retail_loose_buy, retail_loose_sell,

sales_volume)

select

card_id,

console_uid,

ingest_date,

(payload->>'loose-price')::numeric,

(payload->>'graded-price')::numeric,

(payload->>'manual-only-price')::numeric,

(payload->>'bgs-10-price')::numeric,

(payload->>'retail-loose-buy')::numeric,

(payload->>'retail-loose-sell')::numeric,

(payload->>'sales-volume')::numeric

from cards_raw_ingests;



## **Step 4: Post-Load Maintenance**

After COPY + inserts:

VACUUM ANALYZE card_market_daily;

Critical so Metabase queries remain fast.

# **5\. MVP Test Requirement (Start With Basketball First)**

Before full universe ingest:

We validate the pipeline end-to-end on:

### **Set:**

basketball-cards-2024-panini-prizm  
console_uid = G78842

### **Load 2 Dates Only**

So we can confirm:

- diff works
- liquidity signal works

### **Card IDs to validate**

(Use this list exactly)

Deliverable:

✅ Metabase dashboard showing price_diff and daily_sales_est across 2 days.

Only then proceed to full ingest.

# **6\. Metabase Phase (Only After Supabase Complete)**

Metabase starts AFTER:

- daily table populated
- diff view created
- vacuum complete

## **Metabase Collection Structure**

- Keep existing AL dashboards untouched
- Create new top-level collection:

**Cards Project**

## **Metabase Must Query ONLY:**

- card_market_daily
- card_market_diff
- Joined with sets_master

Raw table is never used for dashboards.

## **Required Dashboards**

### **Dashboard 1: Top Liquidity Cards**

Sum daily_sales_est over window.

### **Dashboard 2: Biggest Price Movers**

Order by % change or diff.

### **Dashboard 3: Top Sets by Liquidity**

Aggregate daily_sales_est grouped by console_uid.

### **Filters Required**

- Category
- Set (console_uid)
- Liquidity thresholds
- Price ranges
- Change windows (1D / 7D / 30D)

Matches V1 dashboard requirements.

# **7\. Algolia (Later Phase)**

Algolia is NOT separate data.

It is built from Supabase:

- latest snapshot fields
- diff fields
- liquidity weights

Ranking should boost:

- exact match
- higher sales_volume
- stronger movers

As documented in V1.

# **8\. Final Deliverables Checklist**

## **Supabase (Phase 1)**

- Load sets_master
- Create cards_raw_ingests (UNLOGGED)
- Merge daily CSVs → snapshot/day
- COPY load 2 basketball dates first
- Populate card_market_daily
- Create card_market_diff
- VACUUM ANALYZE

## **Metabase (Phase 2)**

- New Collection: Cards Project
- Dashboards: movers + liquidity + sets
- Filters: category, set, liquidity thresholds

## **Then Full Scale**

- Expand from Basketball → all categories
- Complete 10-day baseline
- Decide permanent smaller daily subset

# **✅ Bottom Line**

This spec achieves the original goal exactly:

- Full universe loaded once
- Daily deltas + liquidity computed correctly
- Metabase identifies what matters
- Future ingestion becomes small incremental diffs

All aligned with V1.