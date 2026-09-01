"""
match_spc_to_gemrate.py
-----------------------
Matches cards from SportsCard Pro (SPC) CSV exports to GemRate CSV exports
and produces a single merged output file.

HOW TO USE:
    python3 match_spc_to_gemrate.py \
        --spc   SPC-G78842.csv \
        --gem   gemrate-G78842.csv \
        --out   matched_cards_G78842.csv

You can reuse this script for any console ID — just swap the input files.
"""

import csv
import io
import re
import argparse


# =============================================================================
# PARALLEL NAME MAPPING  (SPC label -> GemRate normalized label)
# =============================================================================
#
# The two data sources name parallels differently in two ways:
#
#   1. WORD ORDER:  SPC puts the type first, GemRate puts the color first.
#                   e.g. SPC "Choice Blue"  ->  GemRate "Blue Choice"
#                        SPC "Fast Break Blue" -> GemRate "Blue Fast Break"
#
#   2. SYNONYMS:    Some names are just different.
#                   e.g. SPC "Rookie Variation" -> GemRate "Variation"
#                        SPC "Black"            -> GemRate "Black Prizm"
#                        SPC "Lazer Gold"       -> GemRate "Gold Lazer"
#
# This dictionary handles both issues. The keys are lowercased SPC parallel
# labels. The values are the GemRate parallel label after normalization
# (GemRate normalization = strip trailing "Prizm" and "1/1", lowercase).
#
# To extend this for a new set: run the script, check the unmatched log,
# and add any new parallel names you see to this dictionary.

