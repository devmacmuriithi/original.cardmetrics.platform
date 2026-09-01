# Basketball Data Availability

This document tracks the availability of basketball card data in the S3 bucket across all dates.

## Data Quality Report

Generated from: `check-basketball-dates.js`

### Summary Statistics

- **Total dates checked:** 23
- **Dates with basketball data:** 22
- **Dates missing basketball data:** 1 (2026-01-01)
- **Dates with complete data (151 files):** 18
- **Dates with partial data:** 3

---

## Daily Breakdown

| Date | Files | Status | Note |
|------|-------|--------|------|
| 2025-12-29 | 11 | ⚠️ | Partial (early data) |
| 2025-12-30 | 11 | ⚠️ | Partial |
| 2025-12-31 | 150 | ✅ | Good |
| 2026-01-01 | 0 | ❌ | No basketball data |
| 2026-01-02 | 148 | ✅ | Good |
| 2026-01-03 | 150 | ✅ | Good |
| 2026-01-04 | 151 | ✅ | Complete |
| 2026-01-05 | 151 | ✅ | Complete |
| 2026-01-06 | 151 | ✅ | Complete |
| 2026-01-07 | 151 | ✅ | Complete |
| 2026-01-09 | 151 | ✅ | Complete |
| 2026-01-14 | 151 | ✅ | Complete |
| 2026-01-15 | 151 | ✅ | Complete |
| 2026-01-16 | 151 | ✅ | Complete |
| 2026-01-17 | 151 | ✅ | Complete |
| 2026-01-18 | 151 | ✅ | Complete |
| 2026-01-19 | 151 | ✅ | Complete |
| 2026-01-20 | 151 | ✅ | Complete |
| 2026-01-21 | 151 | ✅ | Complete |
| 2026-01-22 | 151 | ✅ | Complete |
| 2026-01-23 | 151 | ✅ | Complete |
| 2026-01-24 | 151 | ✅ | Complete |
| 2026-01-25 | 151 | ✅ | Complete |

---

## Usage Commands

### Process Last 10 Days

```bash
node mvp-test-basketball.js --no-cleanup --dates=2026-01-16,2026-01-17,2026-01-18,2026-01-19,2026-01-20,2026-01-21,2026-01-22,2026-01-23,2026-01-24,2026-01-25
```

### Check Available Dates

```bash
node list-available-dates.js
```

### Check Basketball Availability

```bash
node check-basketball-dates.js
```

---

## Notes

- **152 basketball sets** are tracked in `basketball_sets.csv`
- **151 files** per complete date indicates one set may not have matching S3 files
- **Partial dates** (Dec 29-30) likely represent early data collection period
- **Missing date** (Jan 1) has no basketball card data in S3
- Data collection appears **complete and stable** from Jan 4 onwards

---

## Data Quality Indicators

| Indicator | Count |
|-----------|-------|
| ✅ Complete (151 files) | 18 dates |
| ✅ Good (148-150 files) | 3 dates |
| ⚠️ Partial (11 files) | 2 dates |
| ❌ No data | 1 date |
