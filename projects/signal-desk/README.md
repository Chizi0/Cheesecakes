# Signal Desk: checkout triage

An independent support operations prototype developed from Chizitalu Obiajulu's portfolio concept. This first iteration handles checkout failures only, using transparent rules and synthetic tickets.

## Run

From this folder, start a local server:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 for the single-ticket card or http://localhost:8000/queue.html for the queue. No package installation, backend, or API key required.

## Product rules

- No working payment link: Critical.
- Confirmed working payment link: High. Purchases can continue, but extra friction may cause abandonment.
- Unknown workaround: Critical, Needs triage, with the instruction “Check status of payment link”.
- Queue order: priority, customer count descending, then oldest arrival. Exact ties use ticket ID for deterministic ordering.
- Customer count signals breadth of impact, not measured revenue loss. Customer size does not enter this initial model.

## Walkthrough

1. Start with SD-1042 at 2 customers: the Critical ticket affecting 50 customers appears first.
2. Change SD-1042 to 60 customers: it becomes first.
3. Change it to 50: its older arrival breaks the tie.
4. Set its payment link to working: its priority becomes High and it moves below Critical tickets.
5. Set its payment link to unknown: Critical and the triage instruction return.

The creator confirmed these interactions in the in-conversation preview. The repository version uses the same rule functions, with module imports rather than the preview's embedded scripts. Standalone browser automation has not been completed.

## Code map

- priority.mjs: a single ticket's priority, explanation, and next action.
- queue.mjs: assigns priorities and sorts tickets without changing the original array.
- card.mjs and queue-ui.mjs: connect input changes to visible results.
- index.html and queue.html: runnable pages.
- card.html and queue-fragment.html: preview markup sources. Keep their corresponding page markup synchronized when editing.

## Tests

Requires Node.js 18+:

```sh
node --test *.test.mjs
```

11 tests cover priority decisions, unknown status, invalid inputs, ordering, ties, and reranking after edits.

## Scope

No live AI, customer integrations, persistent storage, authentication, notifications, overrides, or SLA escalation. Ticket ages are fixed for this exercise. Customer counts are entered manually. Arrival timestamps must be parseable by JavaScript. A production version needs explicit date validation and a policy preventing small incidents from waiting indefinitely. User research and business outcomes have not been validated.
