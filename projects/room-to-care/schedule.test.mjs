import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySchedule } from './schedule.mjs';
import { isCleanerAvailable } from './cleaners.mjs';
import { completeCleaning } from './cleaning.mjs';

const schedule = {
  shiftStart: '2026-11-01T08:00:00Z', shiftEnd: '2026-11-01T16:00:00Z',
  breaks: [{ start: '2026-11-01T12:00:00Z', end: '2026-11-01T12:30:00Z' }],
};
const cleaner = { id: 'A', hasActiveTask: false, lastAssignedAt: null };

test('shift and break boundaries include start but exclude end', () => {
  for (const [time, available] of [['07:59',false],['08:00',true],['11:59',true],['12:00',false],['12:29',false],['12:30',true],['16:00',false]]) {
    assert.equal(isCleanerAvailable(applySchedule(cleaner, schedule, `2026-11-01T${time}:00Z`)), available, time);
  }
});

test('scheduled break retains active ownership and flags it without mutating the input', () => {
  const busy = { ...cleaner, hasActiveTask: true, activeRoomId: 'R-01' };
  const result = applySchedule(busy, schedule, '2026-11-01T12:00:00Z');
  assert.equal(result.hasActiveTask, true);
  assert.equal(result.activeRoomId, 'R-01');
  assert.equal(result.scheduleFlag, 'Break due—active task');
  assert.equal(isCleanerAvailable(result), false);
  assert.equal(busy.onBreak, undefined);
});

test('completion during scheduled break releases the task but does not permit new work', () => {
  const busy = applySchedule({ ...cleaner, hasActiveTask: true, activeRoomId: 'R-01' }, schedule, '2026-11-01T12:05:00Z');
  const room = { id: 'R-01', status: 'being_cleaned', cleaningTask: { cleanerId: 'A', assignedAt: '2026-11-01T11:40:00Z', startedAt: '2026-11-01T11:45:00Z' } };
  const finished = completeCleaning(room, [busy], 'A', '2026-11-01T12:05:00Z');
  const updated = applySchedule(finished.cleaners[0], schedule, '2026-11-01T12:05:00Z');
  assert.equal(updated.hasActiveTask, false);
  assert.equal(updated.scheduleFlag, null);
  assert.equal(isCleanerAvailable(updated), false);
});

test('shift ending retains an active task for review', () => {
  const result = applySchedule({ ...cleaner, hasActiveTask: true, activeRoomId: 'R-01' }, schedule, '2026-11-01T16:00:00Z');
  assert.equal(result.activeRoomId, 'R-01');
  assert.equal(result.scheduleFlag, 'Shift ended—active task');
  assert.equal(isCleanerAvailable(result), false);
});

test('rejects missing timezone and invalid schedule intervals', () => {
  assert.throws(() => applySchedule(cleaner, schedule, '2026-11-01T12:00:00'), /timezone/);
  assert.throws(() => applySchedule(cleaner, { ...schedule, shiftEnd: schedule.shiftStart }, schedule.shiftStart), /Shift end/);
  assert.throws(() => applySchedule(cleaner, { ...schedule, breaks: [{start: schedule.shiftStart, end: '2026-11-01T17:00:00Z'}] }, schedule.shiftStart), /Break/);
});
