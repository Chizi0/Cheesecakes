# ZIALA: closet-to-outfit prototype

A guided, independent implementation of a small closet-to-outfit flow using sample items. GitHub source only.

## First approved rule

Wear-now suggestions exclude items in the laundry and explain why. Exclusion applies to recommendation eligibility; the item remains in the closet. Confirmed-ready items qualify for later styling checks. Missing or unrecognized availability requires confirmation rather than assuming readiness.

`availability.mjs` implements this rule. The interface now shows a sample closet with availability controls and laundry reminders. Outfit selection, closet entry, and images are not implemented yet. No live AI or integrations are connected.

From the repository root, run `node --test projects/ziala/*.test.mjs` with Node.js 18+.

## Laundry reminders

`laundry.mjs` checks tops and bottoms independently. A category triggers an in-app reminder when fewer than two items are confirmed ready and at least one item is in the laundry. Two ready items suppress it; a small closet without laundry does not trigger it. Unknown states do not count as ready. Other clothing categories are outside this initial rule.

The function returns reminder records with stable category IDs and counts. It does not send notifications, schedule reminders, or change clothing status. Mark clean and Move to laundry controls recalculate reminders in the interface. Persistence and outfit integration are not implemented yet. Ready counts reflect the whole category, not suitability for an occasion.

## Closet walkthrough

Run `python3 -m http.server 8000` from this folder and open http://localhost:8000. Start with one ready top and two ready bottoms. Mark the wine satin blouse clean to clear the top reminder. Move one ready bottom to laundry to trigger the bottom reminder. Reset restores sample items. This is browser-local state; refresh discards edits.

## Chosen-time snooze

The card provides a local date/time picker for each reminder. `snooze.mjs` requires a future timestamp and hides only that category until the selected time. On expiry, the closet is evaluated again; resolved laundry does not produce a reminder. Show reminder now cancels a snooze. The demo clock starts at the browser current time and advances only through the 30-minute demo button. Refresh/reset clears snoozes. This is an in-app prototype, not a background scheduler, push notification, or external automation. Local times are converted to timestamp instants for comparison.

## Outfit fallback policy

`outfit-policy.mjs` prefers a suitable ready closet outfit. Daily wear may offer a ready alternative with an explicit explanation of the compromise. Occasions keep suitability as a requirement. When no suitable ready outfit exists, shopping is offered only for occasions at least seven calendar days away. For occasions fewer than seven days away, the fallback is suitable nearby in-store buying options rather than an unsuitable closet outfit.

Shopping review requires confirmed occasion suitability and a supplied estimated delivery date strictly before the occasion. Missing, same-day, or late delivery does not qualify. Dates are displayed as estimates. These are policy helpers only: closet suitability detection, alternative ranking, real product retrieval, delivery lookup, and outfit UI are not implemented yet. No estimates are invented and no purchases are made.

`reviewStoreOptions` requires supplied confirmation of occasion suitability, nearby location, and in-store stock. Unknown stock or location does not count as available. Eligible options advise checking opening hours and reconfirming stock before visiting. No real stores, stock, opening hours, location permissions, reservations, or purchases are connected. The nearby radius will be defined in a later step. Size-specific inventory is a supplied input for now.

In-store review requires a user-selected size and a matching entry in the store option’s `availableSizes` list. Missing size inventory stays excluded. Case/whitespace are normalized, but country/brand size systems are not converted. A confirmed general stock flag alone is insufficient. Real store-size inventory retrieval is not connected.

## Styling-policy preview

Open /policy.html on the local server to test fallback behavior. The preview uses a browser-local today date, editable sample closet records, sample delivery dates, and fictional store inventory. Seven or more days selects delivery review; fewer selects in-store review. Changing size affects the store-size eligibility check. Marking the required pieces ready returns to the closet path. Daily wear may offer a ready alternative with a compromise explanation. This tests policy routing, not actual outfit generation or live shopping.

## Complete closet outfit rules

`outfits.mjs` requires either top + bottom + shoes + bag, or dress + shoes + bag. Bag is mandatory. Every selected item must be confirmed ready and carry the requested occasion tag. Results include missing categories and per-item exclusion reasons. One complete pattern is sufficient; incomplete patterns are not labeled complete.

This first selector chooses one candidate per category by ID for repeatable tests, not fashion ranking. Occasion tags are supplied metadata; color harmony, fit, weather, and visual compatibility are not checked. The policy preview now uses this helper against editable sample closet records. Daily alternative ranking remains future work.

In the current /policy.html sample, occasion means dinner. Move the structured bag to laundry to make both patterns incomplete. Mark it clean to restore closet completeness. The daily alternative path checks ready-category completeness without the requested tag and explicitly labels the compromise; it does not yet rank alternatives by styling quality. Buying candidates remain illustrative and are not matched to the exact missing category. The closet/snooze page and outfit-policy page currently use separate sample state.
