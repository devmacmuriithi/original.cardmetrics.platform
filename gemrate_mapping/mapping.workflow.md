Let me walk you through it visually.Here's how the whole thing works, from end to end.**The three-step process:**

**Step 1 — Parse.** The SPC file stores card names as a single string like `"LeBron James [Silver] #130"`. The script splits that into three separate pieces: player name, parallel, and card number. The GemRate file already stores these as separate columns, but its parallel names have "Prizm" and "1/1" appended, so those get stripped off.

**Step 2 — Translate.** This is the core of the whole thing. SPC and GemRate use different naming conventions for the same parallel. The `PARALLEL_MAP` dictionary at the top of the script is a manual translation table — 60 entries covering every known naming difference. For example, SPC calls it `"Choice Blue"` while GemRate calls it `"Blue Choice"`. After translation, both files are speaking the same language.

**Step 3 — Match.** The script builds a lookup dictionary from the SPC data, keyed on `(player, translated_parallel, card_number)`. Then for every GemRate row it builds the same key and looks it up. If the key exists, the two rows get merged into one output row. If not, the GemRate row goes to the unmatched log.

---

**How to use it for a new set:**

```bash
python3 match_spc_to_gemrate.py \
  --spc  SPC-G99999.csv \
  --gem  gemrate-G99999.csv \
  --out  matched_G99999.csv
```

The only thing you'll ever need to maintain is the `PARALLEL_MAP` dictionary. If a new set introduces a parallel you haven't seen before, the script will tell you — it prints a breakdown of exactly which parallel names caused misses. You then add that one line to the dictionary and re-run. Everything else is automatic.



**Why we do the mapping**

The core problem is that you have two separate data sources that each know about the same physical card, but they don't share a common ID. SPC identifies a card as `"LeBron James [Silver] #130"` — GemRate identifies the same card as `"LeBron James Silver Prizm 130"`. Neither file has a field that says "this is card X, go look up card X in the other file." The mapping is the bridge that lets you say with confidence: these two rows are describing the same card.

Without the mapping, you'd have two isolated tables — pricing data in one place, grading population data in another — and no way to connect them.

---

**What the final merged file gives you**

Before mapping you could only ask questions like:
- What's the PSA 10 price of LeBron Silver? *(SPC only)*
- What percentage of LeBron Silvers gem out? *(GemRate only)*

After mapping you can ask questions that require both sources together:
- Which cards have a high PSA 10 price AND a low gem rate? Those are the ones where scarcity is driving premium — good buying signal.
- Which cards have a high gem rate AND high sales volume? Easy to gem, liquid market — lower risk.
- Which cards are seeing grading momentum increase while price is still flat? Potential early signal before price moves.
- What's the PSA 10 to raw price ratio, and how does it compare to the set average gem rate?

That last category — comparing a card against its own set — is exactly what your client was building toward in the transcript. He wants to know not just "this card has a 19% gem rate" but "this card's gem rate is below the set average of 22%, meaning it's harder to gem than most cards in this set, which explains why the PSA 10 trades at a bigger premium." You can only calculate that set average and make that comparison once the cards are matched and you know which set each GemRate row belongs to.

---

**How to perform future mappings**

Each new set you want to cover follows the same three steps:

**Step 1 — Get the two files for that console ID**

From SPC, download the CSV for that set. From GemRate, download the population CSV for the same set. Both will be scoped to one console ID, just like the files you already have for G78842.

**Step 2 — Run the script**

```bash
node match_spc_to_gemrate.js \
  --spc  SPC-G99999.csv \
  --gem  gemrate-G99999.csv \
  --out  matched_G99999.csv
```

For most sets this will be all you need. The `PARALLEL_MAP` already covers every parallel type seen in Panini Prizm basketball — Silver, Gold, Red, Blue, Fast Break variants, Choice variants, Wave variants, and so on. If the new set is also Panini Prizm (or a similar product line), you'll likely get 95%+ match rate with zero changes to the script.

**Step 3 — Check the unmatched log**

The script always writes a `_UNMATCHED.csv` alongside the output, and prints a breakdown like this:

```
Unmatched parallel breakdown:
  "variation-fast break": 20
  "plum blossom": 1
```

If you see a parallel name in that list, it means that parallel exists in GemRate but isn't in the `PARALLEL_MAP` yet. To fix it, open the script, find the `PARALLEL_MAP` section, and add one line:

```js
'fotl bronze'  :  'bronze fast break',   // whatever the SPC name maps to
```

Then re-run the script. That parallel will now match. You only ever need to add a mapping once — once it's in the dictionary it works for every future set that uses that parallel.

The 87 unmatched rows in your current file are mostly `variation-fast break`, `variation-bronze fast break`, and `variation-neon green fast break` — these are GemRate parallel names that don't have a clean SPC equivalent yet because SPC doesn't seem to track those specific variation sub-types in this set. They're edge cases and low volume, which is why your client said to only worry about the top 300-500 cards anyway — those 87 are likely cards that sell rarely and wouldn't make the cut regardless.