import {prepareClothingPhoto} from './client-image.mjs';
export function setupReceipts({api,message,onImported}){
 const root=document.getElementById('receipt-review');
 api('/api/health').then(health=>{document.getElementById('receipt-ai-status').textContent=health.receiptAIConfigured?'AI key is configured. A successful receipt request will confirm it works.':'AI receipt extraction is not connected yet. Local receipt reading is available.';}).catch(()=>{});let draftId=null,rows=[],metadata={};
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const label=(text,input)=>{const node=el('label',text);node.append(input);return node;};
 const input=(value='')=>{const node=el('input');node.value=value;return node;};
 const select=(options,value='')=>{const node=el('select');for(const [key,text] of options){const option=el('option',text);option.value=key;node.append(option);}node.value=value;return node;};
 const readBase64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Cannot read receipt file.'));reader.readAsDataURL(file);});
 document.getElementById('receipt-upload').onsubmit=async event=>{
  event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
  try{const file=event.target.elements.receipt.files[0];if(!file)throw Error('Choose a receipt file.');
   let fileBase64,type=file.type;if(['image/jpeg','image/png','image/webp'].includes(type)){fileBase64=(await prepareClothingPhoto(file)).imageBase64;type='image/jpeg';}
   else{if(file.size>5*1024*1024)throw Error('Use a PDF or text receipt up to 5 MB.');fileBase64=await readBase64(file);}
   message('Reading your receipt locally. Photos may take a little longer…');
   const result=await api('/api/receipts/extract',{method:'POST',body:JSON.stringify({fileBase64,type})});draftId=result.draftId;rows=result.rows;metadata={};render(result.text);message('Review the extracted items. Nothing has been added to your closet.');
  }catch(error){message(error.message);}finally{button.disabled=false;}
 };
 function render(text){
  root.replaceChildren();const details=el('details'),summary=el('summary','Review or correct receipt text'),raw=el('textarea');raw.value=text;raw.rows=9;raw.setAttribute('aria-label','Extracted receipt text');
  const parse=el('button','Find item lines again');parse.type='button';parse.onclick=async()=>{parse.disabled=true;try{const result=await api(`/api/receipts/${draftId}/parse`,{method:'POST',body:JSON.stringify({text:raw.value})});rows=result.rows;metadata={};render(raw.value);message('Item suggestions refreshed. Review them again before saving.');}catch(error){message(error.message);parse.disabled=false;}};
  details.append(summary,raw,parse);root.append(details);
  const consent=input();consent.type='checkbox';const ai=el('button','Use AI to identify retailer and items');ai.type='button';const aiStatus=el('p');aiStatus.setAttribute('role','status');
  root.append(el('p','Optional AI extraction sends the receipt text above to OpenAI. Open the text review to remove personal details first. It uses your separately configured API account.'));
  root.append(label('Send this reviewed receipt text to OpenAI for structured extraction.',consent),ai,aiStatus);
  ai.onclick=async()=>{if(!consent.checked){aiStatus.textContent='Confirm sending the reviewed text to OpenAI, or continue with local review.';message(aiStatus.textContent);return;}ai.disabled=true;parse.disabled=true;
   try{aiStatus.textContent='AI is identifying the retailer and purchase details…';message(aiStatus.textContent);const result=await api(`/api/receipts/${draftId}/structure`,{method:'POST',body:JSON.stringify({text:raw.value,consent:true})});rows=result.rows;metadata=result.metadata;render(raw.value);message('AI suggestions are ready. Check the source lines and correct uncertain fields before searching or saving.');}catch(error){aiStatus.textContent=error.message;message(error.message);ai.disabled=false;parse.disabled=false;}
  };
  const retailer=input(metadata.retailer||''),orderNumber=input(metadata.orderNumber||''),orderDate=input(metadata.orderDate||'');retailer.maxLength=100;orderNumber.maxLength=100;orderDate.maxLength=60;
  const purchase=el('div');purchase.className='fields';purchase.append(label('Retailer (confirm or correct)',retailer),label('Order number — saved locally, excluded from product searches',orderNumber),label('Purchase date as printed',orderDate));root.append(purchase);
  root.append(el('p','Only selected, reviewed purchases will be added. Confirm category, quantity, availability and occasion tags. Product photos are optional.'));
  if(!rows.length)root.append(el('p','No priced item lines found. Correct the text above to one item per line, such as “Wine blouse $45.00”, then find item lines again.'));
  const controls=[];
  for(const row of rows){
   const card=el('article'),choose=input();choose.type='checkbox';card.className='item';card.append(label('Add this purchased item',choose),el('p',`Receipt line: ${row.sourceLine}`));
   const name=input(row.name),category=select([['','Choose category'],['top','Top'],['bottom','Bottom'],['dress','Dress'],['shoes','Shoes'],['bag','Bag']],row.category),quantity=input(row.quantity??''),availability=select([['','Confirm availability'],['ready','Ready to wear'],['laundry','In laundry']]),occasions=input(),size=input(row.size||''),sku=input(row.sku||''),color=input(row.color||'');
   sku.maxLength=60;color.maxLength=60;name.maxLength=100;quantity.type='number';quantity.min=1;quantity.max=10;size.placeholder='M, US 8, or One size';size.maxLength=30;occasions.placeholder='daily, dinner';
   const fields=el('div');fields.className='fields';fields.append(label('Item name',name),label('Category (suggestion—please confirm)',category),label('Quantity',quantity),label('Availability',availability),label('Occasion tags',occasions),label('SKU or style code (not order number)',sku),label('Color',color),label('Size for optional product search',size));card.append(fields);if(row.uncertainties?.length)card.append(el('p',`Needs review: ${row.uncertainties.join(' ')}`));
   const search=el('button','Find a matching product'),results=el('div'),chosen=el('p','No product photo selected. You can still save this item.');search.type='button';
   const state={rowId:row.rowId,choose,name,category,quantity,availability,occasions,size,sku,color,productId:null,matchConfirmed:false};controls.push(state);
   const resetMatch=()=>{state.productId=null;state.matchConfirmed=false;results.replaceChildren();chosen.textContent='Details changed. Search again to attach a matching product.';};name.oninput=resetMatch;category.onchange=resetMatch;size.oninput=resetMatch;sku.oninput=resetMatch;color.oninput=resetMatch;retailer.addEventListener('input',resetMatch);
   search.onclick=async()=>{search.disabled=true;state.productId=null;state.matchConfirmed=false;results.replaceChildren();chosen.textContent='Searching…';
    try{const result=await api(`/api/receipts/${draftId}/search`,{method:'POST',body:JSON.stringify({rowId:row.rowId,name:name.value,category:category.value,size:size.value,retailer:retailer.value,sku:sku.value,color:color.value,orderNumber:orderNumber.value})});chosen.textContent=result.products.length?'Select only if it matches your purchased item, including the style and color.':'No matches found. You can save without a product photo.';
     for(const product of result.products){const candidate=el('div');candidate.className='receipt-candidate';if(product.imageUrl){const image=el('img');image.src=product.imageUrl;image.alt=product.name;image.loading='lazy';image.referrerPolicy='no-referrer';candidate.append(image);}const link=el('a',`${product.name} · ${product.seller} · ${product.price||'Price unknown'}`);link.href=product.url;link.target='_blank';link.rel='noopener noreferrer';
      const attach=el('button','This matches my purchase');attach.type='button';attach.onclick=()=>{state.productId=product.id;state.matchConfirmed=true;chosen.textContent=`Selected: ${product.name}`;};candidate.append(link,attach);results.append(candidate);}
    }catch(error){chosen.textContent=error.message;}finally{search.disabled=false;}
   };card.append(search,chosen,results);root.append(card);
  }
  if(!rows.length)return;
  const confirm=input();confirm.type='checkbox';root.append(label('I reviewed the selected purchases and corrected their details.',confirm));
  const save=el('button','Add reviewed items to closet');save.type='button';save.onclick=async()=>{save.disabled=true;parse.disabled=true;ai.disabled=true;
   try{const items=controls.filter(row=>row.choose.checked).map(row=>({rowId:row.rowId,name:row.name.value,category:row.category.value,quantity:Number(row.quantity.value),availability:row.availability.value,occasions:row.occasions.value.split(',').map(s=>s.trim()).filter(Boolean),productId:row.productId,matchConfirmed:row.matchConfirmed,retailer:retailer.value,size:row.size.value,sku:row.sku.value,color:row.color.value}));
    const result=await api(`/api/receipts/${draftId}/commit`,{method:'POST',body:JSON.stringify({reviewConfirmed:confirm.checked,items,metadata:{orderNumber:orderNumber.value,orderDate:orderDate.value}})});await onImported();message(`${result.items.length} clothing pieces saved. ${result.skippedRows.length} previously imported receipt lines skipped.`);root.replaceChildren();draftId=null;rows=[];
   }catch(error){message(error.message);save.disabled=false;parse.disabled=false;ai.disabled=false;}
  };root.append(save);
 }
}
