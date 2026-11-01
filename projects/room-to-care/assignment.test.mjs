import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoAssignPatient } from './assignment.mjs';
const room = () => ({id:'R-01',roomType:'standard',status:'available'});
const patient = (id, waitingSince, extra={}) => ({id,waitingSince,status:'waiting',clinicalPriority:'A',requiredRoomType:'standard',...extra});
const queue = () => [patient('P-02','2026-11-01T10:40:00Z'),patient('P-01','2026-11-01T10:15:00Z')];

test('automatically assigns longest waiting eligible patient and returns a notice',()=>{
 const r=autoAssignPatient(room(),queue(),'A');
 assert.equal(r.assigned,true);assert.equal(r.room.patientId,'P-01');assert.equal(r.room.status,'occupied');
 assert.equal(r.patients[1].status,'assigned');assert.equal(r.patients[1].roomId,'R-01');
 assert.equal(r.notice,'Patient P-01 automatically assigned to room R-01.');
});
test('updated records prevent repeat assignment and let another room take the next patient',()=>{
 const first=autoAssignPatient(room(),queue(),'A');
 assert.equal(autoAssignPatient(first.room,first.patients,'A').assigned,false);
 assert.equal(autoAssignPatient({...room(),id:'R-02'},first.patients,'A').room.patientId,'P-02');
});
test('unavailable rooms and unmatched patients do not trigger assignment',()=>{
 assert.equal(autoAssignPatient({...room(),status:'being_cleaned'},queue(),'A').assigned,false);
 for(const extra of [{clinicalPriority:'B'},{requiredRoomType:'specialist'},{status:'assigned'}]){
  const result=autoAssignPatient(room(),[patient('P-03','2026-11-01T10:00:00Z',extra)],'A');
  assert.equal(result.assigned,false);assert.equal(result.room.status,'available');
 }
});
test('inconsistent existing assignments are rejected',()=>{
 assert.throws(()=>autoAssignPatient({...room(),patientId:'P-other'},queue(),'A'),/already/);
 assert.throws(()=>autoAssignPatient(room(),[...queue(),patient('P-other','2026-11-01T10:00:00Z',{status:'assigned',roomId:'R-01'})],'A'),/already/);
 assert.throws(()=>autoAssignPatient(room(),[patient('P-01','2026-11-01T10:00:00Z',{roomId:'R-other'})],'A'),/already/);
});
test('assignment preserves original room and queue',()=>{
 const originalRoom=room(),patients=queue(),snapshot=structuredClone(patients);
 autoAssignPatient(originalRoom,patients,'A');
 assert.equal(originalRoom.status,'available');assert.deepEqual(patients,snapshot);
});

test('cleaning completion releases cleaner before automatic patient assignment', async()=>{
 const {completeCleaning}=await import('./cleaning.mjs');
 const active={...room(),status:'being_cleaned',cleaningTask:{cleanerId:'A',assignedAt:'2026-11-01T11:00:00Z',startedAt:'2026-11-01T11:05:00Z'}};
 const roster=[{id:'A',onShift:true,onBreak:false,hasActiveTask:true,activeRoomId:'R-01'}];
 const completed=completeCleaning(active,roster,'A','2026-11-01T11:25:00Z');
 const assigned=autoAssignPatient(completed.room,queue(),'A');
 assert.equal(completed.cleaners[0].hasActiveTask,false);
 assert.equal(assigned.room.patientId,'P-01');
 assert.equal(assigned.room.cleaningHistory[0].cleaningMinutes,20);
 assert.match(assigned.notice,/automatically assigned/);
});
