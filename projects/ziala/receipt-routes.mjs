import {randomUUID} from 'node:crypto';
import {validateItemFields} from './upload.mjs';
import {readReceipt,receiptLines} from './receipt.mjs';
import {searchShopping} from './shopping.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function createReceiptHandler({load,save,transact,apiKey,fetchImpl,extractReceipt=readReceipt}){
 const drafts=new Map();let extracting=false;
 function prune(){for(const [id,draft] of drafts)if(draft.expiresAt<=Date.now())drafts.delete(id);}
 function draftFor(id){prune();const draft=drafts.get(id);if(!draft)fail('Receipt review expired. Upload the receipt again.',410);return draft;}
 return async(path,input)=>{
  if(path==='/api/receipts/extract'){
   prune();if(extracting)fail('Another receipt is being read. Please wait.',429);if(drafts.size>=10)fail('Too many open receipt reviews. Finish a review or wait 20 minutes.',429);
   extracting=true;try{const result=await extractReceipt(input),id=randomUUID();drafts.set(id,{fingerprint:result.fingerprint,rows:result.rows,matches:new Map(),expiresAt:Date.now()+20*60*1000});return {draftId:id,text:result.text,method:result.method,rows:result.rows};}finally{extracting=false;}
  }
  const match=path.match(/^\/api\/receipts\/([a-f0-9-]{36})\/(parse|search|commit)$/);if(!match)fail('Not found.',404);
  const draft=draftFor(match[1]),action=match[2];
  if(action==='parse'){draft.rows=receiptLines(input?.text);draft.matches.clear();return {rows:draft.rows};}
  if(action==='search'){
   if(!draft.rows.some(row=>row.rowId===input?.rowId))fail('Choose an extracted receipt line.');
   const productName=typeof input.name==='string'?input.name.trim():'';if(!productName||productName.length>100)fail('Review the item name before searching.');
   const result=await searchShopping({category:input.category,size:input.size,occasion:'receipt product match',productName},{apiKey,fetchImpl});
   draft.matches.set(input.rowId,{name:productName,category:input.category,products:result.products});return result;
  }
  if(input?.reviewConfirmed!==true)fail('Confirm that you reviewed these purchased items.');
  if(!Array.isArray(input.items)||input.items.length===0||input.items.length>50)fail('Select 1–50 reviewed items.');
  const seen=new Set();let units=0;
  const reviewed=input.items.map(row=>{
   if(!draft.rows.some(original=>original.rowId===row.rowId)||seen.has(row.rowId))fail('Choose each receipt line only once.');seen.add(row.rowId);
   const fields=validateItemFields(row);if(!fields.occasions.length)fail('Add an occasion tag for each selected item.');
   const quantity=Number(row.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>10)fail('Confirm a quantity from 1 to 10.');units+=quantity;if(units>50)fail('Import at most 50 clothing pieces at once.');
   let product=null;
   if(row.productId){const search=draft.matches.get(row.rowId);if(row.matchConfirmed!==true||search?.name!==fields.name||search.category!==fields.category)fail('Search again and confirm the match after changing item details.');product=search.products.find(p=>p.id===row.productId);if(!product)fail('Choose a product from this receipt review search.');}
   return {rowId:row.rowId,quantity,fields,product};
  });
  return transact(async()=>{
   const items=await load(),added=[],skipped=[];
   for(const row of reviewed){
    if(items.some(item=>item.receiptSource?.fingerprint===draft.fingerprint&&item.receiptSource.rowId===row.rowId)){skipped.push(row.rowId);continue;}
    for(let unit=0;unit<row.quantity;unit++){
     const item={id:randomUUID(),...row.fields,createdAt:new Date().toISOString(),receiptSource:{fingerprint:draft.fingerprint,rowId:row.rowId,unit},...(row.product?{productUrl:row.product.url,imageUrl:row.product.imageUrl||undefined,productMatch:'user-confirmed search candidate'}:{})};items.push(item);added.push(item);
    }
   }
   if(added.length)await save(items);return {items:added,skippedRows:skipped};
  });
 };
}
