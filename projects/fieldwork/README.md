# Fieldwork

A technician-dispatch portfolio prototype using synthetic records.

## First approved rule

The job's required certification is a hard eligibility condition. A closer technician without it cannot qualify through travel time. `eligibility.mjs` checks an exact certification identifier in the supplied list. Missing credential information is flagged for verification rather than assumed valid.

This first step checks qualifications only. It does not assign jobs, check availability, verify credentials or expiration, or calculate routes. Credential verification and jurisdiction-specific requirements would need separate implementation before real use.

## Dispatch selection

`dispatch.mjs` excludes unqualified technicians, unconfirmed/unavailable technicians, and anyone with an active job. Among remaining candidates, the shortest supplied travel estimate wins; equal estimates use technician ID for repeatable ordering. Busy technicians are excluded rather than selected on an unknown completion estimate. If nobody qualifies, the function returns no match. Travel estimates are synthetic inputs, not live routing data. This selects a technician without reserving them or assigning the job yet.

## Automatic assignment

`assignJob` uses the selection result to assign an unassigned pending job immediately. `available: true` means technician-confirmed availability in this model; the card provides a simulated technician confirmation action and records its timestamp. Assignment records the technician on the job and marks them unavailable with an active job in the returned roster. The caller must retain both updated records. A returned notice confirms assignment; no external message is sent. Nobody eligible leaves the job pending. Cancellation, stale-availability rules, persistent storage, and concurrent dispatch protection remain future work.

From the repository root, run `node --test projects/fieldwork/*.test.mjs` with Node.js 18+.

## Interactive dispatch card

Run `python3 -m http.server 8000` from this folder and open http://localhost:8000. The sample starts with A unqualified, B busy, and C qualified and confirmed available. Dispatch job automatically chooses and reserves an eligible technician; there is no separate technician acceptance step. Availability controls simulate technician confirmations and are disabled for active jobs. Set C unavailable before dispatch to test the no-match case. Reset restores sample data. Files stay in browser memory; no hosting or external notifications.

## Job completion and availability

`job-lifecycle.mjs` advances Assigned → En route → In progress → Completed. The job's assigned technician and roster reservation must match. Completion clears the active job but keeps availability false and flags confirmation as required. `confirmAvailability` is a separate explicit action with a timestamp; it rejects busy or unknown job states. The card connects lifecycle buttons and a separate Confirm available control to this logic. Technician identity is a supplied record, not authenticated. Completing work does not imply readiness for a new assignment.

Job-cycle walkthrough: Dispatch job → Mark en route → Start work → Complete job. C must remain unavailable with confirmation required. Create next sample job preserves the roster; dispatch finds nobody eligible until C explicitly confirms availability. The demo shows one job at a time and does not retain earlier jobs in a history view.

## Validation

All 19 Node tests pass. The creator manually verified the in-conversation dispatch and job-cycle previews, including confirmation after completion. Standalone browser automation remains incomplete. No real credentials, location feeds, or external notifications are connected.
