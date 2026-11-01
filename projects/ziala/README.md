# ZIALA: closet uploads, styling rules, and shopping search

A local development prototype with persisted clothing-photo uploads, optional structured AI receipt extraction, and a server-side shopping search adapter. GitHub source only; no hosted Site. This is not a production account-based application.

## Run the integrated app

Requires Node.js 22+ and npm.

```sh
cd projects/ziala
npm install
cp .env.example .env
npm start
```

Open http://127.0.0.1:3100. The server binds only to loopback. `ZIALA_PORT` can change the port.

Uploads work without a shopping key. To enable real product searches, put your own SerpApi key in the ignored `.env` file as `SERPAPI_API_KEY=...`, then restart the server. Never paste keys into the UI, commit them, or share them in chat. Searches use the configured provider account and its quota. No provider account is created automatically.

## Clothing uploads and persistence

- Select one JPEG, PNG, or WebP up to 20 MB and 80 megapixels in the browser. The browser scales it to a maximum of 1600 × 1600 before upload, so common 48-megapixel phone photos need not be rejected. Browser decode failures have a distinct message. The server separately enforces a 5 MB, 30-megapixel input limit and decodes/re-encodes the actual uploaded image. Other formats and direct animated uploads are rejected; HEIC is not supported.
- The server decodes the actual image, applies orientation, resizes to a maximum of 1600 × 1600, re-encodes as JPEG, and strips source metadata. Transparent images are flattened on white.
- Confirm name, category, ready/laundry state, and occasion tags. Tags are manual; no image-recognition model is connected.
- Metadata and normalized photos are saved under ignored `.ziala-data/` on the server computer, not in GitHub. `ZIALA_DATA_DIR` can override this directory.
- Refreshing or restarting the server retains saved items and ready/laundry changes. Start with four clearly labeled sample pieces; uploading or updating an item saves the current closet.
- Photos and tags in the integrated app feed the outfit-completeness checks. There is no background removal, image segmentation, bulk upload, account sync, deletion UI, or user authentication yet.

## Styling rules

Wear-now suggestions exclude laundry items with a reason. Unknown readiness requires confirmation.

A complete closet outfit is either top + bottom + shoes + bag, or dress + shoes + bag. Bag is mandatory. Every selected piece must be ready and tagged for the requested occasion. The selector picks one candidate per category by ID for repeatable behavior, not visual styling quality. Tags, color harmony, fit, and compatibility are not inferred by AI.

A suitable ready closet outfit takes precedence over shopping. Daily wear may show a ready alternative with an explicit occasion-tag compromise. This alternative checks completeness but does not yet rank styling quality.

When there is no suitable ready outfit:

- Occasions at least seven calendar days away route toward delivery candidates; confirmed estimates must be strictly before the occasion to qualify under `reviewShoppingOptions`.
- Earlier occasions route toward nearby in-store candidates; suitability, nearby location, stock, and selected size must be confirmed to qualify under `reviewStoreOptions`.
- Unknown, same-day, or late delivery does not qualify as timely. Unknown size inventory does not qualify. Size systems are not silently converted.

## Shopping integration: what is connected

`shopping.mjs` calls SerpApi's Google Shopping endpoint from the server. The browser sends a clothing category, occasion, size, optional city, and optional maximum price to `/api/shopping/search`. Search terms, size, and city are transmitted to SerpApi when the user submits. Images are not sent to the shopping provider.

Search results include supplied product title, seller, price, product link, thumbnail, and raw delivery text. API keys remain server-side. Unsafe links and known over-budget amounts are excluded; results without a known price are labeled accordingly. Provider errors return an error rather than substituting fictional results.

**Discovery is not verification.** Search results do not establish size-specific store stock, actual nearby inventory, occasion suitability, or an arrival date. Those fields remain explicitly unverified/null. “Free shipping” is not converted into a delivery date. The UI labels results as candidates and links to the product page for retailer checks; it does not mark them as satisfying our strict eligibility rules.

Current source docs:
- https://serpapi.com/google-shopping-api
- https://serpapi.com/shopping-results

Live retailer inventory, geospatial nearby filtering, size-specific delivery estimates, retailer detail APIs, purchasing, and verified store-visit options remain unconnected. The city influences provider search origin; it does not prove proximity. No precise-location permission is requested. The missing-category selection is a simple starting suggestion, not an optimized shopping plan.

## API

- `GET /api/health`: reports whether shopping credentials are configured; never returns the key.
- `GET /api/closet`: saved closet records.
- `GET /api/laundry`: current laundry reminders, visible reminders, saved snoozes, and server time.
- `POST /api/laundry/snooze/:id`: persist a future `until` timestamp for an active category reminder.
- `DELETE /api/laundry/snooze/:id`: cancel that category’s snooze.
- `POST /api/closet`: JSON metadata plus `imageBase64`, validated and saved as a normalized image.
- `PATCH /api/closet/:id`: persist a ready/laundry change.
- `POST /api/shopping/search`: validated search request, server-side provider call.
- `GET /uploads/:id.jpg`: normalized uploaded image.

