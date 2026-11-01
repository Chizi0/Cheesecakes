import { prepareClothingPhoto } from './client-image.mjs';
import { reviewCloset } from './availability.mjs';
import { laundryReminders } from './laundry.mjs';
import { buildClosetOutfits } from './outfits.mjs';
import { outfitFallback } from './outfit-policy.mjs';
const $=id=>document.getElementById(id);let items=[];
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const start=new Date(`${today()}T00:00:00Z`);start.setUTCDate(start.getUTCDate()+7);$('date').value=start.toISOString().slice(0,10);$('date').min=today();
function el(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;}
function message(text){$('message').textContent=text;}
function render(){
 $('counts').textContent=`${items.length} items saved`;$('items').replaceChildren();$('laundry').replaceChildren();
 for(const reminder of laundryReminders(items))$('laundry').append(el('p',reminder.message,'reminder'));
 for(const item of reviewCloset(items)){
  const card=el('article',null,'item');if(item.imageUrl){const image=el('img');image.src=item.imageUrl;image.alt=item.name;image.loading='lazy';card.append(image);}
  card.append(el('h3',item.name),el('p',`${item.category} · ${item.occasions?.join(', ')||'No occasion tags'}`),el('p',item.reason));
  const button=el('button',item.availability==='ready'?'Move to laundry':'Mark clean');button.onclick=async()=>{button.disabled=true;try{const data=await api(`/api/closet/${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify({availability:item.availability==='ready'?'laundry':'ready'})});items=items.map(existing=>existing.id===item.id?data.item:existing);render();}catch(error){message(error.message);button.disabled=false;}};card.append(button);$('items').append(card);
 }
 renderStyle();
}
function renderStyle(){
 $('outfits').replaceChildren();
 try{
  const mode=$('mode').value,occasion=mode==='daily'?'daily':$('occasion').value;
  const result=buildClosetOutfits(items,occasion);
  const alternate=buildClosetOutfits(items.map(item=>({...item,occasions:['any-ready']})),'any-ready');
  const decision=outfitFallback({mode,hasSuitableReadyOutfit:result.hasSuitableReadyOutfit,hasReadyAlternative:alternate.hasSuitableReadyOutfit,today:today(),occasionDate:$('date').value});
  $('outfits').append(el('p',decision.reason));
  for(const pattern of result.patterns)$('outfits').append(el('p',pattern.complete?`${pattern.pattern}: ${pattern.items.map(item=>item.name).join(' + ')}`:`${pattern.pattern} missing: ${pattern.missingCategories.join(', ')}`));
  if(decision.action==='alternative'){const pattern=alternate.patterns.find(p=>p.complete);$('outfits').append(el('p',`Ready alternative (occasion-tag compromise): ${pattern.items.map(i=>i.name).join(' + ')}`));}
  const missing=result.patterns.filter(p=>!p.complete).sort((a,b)=>a.missingCategories.length-b.missingCategories.length)[0]?.missingCategories[0];
  if(missing)$('shopping-category').value=missing;
  $('shopping-status').textContent=decision.action==='in_store'?'Near occasion: look for nearby stores, but store-specific size stock still needs verification.':decision.action==='shopping'?'Future occasion: compare buying candidates and verify an arrival date before the event.':'Closet-first styling. Product search is also available if you choose to browse.';
 }catch(error){$('outfits').append(el('p',error.message));}
}
$('upload-form').onsubmit=async event=>{
 event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;
 try{const data=new FormData(form),file=data.get('photo');const prepared=await prepareClothingPhoto(file);
 const result=await api('/api/closet',{method:'POST',body:JSON.stringify({name:data.get('name'),category:data.get('category'),availability:data.get('availability'),occasions:data.get('occasions').split(',').map(s=>s.trim()).filter(Boolean),imageBase64:prepared.imageBase64})});items.push(result.item);form.reset();render();message(`${result.item.name} saved with its photo.`);
 }catch(error){message(error.message);}finally{button.disabled=false;}
};
$('shopping-form').onsubmit=async event=>{
 event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;$('products').replaceChildren();
 try{const values=Object.fromEntries(new FormData(event.target));values.occasion=$('mode').value==='daily'?'daily':$('occasion').value;
 const result=await api('/api/shopping/search',{method:'POST',body:JSON.stringify(values)});
 for(const product of result.products){const card=el('article',null,'item');
  if(product.imageUrl){const img=el('img');img.src=product.imageUrl;img.alt=product.name;img.loading='lazy';img.referrerPolicy='no-referrer';card.append(img);}
  card.append(el('h3',product.name),el('p',`${product.seller} · ${product.price||'Price not supplied'}`),el('p',product.deliveryText?`Provider delivery text: ${product.deliveryText}`:'Delivery date not supplied'),el('p',`Selected size ${product.requestedSize}: unverified. Local stock and occasion suitability: unverified.`));
  const link=el('a','Check retailer / product page');link.href=product.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);$('products').append(card);
 }
 message(result.products.length?result.notice:'No search candidates returned. Try different terms.');
 }catch(error){message(error.message);}finally{button.disabled=false;}
};
for(const id of ['mode','occasion','date'])$(id).onchange=renderStyle;
try{items=(await api('/api/closet')).items;render();const health=await api('/api/health');if(!health.shoppingConfigured)message('Closet uploads are ready. Shopping search needs a server API key; setup is in the README.');}catch(error){message(`Start the ZIALA server to load your closet: ${error.message}`);}
