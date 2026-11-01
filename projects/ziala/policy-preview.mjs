import { outfitFallback, reviewShoppingOptions, reviewStoreOptions } from './outfit-policy.mjs';
import { buildClosetOutfits } from './outfits.mjs';
const root=document.getElementById('ziala-policy');
const field=name=>root.querySelector(`[data-role="${name}"]`);
const localToday=new Date();
const today=`${localToday.getFullYear()}-${String(localToday.getMonth()+1).padStart(2,'0')}-${String(localToday.getDate()).padStart(2,'0')}`;
function plusDays(count){const date=new Date(`${today}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);}
field('today').textContent=today;field('date').value=plusDays(7);field('date').min=today;
const deliveryOptions=[
 {id:'D1',name:'Sample buying candidate · option A',occasionSuitable:true,estimatedDeliveryDate:plusDays(4)},
 {id:'D2',name:'Sample buying candidate · option B',occasionSuitable:true,estimatedDeliveryDate:plusDays(9)},
 {id:'D3',name:'Sample buying candidate · option C',occasionSuitable:true},
];
const stores=[
 {id:'S1',name:'Sample Boutique A',occasionSuitable:true,nearby:true,inStock:true,availableSizes:['S','M']},
 {id:'S2',name:'Sample Boutique B',occasionSuitable:true,nearby:true,inStock:true,availableSizes:['L']},
 {id:'S3',name:'Sample Boutique C',occasionSuitable:true,nearby:true,inStock:undefined,availableSizes:[]},
];
let closetItems=[
 {id:'T1',name:'Wine satin blouse',category:'top',availability:'ready',occasions:['dinner','daily']},
 {id:'B1',name:'Tailored black trousers',category:'bottom',availability:'ready',occasions:['dinner','daily']},
 {id:'D1',name:'Evening dress',category:'dress',availability:'ready',occasions:['dinner']},
 {id:'S1',name:'Black shoes',category:'shoes',availability:'ready',occasions:['dinner','daily']},
 {id:'G1',name:'Structured bag',category:'bag',availability:'ready',occasions:['dinner','daily']},
];
const titles={closet:'Use the suitable ready closet outfit',alternative:'Offer the closest ready daily alternative',shopping:'Check delivery options',in_store:'Check nearby in-store options',no_match:'No ready closet option'};
function update(){
 const mode=field('mode').value;field('date-label').hidden=mode==='daily';
 try{
  const tag=mode==='occasion'?'dinner':'daily';
  const built=buildClosetOutfits(closetItems,tag);
  const anyReady=buildClosetOutfits(closetItems.map(item=>({...item,occasions:['ready-alternative']})),'ready-alternative');
  const decision=outfitFallback({mode,hasSuitableReadyOutfit:built.hasSuitableReadyOutfit,hasReadyAlternative:anyReady.hasSuitableReadyOutfit,today,occasionDate:field('date').value});
  field('closet').replaceChildren();
  for(const item of built.reviewedItems){
   const row=document.createElement('div');row.className='zp-item';
   const text=document.createElement('div');const name=document.createElement('strong');name.textContent=item.name;
   const reason=document.createElement('p');reason.className='zp-muted';reason.textContent=`${item.category} · Tags: ${item.occasions.join(', ')} · ${item.reason}`;text.append(name,reason);
   const button=document.createElement('button');button.type='button';button.textContent=item.availability==='ready'?'Move to laundry':'Mark clean';button.setAttribute('aria-label',`${button.textContent}: ${item.name}`);
   button.onclick=()=>{closetItems=closetItems.map(existing=>existing.id===item.id?{...existing,availability:item.availability==='ready'?'laundry':'ready'}:existing);update();};
   row.append(text,button);field('closet').append(row);
  }
  field('outfits').replaceChildren();
  for(const pattern of built.patterns){
   const description=document.createElement('p');description.textContent=pattern.complete?`${pattern.pattern==='dress'?'Dress look':'Separates look'}: ${pattern.items.map(item=>item.name).join(' + ')}`:`${pattern.pattern==='dress'?'Dress look':'Separates look'} incomplete: no ready suitable ${pattern.missingCategories.join(', ')}.`;
   field('outfits').append(description);
  }
  if(decision.action==='alternative'){
   const alternative=anyReady.patterns.find(pattern=>pattern.complete),text=document.createElement('p');text.textContent=`Ready alternative: ${alternative.items.map(item=>item.name).join(' + ')}. At least one piece lacks the requested tag; this is not a suitability match.`;field('outfits').append(text);
  }
  field('title').textContent=titles[decision.action];
  field('reason').textContent=decision.reason;
  field('options').replaceChildren();
  let options=[];
  if(decision.action==='shopping')options=reviewShoppingOptions(deliveryOptions,field('date').value);
  if(decision.action==='in_store')options=reviewStoreOptions(stores,field('size').value);
  for(const option of options){
   const block=document.createElement('div');block.className='zp-option';
   const title=document.createElement('strong');title.textContent=`${option.name} · ${option.eligible?'Qualifies':'Excluded'}`;
   const reason=document.createElement('p');reason.textContent=option.reason;
   block.append(title,reason);
   if(option.availableSizes){const sizes=document.createElement('p');sizes.className='zp-muted';sizes.textContent=`Confirmed sample sizes: ${option.availableSizes.join(', ')||'none'}`;block.append(sizes);}
   field('options').append(block);
  }
  field('error').hidden=true;field('result').hidden=false;
 }catch(error){field('error').textContent=error.message;field('error').hidden=false;field('result').hidden=true;}
}
for(const input of root.querySelectorAll('input,select'))input.addEventListener('input',update);
update();
