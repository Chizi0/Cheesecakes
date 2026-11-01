import { transitionRoom } from './room.mjs';
import { isCleanerAvailable } from './cleaners.mjs';
import { applySchedule } from './schedule.mjs';
import { assignCleaning, startAssignedCleaning, completeCleaning } from './cleaning.mjs';
import { waitingPatients } from './patient-queue.mjs';
import { autoAssignPatient } from './assignment.mjs';
const root=document.getElementById('rtc-card');
const field=name=>root.querySelector(`[data-role="${name}"]`);
const initial={id:'R-01',roomType:'standard',status:'occupied',patientId:'SAMPLE-001',updatedBy:'Sample Staff A'};
let room,cleaners,clock,patients;
const schedules = {
 A: {shiftStart:'2026-11-01T08:00:00Z',shiftEnd:'2026-11-01T16:00:00Z',breaks:[{start:'2026-11-01T12:00:00Z',end:'2026-11-01T12:15:00Z'}]},
 B: {shiftStart:'2026-11-01T08:00:00Z',shiftEnd:'2026-11-01T16:00:00Z',breaks:[{start:'2026-11-01T12:15:00Z',end:'2026-11-01T12:30:00Z'}]},
};
function refreshSchedules(){cleaners=cleaners.map(cleaner=>applySchedule(cleaner,schedules[cleaner.id],now()));}
const labels={occupied:'Occupied',needs_cleaning:'Needs cleaning',being_cleaned:'Being cleaned',available:'Available'};
const now=()=>new Date(clock).toISOString();
const time=value=>new Date(value).toISOString().slice(11,16);
function reserve(){refreshSchedules();const result=assignCleaning(room,cleaners,now());room=result.room;cleaners=result.cleaners;return result.message;}
function render(){
 refreshSchedules();
 field('clock').textContent=time(now());
 field('status').textContent=labels[room.status];
 field('patient').textContent=room.patientId?`Patient: ${room.patientId}`:'No patient assigned';
 field('staff').textContent=`Last workflow update by ${room.updatedBy}`;
 const task=room.cleaningTask;
 const owner=cleaners.find(cleaner=>cleaner.id===task?.cleanerId);
 field('task').textContent=task?`Assigned cleaner: ${task.cleanerId} · Assigned ${time(task.assignedAt)}${task.startedAt?` · Started ${time(task.startedAt)}`:''}`:room.awaitingCleaner?'Awaiting cleaner':'No active cleaning task';
 const completed=room.cleaningHistory?.at(-1);
 field('timing').textContent=task?task.startedAt?`Waiting to start: ${(Date.parse(task.startedAt)-Date.parse(task.assignedAt))/60000} min · Cleaning so far: ${(clock-Date.parse(task.startedAt))/60000} min`:`Waiting to start: ${(clock-Date.parse(task.assignedAt))/60000} min`:completed?`Last completed task: ${completed.assignmentToStartMinutes} min waiting · ${completed.cleaningMinutes} min cleaning`:'';
 for(const button of root.querySelectorAll('[data-action]')){
  const action=button.dataset.action;
  button.disabled=action==='patient_left'?room.status!=='occupied':action==='start_cleaning'?room.status!=='needs_cleaning'||!task||!owner?.onShift||owner?.onBreak:room.status!=='being_cleaned';
 }
 field('retry').hidden=!room.awaitingCleaner;
 field('queue').replaceChildren();
 const waiting=waitingPatients(patients,{clinicalPriority:'staff-group-A',roomType:room.roomType});
 for(const patient of waiting){const li=document.createElement('li');li.textContent=`${patient.id} · Waiting since ${time(patient.waitingSince)} UTC`;field('queue').append(li);}
 field('queue-empty').hidden=waiting.length>0;
 field('roster').replaceChildren();
 for(const cleaner of cleaners){
  const row=document.createElement('div');row.className='rtc-controls';
  const text=document.createElement('span');
  const availability=cleaner.scheduleFlag || (!cleaner.onShift?'Off shift':cleaner.onBreak?'Scheduled break':cleaner.hasActiveTask?'Busy':'Available');
  text.textContent=`Cleaner ${cleaner.id}: ${availability}`;
  row.append(text);field('roster').append(row);
 }
}
function act(callback){try{field('message').textContent=callback();render();}catch(error){field('message').textContent=error.message;}}
for(const button of root.querySelectorAll('[data-action]'))button.addEventListener('click',()=>act(()=>{
 const action=button.dataset.action;
 if(action==='patient_left'){patients=patients.map(patient=>patient.id===room.patientId?{...patient,status:'departed',roomId:null}:patient);room=transitionRoom(room,action,'Sample Staff A');return reserve();}
 if(action==='start_cleaning'){room=startAssignedCleaning(room,cleaners,room.cleaningTask.cleanerId,now());return 'Cleaning started';}
 const result=completeCleaning(room,cleaners,room.cleaningTask.cleanerId,now());room=result.room;cleaners=result.cleaners;
 const assignment=autoAssignPatient(room,patients,'staff-group-A');room=assignment.room;patients=assignment.patients;return `${result.message}. ${assignment.notice}`;
}));
field('retry').onclick=()=>act(reserve);
field('advance').onclick=()=>{clock+=5*60000;render();};
function reset(){room={...initial};patients=[
 {id:'SAMPLE-001',status:'assigned',roomId:'R-01',clinicalPriority:'staff-group-A',requiredRoomType:'standard',waitingSince:'2026-11-01T10:00:00Z'},
 {id:'SAMPLE-003',status:'waiting',clinicalPriority:'staff-group-A',requiredRoomType:'standard',waitingSince:'2026-11-01T10:40:00Z'},
 {id:'SAMPLE-002',status:'waiting',clinicalPriority:'staff-group-A',requiredRoomType:'standard',waitingSince:'2026-11-01T10:15:00Z'},
 ];clock=Date.parse('2026-11-01T11:55:00Z');cleaners=['A','B'].map((id,i)=>({id,onShift:true,onBreak:false,hasActiveTask:false,lastAssignedAt:`2026-11-01T09:${i?'30':'00'}:00Z`}));field('message').textContent='';render();}
field('reset').onclick=reset;reset();
