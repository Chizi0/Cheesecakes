# Room to Care

An independent healthcare operations portfolio prototype. Initial objective: give staff a shared view of waiting patients, room readiness, and handoffs using synthetic data.

## Initial scope

- Track room states: available, occupied, needs cleaning, and being cleaned.
- Track operational patient states and handoff ownership.
- Clinical urgency is supplied by qualified staff; this prototype will not infer medical urgency or diagnose patients.
- Assignment rules and exception behavior will be defined during the guided product walkthrough before implementation.

## Approved first rule

Occupied → Needs cleaning → Being cleaned → Available. A staff member confirms readiness before the room becomes assignable. Actions cannot skip stages. Each update requires a staff name for attribution; this prototype does not authenticate staff or enforce roles.

`room.mjs` implements transitions, the availability check, and assignment. Available rooms become occupied when assigned a sample patient ID. Assignment during cleaning returns “Room unavailable - still cleaning” and leaves the room unchanged. Other unavailable states also block assignment. Patient departure clears the active patient ID. These checks apply to the supplied in-memory room record; concurrent staff updates and cross-room duplicate assignments are not handled yet.

Run tests with Node.js 18+: `node --test projects/room-to-care/room.test.mjs` from the repository root.

No live patient data, integrations, or clinical decision support.

## Cleaner selection

`cleaners.mjs` selects a cleaner only when on shift, off break, and without an active task. Among eligible staff, the oldest last-assignment timestamp wins. Explicitly no prior assignment (`null`) comes first; equal times use cleaner ID for a repeatable tie-break. Selection returns `null` when nobody qualifies. Missing availability is not assumed to mean available.

Selection alone does not reserve a cleaner. `cleaning.mjs` connects it to task assignment: it returns the updated room and staff roster together, reserving the selected cleaner, recording assignment time, and leaving the room in Needs cleaning. If nobody qualifies, the room is flagged Awaiting cleaner. The caller must keep both returned records for subsequent assignments.

The assigned cleaner can start the task while on shift and off break. This records a separate start time and moves the room to Being cleaned. Completion requires the matching cleaner reservation, records finish time, makes the room Available, and releases the cleaner. Completed task history retains assignment-to-start delay separately from cleaning duration, then the active task is cleared for the next cycle. In this first version, the assigned cleaner confirms readiness. These are in-memory records, not a persistent audit log or staff performance assessment. Schedule calculation, concurrent updates, and persistence remain future steps. Staff identity is supplied, not authenticated.

Run all current tests: `node --test projects/room-to-care/*.test.mjs`.

## Interactive walkthrough

Run `python3 -m http.server 8000` from this folder and open http://localhost:8000. The card assigns cleaning automatically on patient departure. Sample shifts and breaks now drive eligibility. The simulated clock starts at 11:55 UTC: Cleaner A has a scheduled break from 12:00 to 12:15, and B from 12:15 to 12:30. Advance the clock before patient departure to test selection. If nobody is free, advance to availability and use Retry cleaner assignment. Advance the simulated clock to distinguish waiting from cleaning time. Start and completion act as the assigned cleaner. A scheduled break during active cleaning displays a review flag, retains the assignment, and allows completion. Starting an assigned but not yet started task during a scheduled break is blocked.

## Schedule rules

`schedule.mjs` calculates on-shift and scheduled-break status from explicit timestamps with timezone offsets. Shift/break starts are inclusive; ends are exclusive. During a scheduled break, an active task stays assigned and gets “Break due—active task”; there is no automatic handoff. An off-shift active task also stays assigned with a review flag. Reapply the schedule after time or task-state changes to refresh flags and availability. Completion does not make staff eligible for new work during a scheduled break.

This is schedule eligibility, not a record of an actual break taken. It does not reschedule missed breaks or enforce employment policies. The card recalculates schedule eligibility whenever its simulated time or task state changes. It does not track actual clock-out/clock-in or reschedule missed breaks.
