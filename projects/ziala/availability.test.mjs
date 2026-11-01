import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWearNow, reviewCloset } from './availability.mjs';

test('laundry item is excluded with a reason even if it is the best style match', () => {
  const result = checkWearNow({ availability: 'laundry', styleScore: 100 });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'Excluded: this item is in the laundry.');
});

test('confirmed ready item is eligible', () => {
  assert.equal(checkWearNow({ availability: 'ready' }).eligible, true);
});

test('unconfirmed status asks for confirmation rather than assuming readiness', () => {
  const result = checkWearNow({});
  assert.equal(result.eligible, false);
  assert.match(result.reason, /confirm/);
});

test('closet review keeps excluded items and their reasons without changing the input', () => {
  const items = [{id:'top-01',availability:'laundry'},{id:'top-02',availability:'ready'}];
  const before = structuredClone(items);
  const result = reviewCloset(items);
  assert.equal(result.length, 2);
  assert.equal(result[0].eligible, false);
  assert.match(result[0].reason, /laundry/);
  assert.equal(result[1].eligible, true);
  assert.deepEqual(items, before);
});

test('duplicate and missing item IDs are rejected', () => {
  assert.throws(() => reviewCloset([{id:'top-01'},{id:'top-01'}]), /unique/);
  assert.throws(() => reviewCloset([{}]), /unique/);
});
