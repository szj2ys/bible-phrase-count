# bible-phrase-count

Reproducible phrase counting for verse-indexed, public-domain Bible text.

The claim *"the Bible says **fear not** 365 times — one for every day of the
year"* circulates widely and has no documented source. This repo is the counting
rule, the tool that applies it, and the full corpus to run it against — so you
can check the number instead of trusting it.

## Result

Counted against the King James Version:

| Rule | Verses |
|---|---|
| Exact phrase `fear not` | **62** |
| `fear not` OR `be not afraid` (union) | **88** |
| `feared not` / `feareth not` (inflected) | 8 |
| `fear thou not` | 4 |
| `be not dismayed` | 4 |
| `fear` in any form | 400 occurrences in 385 verses |

The Chinese Union Version (和合本) uses four separate `不要` constructions:

| Rule | Verses |
|---|---|
| `不要怕` / `不要惧怕` / `不要害怕` / `不要恐惧` (union) | **102** |
| `不要惧怕` | 49 |
| `不要怕` | 33 |
| `不要害怕` | 19 |
| `不要恐惧` | 3 |

Not 365. Not close. The "365" was almost certainly chosen because a year has
days, not because anyone counted.

## Install

No dependencies. Node 18+.

```sh
git clone https://github.com/szj2ys/bible-phrase-count && cd bible-phrase-count
node test.mjs
```

`test.mjs` is the argument, not a formality: it runs the tool over the **whole
KJV (31,102 verses)** and the **whole CUV (31,100 verses)** and asserts that it
reproduces every number in the tables above.

## Use

Count a phrase across a corpus — `.json`, `.jsonl`, or `.jsonl.gz`:

```sh
node count.mjs --file data/kjv.jsonl.gz --phrase "fear not"
```

```json
{ "phrase": "fear not", "verses": 62, "occurrences": 62, "matches": [ ... ] }
```

Re-derive a published count from its audit trail, one row per matched verse:

```sh
node count.mjs --audit data/fear-not-counts.csv --rule "fear not"
# fear not: 62 verses

node count.mjs --audit data/fear-not-counts.csv
# { "rows": 398, "byRule": { "fear not": 62, ... } }
```

## The rule

A count is only a result if the rule that produced it is on the page next to it.

1. **Corpus.** Public-domain text, verse-indexed. KJV for English, CUV for
   Chinese.
2. **Whole words, not substrings.** Otherwise `fear` also matches `fearful`,
   `fearfulness` and `God-fearing` — roughly a 15% inflation.
3. **Whitespace joins words, punctuation never does.** `with all fear; not only
   to the good` is not the phrase `fear not`; the semicolon is a clause break.
   Normalising punctuation away turns verses like 1 Peter 2:18 into false
   positives.
4. **Verses for phrase claims, occurrences for word claims.** "400 occurrences
   in 385 verses" and "62 verses" answer different questions. Both are correct.
5. **Rules are reported separately, never silently merged.** Every added variant
   is a judgment call, so it gets its own row.

Two of those rules exist because the naive version of this tool got them wrong
on the first pass over the full corpus. Both bugs were silent — the count looked
plausible either way. That is the whole argument for shipping the corpus and the
test rather than a number.

## Data

The audit trail is one row per matched verse, so you can diff the work rather
than trust it. Columns: `lang, translation, rule, reference, book_slug, book,
book_zh, testament, chapter, verse, text` — the `rule` column says *why* each row
is in the file.

- `data/fear-not-counts.csv` / `.json` — the matched verses
- `data/kjv.jsonl.gz` — the full KJV (31,102 verses)
- `data/cuv-simplified.jsonl.gz` — the full CUV, Simplified (31,100 verses)

Bible text is public domain: KJV, and the CUV via
[open-bibles](https://github.com/seven1m/open-bibles).

## Provenance

The counts and the method write-up live at **TrustBible**, a Bible Q&A tool that
quotes the exact verses it cites:

- <https://trustbible.org/blog/how-many-times-does-the-bible-say-fear-not/> — full methodology
- <https://trustbible.org/data/fear-not-counts.csv>
- <https://trustbible.org/data/fear-not-counts.json>

The dataset is **CC-BY-4.0** — reuse it, including commercially, with
attribution. The code is MIT.

## Contributing

If you find an error, open an issue with the verse reference and the rule you
think applies. Corrections are the point of publishing the method next to the
result.

## License

Code: MIT (`LICENSE`). Data: CC-BY-4.0.
