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
