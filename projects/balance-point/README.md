# Balance Point

A runnable finance operations prototype that explains the difference between invoiced amounts and incoming payments. Built as an extension of Chizitalu Obiajulu's portfolio concept.

## Run locally

Requires Python 3; no package installation or API keys.

```sh
cd projects/balance-point
python3 -m http.server 8000
```

Open http://localhost:8000. Use a local server because the app uses JavaScript modules.

## Try it

1. Review the sample: two matched invoices, one underpayment, one overpayment, one unpaid invoice, and one unallocated payment.
2. Filter by status or search by customer/invoice ID.
3. Select **Investigate** to see contributing payment IDs and the reason for the exception.
4. Import invoices and payments using the sample CSV schemas. Each import replaces that ledger. Invalid imports preserve the existing ledger.
5. Restore the sample or refresh to reset. No data persists.

## Product decisions

- Exact invoice references make matches explainable; no fuzzy matching or hidden AI decisions.
- Multiple payments may settle one invoice. Amounts use integer cents to avoid common decimal rounding errors.
- Overpayments remain exceptions rather than automatically being assigned elsewhere.
- Unknown references stay unallocated for human investigation.
- Summary received includes every payment, including unallocated funds. Exception count includes nonmatched invoices plus unallocated payments.
- Synthetic USD data only. Files are read locally in browser memory; no backend, analytics, external scripts, banking connections, or live AI model.

## Validation

With Node.js 18+:

```sh
node --test tests/*.test.mjs
```

Tests cover split payments, reconciliation statuses, unknown references, duplicate identifiers, invalid amounts, and quoted CSV fields.

## Boundaries and proposed next steps

Prototype only: no authentication, persistent database, audit trail, currency conversion, date matching, credits/refunds, fee inference, or actual financial actions. Large ledgers and aggregate overflow are not supported. CSV input limit: 1 MB per file.

Before a production build, interview finance operators, validate exception categories, and evaluate time to resolve a discrepancy and incorrect match rate. These are proposed measures, not achieved outcomes.
