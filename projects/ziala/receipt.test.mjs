import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import sharp from 'sharp';
import {readReceipt,receiptLines} from './receipt.mjs';
import {createApp} from './server.mjs';
const sample='SHOP\nOrder 1234\nWine satin blouse $45.00\n2 x Black trousers $60.00\nSubtotal $105.00\nTax $7.00\nTotal $112.00\nVisa 1234 112.00\nThank you';
const file=text=>({type:'text/plain',fileBase64:Buffer.from(text).toString('base64')});
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function pdf(lines){
 const stream='BT /F1 18 Tf 30 760 Td '+lines.map((line,i)=>`${i?'0 -30 Td ':''}(${line.replace(/[()\\]/g,'\\$&')}) Tj`).join('\n')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let out='%PDF-1.4\n',offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(out));out+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(out);out+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(out);
}
test('receipt suggestions exclude totals/payment lines, retain quantities and leave unknown categories unconfirmed',()=>{
 const rows=receiptLines(sample);assert.deepEqual(rows.map(r=>r.name),['Wine satin blouse','Black trousers']);assert.deepEqual(rows.map(r=>r.quantity),[1,2]);assert.equal(rows[0].category,'top');assert.equal(receiptLines('Mystery item $19.00')[0].category,'');
});
test('actual local receipt text and PDF extraction returns reviewable lines without inventing products',async()=>{
 const text=await readReceipt(file(sample));assert.equal(text.method,'text');assert.equal(text.rows.length,2);
 const result=await readReceipt({type:'application/pdf',fileBase64:pdf(['Wine satin blouse $45.00','Total $45.00']).toString('base64')});assert.equal(result.method,'pdf-text');assert.equal(result.rows[0].name,'Wine satin blouse');
});
test('actual offline image OCR reads a clear synthetic receipt photo',async()=>{
 const image=await sharp(Buffer.from('<svg width="1400" height="400"><rect width="1400" height="400" fill="white"/><text x="60" y="110" font-family="DejaVu Sans" font-size="50" fill="black">Wine blouse $45.00</text><text x="60" y="220" font-family="DejaVu Sans" font-size="50" fill="black">Total $45.00</text></svg>')).png().toBuffer();
 const result=await readReceipt({type:'image/png',fileBase64:image.toString('base64')});assert.equal(result.method,'local-ocr');assert.ok(result.rows.some(r=>/blouse/i.test(r.name)));
});
test('bad, oversized and blank receipt files fail clearly',async()=>{
 for(const input of [{fileBase64:'?'},{type:'image/png',fileBase64:Buffer.from('<svg/>').toString('base64')},file(''),file(' '.repeat(4)),{type:'application/pdf',fileBase64:Buffer.from('%PDF-invalid').toString('base64')},{fileBase64:Buffer.alloc(5*1024*1024+1).toString('base64')}])await assert.rejects(()=>readReceipt(input));
});
async function withServer(run){
 const dataDir=await mkdtemp(join(tmpdir(),'ziala-receipt-'));let server,url,searchURL;
 const start=async()=>{server=await createApp({dataDir,apiKey:'private-test-key',fetchImpl:async url=>{searchURL=new URL(url);return {ok:true,json:async()=>({shopping_results:[{product_id:'p1',title:'Wine blouse',source:'Retailer',product_link:'https://example.com/blouse',thumbnail:'https://example.com/blouse.jpg',price:'$45',extracted_price:45}]})};}});server.listen(0,'127.0.0.1');await once(server,'listening');url=`http://127.0.0.1:${server.address().port}`;};
 const close=()=>new Promise(resolve=>server.close(resolve));
 const request=(path,opts)=>fetch(url+path,opts);
 const post=async(path,body)=>{const response=await request(path,json(body));return {status:response.status,data:await response.json()};};
 try{await start();await run({post,request,dataDir,searchURL:()=>searchURL,restart:async()=>{await close();await start();}});}finally{await close();await rm(dataDir,{recursive:true,force:true});}
}
const review=row=>({...row,availability:'ready',occasions:['dinner']});
test('receipt review saves only approved purchases, preserves across restart and prevents repeated imports',()=>withServer(async({post,request,restart,dataDir})=>{
 const draft=(await post('/api/receipts/extract',file(sample))).data;
 assert.equal((await (await request('/api/closet')).json()).items.length,4);
 const body={reviewConfirmed:true,items:[review(draft.rows[1])]};
 const save=await post(`/api/receipts/${draft.draftId}/commit`,body);assert.equal(save.status,200);assert.equal(save.data.items.length,2);assert.ok(save.data.items.every(i=>i.name==='Black trousers'&&!i.imageUrl));
 const repeat=await post(`/api/receipts/${draft.draftId}/commit`,body);assert.equal(repeat.data.items.length,0);assert.equal(repeat.data.skippedRows.length,1);
 await restart();assert.equal((await (await request('/api/closet')).json()).items.length,6);
 assert.equal((await post(`/api/receipts/${draft.draftId}/commit`,body)).status,410);
 const again=(await post('/api/receipts/extract',file(sample))).data;assert.equal((await post(`/api/receipts/${again.draftId}/commit`,{...body,items:[review(again.rows[1])]})).data.items.length,0);
 assert.deepEqual((await readdir(dataDir)).sort(),['closet.json','images']);
}));
test('receipt product matching sends reviewed item terms only and requires explicit candidate confirmation',()=>withServer(async({post,searchURL})=>{
 const draft=(await post('/api/receipts/extract',file(sample+'\ncustomer@example.com'))).data,row=review(draft.rows[0]);
 const result=await post(`/api/receipts/${draft.draftId}/search`,{rowId:row.rowId,name:row.name,category:row.category,size:'M'});assert.equal(result.status,200);assert.match(searchURL().searchParams.get('q'),/Wine satin blouse/);assert.ok(!searchURL().href.includes('customer'));assert.ok(!JSON.stringify(result.data).includes('private-test-key'));
 const body={reviewConfirmed:true,items:[{...row,size:'M',productId:'p1'}]};assert.equal((await post(`/api/receipts/${draft.draftId}/commit`,body)).status,400);
 body.items[0].matchConfirmed=true;const saved=await post(`/api/receipts/${draft.draftId}/commit`,body);assert.equal(saved.status,200);assert.equal(saved.data.items[0].productUrl,'https://example.com/blouse');assert.equal(saved.data.items[0].imageUrl,'https://example.com/blouse.jpg');
}));
test('invalid receipt review is all-or-nothing and backend modules and foreign origins stay blocked',()=>withServer(async({post,request})=>{
 const draft=(await post('/api/receipts/extract',file(sample))).data,row=review(draft.rows[0]);
 for(const body of [{reviewConfirmed:false,items:[row]},{reviewConfirmed:true,items:[row,{...review(draft.rows[1]),category:''}]},{reviewConfirmed:true,items:[{...row,quantity:0}]},{reviewConfirmed:true,items:[row,row]},{reviewConfirmed:true,items:[{...row,productId:'forged',matchConfirmed:true}]}])assert.equal((await post(`/api/receipts/${draft.draftId}/commit`,body)).status,400);
 assert.equal((await (await request('/api/closet')).json()).items.length,4);
 const options=json(file(sample));options.headers.Origin='https://untrusted.example';assert.equal((await request('/api/receipts/extract',options)).status,403);
 for(const path of ['/receipt.mjs','/receipt-routes.mjs'])assert.equal((await request(path)).status,404);
}));
