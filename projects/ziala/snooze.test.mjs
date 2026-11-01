import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snoozeReminder, visibleLaundryReminders } from './snooze.mjs';
const now='2026-11-01T14:00:00Z',until='2026-11-01T15:00:00Z';
const items=[{id:'T1',category:'top',availability:'laundry'},{id:'B1',category:'bottom',availability:'laundry'}];
test('chosen future time hides only the selected category reminder',()=>{
 const snoozes=snoozeReminder({},'laundry-top',until,now);
 assert.deepEqual(visibleLaundryReminders(items,snoozes,now).map(r=>r.id),['laundry-bottom']);
});
test('reminder becomes visible at the chosen time if still needed',()=>{
 const snoozes=snoozeReminder({},'laundry-top',until,now);
 assert.deepEqual(visibleLaundryReminders(items,snoozes,until).map(r=>r.id),['laundry-top','laundry-bottom']);
});
test('expired snooze does not recreate a reminder when laundry is resolved',()=>{
 const snoozes=snoozeReminder({},'laundry-top',until,now);
 const cleaned=[{id:'T1',category:'top',availability:'ready'},{id:'T2',category:'top',availability:'ready'}];
 assert.deepEqual(visibleLaundryReminders(cleaned,snoozes,until),[]);
});
test('rejects past, present and invalid chosen times',()=>{
 for(const time of [now,'2026-11-01T13:00:00Z','bad','2026-11-01T15:00:00'])assert.throws(()=>snoozeReminder({},'laundry-top',time,now));
});
test('snoozing preserves prior state and other category settings',()=>{
 const prior={'laundry-bottom':until};
 const next=snoozeReminder(prior,'laundry-top',until,now);
 assert.deepEqual(prior,{'laundry-bottom':until});
 assert.equal(next['laundry-bottom'],until);
});
