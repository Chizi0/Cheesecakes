import { reviewCloset } from './availability.mjs';
import { laundryReminders } from './laundry.mjs';
import { snoozeReminder, visibleLaundryReminders } from './snooze.mjs';
const root=document.getElementById('ziala-closet');
const field=name=>root.querySelector(`[data-role="${name}"]`);
const sample=[
 {id:'T1',name:'Ivory knit top',category:'top',availability:'ready'},
 {id:'T2',name:'Wine satin blouse',category:'top',availability:'laundry'},
 {id:'T3',name:'Black fitted tee',category:'top',availability:'laundry'},
 {id:'B1',name:'Tailored black trousers',category:'bottom',availability:'ready'},
 {id:'B2',name:'Straight-leg jeans',category:'bottom',availability:'ready'},
 {id:'B3',name:'Chocolate midi skirt',category:'bottom',availability:'laundry'},
];
let items,snoozes,clock;
const now=()=>new Date(clock).toISOString();
function render(){
 field('clock').textContent=new Date(clock).toLocaleString();
 const reviewed=reviewCloset(items);
 const count=category=>items.filter(item=>item.category===category&&item.availability==='ready').length;
 field('counts').textContent=`Ready to wear: ${count('top')} tops · ${count('bottom')} bottoms`;
 field('reminders').replaceChildren();
 const active=laundryReminders(items);
 const reminders=visibleLaundryReminders(items,snoozes,now());
 for(const reminder of reminders){
  const panel=document.createElement('div');panel.className='zc-panel';
  const heading=document.createElement('h3');heading.textContent=reminder.category==='top'?'Tops running low':'Bottoms running low';
  const message=document.createElement('p');message.textContent=reminder.message;
  const label=document.createElement('label');label.className='zc-snooze';label.textContent='Remind me at (your local time)';
  const picker=document.createElement('input');picker.type='datetime-local';picker.required=true;label.append(picker);
  const button=document.createElement('button');button.type='button';button.textContent='Remind me later';
  button.onclick=()=>{try{
   const chosen=new Date(picker.value);if(!picker.value||!Number.isFinite(chosen.getTime()))throw new Error('Choose a date and time.');
   snoozes=snoozeReminder(snoozes,reminder.id,chosen.toISOString(),now());
   field('message').textContent=`Reminder snoozed until ${chosen.toLocaleString()}.`;render();
  }catch(error){field('message').textContent=error.message;}};
  panel.append(heading,message,label,button);field('reminders').append(panel);
 }
 for(const reminder of active.filter(r=>!reminders.some(visible=>visible.id===r.id))){
  const panel=document.createElement('div');panel.className='zc-panel';
  const message=document.createElement('p');message.textContent=`${reminder.category==='top'?'Top':'Bottom'} reminder snoozed until ${new Date(snoozes[reminder.id]).toLocaleString()}.`;
  const button=document.createElement('button');button.type='button';button.textContent='Show reminder now';button.onclick=()=>{const next={...snoozes};delete next[reminder.id];snoozes=next;render();};
  panel.append(message,button);field('reminders').append(panel);
 }
 if(!active.length){const message=document.createElement('p');message.textContent='No laundry reminder needed right now.';field('reminders').append(message);}
 field('items').replaceChildren();
 for(const item of reviewed){
  const row=document.createElement('div');row.className='zc-item';
  const text=document.createElement('div');
  const name=document.createElement('strong');name.textContent=item.name;
  const status=document.createElement('p');status.textContent=item.availability==='ready'?'Ready to wear':'In laundry';
  const reason=document.createElement('p');reason.className='zc-muted';reason.textContent=item.eligible?'Eligible for wear-now styling':item.reason;
  text.append(name,status,reason);
  const button=document.createElement('button');button.type='button';button.textContent=item.availability==='laundry'?'Mark clean':'Move to laundry';button.setAttribute('aria-label',`${button.textContent}: ${item.name}`);
  button.onclick=()=>{const availability=item.availability==='laundry'?'ready':'laundry';items=items.map(existing=>existing.id===item.id?{...existing,availability}:existing);field('message').textContent=`${item.name}: ${availability==='ready'?'ready to wear':'moved to laundry'}.`;render();};
  row.append(text,button);field('items').append(row);
 }
}
function reset(){items=structuredClone(sample);snoozes={};clock=Date.now();field('message').textContent='';render();}
field('advance').onclick=()=>{clock+=30*60000;render();};
field('reset').onclick=reset;reset();
