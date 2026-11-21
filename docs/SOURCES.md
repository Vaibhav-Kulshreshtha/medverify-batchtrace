# Official alert snapshot

Version `2026-11-20.1` records a manual source review on 20 November 2026. The two notices cover March 2025 and both were published on 18 April 2025. The snapshot searches three selected rows. It excludes the other 68 rows in the central-laboratory NSQ notice, state laboratory lists and other months. A pack can have a published alert outside this selection. [CDSCO alerts index](https://www.cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/)

| Official notice | Selected PDF page and printed serial number | Batch as printed | Classification |
| --- | --- | --- | --- |
| [March 2025 central-laboratory notice](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/NSQ%20Alert%20For%20The%20Month%20of%20March-2025.pdf#page=1) | Page 1, S.No. 2 · Pantoshang-40 | `SP240165` | Not of Standard Quality (NSQ) |
| [Same central-laboratory notice](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/NSQ%20Alert%20For%20The%20Month%20of%20March-2025.pdf#page=1) | Page 1, S.No. 3 · Pantoprazole tablets IP 40 mg | `0081` | Not of Standard Quality (NSQ) |
| [March 2025 spurious-drugs notice](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/mdmar25.pdf#page=1) | Page 1, S.No. 1 · Telma 40 | `5240226` | Spurious list. The authority qualifies this finding as purported, pending investigation. |

## Reading the rows

In `public/data/official.json`, `noticeId` joins each row to the issuing authority, full PDF title, index publication date, direct PDF and SHA-256 fingerprint. The page is one-based. The row is the printed serial number inside the document. `printedProduct` and `printedManufacturer` preserve the full cell text with line breaks joined. `product`, `strength` and `manufacturer` isolate the printed brand or generic name, stated strength and named company for comparison. `mfg`, `expiry` and `batch` are strings. The `normalized` object keeps the matching keys for inspection.

The two central-lab rows name the laboratory and report a dissolution test failure. In row 2 the number 40 occurs in the brand name only. Its separate strength field is empty. On the spurious list, “Under Investigation” appears in the manufacturer cell, so the matchable manufacturer is empty. Read the authority's remarks with the classification. The row identifies a published batch report and does not establish the origin of the pack in hand. [Central-laboratory notice](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/NSQ%20Alert%20For%20The%20Month%20of%20March-2025.pdf#page=1) · [Spurious-drugs notice](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/mdmar25.pdf#page=1)

## Corrections checked

During this review the two download links in the CDSCO index resolved through its download viewer to the PDF URLs above. The index lists revisions for November 2024, January 2025 and May 2025. We found no indexed revision targeting the three selected March 2025 rows. The 21 August 2025 corrigendum concerns a Cosmetics Division letter to Spectra Medical India and changes serial numbers in that letter. The search covered the official alert index, the archive on the newer NSQ page, and an official-domain search for corrections to the selected identifiers. Later decisions or unindexed corrections may exist. [Alert index](https://www.cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/) · [NSQ alerts](https://www.cdsco.gov.in/opencms/opencms/en/Notifications/nsq-drugs/) · [21 August corrigendum](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/Corrigendum%20order%20dated%2021.08.2025.pdf)

## Refreshing a release

1. Open both official indexes. Check the newer public NSQ listing for current releases and the archive for revisions, withdrawals and corrigenda. Search for each existing batch and manufacturer as well as each notice month. Record the documents reviewed and their publication dates. [Historical alert index](https://www.cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/) · [Current CDSCO NSQ portal](https://www.cdsco.gov.in/opencms/opencms/en/Notifications/nsq-drugs/)
2. Follow the download icon. Where it opens an HTML viewer, use the embedded PDF's URL. Download that PDF, inspect the actual table page, and run `shasum -a 256 filename.pdf` on macOS. A different hash at an existing URL requires a fresh row-level comparison. The original hashes are in the notice entries.
3. Transcribe the selected row with its classification, source qualifications, printed strings, publication date and one-based location. Preserve zeroes, punctuation and units. Keep unknown units and unidentified manufacturers empty as comparison fields. Have a second reviewer compare each value to the rendered PDF before public distribution.
4. Apply applicable corrections before enabling affected rows. Retire superseded rows from active matching. Record the previous snapshot version, old and new notice links, changed rows and reason in this history. Where the source is too ambiguous to reconcile, withhold that row and state the coverage reduction.
5. Update the JSON version, snapshot date, normalized values and coverage note, then update this table. Keep the fictional demo registry separate. Run the matching and browser tests and check at least one real-mode report against each affected PDF. Verify printed code values and all source links. Release data and code together so the report describes the data installed on that device.

## Before routine pharmacy use

A maintained service would need agreed national and state source coverage, a named reviewer and backup, repeatable update checks, targets for publishing revisions, stale-data handling, and a traceable history of withdrawals. Validate with licensed pharmacists and independently transcribed physical packs across lighting conditions, languages, devices and pack types. Measure mistaken alerts and missed alerts by field, product, batch and notice category, including unreadable images. Confirm publication arrangements before redistributing source documents. [CDSCO copyright policy](https://cdsco.gov.in/opencms/opencms/en/Copyright-Policy/)

## Offline inspection

Both original PDFs are bundled for local inspection under `public/data/notices/`. **Open original notice** points to CDSCO. **View offline PDF** opens the local PDF at the cited page. `npm test` checks the local bytes against each recorded SHA-256. When refreshing a notice, replace its local PDF and recorded digest together and check the transcribed page again.
