import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitingPatients } from './patient-queue.mjs';
const group = { clinicalPriority: 'staff-group-A', roomType: 'standard' };
const patient = (id, waitingSince, overrides = {}) => ({id,waitingSince,status:'waiting',clinicalPriority:group.clinicalPriority,requiredRoomType:group.roomType,...overrides});
test('longest waiting comes first within the selected group',()=>{
 assert.deepEqual(waitingPatients([patient('B','2026-11-01T11:30:00Z'),patient('A','2026-11-01T11:00:00Z')],group).map(p=>p.id),['A','B']);
});
test('excludes different priorities, room types and assigned patients',()=>{
 const result=waitingPatients([
 patient('priority','2026-11-01T10:00:00Z',{clinicalPriority:'staff-group-B'}),
 patient('room','2026-11-01T10:00:00Z',{requiredRoomType:'specialist'}),
 patient('assigned','2026-11-01T10:00:00Z',{status:'assigned'}),
 patient('eligible','2026-11-01T11:00:00Z')],group);
 assert.deepEqual(result.map(p=>p.id),['eligible']);
});
test('compares actual instants across timezones and uses ID for exact ties',()=>{
 const result=waitingPatients([patient('B','2026-11-01T11:00:00Z'),patient('A','2026-11-01T06:00:00-05:00'),patient('C','2026-11-01T10:30:00Z')],group);
 assert.deepEqual(result.map(p=>p.id),['C','A','B']);
});
test('returns an empty list when nobody matches',()=>assert.deepEqual(waitingPatients([],group),[]));
test('rejects duplicate IDs, missing group criteria and invalid timestamps',()=>{
 const p=patient('A','2026-11-01T11:00:00Z');
 assert.throws(()=>waitingPatients([p,p],group),/unique/);
 assert.throws(()=>waitingPatients([p],{roomType:'standard'}),/staff-assigned/);
 for(const time of ['unknown','2026-11-01T11:00:00',undefined])assert.throws(()=>waitingPatients([patient('A',time)],group),/timestamp/);
});
test('preserves input records and order',()=>{
 const patients=[patient('B','2026-11-01T11:30:00Z'),patient('A','2026-11-01T11:00:00Z')];
 const before=structuredClone(patients), result=waitingPatients(patients,group);
 assert.deepEqual(patients,before);assert.notEqual(result[0],patients[1]);
});
