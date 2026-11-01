import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCleanerAvailable, selectCleaner } from './cleaners.mjs';

const cleaner = (id, lastAssignedAt, overrides = {}) => ({
  id, lastAssignedAt, onShift: true, onBreak: false, hasActiveTask: false, ...overrides,
});

test('chooses the eligible cleaner with the oldest assignment time', () => {
  const recent = cleaner('A', '2026-11-01T10:30:00Z');
  const older = cleaner('B', '2026-11-01T09:00:00Z');
  assert.equal(selectCleaner([recent, older]).id, 'B');
});

test('excludes off-shift, on-break, busy, and unconfirmed staff', () => {
  for (const overrides of [{ onShift: false }, { onBreak: true }, { hasActiveTask: true }, { onBreak: undefined }]) {
    const unavailable = cleaner('A', null, overrides);
    assert.equal(isCleanerAvailable(unavailable), false);
    assert.equal(selectCleaner([unavailable, cleaner('B', '2026-11-01T10:00:00Z')]).id, 'B');
  }
});

test('returns null when nobody is available', () => {
  assert.equal(selectCleaner([]), null);
  assert.equal(selectCleaner([cleaner('A', null, { onBreak: true })]), null);
});

test('no previous assignment comes first; equal times use cleaner ID', () => {
  assert.equal(selectCleaner([cleaner('A', '2026-11-01T09:00:00Z'), cleaner('B', null)]).id, 'B');
  assert.equal(selectCleaner([cleaner('B', null), cleaner('A', null)]).id, 'A');
});

test('rejects duplicate IDs and invalid eligible assignment timestamps', () => {
  assert.throws(() => selectCleaner([cleaner('A', null), cleaner('A', null)]), /unique/);
  assert.throws(() => selectCleaner([cleaner('A', 'unknown')]), /valid last assignment/);
});

test('selection does not reorder or change staff records', () => {
  const staff = [cleaner('B', null), cleaner('A', null)];
  const original = structuredClone(staff);
  selectCleaner(staff);
  assert.deepEqual(staff, original);
});
