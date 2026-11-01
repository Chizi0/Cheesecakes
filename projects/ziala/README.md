# ZIALA: closet uploads, styling rules, and shopping search

A local development prototype with persisted clothing-photo uploads and a server-side shopping search adapter. GitHub source only; no hosted Site. This is not a production account-based application.

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

Laundry reminders check tops and bottoms separately: fewer than two confirmed-ready items plus at least one item in laundry triggers a category reminder. The integrated app displays these counts and reminders. Chosen-time snooze is currently in the older `/index.html` preview only: its date/time picker hides a category reminder until the selected time, then rechecks the closet. The demo clock advances through its 30-minute button; refresh clears snoozes. There are no actual background notifications or recurring automations.

## Validation

```sh
npm test
```

Tests cover the original rules plus real HTTP upload/metadata/image persistence across a server restart, invalid image rejection with no data changes, status updates, cross-origin rejection, and shopping request/response normalization. Shopping tests inject provider fixtures; they are not proof of a live credentialed search. No real provider call is possible without a supplied key. Browser verification status is recorded with the pull request.

The phone-preview fix uses a file data URL rather than a blob URL for image loading. Browser resizing is implemented in `client-image.mjs`; dimensions, size limits, and image-decode errors are reported separately. Dimension tests cover 48-megapixel portrait and landscape photos, but actual phone-browser verification is still pending.
