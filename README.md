# MedVerify — Counterfeit Medicine Detector

**Check a medicine pack for reported issues.** MedVerify screens a reviewed product and batch against a small selection of published Indian medicine alerts. Every hit points to an authority, notice, page and row. Physical authenticity requires evidence beyond this check.

[Open the live MedVerify demo](https://vaibhav-kulshreshtha.github.io/medverify-batchtrace/)

GitHub Pages publishes the production build after tests pass on the `main` branch. The hosted demo needs a connection to load its bundled files. For a classroom session without Wi-Fi, use the local setup below.

## Run on a Mac

Use Node.js 22.18 or newer and npm. This project was built and tested with Node 24.20.0. The first install needs internet access or a populated npm cache. Google Chrome is needed for the automated browser suite.

```sh
git clone https://github.com/Vaibhav-Kulshreshtha/medverify-batchtrace.git
cd medverify-batchtrace
npm ci
npm run build
npm run preview
```

Open [MedVerify on localhost](http://127.0.0.1:4178/). Keep the terminal running. For hot reload during development, use `npm run dev` in place of the preview command. Only one server can occupy port 4178. To use another port, run `npm run preview -- --port 4180` and open that port. Both commands bind to the loopback interface.

Once the project is installed and built, Wi-Fi can be switched off before opening the app. The UI, OCR worker, WebAssembly core, English model, code readers, sample PNGs, records and two reference PDFs are served from this Mac. The official website links require a connection. There are no credentials, GPU requirements, paid APIs or backend services.

## Check a pack

1. Select **Scan a medicine pack**, then **Open camera** or **Upload an image**. Frame the printed panel in bright, even light. Review the photo, retake it if needed, then choose **Read pack details**. **Enter details manually** starts from an empty transcription.
2. Compare the six fields with the image. Enlarge the photo to inspect small characters. Each value shows its origin. Missing or uncertain values are marked. Confirm a flagged reading only when you can distinguish its characters. Inspect decoded contents and any differences from the print.
3. Acknowledge the image comparison and select **Check published alerts**. A hit shows **Your pack** and **Published notice** side by side. The report includes exact classification, qualifications, expiry, unresolved readings, source coverage and check time. Select **Print or save report** and use the browser’s PDF destination to retain a copy.
4. **Edit details** discards the finding and requires a fresh comparison. **Check a new pack**, **Check a real pack**, returning home or reloading clears the scan session.

JPEG, PNG and WebP images up to 20 MiB are supported. Large images are checked before full decode and resized to a maximum 2,400-pixel edge. Convert HEIC to JPEG first. Camera use needs a secure browser context, such as localhost on the Mac. A denied or missing camera leaves upload and manual entry available.

## 90-second judge walkthrough

| Time | Action | Observe |
| --- | --- | --- |
| 0–20 s | From Home choose **Try a demo pack → Use pack A → Read pack details**. | An actual image is read. Its printed batch is `00742A`. The decoded QR contains the same batch. Check the photo-review box and choose **Check published alerts**. |
| 20–35 s | Compare the two columns, then **Open original notice**. Return to the report and choose **Print or save report**. | The fictional source is page 1, row 1. The print preview contains the selected evidence and reviewed fields. Cancel printing to continue. |
| 35–65 s | Select **MedVerify** in the header to return home. Open **Try a demo pack → Use pack B → Read pack details**. Review and check. Select **Edit details**, change only the batch from `00791B` to `00742A`, acknowledge and check again. | The first check has no matching row. The edit produces a match on the reviewed values, while the report still shows the QR’s different batch. |
| 65–90 s | Return home and open **Try a demo pack → Use pack C → Read pack details**. Acknowledge and check the incomplete transcription. Choose **Edit details**, then enter `Velmora Tablets` and `00742A` as supplied training values. Review and check again. | The obscured name and batch were left blank. The finding changes from **Insufficient information** to a fictional match after manual completion. **Check a real pack** clears the sample and selects official records. |

The demo picker also offers **Download image** and **Upload a demo image**. Download a PNG, rename it, then upload it in demo mode to repeat the same workflow. For a real check, uploading that same PNG searches only official records. The collection selector determines which data may be searched. The reviewed fields determine the finding.

## Official coverage

Snapshot reviewed **20 November 2026**. It contains **three selected rows from two CDSCO notices for March 2025**, both published on **18 April 2025**. The snapshot date is the date of review. It does not extend notice coverage through November 2026.

| Classification | Product and batch | Original evidence |
| --- | --- | --- |
| Not of Standard Quality (NSQ) | Pantoshang-40 · `SP240165` | [CDSCO central-laboratory notice, page 1, row 2](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/NSQ%20Alert%20For%20The%20Month%20of%20March-2025.pdf#page=1) |
| Not of Standard Quality (NSQ) | Pantoprazole tablets IP 40 mg · `0081` | [Same notice, page 1, row 3](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/NSQ%20Alert%20For%20The%20Month%20of%20March-2025.pdf#page=1) |
| Spurious list, described as purported pending investigation | Telma 40 · `5240226` | [CDSCO spurious-drugs notice, page 1, row 1](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/mdmar25.pdf#page=1) |

**To reproduce an official finding**, choose **Enter details manually**. Enter product `Pantoprazole tablets IP`, strength `40 mg`, batch `0081`, manufacturer `Hindustan Antibiotics Ltd.`, manufacturing date `05/2024` and expiry `04/2026`. The report identifies the published NSQ row and separately flags the past expiry. The other rows of the source PDF can be read in the offline copy. Only the selected rows are indexed.

The source notes describe PDF fingerprints, field transcription, the correction search and the refresh procedure. Matching requires exact batch and product agreement plus agreement on strength and manufacturer where the authority provides them. Tolerances for typography, review-only similarity and missing fields are documented. [Source review and refresh](docs/SOURCES.md) · [Matching rules and test cases](docs/MATCHING.md)

## Judge questions

| Question | Answer |
| --- | --- |
| What if someone copies a valid QR? | The copy yields the same decoded text. MedVerify shows what it supplied, flags differences from the print and compares the reviewed identifiers to notices. It cannot establish pack-level provenance from a code. |
| What if the batch has never appeared in an alert? | A sufficiently identified pack can return **No matching alert found in the records checked**. A hazardous or falsified pack may have no published alert, or its notice may fall outside these three rows. |
| How does an OCR error avoid becoming a false flag? | The user must compare a scan with the image before checking. Missing or uncertain required fields block an exact match. Batch alone is insufficient, and O/0 and I/1 remain distinct. A wrongly read value that a reviewer accepts could still cause an error. |
| How do I independently verify the finding? | Open the authority’s PDF at the cited page and printed row. Compare its product, batch and available qualifiers with the actual pack. The report shows the original cells, classification, caveat and date. The bundled PDF can be checked against its SHA-256 fingerprint. |
| What works without venue Wi-Fi? | After installation, the local server supports capture, upload, OCR, codes, matching, offline PDFs and printing. Rechecking the publisher’s current online records requires internet. |
| What would a pharmacy need before routine use? | A representative physical-pack study with independent ground truth, measured false alerts and missed alerts, pharmacist usability testing, wider national and state coverage, and an accountable update, correction and withdrawal process. See the evaluation for the device and operational work still needed. |

## Implementation and verification

React, TypeScript and Vite produce a static application. OCR and barcode decoding run in disposable browser workers. A backend would add image transfers and infrastructure without improving this local comparison. Images, transcriptions and findings stay in memory. Camera tracks stop when leaving capture. Printing creates a copy under the user’s control.

- `src/reader.ts` validates and resizes files, then invokes the bundled OCR and code readers. `src/transcription.ts` parses their output and tracks origins, missing values and disagreements.
- `src/evidence.ts` validates the selected snapshot, compares fields and evaluates expiry independently. The two collections live in separate JSON files in `public/data`.
- `src/Capture.tsx`, `src/Review.tsx` and `src/Result.tsx` implement capture, correction and the printable comparison. The presentation reads the same evidence object for screen and print.
- The three sample images ship in `public/samples`. Optional regeneration on macOS uses `python3 scripts/make-samples.py` with Pillow and OpenCV installed. These Python packages are unnecessary for installation, normal use and the browser suite.

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser suite starts a separate production preview on port 4291, uses installed Chrome, and shuts its own server down. Set `CHROME_PATH` to an alternative Chromium executable if needed. Screenshots, an A4 report and observed results are written to `test-results/`. See the separate measurements for synthetic images and physical photographs. [Evaluation and device-testing limits](docs/EVALUATION.md) · [Asset provenance](docs/ASSETS.md)
