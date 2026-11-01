import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceJob, confirmAvailability } from './job-lifecycle.mjs';
import { selectTechnician } from './dispatch.mjs';
const time='2026-11-01T12:00:00Z';
const job=()=>({id:'JOB-01',status:'assigned',technicianId:'C',requiredCertification:'electrical'});
const tech=()=>({id:'C',available:false,hasActiveJob:true,activeJobId:'JOB-01',certifications:['electrical'],travelMinutes:35});

test('job advances in order while technician remains unavailable',()=>{
 let currentJob=job(),technician=tech();
 for(const expected of ['en_route','in_progress','completed']){
  const result=advanceJob(currentJob,technician,time);
  assert.equal(result.job.status,expected);assert.equal(result.technician.available,false);
  currentJob=result.job;technician=result.technician;
 }
 assert.equal(technician.hasActiveJob,false);assert.equal(technician.activeJobId,null);
 assert.equal(technician.availabilityNeedsConfirmation,true);
 assert.equal(currentJob.completedAt,new Date(time).toISOString());
});
test('completed technician is excluded until they explicitly confirm',()=>{
 const finished=advanceJob({...job(),status:'in_progress'},tech(),time);
 assert.equal(selectTechnician([finished.technician],job()).technician,null);
 const confirmed=confirmAvailability(finished.technician,'2026-11-01T12:05:00Z');
 assert.equal(confirmed.available,true);assert.equal(confirmed.availabilityNeedsConfirmation,false);
 assert.equal(confirmed.availabilityConfirmedAt,'2026-11-01T12:05:00.000Z');
 assert.equal(selectTechnician([confirmed],job()).technician.id,'C');
});
test('active or unknown job state cannot confirm availability',()=>{
 assert.throws(()=>confirmAvailability(tech(),time),/no active job/);
 assert.throws(()=>confirmAvailability({id:'C'},time),/no active job/);
});
test('rejects mismatched ownership, finished job updates, invalid time and backwards updates',()=>{
 assert.throws(()=>advanceJob(job(),{...tech(),id:'B'},time),/must match/);
 assert.throws(()=>advanceJob({...job(),status:'completed'},tech(),time),/cannot advance/);
 assert.throws(()=>advanceJob(job(),tech(),'invalid'),/timestamp/);
 assert.throws(()=>advanceJob({...job(),updatedAt:'2026-11-01T13:00:00Z'},tech(),time),/precede/);
});
test('completion and confirmation preserve their input records',()=>{
 const originalJob={...job(),status:'in_progress'},originalTechnician=tech();
 const finished=advanceJob(originalJob,originalTechnician,time);
 confirmAvailability(finished.technician,time);
 assert.equal(originalJob.status,'in_progress');assert.equal(originalTechnician.hasActiveJob,true);
 assert.equal(finished.technician.available,false);
});
