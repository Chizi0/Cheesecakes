# RxBridge MVP test plan

All test data must be fictional. No actual prescriptions, pharmacies, patient identifiers, or protected health information.

## Core journey — manual browser tests
1. Open `rxbridge/index.html`. Confirm the demo disclaimer and three role options.
2. Choose Prescriber. Create a fictional order. Confirm it appears as Received.
3. Choose Pharmacy. Mark the new order Processing, then Ready, then Picked up. Confirm each status and history entry.
4. Reset. Choose Pharmacy. On RX-1002 confirm Delayed and its fictional stock issue.
5. Choose Patient. Select Northside Pharmacy and Delivery. Approve the simulated request. Confirm it says awaiting pharmacy review.
6. Choose Pharmacy. Accept the coordination request. Confirm status awaits authorized review.
7. Choose Prescriber. Simulate authorized transfer/reissue. Confirm the destination pharmacy changes and fulfillment resets to Received.
8. Choose Pharmacy. Process the new destination order to Ready.
9. Reset. Request Park Avenue Pharmacy with Delivery. Confirm delivery is rejected for that destination.
10. Reset. Request a transfer and decline it as Pharmacy. Confirm the patient can request another alternative.
11. While transfer review is pending, confirm pharmacy fulfillment cannot advance.
12. Refresh the page. Confirm the app resets; no server or persistent storage is connected.

## MVP acceptance criteria
- Every new prescription starts in Received.
- Only Pharmacy can advance fulfillment status in the simulated UI.
- Patient explicitly approves each transfer request.
- Transfer requests do not automatically change the dispensing pharmacy.
- Destination pharmacy and authorized-review steps precede simulated reassignment.
- Delivery eligibility is checked against the selected pharmacy.
- Invalid state transitions are rejected.
- The history records meaningful events.
- User-entered text is HTML-escaped.
- No clinical advice, real inventory claims, or real e-prescribing occurs.

## Known limitations
- Roles are a demo selector, not authenticated identities or access controls.
- All orders are visible across role views; do not use with real data.
- There is no database, real API, eligibility check, insurer integration, or e-prescribing network.
- In-memory history is not a production audit log.
- Real controlled-substance and interstate transfer rules are out of scope.
- Automated browser testing is not yet configured.