PARALLEL_MAP = {
    # --- Base / Silver ---
    'base'                       : 'base',
    'silver'                     : 'silver',
    'basketball'                 : 'basketball',
    'basketball prizm'           : 'basketball',

    # --- Black variants ---
    'black'                      : 'black prizm',       # SPC drops "prizm", GemRate keeps it
    'black gold'                 : 'black gold',
    'black shimmer fotl'         : 'black shimmer fotl',
    'black white'                : 'black white',

    # --- Blue variants ---
    'blue'                       : 'blue',
    'blue ice'                   : 'blue ice',
    'blue pulsar'                : 'blue pulsar',
    'blue seismic'               : 'blue seismic',
    'blue shimmer fotl'          : 'blue shimmer fotl',
    'blue sparkle'               : 'blue sparkle',
    'wave blue'                  : 'blue wave',         # word order flip

    # --- Choice variants (SPC: "Choice X" -> GemRate: "X Choice") ---
    'choice blue'                : 'blue choice',
    'choice blue yellow green'   : 'blue yellow green choice',
    'choice cherry blossom'      : 'cherry blossom choice',
    'choice green'               : 'green choice',
    'choice nebula'              : 'nebula choice',
    'choice red'                 : 'red choice',
    'choice tiger stripe'        : 'tiger stripes choice',

    # --- Special / themed ---
    'china variation'            : 'china variation',
    'dragon year'                : 'dragon year',
    'glitter'                    : 'glitter',
    'hyper'                      : 'hyper',
    'ice'                        : 'ice',
    'lucky envelope'             : 'lucky envelopes',   # singular vs plural
    'mojo'                       : 'mojo',
    'multi wave'                 : 'multi wave',
    'premium factory set'        : 'premium factory set',
    'pulsar'                     : 'pulsar',
    'ruby wave'                  : 'ruby wave',
    'skewed'                     : 'skewed',
    'snakeskin'                  : 'snakeskin',
    'teal ice'                   : 'teal ice',
    'wave'                       : 'wave',

    # --- Fast Break variants (SPC: "Fast Break X" -> GemRate: "X Fast Break") ---
    'fast break'                 : 'fast break',
    'fast break blue'            : 'blue fast break',
    'fast break bronze'          : 'bronze fast break',
    'fast break neon green'      : 'neon green fast break',
    'fast break orange'          : 'orange fast break',
    'fast break pink'            : 'pink fast break',
    'fast break purple'          : 'purple fast break',
    'fast break red'             : 'red fast break',
    'fotl'                       : 'fast break',

    # --- Gold variants ---
    'gold'                       : 'gold',
    'gold ice'                   : 'gold ice',
    'ice gold'                   : 'gold ice',          # word order flip
    'lazer gold'                 : 'gold lazer',        # word order flip
    'wave gold'                  : 'gold wave',         # word order flip

    # --- Green variants ---
    'green'                      : 'green',
    'green ice'                  : 'green ice',
    'green pulsar'               : 'green pulsar',
    'green sparkle'              : 'green sparkle',
    'green wave'                 : 'green wave',

    # --- Orange variants ---
    'orange'                     : 'orange',
    'orange ice'                 : 'orange ice',
    'orange seismic'             : 'orange seismic',
    'wave orange'                : 'orange wave',       # word order flip

    # --- Pink variants ---
    'pink'                       : 'pink',
    'pink ice'                   : 'pink ice',
    'pink pulsar'                : 'pink pulsar',

    # --- Purple variants ---
    'purple'                     : 'purple',
    'purple ice'                 : 'purple ice',
    'purple pulsar'              : 'purple pulsar',

    # --- Red variants ---
    'red'                        : 'red',
    'red ice'                    : 'red ice',
    'red lazer'                  : 'red lazer',
    'red pulsar'                 : 'red pulsar',
    'red seismic'                : 'red seismic',
    'red sparkle'                : 'red sparkle',
    'red white blue'             : 'red white blue',

    # --- Variation (Rookie Variation in SPC = Variation in GemRate) ---
    'rookie variation'           : 'variation',

    # --- White variants ---
    'white'                      : 'white',
    'white ice'                  : 'white ice',
    'white lazer'                : 'white lazer',
    'white sparkle'              : 'white sparkle',
    'white tiger stripe'         : 'white tiger stripe',
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def normalize_gem_parallel(parallel_str):
    """
    Normalize a GemRate parallel label into a clean comparable string.

    GemRate appends "Prizm" and "1/1" to many parallel names that SPC omits.
    Stripping these makes the comparison fair.

    Examples:
        "Silver Prizm"        -> "silver"
        "Black Prizm 1/1"     -> "black prizm"
        "Blue Fast Break"     -> "blue fast break"
    """
    p = parallel_str.lower().strip()
    p = re.sub(r'\s*prizm$', '', p)   # remove trailing "prizm"
    p = re.sub(r'\s*1/1$', '', p)     # remove trailing "1/1"
    return p.strip()


def parse_spc_product_name(product_name):
    """
    Parse an SPC product name into (player, parallel, card_number).

    SPC product names follow this format:
        "Player Name [Parallel] #CardNumber"
        "Player Name #CardNumber"           <- no parallel = Base card

    Examples:
        "LeBron James [Silver] #130"     -> ("LeBron James", "silver", "130")
        "Stephon Castle #234"            -> ("Stephon Castle", "base",  "234")
        "Blaster Box"                    -> ("Blaster Box",   "base",  "")
    """
    # Extract card number (digits after #)
    num_match = re.search(r'#(\d+)', product_name)
    card_number = num_match.group(1) if num_match else ''

    # Extract parallel from square brackets
    par_match = re.search(r'\[(.+?)\]', product_name)
    parallel = par_match.group(1).lower().strip() if par_match else 'base'

    # Player name = everything before the bracket or the #
    player = re.sub(r'\s*\[.+?\]', '', product_name)   # remove [parallel]
    player = re.sub(r'\s*#\d+', '', player).strip()     # remove #number

    return player, parallel, card_number


def load_spc(filepath):
    """Load SPC CSV and return list of row dicts."""
    with open(filepath, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def load_gemrate(filepath):
    """
    Load GemRate CSV. GemRate exports have a metadata row as the first line,
    so the actual column headers are on the second line.
    """
    with open(filepath, encoding='utf-8') as f:
        lines = f.readlines()
    reader = csv.DictReader(io.StringIO(''.join(lines[1:])))  # skip row 0
    return list(reader)


# =============================================================================
# MAIN MATCHING LOGIC
# =============================================================================

def build_spc_lookup(spc_rows):
    """
    Build a dict keyed by (player_lower, gem_normalized_parallel, card_number)
    -> list of SPC rows.

    We store a list per key because SPC data is daily — the same card can
    appear multiple times across different snapshot dates. When merging we
    pick the most recent snapshot.
    """
    lookup = {}
    for row in spc_rows:
        player, parallel, card_number = parse_spc_product_name(row['product-name'])

        # Skip non-card rows (boxes, sealed product, etc.)
        if not card_number:
            continue

        # Translate SPC parallel label to GemRate equivalent
        parallel_mapped = PARALLEL_MAP.get(parallel, parallel)

        key = (player.lower().strip(), parallel_mapped, card_number)
        lookup.setdefault(key, []).append(row)

    return lookup


def merge_rows(spc_row, gem_row):
    """
    Combine one SPC row and one GemRate row into a single merged output dict.
    """
    return {
        # --- Identifiers ---
        'spc_id'                  : spc_row['id'],
        'gemrate_id'              : gem_row['Gemrate_id'],
        'console_name'            : spc_row['console-name'],

        # --- Card identity ---
        'player_name'             : gem_row['Name'],
        'parallel'                : gem_row['Parallel'],
        'card_number'             : gem_row['Card #'],
        'card_description'        : gem_row['Card Description'],

        # --- Pricing (SPC) ---
        'loose_price'             : spc_row['loose-price'],        # raw ungraded price
        'graded_price'            : spc_row['graded-price'],       # avg across all grades
        'manual_only_price'       : spc_row['manual-only-price'],  # PSA 9 price
        'bgs_10_price'            : spc_row['bgs-10-price'],       # PSA 10 price

        # --- Sales activity (SPC) ---
        'sales_volume'            : spc_row['sales-volume'],       # total sales count
        'spc_date'                : spc_row['release-date'],       # snapshot date

        # --- Grading summary (GemRate) ---
        'gem_rate_all_time'       : gem_row['Gem Rate - All Time'],
        'gem_rate_past_month'     : gem_row['Gem Rate - Past Month'],
        'total_graded'            : gem_row['Total'],
        'total_gems'              : gem_row['Gems'],
        'graded_past_month'       : gem_row['Graded Past Month'],
        'graded_prior_month'      : gem_row['Graded Prior Month'],
        'momentum_30d'            : gem_row['30 Day Momentum'],
        'last_gem_date'           : gem_row['Last Gem'],
        'last_graded_date'        : gem_row['Last Graded'],

        # --- PSA grade % breakdown (GemRate) ---
        'pct_psa_10'              : gem_row['10'],
        'pct_psa_9'               : gem_row['9'],
        'pct_psa_8'               : gem_row['8'],
        'pct_psa_7'               : gem_row['7'],
        'pct_psa_6'               : gem_row['6'],
        'pct_psa_5'               : gem_row['5'],
        'pct_psa_4'               : gem_row['4'],
        'pct_psa_3'               : gem_row['3'],

        # --- Links ---
        'cardladder_all_graded_url' : gem_row['All Graded Sales'],
        'gemrate_url'               : gem_row['Universal Pop'],
        'psa_cert_url'              : gem_row['Recent Cert'],
    }


def run_match(spc_path, gem_path, out_path):
    print(f'Loading SPC:     {spc_path}')
    spc_rows = load_spc(spc_path)
    print(f'  -> {len(spc_rows)} rows')

    print(f'Loading GemRate: {gem_path}')
    gem_rows = load_gemrate(gem_path)
    print(f'  -> {len(gem_rows)} rows')

    # Build lookup from SPC side
    spc_lookup = build_spc_lookup(spc_rows)

    matched = []
    unmatched = []

    for gem_row in gem_rows:
        name   = gem_row['Name'].lower().strip()
        par    = normalize_gem_parallel(gem_row['Parallel'])
        number = gem_row['Card #'].strip()
        key    = (name, par, number)

        if key in spc_lookup:
            # Pick most recent SPC snapshot for this card
            best_spc = sorted(
                spc_lookup[key],
                key=lambda r: r.get('release-date', ''),
                reverse=True
            )[0]
            matched.append(merge_rows(best_spc, gem_row))
        else:
            unmatched.append(gem_row)

    # Write matched output
    if matched:
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(matched[0].keys()))
            writer.writeheader()
            writer.writerows(matched)
        print(f'\nMatched: {len(matched)} rows  ({len(matched)/len(gem_rows)*100:.1f}%)')
        print(f'Written: {out_path}')

    # Write unmatched log (for review / adding new parallel mappings)
    if unmatched:
        unmatched_path = out_path.replace('.csv', '_UNMATCHED.csv')
        with open(unmatched_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(unmatched[0].keys()))
            writer.writeheader()
            writer.writerows(unmatched)
        print(f'Unmatched: {len(unmatched)} rows -> {unmatched_path}')
        # Show which parallels are causing misses
        from collections import Counter
        par_counts = Counter(normalize_gem_parallel(r['Parallel']) for r in unmatched)
        print('\nUnmatched parallel breakdown:')
        for par, count in par_counts.most_common():
            print(f'  {par!r}: {count}')


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Match SPC CSV to GemRate CSV')
    parser.add_argument('--spc', required=True, help='Path to SPC CSV file')
    parser.add_argument('--gem', required=True, help='Path to GemRate CSV file')
    parser.add_argument('--out', required=True, help='Path for merged output CSV')
    args = parser.parse_args()

    run_match(args.spc, args.gem, args.out)