This local server rejects foreign origins and unrecognized hosts, limits request size, serializes metadata writes, and never serves `.env` or backend modules. It has no authentication, multi-process transactional storage, or production rate limiting. Do not expose it on a public interface. Back up the local data directory yourself if you need durable recovery.

## Guided previews retained

- `/index.html`: original sample laundry closet, with mark-clean controls and category reminders.
- `/policy.html`: editable sample closet, completeness, and fictional shopping candidates for rule testing.
- `/app.html` or `/`: integrated uploaded closet and actual shopping adapter.

The older previews use separate in-memory sample state and do not modify the saved uploaded closet. For them alone, a static server still works: `python3 -m http.server 8000`.

Laundry reminders check tops and bottoms separately: fewer than two confirmed-ready items plus at least one item in laundry triggers a category reminder. The integrated app displays these counts and reminders. Each category has a “Remind me at” date/time picker. Snoozes are saved under ignored `.ziala-data/laundry-snoozes.json`, independently for tops and bottoms, and survive page refresh and server restart. The picker uses your computer’s local time, which is sent as an absolute UTC timestamp. A snoozed reminder shows its chosen time and a “Show reminder now” control. When the time arrives, the open app rechecks the rule and shows the reminder only if laundry is still needed. Cleaning enough items clears that category’s snooze, so a later laundry cycle starts fresh. Past/invalid times and attempts to snooze a resolved reminder are rejected. The older `/index.html` preview still uses separate sample data and a demo clock. There are no phone/email notifications, background notifications, or recurring automations; reopening the app re-evaluates expired snoozes.

## Validation

```sh
npm test
```

Tests cover the original rules plus real HTTP upload/metadata/image persistence across a server restart, invalid image rejection with no data changes, status updates, cross-origin rejection, and shopping request/response normalization. Shopping tests inject provider fixtures; they are not proof of a live credentialed search. No real provider call is possible without a supplied key. Browser verification status is recorded with the pull request.

The phone-preview fix uses a file data URL rather than a blob URL for image loading. Browser resizing is implemented in `client-image.mjs`; dimensions, size limits, and image-decode errors are reported separately. Dimension tests cover 48-megapixel portrait and landscape photos. The creator confirmed the corrected phone preview worked, and verified integrated uploads, persistence after refresh/restart, and live shopping on their Mac. The saved laundry snooze follow-up still needs a guided browser check.

## Remaining integrations

Gmail receipt import and calendar event import are not implemented yet. They remain separate follow-up work. Connecting Gmail or Calendar to ChatGPT does not connect them to this app.

## Receipt uploads and purchased-item review

Use **Receipts** in the integrated app. Upload a JPEG/PNG/WebP photo, UTF-8 text file, or unlocked PDF with selectable text. Photos use the existing browser resize path (20 MB source limit). Server receipt files are limited to 5 MB; PDF extraction is limited to five pages and all text to 30,000 characters. English image OCR uses Tesseract.js with bundled English language data from npm; extraction does not send receipt contents to a service. Scanned PDFs are not rendered/OCRed: upload a clear photo instead. Photos are resized, so tiny or blurred text may need a cropped clearer image.

1. Read the receipt. Nothing is saved to the closet yet.
2. Inspect the extracted text and priced-line suggestions. Names, categories and quantities are suggestions. Optional AI extraction also proposes retailer, order number/date, SKU/style code, color and size, with cited source lines and uncertainty notes. Totals, tax, shipping, payment and obvious contact lines are filtered; unusual layouts can still be wrong. Edit raw text and reparse when needed. Extraction is heuristic, not a purchase-verification model.
3. Select clothing items you actually purchased. Correct the name/category/quantity, confirm ready/laundry status, and add occasion tags. Unknown categories and availability require an explicit choice. Quantities of 1–10 create separate physical closet records, up to 50 records per save. Printed receipt amounts are review context, not inferred unit prices or cost-per-wear data.
4. Optionally enter the size and choose **Find a matching product**. Only reviewed retailer, item name, category, SKU/style code, color and size are sent to SerpApi. Candidate products show seller, image and link. Confirm a candidate yourself; exact identity, size and color are not automatically verified. A product link/photo can be attached only from that review’s returned candidates. You may save without a product image. Retailer image URLs are referenced, not downloaded or owned by ZIALA, and may stop working. To use your own photo instead, use the existing manual clothing upload; photo replacement on receipt-created records is future work.
5. Confirm review and save. Validation runs for the whole selected set before any item is written. The existing saved closet remains compatible. Repeated imports of the same unchanged receipt bytes and line ID are skipped, even after restart. This is not semantic duplicate detection across different photos, edited/reordered receipt text, or alternate copies of the same purchase.

