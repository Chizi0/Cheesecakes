import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeCheckout } from './priority.mjs';

test('checkout blocked without a working payment link is Critical', () => {
  const result = prioritizeCheckout({ customersAffected: 12, hasWorkingPaymentLink: false });
  assert.equal(result.priority, 'Critical');
  assert.match(result.explanation, /12 customers/);
  assert.match(result.explanation, /cannot complete a purchase/);
});

test('a working payment link lowers urgency to High while retaining abandonment risk', () => {
  const result = prioritizeCheckout({ customersAffected: 12, hasWorkingPaymentLink: true });
  assert.equal(result.priority, 'High');
  assert.match(result.explanation, /extra steps may cause customers to abandon/);
});

test('missing workaround information is not silently treated as confirmed', () => {
  for (const value of [undefined, null, 'unknown', 'true', 'false']) {
    const result = prioritizeCheckout({ customersAffected: 12, hasWorkingPaymentLink: value });
    assert.equal(result.priority, 'Critical');
    assert.equal(result.needsTriage, true);
    assert.equal(result.nextAction, 'Check status of payment link');
    assert.match(result.explanation, /unconfirmed/);
  }
});

test('confirmed workaround states do not carry an unresolved triage flag', () => {
  for (const hasWorkingPaymentLink of [true, false]) {
    assert.equal(prioritizeCheckout({ customersAffected: 12, hasWorkingPaymentLink }).needsTriage, false);
  }
});

test('rejects invalid customer counts', () => {
  for (const customersAffected of [0, -1, 1.5, '12', undefined]) {
    assert.throws(() => prioritizeCheckout({ customersAffected, hasWorkingPaymentLink: true }), /positive whole number/);
  }
});
