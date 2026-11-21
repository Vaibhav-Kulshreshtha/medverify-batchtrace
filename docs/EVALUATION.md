# Evaluation on 20 November 2026

The verification host reported an Apple M1 processor and 8 GiB RAM. A clean lockfile install, strict TypeScript check and production build completed successfully. All 33 automated matching, transcription and source-integrity tests passed. The production browser suite passed 14 workflow checks. The production UI was exercised in Chrome 157.0.8103.79 at 1366 × 900 and 360 × 780 CSS pixels. The browser suite blocked external origins. Matching tests used a fixed clock for expiry boundaries. These results apply to the included images, rows and browser.

## Reproduce

Run the verification commands in the [project README](../README.md). The production browser suite saves screenshots, `demo-comparison.pdf`, `real-photo-results.json` and `browser-results.json` under `test-results/`. A failed run writes a failure screenshot.

To repeat the standalone reader check, run `npm run dev -- --port 4179` in one terminal. From the project directory in another, run the following command. This checks the three demo PNGs and a generated EAN-13 image. A final JPEG path may be supplied to inspect a particular photograph.

```sh
READER_TEST_URL=http://127.0.0.1:4179 node scripts/evaluate-reader.mjs
```

## Synthetic pack images

| Image and count | Expected | Observed |
| --- | --- | --- |
| Clear fictional A and B, two PNGs | Product, strength, manufacturer, batch, manufacturing date and expiry agree with each printed label. | Each of the six fields was exact on 2/2 images. Batch retained leading zeros in both. Both QRs decoded to the corresponding batch. A matched the fictional notice. B returned no match. |
| Damaged fictional C, one PNG | Product and batch are unrecoverable. Four other printed fields remain visible. | Both obscured fields stayed empty. Strength, manufacturer and both dates were exact on 1/1. The finding was insufficient. Entering the supplied training name and batch produced a fictional match. |
| Independent synthetic retail barcode, one PNG | Decode EAN-13 5901234123457. Supply no batch. | Exact EAN-13 on 1/1. Zero pack fields supplied by the code. |

All demo PNGs, including renamed uploads, pass through pixel decoding and OCR. The evaluator passes neutral filenames to the reader. The result engine receives the reviewed strings and the selected registry.

## Photographs of physical packaging

Two unmodified, independently published photographs were uploaded through the ordinary real-pack UI. No fields were corrected for this measurement. Both images and attribution are in the test fixture directory. [Photograph provenance and licenses](../tests/fixtures/ATTRIBUTION.md)

| Photograph and count | Reference details | Actual structured result |
| --- | --- | --- |
| Archived Singapore pharmacy storage label, one photograph | The museum catalog identifies Atenolol Tablets and 50 mg. The label is distant and oblique. | Product 0/1 and strength 0/1 recovered. All six fields were blank and marked for review. **Insufficient information**. |
| Welset-650 Indian blister strip, one photograph | The brand and 650 mg strength are visible on the foil. The strip is opened and the batch panel is blurred. | Product 0/1 and strength 0/1 recovered. All six fields were blank and marked for review. **Insufficient information**. |

OCR produced fragments of text on these photographs. Neither image yielded a reliable product-and-batch pair. Batch transcription accuracy was not scored on the two real photographs. The synthetic results do not estimate performance in an Indian pharmacy.

## Evidence and workflow checks

| Scenario | Expected | Observed |
| --- | --- | --- |
| Three transcribed CDSCO records queried against the official snapshot | Recover each source, classification and precise row | 3/3 returned their own row |
| Official batch 0081 with complete identifiers and past expiry | Published NSQ match plus a separate expiry issue | Both visible together, with page 1, row 3 and a working local reference PDF |
| Same official row missing manufacturer | Possible match, with manufacturer highlighted | As expected |
| Different product sharing a batch or same product with a different batch | No exact alert association | Both yielded no match for the tested unrelated values |
| O/0 or I/1 substitutions and omitted leading zeros | No silent character repair | Confusable positions were marked for review. Removing zeros changed the lookup. |
| Official data load failure | Source unavailable, with no negative finding | Retry recovered after the request was restored |
| Pack B changed to pack A’s batch | Recheck the new values and keep the differing encoded batch visible | Corrected batch matched. The QR retained 00791B. |
| Edit while an older comparison is pending | Discard stale result | Only the current field values reached the report |
| Simulated rear-facing camera stream | Capture the video frame, stop the camera track and allow close inspection | The capture requested the environment-facing camera, stopped its track and produced a photo with batch 00742A. Full-size review opened and closed. |
| Camera permission denied, invalid image, retake, manual fallback | User can continue without a camera | All exercised at 360 px |
| Demo → real collection | Clear photo, fields, decoded contents and finding | All cleared. Fictional identifiers did not match in real mode. |
| Upload → local OCR and QR → report with external requests blocked | Complete flow with no remote calls | Complete. Desktop and mobile pages had no horizontal overflow. The A4 PDF contained the comparison, provenance, checked time, coverage and uncertainties. |

The A4 sample was rendered and visually inspected on both pages. Physical printer drivers and the OS save-file dialog still need device testing. [Complete matching rules and expected results](MATCHING.md)

## Before routine pharmacy use

- Test physical rear-camera selection and permission prompts on iOS Safari and Android Chrome. Cover focus distance, glare on foil, curved strips, orientation, memory under repeated large uploads, retakes and interrupted sessions. The browser viewport checks and simulated permission denial do not measure camera hardware behavior.
- Collect consented photos across Indian languages, brands, product forms, phones and lighting conditions. Obtain independent pharmacist transcriptions and adjudicate discrepancies. Report field-level recall, incorrect substitutions, unresolved fields, missed alerts and false alerts on a held-out set.
- Test how patients and pharmacists interpret each finding and the absence of a match. Verify screen-reader reading order, local language comprehension and print use at the counter.
- Assign owners for national and state sources, versioning, correction monitoring, withdrawals, refresh deadlines and incident response. Review reuse terms, distribution security, privacy and regulatory obligations before public launch. [Source review and refresh procedure](SOURCES.md)
