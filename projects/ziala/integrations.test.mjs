import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createApp } from './server.mjs';
import { normalizeImage } from './upload.mjs';
import { normalizeShoppingResults, searchShopping } from './shopping.mjs';
const sharp=createRequire(import.meta.url)('sharp');
const png=()=>sharp({create:{width:20,height:20,channels:3,background:'#aa3355'}}).png().toBuffer();
async function start(options){const server=await createApp(options);server.listen(0,'127.0.0.1');await once(server,'listening');return {server,url:`http://127.0.0.1:${server.address().port}`};}
async function close(server){await new Promise(resolve=>server.close(resolve));}
const json=(body,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});

test('upload persists a normalized image and metadata across server restart; status changes persist',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'ziala-upload-'));let running;
 try{
  running=await start({dataDir});
  const response=await fetch(`${running.url}/api/closet`,json({name:'Wine blouse',category:'top',availability:'ready',occasions:[' Dinner '],imageBase64:(await png()).toString('base64')}));
  assert.equal(response.status,201);const {item}=await response.json();assert.deepEqual(item.occasions,['dinner']);
  const image=await fetch(running.url+item.imageUrl);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');
  const meta=await sharp(Buffer.from(await image.arrayBuffer())).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);
  await close(running.server);running=await start({dataDir});
  let records=(await (await fetch(`${running.url}/api/closet`)).json()).items;
  assert.equal(records.find(i=>i.id===item.id).name,'Wine blouse');
  const changed=await fetch(`${running.url}/api/closet/${item.id}`,{...json({availability:'laundry'}),method:'PATCH'});assert.equal(changed.status,200);
  records=(await (await fetch(`${running.url}/api/closet`)).json()).items;
  assert.equal(records.find(i=>i.id===item.id).availability,'laundry');
 }finally{if(running)await close(running.server);await rm(dataDir,{recursive:true,force:true});}
});

test('invalid image and fields leave the saved closet and image directory unchanged',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'ziala-invalid-'));const {server,url}=await start({dataDir});
 try{
  const before=await (await fetch(`${url}/api/closet`)).json();
  const response=await fetch(`${url}/api/closet`,json({name:'Invalid',category:'top',availability:'ready',occasions:['daily'],imageBase64:Buffer.from('<svg></svg>').toString('base64')}));
  assert.equal(response.status,400);assert.deepEqual(await (await fetch(`${url}/api/closet`)).json(),before);
  assert.deepEqual(await readdir(join(dataDir,'images')),[]);
  const wrong=await fetch(`${url}/api/closet`,json({name:'',category:'invalid'}));assert.equal(wrong.status,400);
 }finally{await close(server);await rm(dataDir,{recursive:true,force:true});}
});

test('oversize image, SVG and non-image bytes are rejected',async()=>{
 for(const base64 of [Buffer.alloc(5*1024*1024+1).toString('base64'),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64'),Buffer.from('not an image').toString('base64')])await assert.rejects(()=>normalizeImage(base64));
});

test('local API rejects cross-origin writes and does not serve server files or environment files',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'ziala-local-'));const {server,url}=await start({dataDir});
 try{
  assert.equal((await fetch(`${url}/api/shopping/search`,json({}, {Origin:'https://untrusted.example'}))).status,403);
  for(const path of ['/server.mjs','/.env','/upload.mjs'])assert.equal((await fetch(url+path)).status,404);
  const app=await fetch(url);assert.equal(app.status,200);assert.match(await app.text(),/Add to your closet/);
 }finally{await close(server);await rm(dataDir,{recursive:true,force:true});}
});

test('shopping adapter sends validated search and keeps delivery, size and store claims unverified',async()=>{
 let requestURL;
 const result=await searchShopping({category:'bag',occasion:'dinner',size:'M',location:'Linden, New Jersey',budget:100},{apiKey:'test-key',fetchImpl:async url=>{
  requestURL=new URL(url);return {ok:true,json:async()=>({shopping_results:[{product_id:'123',title:'Sample product',source:'Sample merchant',price:'$80',extracted_price:80,product_link:'https://example.com/product',delivery:'Free shipping'}]})};
 }});
 assert.equal(requestURL.hostname,'serpapi.com');assert.equal(requestURL.searchParams.get('engine'),'google_shopping');
 assert.equal(requestURL.searchParams.get('location'),'Linden, New Jersey');
 const product=result.products[0];assert.equal(product.deliveryText,'Free shipping');assert.equal(product.estimatedDeliveryDate,null);assert.equal(product.inStock,null);assert.deepEqual(product.availableSizes,[]);
 assert.equal(product.verification,'unverified');assert.ok(!JSON.stringify(result).includes('test-key'));
});

test('shopping normalization excludes unsafe links and known over-budget candidates',()=>{
 const request={size:'M',category:'dress',budget:100};
 const result=normalizeShoppingResults({shopping_results:[{title:'unsafe',product_link:'javascript:alert(1)'},{title:'costly',product_link:'https://example.com/item',extracted_price:200},{title:'valid',product_link:'https://example.com/valid',extracted_price:50}]},request);
 assert.deepEqual(result.map(p=>p.name),['valid']);
});

test('missing credentials and provider errors fail clearly without sample-result substitution or key leakage',async()=>{
 await assert.rejects(()=>searchShopping({category:'bag',occasion:'dinner',size:'M'},{}),/SERPAPI_API_KEY/);
 await assert.rejects(()=>searchShopping({category:'bag',occasion:'dinner',size:'M'},{apiKey:'secret-key',fetchImpl:async()=>({ok:false})}),error=>!error.message.includes('secret-key'));
 await assert.rejects(()=>searchShopping({category:'invalid',occasion:'dinner',size:'M'},{apiKey:'secret-key'}),/category/);
});
