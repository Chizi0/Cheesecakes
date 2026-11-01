import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignCleaning, startAssignedCleaning, assignmentToStartMinutes, completeCleaning } from './cleaning.mjs';
import { transitionRoom, assignRoom } from './room.mjs';
const room = () => ({ id: 'R-01', status: 'needs_cleaning' });
const staff = () => ['A','B'].map((id,i) => ({ id, onShift: true, onBreak: false, hasActiveTask: false, lastAssignedAt: `2026-11-01T${String(9+i).padStart(2,'0')}:00:00Z` }));
const now = '2026-11-01T11:00:00Z';

test('assignment reserves one cleaner while room still needs cleaning', () => {
 const originalRoom=room(), originalStaff=staff();
 const result=assignCleaning(originalRoom,originalStaff,now);
 assert.equal(result.room.status,'needs_cleaning');
 assert.deepEqual(result.room.cleaningTask,{cleanerId:'A',assignedAt:new Date(now).toISOString(),startedAt:null});
 assert.equal(result.cleaners[0].hasActiveTask,true);
 assert.equal(result.cleaners[0].activeRoomId,'R-01');
 assert.equal(originalStaff[0].hasActiveTask,false);
 assert.equal(originalRoom.cleaningTask,undefined);
 assert.equal(assignmentToStartMinutes(result.room),null);
});
test('reserved cleaner cannot receive another room; assigned room cannot be assigned twice',()=>{
 const first=assignCleaning(room(),staff(),now);
 assert.equal(assignCleaning({id:'R-02',status:'needs_cleaning'},first.cleaners,now).room.cleaningTask.cleanerId,'B');
 assert.throws(()=>assignCleaning(first.room,first.cleaners,now),/already/);
});
test('no available cleaner leaves room awaiting assignment',()=>{
 const result=assignCleaning(room(),staff().map(p=>({...p,onBreak:true})),now);
 assert.equal(result.assigned,false);assert.equal(result.room.awaitingCleaner,true);
 assert.equal(result.room.status,'needs_cleaning');assert.equal(result.room.cleaningTask,undefined);
});
test('assigned cleaner starting records a separate timestamp and delay',()=>{
 const assigned=assignCleaning(room(),staff(),now);
 const started=startAssignedCleaning(assigned.room,assigned.cleaners,'A','2026-11-01T11:07:00Z');
 assert.equal(started.status,'being_cleaned');assert.equal(assignmentToStartMinutes(started),7);
 assert.equal(assigned.room.cleaningTask.startedAt,null);
});
test('wrong cleaner, break, early start, and repeated start are rejected',()=>{
 const a=assignCleaning(room(),staff(),now);
 assert.throws(()=>startAssignedCleaning(a.room,a.cleaners,'B',now),/assigned cleaner/);
 assert.throws(()=>startAssignedCleaning(a.room,a.cleaners.map(p=>({...p,onBreak:true})),'A',now),/off break/);
 assert.throws(()=>startAssignedCleaning(a.room,a.cleaners,'A','2026-11-01T10:59:00Z'),/precede/);
 const started=startAssignedCleaning(a.room,a.cleaners,'A',now);
 assert.throws(()=>startAssignedCleaning(started,a.cleaners,'A',now),/not waiting/);
});
test('invalid time and assignment before departure are rejected',()=>{
 assert.throws(()=>assignCleaning(room(),staff(),'bad'),/timestamp/);
 assert.throws(()=>assignCleaning({id:'R-01',status:'occupied'},staff(),now),/need cleaning/);
});

function startedTask() {
 const assigned=assignCleaning(room(),staff(),now);
 return {room:startAssignedCleaning(assigned.room,assigned.cleaners,'A','2026-11-01T11:07:00Z'),cleaners:assigned.cleaners};
}

test('completion records duration, makes room available, and releases only its cleaner',()=>{
 const started=startedTask();
 const result=completeCleaning(started.room,started.cleaners,'A','2026-11-01T11:27:00Z');
 assert.equal(result.room.status,'available');
 assert.equal(result.room.cleaningTask,null);
 const history=result.room.cleaningHistory[0];
 assert.equal(history.cleaningMinutes,20);
 assert.equal(history.assignmentToStartMinutes,7);
 assert.equal(history.confirmedBy,'A');
 assert.equal(result.cleaners[0].hasActiveTask,false);
 assert.equal(result.cleaners[0].activeRoomId,null);
 assert.deepEqual(result.cleaners[1],started.cleaners[1]);
 assert.equal(started.room.status,'being_cleaned');
 assert.equal(started.cleaners[0].hasActiveTask,true);
});

test('completion rejects unstarted tasks, wrong cleaner, mismatched reservation, and backwards time',()=>{
 const assigned=assignCleaning(room(),staff(),now),started=startedTask();
 assert.throws(()=>completeCleaning(assigned.room,assigned.cleaners,'A',now),/must start/);
 assert.throws(()=>completeCleaning(started.room,started.cleaners,'B','2026-11-01T11:27:00Z'),/assigned cleaner/);
 assert.throws(()=>completeCleaning(started.room,started.cleaners.map(p=>({...p,activeRoomId:'R-other'})),'A','2026-11-01T11:27:00Z'),/reservation/);
 assert.throws(()=>completeCleaning(started.room,started.cleaners,'A','2026-11-01T11:06:00Z'),/precede/);
});

test('room can be occupied and cleaned again without losing its completed history',()=>{
 const started=startedTask();
 const completed=completeCleaning(started.room,started.cleaners,'A','2026-11-01T11:27:00Z');
 assert.throws(()=>completeCleaning(completed.room,completed.cleaners,'A','2026-11-01T11:28:00Z'),/must start/);
 const occupied=assignRoom(completed.room,'SAMPLE-003','Staff A').room;
 const departed=transitionRoom(occupied,'patient_left','Staff A');
 const next=assignCleaning(departed,completed.cleaners,'2026-11-01T12:00:00Z');
 assert.equal(next.assigned,true);
 assert.equal(next.room.cleaningHistory.length,1);
 assert.equal(next.room.cleaningTask.cleanerId,'B');
});
