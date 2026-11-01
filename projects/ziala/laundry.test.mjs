import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laundryReminders } from './laundry.mjs';
const item = (id, category, availability) => ({ id, category, availability });

test('one ready top and laundry tops produces a category-specific reminder', () => {
  const result = laundryReminders([item('T1','top','ready'),item('T2','top','laundry')]);
  assert.equal(result.length,1);
  assert.equal(result[0].readyCount,1);
  assert.equal(result[0].laundryCount,1);
  assert.match(result[0].message,/1 ready-to-wear top/);
});
test('exactly two ready items suppress the reminder', () => {
  assert.deepEqual(laundryReminders([item('T1','top','ready'),item('T2','top','ready'),item('T3','top','laundry')]),[]);
});
test('a small closet without laundry does not trigger a reminder', () => {
  assert.deepEqual(laundryReminders([item('T1','top','ready')]),[]);
  assert.deepEqual(laundryReminders([]),[]);
});
test('tops and bottoms are checked independently', () => {
  const result=laundryReminders([item('T1','top','ready'),item('T2','top','ready'),item('B1','bottom','laundry')]);
  assert.deepEqual(result.map(r=>r.category),['bottom']);
  assert.equal(result[0].readyCount,0);
});
test('both categories can trigger while other categories and unknown states do not count as ready', () => {
  const result=laundryReminders([item('T1','top','unknown'),item('T2','top','laundry'),item('B1','bottom','laundry'),item('S1','shoe','laundry')]);
  assert.deepEqual(result.map(r=>r.category),['top','bottom']);
  assert.equal(result[0].readyCount,0);
});
test('marking a laundry item ready clears a reminder when the count reaches two', () => {
  const items=[item('T1','top','ready'),item('T2','top','laundry')];
  const before=structuredClone(items);
  assert.equal(laundryReminders(items).length,1);
  assert.deepEqual(laundryReminders(items.map(i=>i.id==='T2'?{...i,availability:'ready'}:i)),[]);
  assert.deepEqual(items,before);
});
