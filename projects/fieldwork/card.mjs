import { checkCertification } from './eligibility.mjs';
import { assignJob, selectTechnician } from './dispatch.mjs';
import { advanceJob, confirmAvailability } from './job-lifecycle.mjs';
const root=document.getElementById('fw-dispatch');
const field=name=>root.querySelector(`[data-role="${name}"]`);
let job,technicians,jobNumber;
const now=()=>new Date().toISOString();
const statusLabels={pending:'Pending',assigned:'Assigned',en_route:'En route',in_progress:'In progress',completed:'Completed'};
const nextLabels={assigned:'Mark en route',en_route:'Start work',in_progress:'Complete job'};
function render(){
 field('job-title').textContent=`${job.id} · Electrical repair`;
 field('job-status').textContent=`Status: ${statusLabels[job.status]}${job.technicianId?` · Assigned to ${job.technicianId}`:''}`;
 field('dispatch').disabled=job.status!=='pending';
 field('advance').hidden=!nextLabels[job.status];
 field('advance').textContent=nextLabels[job.status]||'Advance job';
 field('next-job').hidden=job.status!=='completed';
 field('roster').replaceChildren();
 for(const technician of technicians){
  const row=document.createElement('section');row.className='fw-tech';row.setAttribute('aria-label',`Technician ${technician.id}`);
  const name=document.createElement('strong');name.textContent=`Technician ${technician.id} · ${technician.travelMinutes} min away`;
  const qualifications=document.createElement('p');qualifications.className='fw-muted';qualifications.textContent=`Certifications: ${technician.certifications.join(', ')}`;
  const state=document.createElement('p');
  const qualified=checkCertification(technician,job).qualified;
  state.textContent=!qualified?'Excluded: missing required certification':technician.hasActiveJob?'Excluded: already has an active job':technician.available?'Eligible: qualified and confirmed available':'Excluded: availability not confirmed';
  const actions=document.createElement('div');actions.className='fw-row';
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent=`${technician.id}: Confirm available`;confirm.disabled=technician.hasActiveJob||technician.available;
  confirm.onclick=()=>{try{technicians=technicians.map(t=>t.id===technician.id?confirmAvailability(t,now()):t);field('notice').textContent=`Technician ${technician.id} confirmed availability.`;render();}catch(error){field('notice').textContent=error.message;}};
  const unavailable=document.createElement('button');unavailable.type='button';unavailable.textContent=`${technician.id}: Set unavailable`;unavailable.disabled=technician.hasActiveJob||!technician.available;
  unavailable.onclick=()=>{technicians=technicians.map(t=>t.id===technician.id?{...t,available:false}:t);field('notice').textContent=`Technician ${technician.id} is unavailable.`;render();};
  const confirmation=document.createElement('p');confirmation.className='fw-muted';confirmation.textContent=technician.availabilityNeedsConfirmation?'Availability confirmation required':technician.availabilityConfirmedAt?`Last confirmation: ${new Date(technician.availabilityConfirmedAt).toLocaleTimeString()}`:technician.available?'Availability preconfirmed in sample data':'';
  actions.append(confirm,unavailable);row.append(name,qualifications,state,confirmation,actions);field('roster').append(row);
 }
 if(job.status==='pending'){
  const selected=selectTechnician(technicians,job).technician;
  field('job-status').textContent+=selected?` · Next eligible: ${selected.id}`:' · No eligible technician';
 }
}
field('dispatch').onclick=()=>{
 try{const result=assignJob(job,technicians);job=result.job;technicians=result.technicians;field('notice').textContent=result.notice;render();}
 catch(error){field('notice').textContent=error.message;}
};
field('advance').onclick=()=>{
 try{
  const technician=technicians.find(t=>t.id===job.technicianId);
  const result=advanceJob(job,technician,now());job=result.job;
  technicians=technicians.map(t=>t.id===result.technician.id?result.technician:t);
  field('notice').textContent=result.notice;render();
 }catch(error){field('notice').textContent=error.message;}
};
field('next-job').onclick=()=>{jobNumber++;job={id:`JOB-${String(jobNumber).padStart(2,'0')}`,status:'pending',requiredCertification:'electrical'};field('notice').textContent='New sample job ready for dispatch. Technician availability has been preserved.';render();};
function reset(){
 jobNumber=1;
 job={id:'JOB-01',status:'pending',requiredCertification:'electrical'};
 technicians=[
 {id:'A',travelMinutes:5,certifications:['plumbing'],available:true,hasActiveJob:false},
 {id:'B',travelMinutes:20,certifications:['electrical'],available:false,hasActiveJob:true,activeJobId:'JOB-other'},
 {id:'C',travelMinutes:35,certifications:['electrical'],available:true,hasActiveJob:false},
 ];field('notice').textContent='';render();
}
field('reset').onclick=reset;reset();
