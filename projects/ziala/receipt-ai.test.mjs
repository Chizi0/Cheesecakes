import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {structureReceipt,validateAIReceipt} from './receipt-ai.mjs';
import {createApp} from './server.mjs';
const text='ZARA\nOrder ORD-987654\nDate 2026-11-01\nWine satin blouse\nSKU 1234/567 Burgundy Size M Qty: 2\nTotal $90.00';
const extracted=()=>({retailer:'ZARA',orderNumber:'ORD-987654',orderDate:'2026-11-01',items:[{name:'Wine satin blouse',category:'top',sku:'1234/567',color:'Burgundy',size:'M',quantity:2,sourceLines:[3,4],uncertainties:[]}]});
const response=value=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('AI extraction uses strict schema, numbered untrusted text, no tools, server key and store false',async()=>{
 let sent;const result=await structureReceipt(text,{apiKey:'ai-test-secret',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer ai-test-secret');return response(extracted());}});
 assert.equal(sent.store,false);assert.equal(sent.model,'gpt-4.1-mini');assert.equal(sent.text.format.type,'json_schema');assert.equal(sent.text.format.strict,true);assert.equal(sent.tools,undefined);assert.match(sent.instructions,/untrusted/);assert.match(sent.input,/"line":3/);
 assert.equal(result.metadata.retailer,'ZARA');assert.equal(result.rows[0].sku,'1234/567');assert.equal(result.rows[0].quantity,2);assert.ok(!JSON.stringify(result).includes('ai-test-secret'));
});
test('unsupported identifiers and attributes are left blank, quantities stay unknown without explicit evidence',()=>{
 const value=extracted();value.retailer='Invented retailer';value.items[0].color='Blue';value.items[0].quantity=3;
 const result=validateAIReceipt(value,text);assert.equal(result.metadata.retailer,null);assert.equal(result.rows[0].color,null);assert.equal(result.rows[0].quantity,null);assert.ok(result.rows[0].uncertainties.length>=2);
 const unknown=extracted();unknown.items[0].sku=null;unknown.items[0].quantity=null;assert.equal(validateAIReceipt(unknown,text).rows[0].sku,null);
});
test('hallucinated item names, broken evidence, duplicate item lines and malformed output fail closed',()=>{
 for(const mutate of [v=>v.items[0].name='Imaginary handbag',v=>v.items[0].sourceLines=[999],v=>v.items.push({...v.items[0]}),v=>v.items[0].quantity=99,v=>v.items[0].uncertainties='not-array']){const value=extracted();mutate(value);assert.throws(()=>validateAIReceipt(value,text));}
});
test('missing key, provider failure, refusal and incomplete output never become successful extraction',async()=>{
 await assert.rejects(()=>structureReceipt(text,{}),/OPENAI_API_KEY/);
 for(const payload of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'invalid'}]}]}])await assert.rejects(()=>structureReceipt(text,{apiKey:'secret',fetchImpl:async()=>({ok:true,json:async()=>payload})}));
 await assert.rejects(()=>structureReceipt(text,{apiKey:'secret',fetchImpl:async()=>({ok:false,json:async()=>({error:'secret'})})}),error=>!error.message.includes('secret'));
});
async function fixture(run,{key='ai-test-key',aiResponse=()=>response(extracted())}={}){
 const dataDir=await mkdtemp(join(tmpdir(),'ziala-ai-receipt-'));let aiCalls=0,shoppingURL;
 const server=await createApp({dataDir,aiApiKey:key,aiFetchImpl:async()=>{aiCalls++;return aiResponse();},apiKey:'shopping-test-key',fetchImpl:async url=>{shoppingURL=new URL(url);return {ok:true,json:async()=>({shopping_results:[{product_id:'p',title:'Wine satin blouse',source:'Zara',product_link:'https://example.com/product',thumbnail:'https://example.com/image'}]})};}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}`;
 const request=(path,opts)=>fetch(url+path,opts);const post=async(path,body)=>{const r=await request(path,json(body));return {status:r.status,data:await r.json()};};
 try{const draft=(await post('/api/receipts/extract',{type:'text/plain',fileBase64:Buffer.from(text).toString('base64')})).data;await run({post,request,draft,aiCalls:()=>aiCalls,shoppingURL:()=>shoppingURL});}finally{await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true});}
}
test('AI requires consent; structured details feed search while order numbers stay out; saved purchases retain reviewed metadata',()=>fixture(async({post,request,draft,aiCalls,shoppingURL})=>{
 const path=`/api/receipts/${draft.draftId}`;
 assert.equal((await post(path+'/structure',{text,consent:false})).status,400);assert.equal(aiCalls(),0);
 const structured=await post(path+'/structure',{text,consent:true});assert.equal(structured.status,200);
 const row={...structured.data.rows[0],...structured.data.metadata,availability:'ready',occasions:['dinner']};
 const search=await post(path+'/search',row);assert.equal(search.status,200);const q=shoppingURL().searchParams.get('q');for(const term of ['ZARA','Wine satin blouse','1234/567','Burgundy','M'])assert.ok(q.includes(term));assert.ok(!shoppingURL().href.includes('ORD-987654'));assert.ok(!shoppingURL().href.includes('2026-11-01'));
 const saved=await post(path+'/commit',{reviewConfirmed:true,metadata:structured.data.metadata,items:[{...row,productId:'p',matchConfirmed:true}]});assert.equal(saved.status,200);assert.equal(saved.data.items.length,2);assert.equal(saved.data.items[0].purchase.orderNumber,'ORD-987654');assert.equal(saved.data.items[0].purchase.sku,'1234/567');
 assert.equal((await request('/receipt-ai.mjs')).status,404);
}));
test('putting a private order number into product fields is rejected, and edited match attributes need a fresh search',()=>fixture(async({post,draft})=>{
 const path=`/api/receipts/${draft.draftId}`;const result=(await post(path+'/structure',{text,consent:true})).data;
 const row={...result.rows[0],retailer:result.metadata.retailer,availability:'ready',occasions:['dinner']};
 assert.equal((await post(path+'/search',{...row,sku:'ORD-987654'})).status,400);
 await post(path+'/search',row);
 for(const changed of [{size:'L'},{sku:'different'},{color:'Blue'},{retailer:'Other'}])assert.equal((await post(path+'/commit',{reviewConfirmed:true,items:[{...row,...changed,productId:'p',matchConfirmed:true}]})).status,400);
}));
test('AI setup or provider errors preserve local review instead of silently pretending it was AI',()=>fixture(async({post,draft,aiCalls})=>{
 const path=`/api/receipts/${draft.draftId}`;const response=await post(path+'/structure',{text,consent:true});assert.equal(response.status,503);assert.equal(aiCalls(),0);
 const local=await post(path+'/parse',{text:'Wine blouse $45.00'});assert.equal(local.status,200);assert.equal(local.data.rows[0].name,'Wine blouse');
},{key:''}));

test('provider failures distinguish credentials, quota, rate, model and request schema without leaking provider text',async()=>{
 const {receiptProviderError}=await import('./receipt-ai.mjs');
 const cases=[
  [401,'invalid_api_key','invalid_request_error',/rejected the API key/],
  [429,'insufficient_quota','insufficient_quota',/quota or billing/],
  [429,'rate_limit_exceeded','rate_limit_error',/rate-limited/],
  [404,'model_not_found','invalid_request_error',/configured receipt model/],
  [403,'permission_denied','permission_error',/project permissions/],
  [400,'invalid_json_schema','invalid_request_error',/request format/],
  [503,null,null,/temporary service error/],
 ];
 for(const [status,code,type,pattern] of cases){const error=await receiptProviderError({status,json:async()=>({error:{code,type,param:'text.format.schema',message:'Private receipt details and sk-secret-key-value must never show'}})});assert.match(error.message,pattern);assert.match(error.message,new RegExp(`HTTP ${status}`));assert.ok(!error.message.includes('Private'));assert.ok(!error.message.includes('sk-secret'));}
 const schema=await receiptProviderError({status:400,json:async()=>({error:{code:'invalid_json_schema',message:"'minimum' is not permitted."}})});assert.match(schema.message,/Unsupported schema keyword: minimum/);
 const unknown=await receiptProviderError({status:502,json:async()=>({error:{code:'sk-secret-value',param:'private-receipt-text'}})});assert.ok(!unknown.message.includes('sk-secret'));assert.ok(!unknown.message.includes('private-receipt'));
 const invalid=await receiptProviderError({status:500,json:async()=>{throw Error('HTML response');}});assert.match(invalid.message,/HTTP 500/);
});
