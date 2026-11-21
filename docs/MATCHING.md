# How a pack is compared

The matcher takes the reviewed fields, the selected snapshot and any unresolved extraction flags. It evaluates every row in that snapshot. The report uses the original printed strings. The application selects the collection explicitly. An unavailable, malformed, empty or wrong-collection snapshot produces **Source unavailable**.

## What counts as agreement

- **Batch** must agree character for character after trimming the ends and uppercasing ASCII letters. Internal spaces, separators and leading zeros matter. A one-position O/0 or I/1 difference can nominate a possible match when the product agrees. It never creates an exact match.
- **Product** must agree with the source name or its transcribed full printed cell. Normalization uses NFC, lowercase, single spaces and standard apostrophes and dashes. It preserves digits, word order, formulation and strength units. A candidate name may share a non-generic word of at least three letters, or differ by one insertion, deletion or substitution in a word at least five letters long. Dosage forms and common company words are excluded from this candidate search. A similar name needs an exact batch to appear.
- **Strength** must agree when supplied by the notice. Spaces between a number and a common unit can be omitted. Units and numbers must agree, including in combinations. The matcher performs no dose conversion.
- **Manufacturer** must agree when identified by the authority. An exact normalized issuer-provided company name or full printed manufacturer cell qualifies. Abbreviations, spelling variation and incomplete company names go to review. An authority entry such as “Under Investigation” remains visible in the source evidence and supplies no identified manufacturer.
- **Dates** are displayed as supporting details. A date alone cannot identify a product or batch. As a separate check, expiry in MM/YYYY, YYYY-MM, day/month/year, ISO calendar date, or named month plus four-digit year is compared with the civil date in India. A month-only expiry runs through the last day of that month. Missing, invalid and two-digit-year dates are reported as unresolved. An expiry preceding the manufacturing date is flagged even when both years are in the future.

## How findings are selected

1. A validated snapshot and a readable product name are prerequisites for comparison. Partial identifiers with explicit obscured characters (for example, a question mark) and explicit missing values such as “unknown” remain unresolved. A batch number alone gives **Insufficient information**.
2. An exact product and batch plus agreement on every manufacturer and strength supplied by that row gives **Published alert matches this batch**. An unresolved OCR flag on a required identifier prevents this result. The notice's own classification and investigation caveats travel with the row. If several rows satisfy the rule, the report includes all those exact rows.
3. An exact product and a missing or visually ambiguous batch, or an exact batch and a similar product, can give **Possible match — check these details**. Unresolved OCR flags or disagreement on manufacturer or strength also require review. The marked fields identify the reason. A clearly different batch rules out that row even when product and manufacturer agree. A batch shared by an unrelated product also rules out that row.
4. Without any candidate, an absent or unresolved product or batch gives **Insufficient information**. With both supplied, the result is **No matching alert found in the records checked**. This result refers only to the included rows as of the snapshot date.
5. Printed/encoded conflicts and expiry remain on the report independently of the selected finding. A result refers to the values the user reviewed. A copied code can reproduce these identifiers on a different physical pack.

## Reproducible checks

From the project root, run `node --test tests/matching.test.mjs` with Node 24.20 or a compatible Node release with native TypeScript stripping. The test clock is fixed at 20 November 2026 except in calendar-boundary tests. The following actual results were observed in this command. These are matcher-input tests, not camera or OCR accuracy measurements.

| Input | Expected | Observed |
| --- | --- | --- |
| Fictional Velmora Tablets, 25 mg, Lumen Vale Labs, 00742A | Published match | Published match |
| Same pack, batch 00791B | No match in snapshot | No match in snapshot |
| Same batch 00742A with unrelated Kelnavir Tablets | No match in snapshot | No match in snapshot |
| Fictional batch O0742A with exact product | Possible, batch highlighted | Possible, batch highlighted |
| Fictional batch 742A with exact product | No match in snapshot | No match in snapshot |
| Missing product with only 00742A | Insufficient | Insufficient |
| Fictional exact product without batch | Possible, batch highlighted | Possible, batch highlighted |
| Exact fictional identifiers plus past expiry and encoded batch conflict | Published match, expired, conflict retained | All three present |
| Unavailable snapshot or demo collection supplied for a real check | Source unavailable | Source unavailable |
| Official-source row transcription replay, three included rows | Each retrieves its own row and classification | 3/3 retrieved |

See [SOURCES.md](SOURCES.md) for the official snapshot and refresh procedure. The official-row replay checks data integration and recoverability. Field performance requires independent pack photographs with independently verified print and source evidence.
