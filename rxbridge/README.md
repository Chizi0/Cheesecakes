# RxBridge — Prescription-to-Pickup Journey

A portfolio prototype that models how a prescription moves from a prescriber to a pharmacy and then to the patient.

## Problem
Patients often lack clear visibility into prescription status, delays, and pickup readiness. Clinicians and pharmacies also need a transparent way to surface exceptions.

## MVP
- Role-based simulated views: prescriber, pharmacy, patient
- Create fictional medication orders
- Track received, processing, delayed, ready, and picked-up statuses
- Record delay reasons and an audit trail
- No real prescribing, insurance adjudication, stock verification, or dispensing

## Run
Open `index.html` in a browser. This is a static demonstration with in-memory sample data; refresh resets the state.

## Safety
Use synthetic data only. Never enter personal health information. No medication recommendations or clinical decision support are provided. Real prescribing requires authenticated clinical workflows, appropriate regulatory compliance, and integration with authorized e-prescribing networks.

## Roadmap
1. Define personas, service blueprint, and exceptions
2. Prototype prescription journey and status changes
3. Add persistence, access controls, audit logging, and automated tests
4. Explore FHIR MedicationRequest/MedicationDispense mapping and NCPDP SCRIPT integration requirements
5. Conduct usability research with patients, clinicians, and pharmacy staff

FHIR resources and e-prescribing standards are distinct; this prototype does not claim production interoperability.
