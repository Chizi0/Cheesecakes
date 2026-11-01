import { rankTickets } from './queue.mjs';
const root=document.getElementById('sd-queue');
const field=name=>root.querySelector(`[data-role="${name}"]`);
const samples=[
 {id:'SD-1042',title:'Checkout fails on mobile',customersAffected:2,arrivedAt:'2026-11-01T11:30:00Z',age:'30 minutes ago',hasWorkingPaymentLink:false},
 {id:'SD-1043',title:'Checkout fails after address entry',customersAffected:50,arrivedAt:'2026-11-01T11:55:00Z',age:'5 minutes ago',hasWorkingPaymentLink:false},
 {id:'SD-1044',title:'Checkout fails; payment link works',customersAffected:100,arrivedAt:'2026-11-01T11:20:00Z',age:'40 minutes ago',hasWorkingPaymentLink:true},
];
function element(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function updateQueue(){
 try{
  const state=field('workaround').value;
  const tickets=samples.map((t,i)=>i===0?{...t,customersAffected:Number(field('count').value),hasWorkingPaymentLink:state==='working'?true:state==='unavailable'?false:undefined}:t);
  const ranked=rankTickets(tickets);field('list').replaceChildren();
  for(const [index,ticket] of ranked.entries()){
   const li=document.createElement('li');const row=element('div','', 'sd-row');
   row.append(element('span',`${index+1}. ${ticket.id}`));
   const tag=element('span',ticket.priority,'sd-tag');tag.dataset.priority=ticket.priority;row.append(tag);
   if(ticket.needsTriage)row.append(element('span','Needs triage','sd-meta'));
   li.append(row,element('p',ticket.title,'sd-title'),element('p',`${ticket.customersAffected} customers · Arrived ${ticket.age}`,'sd-meta'),element('p',ticket.explanation,'sd-meta'));
   if(ticket.nextAction)li.append(element('p',`Next action: ${ticket.nextAction}`,'sd-title'));
   field('list').append(li);
  }
  field('summary').textContent=`SD-1042 is position ${ranked.findIndex(t=>t.id==='SD-1042')+1} of ${ranked.length}.`;
  field('error').hidden=true;field('results').hidden=false;
 }catch(error){field('error').textContent=error.message;field('error').hidden=false;field('results').hidden=true;}
}
field('count').addEventListener('input',updateQueue);
field('workaround').addEventListener('change',updateQueue);
updateQueue();