Receipt files and full extracted text are not written to disk. Draft line suggestions and product candidates live in server memory for 20 minutes, with at most ten open reviews and one extraction at a time. Restarting the app clears unfinished drafts. Saved closet items retain reviewed fields and a receipt fingerprint/line/unit reference for duplicate checks, plus any confirmed product reference and reviewed purchase metadata (retailer, order number/date, SKU/color/size). Sensitive lines are never deliberately sent in product searches; the editable item-name field still requires your review before searching. Loading candidate images contacts the image hosts.

Endpoints: `POST /api/receipts/extract`, `POST /api/receipts/:draftId/parse`, `POST /api/receipts/:draftId/search`, and `POST /api/receipts/:draftId/commit`. Receipt backend modules are not served as static files. This remains a loopback-only development server, without account authentication or cloud sync.

Validation: 72 tests pass, including real local OCR, PDF/text extraction, selection-only saves, quantity handling, persistence, exact-file duplicate checks, review/match confirmation, invalid review rejection, backend-file protection and origin checks. Receipt tests also passed under Node 22.11.0, matching the creator’s Mac. A DOM interaction check exercised upload → review → candidate confirmation → save against the actual local HTTP server with fixture shopping data. Visual browser review and live receipt-product search on the creator’s Mac are pending. Existing general live shopping and clothing uploads were previously confirmed by the creator. No real receipt or provider credential is used by automated tests.

Implementation references: https://github.com/naptha/tesseract.js/blob/master/docs/api.md and https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs.

## Optional structured AI receipt extraction

After the initial local receipt read, open **Review or correct receipt text** to inspect/redact personal information. Tick the consent checkbox and choose **Use AI to identify retailer and items**. This explicitly sends that reviewed text to OpenAI; it is separate from the local OCR/PDF step. No receipt image is sent to OpenAI by this implementation. A ChatGPT or SerpApi connection does not configure this app’s OpenAI API access.

Set `OPENAI_API_KEY` privately in the ignored `.env`, optionally set `OPENAI_RECEIPT_MODEL` (default `gpt-4.1-mini`), and restart. API access/credits and model availability depend on the configured account. No key is bundled, logged or returned to the browser. Missing keys/provider errors leave local review available, with an explicit error rather than a fake AI success. The app reports whether AI credentials are configured; it does not claim this proves the key works.

`POST /api/receipts/:draftId/structure` requires `consent: true` and reviewed `text`. The server uses the Responses API with a strict JSON schema, a bounded text/output size, a 45-second timeout, no tools, and `store: false`. This disables stored response state for this request; it is not a promise of zero provider retention. OpenAI’s API data controls still apply. No live AI request has been made during this work because no real key is available in the development environment.

The AI proposes retailer, private order number and printed purchase date, plus individual product names, category, SKU/style code, color, size, quantity and source-line evidence. Values absent from the receipt stay null/blank. Backend evidence checks reject unsupported item names/line references and clear unsupported identifiers/attributes. Category suggestions and uncertainty notes remain model suggestions. Quantity without explicit labeled evidence requires manual entry. These checks reduce unsupported output; they do not guarantee semantic extraction accuracy. Abbreviations are retained for review, rather than silently expanded into invented product names. All item fields remain editable and nothing automatically enters the closet.

Search queries are built from allowlisted reviewed product fields. Order number/date are not included. A known order identifier accidentally pasted into a product field is blocked before SerpApi search. Candidate confirmation is tied to the exact reviewed retailer/name/category/SKU/color/size; editing those details requires a fresh search. Search queries bias results through retailer/style/color terms but do not verify an exact product, retailer domain, inventory, or variant. The user still confirms the match. Saved items retain their corrected purchase metadata locally; order information is not sent to SerpApi. Exact-file/line duplicate detection is still limited when layout/text or parsing modes change source-line identity.

Validation adds schema/request checks, unsupported-evidence handling, null/unknown fields, incomplete/refused/malformed output, missing credentials, consent, private identifier exclusion, corrected search queries, stale-match rejection, and reviewed metadata persistence. Provider calls in tests are injected fixtures, not evidence of live AI quality. The creator’s Mac/live AI check is pending. Gmail and calendar integration remain follow-up work.

Official API references: https://developers.openai.com/api/docs/guides/structured-outputs and https://developers.openai.com/api/docs/guides/your-data.

AI failure diagnostics: provider HTTP status and allowlisted error codes now distinguish authentication, quota/billing, rate limiting, model access, request-format/schema and temporary service failures. The error appears next to the AI button as well as in the main status. Provider messages, keys and receipt text are not echoed; only recognized schema-keyword hints are extracted from provider messages. A configured key is labeled configured, not validated. These diagnostics do not establish the cause of the creator’s current failed request; the next Mac retry is needed.
