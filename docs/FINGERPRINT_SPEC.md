# Card Fingerprint Specification v1.0.0

## Overview
Deterministic canonical identity for trading cards. Stable across reloads, migrations, systems.

## Input Fields (7 components)

| # | Field | Source | Type | Fallback |
|---|-------|--------|------|----------|
| 1 | sport | sports.slug | TEXT | '' |
| 2 | year | sets.year | INTEGER | '' |
| 3 | manufacturer | manufacturers.slug | TEXT | '' |
| 4 | set_name | sets.slug | TEXT | '' |
| 5 | card_number | cards.card_number | TEXT | '' |
| 6 | variation | cards.variation | TEXT | 'base' |
| 7 | player_name | players.slug | TEXT | '' |

## Normalization Rules

1. **TRIM** - Remove leading/trailing whitespace
2. **LOWERCASE** - Convert to lowercase
3. **COALESCE** - NULL → fallback value

## Format

```
sport|year|manufacturer|set|card_number|variation|player_name
```

**Example:** `basketball|2019|panini|prizm|1|silver|lebron-james`

## Exclusions & Edge Cases

| Condition | Action | Reason |
|-----------|--------|--------|
| variation IS NULL | Use 'base' | NULL = base card |
| variation = '' | Use 'base' | Empty = base card |
| Whitespace-only inputs | Trim to empty | Noise reduction |

## Hash Algorithm

- Primary: SHA256
- Fallback: MD5 (if pgcrypto unavailable)
- Output: Hex-encoded string

## Versioning

- Current: `fingerprint_version = 1`
- Bump version on logic changes
- Trigger re-computation when version changes

## Test Cases

| Case | Inputs | Expected Fingerprint |
|------|--------|---------------------|
| Standard | Basketball, 2019, Panini, Prizm, 1, Silver, LeBron James | `basketball|2019|panini|prizm|1|silver|lebron-james` |
| Base card | ...variation: null | `...|1|base|...` |
| Whitespace | '  Basketball  ' | `basketball` |
| Missing player | player_name: null | `basketball|2019|...|1|silver|` |

## Change Log

**v1.0.0** (2025-02-08)
- Initial 7-field fingerprint structure
- SHA256 hashing
- NULL variation → 'base'
