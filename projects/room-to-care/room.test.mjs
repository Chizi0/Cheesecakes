import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitionRoom, canAssignRoom, assignRoom } from './room.mjs';

test('assignment during cleaning shows the approved message without changing the room', () => {
  const room = { id: 'R-01', status: 'being_cleaned' };
  const before = structuredClone(room);
  const result = assignRoom(room, 'SAMPLE-001', 'Staff A');
  assert.equal(result.success, false);
  assert.equal(result.message, 'Room unavailable - still cleaning');
  assert.deepEqual(room, before);
  assert.deepEqual(result.room, before);
});

test('other unavailable rooms also block assignment', () => {
  for (const status of ['occupied', 'needs_cleaning']) {
    const room = { id: 'R-01', status };
    const result = assignRoom(room, 'SAMPLE-001', 'Staff A');
    assert.equal(result.success, false);
    assert.equal(result.room.status, status);
  }
});

test('assignment to an available room records the patient and staff, then blocks a second assignment', () => {
  const room = { id: 'R-01', status: 'available' };
  const result = assignRoom(room, ' SAMPLE-001 ', ' Staff A ');
  assert.equal(result.success, true);
  assert.equal(result.room.status, 'occupied');
  assert.equal(result.room.patientId, 'SAMPLE-001');
  assert.equal(result.room.updatedBy, 'Staff A');
  assert.equal(room.status, 'available');
  assert.equal(assignRoom(result.room, 'SAMPLE-002', 'Staff B').success, false);
});

test('available room assignment requires patient and staff attribution', () => {
  const room = { status: 'available' };
  assert.throws(() => assignRoom(room, '', 'Staff A'), /patient ID/);
  assert.throws(() => assignRoom(room, 'SAMPLE-001', ''), /staff name/);
  assert.throws(() => assignRoom({ status: 'unknown' }, 'SAMPLE-001', 'Staff A'), /not recognized/);
});

test('patient departure leaves an empty room needing cleaning', () => {
  const room = transitionRoom({ id: 'R-01', status: 'occupied', patientId: 'SAMPLE-001' }, 'patient_left', 'Staff A');
  assert.equal(room.status, 'needs_cleaning');
  assert.equal(room.patientId, null);
  assert.equal(canAssignRoom(room), false);
});

test('complete approved workflow makes a room assignable only after confirmation', () => {
  let room = { id: 'R-01', status: 'occupied' };
  for (const [action, status] of [
    ['patient_left', 'needs_cleaning'],
    ['start_cleaning', 'being_cleaned'],
    ['confirm_ready', 'available'],
  ]) {
    room = transitionRoom(room, action, 'Staff A');
    assert.equal(room.status, status);
    assert.equal(canAssignRoom(room), status === 'available');
    assert.equal(room.updatedBy, 'Staff A');
  }
});

test('cleaning cannot be skipped', () => {
  for (const status of ['occupied', 'needs_cleaning']) {
    assert.throws(() => transitionRoom({ status }, 'confirm_ready', 'Staff A'), /Cannot/);
  }
});

test('repeated and out-of-order actions are rejected', () => {
  assert.throws(() => transitionRoom({ status: 'available' }, 'confirm_ready', 'Staff A'), /Cannot/);
  assert.throws(() => transitionRoom({ status: 'being_cleaned' }, 'patient_left', 'Staff A'), /Cannot/);
  assert.throws(() => transitionRoom({ status: 'needs_cleaning' }, 'toString', 'Staff A'), /Cannot/);
});

test('unknown room states and missing staff attribution are rejected', () => {
  assert.throws(() => transitionRoom({ status: 'empty' }, 'start_cleaning', 'Staff A'), /not recognized/);
  assert.throws(() => transitionRoom(null, 'start_cleaning', 'Staff A'), /not recognized/);
  for (const name of ['', '  ', undefined]) {
    assert.throws(() => transitionRoom({ status: 'being_cleaned' }, 'confirm_ready', name), /staff name/);
  }
});

test('returns a new room record and preserves the original', () => {
  const original = { id: 'R-01', status: 'being_cleaned' };
  const updated = transitionRoom(original, 'confirm_ready', ' Staff A ');
  assert.equal(original.status, 'being_cleaned');
  assert.equal(updated.id, 'R-01');
  assert.equal(updated.updatedBy, 'Staff A');
  assert.notEqual(updated, original);
});
