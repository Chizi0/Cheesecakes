import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTechnician, assignJob } from './dispatch.mjs';
const job = { requiredCertification: 'electrical' };
const tech = (id, travelMinutes, overrides = {}) => ({id,travelMinutes,certifications:['electrical'],available:true,hasActiveJob:false,...overrides});

test('C wins over closer unqualified A and qualified but busy B',()=>{
 const result=selectTechnician([
  tech('A',5,{certifications:['plumbing']}),
  tech('B',20,{hasActiveJob:true}),
  tech('C',35),
 ],job);
 assert.equal(result.technician.id,'C');
});
test('shortest travel estimate wins among eligible technicians',()=>{
 assert.equal(selectTechnician([tech('C',35),tech('D',25)],job).technician.id,'D');
});
test('unknown availability and active-job status do not qualify',()=>{
 for(const overrides of [{available:undefined},{hasActiveJob:undefined},{available:false}]){
  assert.equal(selectTechnician([tech('B',5,overrides),tech('C',35)],job).technician.id,'C');
 }
});
test('returns no match when nobody qualifies',()=>{
 assert.equal(selectTechnician([],job).technician,null);
 assert.equal(selectTechnician([tech('B',20,{hasActiveJob:true})],job).technician,null);
});
test('invalid estimates and duplicate IDs are rejected',()=>{
 for(const minutes of [-1,NaN,Infinity,undefined])assert.throws(()=>selectTechnician([tech('A',minutes)],job),/travel estimate/);
 assert.throws(()=>selectTechnician([tech('A',5),tech('A',20)],job),/unique/);
});
test('exact travel ties use ID and do not reorder the original list',()=>{
 const technicians=[tech('B',20),tech('A',20)],before=structuredClone(technicians);
 assert.equal(selectTechnician(technicians,job).technician.id,'A');
 assert.deepEqual(technicians,before);
});

test('automatically assigns confirmed available technician and reserves them',()=>{
 const pending={...job,id:'JOB-01',status:'pending'};
 const technicians=[tech('C',35)];
 const result=assignJob(pending,technicians);
 assert.equal(result.assigned,true);
 assert.equal(result.job.technicianId,'C');
 assert.equal(result.job.status,'assigned');
 assert.equal(result.technicians[0].available,false);
 assert.equal(result.technicians[0].hasActiveJob,true);
 assert.equal(result.technicians[0].activeJobId,'JOB-01');
 assert.equal(result.notice,'Job JOB-01 automatically assigned to technician C.');
 assert.equal(pending.status,'pending');assert.equal(technicians[0].available,true);
});

test('updated roster prevents assigning a second job to the same busy technician',()=>{
 const first=assignJob({...job,id:'JOB-01',status:'pending'},[tech('C',35)]);
 const second=assignJob({...job,id:'JOB-02',status:'pending'},first.technicians);
 assert.equal(second.assigned,false);
 assert.equal(second.job.status,'pending');
 assert.throws(()=>assignJob(first.job,first.technicians),/pending/);
});

test('no eligible technician leaves the job pending with a notice',()=>{
 const pending={...job,id:'JOB-01',status:'pending'};
 const result=assignJob(pending,[tech('B',20,{available:false})]);
 assert.equal(result.assigned,false);assert.equal(result.job.status,'pending');
 assert.match(result.notice,/No qualified technician/);
});

test('rejects missing job ID and inconsistent existing reservations',()=>{
 assert.throws(()=>assignJob({...job,status:'pending'},[]),/Job ID/);
 assert.throws(()=>assignJob({...job,id:'JOB-01',status:'pending'},[tech('C',35,{activeJobId:'JOB-01'})]),/reservation/);
});
