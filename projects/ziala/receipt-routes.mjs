import {randomUUID} from 'node:crypto';
import {validateItemFields} from './upload.mjs';
import {readReceipt,receiptLines} from './receipt.mjs';
import {searchShopping} from './shopping.mjs';
import {structureReceipt} from './receipt-ai.mjs';
const short=(value,max)=>{if(value==null||value==='')return '';if(typeof value!=='string'||value.length>max||/[\r\n\x00]/.test(value))throw Error('Receipt fields must be short single-line text.');return value.trim();};
const productDetails=row=>({retailer:short(row.retailer,100),sku:short(row.sku,60),color:short(row.color,60),size:short(row.size,30)});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function createReceiptHandler({load,save,transact,apiKey,fetchImpl,extractReceipt=readReceipt,aiApiKey,aiModel,aiFetchImpl=fetch}){
 const drafts=new Map();let extracting=false;
 function prune(){for(const [id,draft] of drafts)if(draft.expiresAt<=Date.now())drafts.delete(id);}
 function draftFor(id){prune();const draft=drafts.get(id);if(!draft)fail('Receipt review expired. Upload the receipt again.',410);return draft;}
 return async(path,input)=>{
  if(path==='/api/receipts/extract'){
   prune();if(extracting)fail('Another receipt is being read. Please wait.',429);if(drafts.size>=10)fail('Too many open receipt reviews. Finish a review or wait 20 minutes.',429);
   extracting=true;try{const result=await extractReceipt(input),id=randomUUID();drafts.set(id,{fingerprint:result.fingerprint,rows:result.rows,metadata:{retailer:null,orderNumber:null,orderDate:null},matches:new Map(),expiresAt:Date.now()+20*60*1000});return {draftId:id,text:result.text,method:result.method,rows:result.rows};}finally{extracting=false;}
  }
  const match=path.match(/^\/api\/receipts\/([a-f0-9-]{36})\/(parse|structure|search|commit)$/);if(!match)fail('Not found.',404);
  const draft=draftFor(match[1]),action=match[2];
  if(action==='structure'){
   if(input?.consent!==true)fail('Confirm sending the reviewed receipt text to OpenAI.');
   if(draft.aiBusy)fail('AI is already reading this receipt. Please wait.',429);
   draft.aiBusy=true;try{const result=await structureReceipt(input.text,{apiKey:aiApiKey,model:aiModel,fetchImpl:aiFetchImpl});draft.rows=result.rows;draft.metadata=result.metadata;draft.matches.clear();return {...result,method:'ai-structured-text'};}finally{draft.aiBusy=false;}
  }
  if(draft.aiBusy)fail('Wait for AI extraction to finish before changing this receipt.',409);
  if(action==='parse'){draft.rows=receiptLines(input?.text);draft.metadata={retailer:null,orderNumber:null,orderDate:null};draft.matches.clear();return {rows:draft.rows};}
  if(action==='search'){
   if(!draft.rows.some(row=>row.rowId===input?.rowId))fail('Choose an extracted receipt line.');
   const productName=typeof input.name==='string'?input.name.trim():'';if(!productName||productName.length>100)fail('Review the item name before searching.');
   const details=productDetails(input);
   const queryFields=[productName,input.category,...Object.values(details)];
   for(const number of [draft.metadata.orderNumber,input.orderNumber])if(typeof number==='string'&&number.trim().length>=3&&queryFields.some(field=>String(field).toLowerCase().includes(number.trim().toLowerCase())))fail('An order number appears in the product search fields. Remove it before searching.');
   const result=await searchShopping({category:input.category,size:details.size,occasion:'receipt product match',productName,...details},{apiKey,fetchImpl});
   draft.matches.set(input.rowId,{name:productName,category:input.category,details,products:result.products});return result;
  }
  if(input?.reviewConfirmed!==true)fail('Confirm that you reviewed these purchased items.');
  if(!Array.isArray(input.items)||input.items.length===0||input.items.length>50)fail('Select 1–50 reviewed items.');
  const seen=new Set();let units=0;
  const purchaseMetadata={orderNumber:short(input.metadata?.orderNumber,100),orderDate:short(input.metadata?.orderDate,60)};
  const reviewed=input.items.map(row=>{
   if(!draft.rows.some(original=>original.rowId===row.rowId)||seen.has(row.rowId))fail('Choose each receipt line only once.');seen.add(row.rowId);
   const fields=validateItemFields(row);if(!fields.occasions.length)fail('Add an occasion tag for each selected item.');
   const quantity=Number(row.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>10)fail('Confirm a quantity from 1 to 10.');units+=quantity;if(units>50)fail('Import at most 50 clothing pieces at once.');
   const details=productDetails(row);let product=null;
   if(row.productId){const search=draft.matches.get(row.rowId);if(row.matchConfirmed!==true||search?.name!==fields.name||search.category!==fields.category||JSON.stringify(search.details)!==JSON.stringify(details))fail('Search again and confirm the match after changing item details.');product=search.products.find(p=>p.id===row.productId);if(!product)fail('Choose a product from this receipt review search.');}
   return {rowId:row.rowId,quantity,fields,product,details};
  });
  return transact(async()=>{
   const items=await load(),added=[],skipped=[];
   for(const row of reviewed){
    if(items.some(item=>item.receiptSource?.fingerprint===draft.fingerprint&&item.receiptSource.rowId===row.rowId)){skipped.push(row.rowId);continue;}
    for(let unit=0;unit<row.quantity;unit++){
     const item={id:randomUUID(),...row.fields,purchase:{...purchaseMetadata,...row.details},createdAt:new Date().toISOString(),receiptSource:{fingerprint:draft.fingerprint,rowId:row.rowId,unit},...(row.product?{productUrl:row.product.url,imageUrl:row.product.imageUrl||undefined,productMatch:'user-confirmed search candidate'}:{})};items.push(item);added.push(item);
    }
   }
   if(added.length)await save(items);return {items:added,skippedRows:skipped};
  });
 };
}
