import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { normalizeImage, validateItemFields } from './upload.mjs';
import { searchShopping } from './shopping.mjs';
import { snoozeReminder, visibleLaundryReminders } from './snooze.mjs';
import { laundryReminders } from './laundry.mjs';
import { createReceiptHandler } from './receipt-routes.mjs';
import { createCalendar } from './calendar.mjs';
const project=dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.jpg':'image/jpeg'};
const errorWith=(message,status)=>Object.assign(new Error(message),{status});
const seed=[{id:'sample-top',name:'Sample ivory top',category:'top',availability:'ready',occasions:['daily','dinner']},{id:'sample-bottom',name:'Sample black trousers',category:'bottom',availability:'ready',occasions:['daily','dinner']},{id:'sample-shoes',name:'Sample black shoes',category:'shoes',availability:'ready',occasions:['daily','dinner']},{id:'sample-bag',name:'Sample structured bag',category:'bag',availability:'ready',occasions:['daily','dinner']}];
export async function createApp({dataDir=join(project,'.ziala-data'),apiKey=process.env.SERPAPI_API_KEY,fetchImpl=fetch,now=()=>new Date().toISOString(),extractReceipt,aiApiKey=process.env.OPENAI_API_KEY,aiModel=process.env.OPENAI_RECEIPT_MODEL,aiFetchImpl=fetch,calendarClientId=process.env.GOOGLE_CALENDAR_CLIENT_ID,calendarClientSecret=process.env.GOOGLE_CALENDAR_CLIENT_SECRET,calendarFetchImpl=fetch,calendarClock}={}){
 await mkdir(join(dataDir,'images'),{recursive:true});
 const db=join(dataDir,'closet.json'),snoozeFile=join(dataDir,'laundry-snoozes.json');
 async function loadSnoozes(){try{return JSON.parse(await readFile(snoozeFile,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
 async function saveSnoozes(value){const temp=join(dataDir,`${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(value));await rename(temp,snoozeFile);}
 async function laundryState(){const items=await load(),snoozes=await loadSnoozes(),current=now();return {snoozes,reminders:laundryReminders(items),visible:visibleLaundryReminders(items,snoozes,current),now:current};}
 async function load(){try{return JSON.parse(await readFile(db,'utf8'));}catch(e){if(e.code==='ENOENT')return structuredClone(seed);throw e;}}
 async function save(items){const temp=join(dataDir,`${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(items));await rename(temp,db);const snoozes=await loadSnoozes(),active=new Set(laundryReminders(items).map(r=>r.id));const next=Object.fromEntries(Object.entries(snoozes).filter(([id])=>active.has(id)));if(Object.keys(next).length!==Object.keys(snoozes).length)await saveSnoozes(next);}
 let pending=Promise.resolve();
 function transact(operation){const result=pending.then(operation);pending=result.catch(()=>{});return result;}
 async function jsonBody(req){
  if(!req.headers['content-type']?.startsWith('application/json'))throw errorWith('Send application/json.',415);
  let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>8*1024*1024)throw errorWith('Request exceeds upload limit.',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw errorWith('Invalid JSON.',400);}
 }
 const receiptHandler=createReceiptHandler({load,save,transact,apiKey,fetchImpl,extractReceipt,aiApiKey,aiModel,aiFetchImpl});
 const calendar=createCalendar({dataDir,clientId:calendarClientId,clientSecret:calendarClientSecret,fetchImpl:calendarFetchImpl,clock:calendarClock});
 const server=createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const origin=`http://${req.headers.host}`;const url=new URL(req.url,origin);
   if(!['127.0.0.1','localhost'].includes(url.hostname))throw errorWith('Local access only.',403);
   if(req.headers.origin&&req.headers.origin!==origin)throw errorWith('Cross-origin requests are not allowed.',403);
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
   if(url.pathname.startsWith('/api/calendar/')){
    if(req.method==='POST')await jsonBody(req);
    const result=await calendar.handle(req.method,url,req.headers);if(result.cookie)res.setHeader('Set-Cookie',result.cookie);
    if(result.redirect){res.writeHead(302,{Location:result.redirect,'Cache-Control':'no-store'});return res.end();}return send(200,result.data);
   }
   if(req.method==='POST'&&url.pathname.startsWith('/api/receipts/'))return send(200,await receiptHandler(url.pathname,await jsonBody(req)));
   if(req.method==='GET'&&url.pathname==='/api/health')return send(200,{shoppingConfigured:!!apiKey,receiptAIConfigured:!!aiApiKey});
   if(req.method==='GET'&&url.pathname==='/api/laundry')return send(200,await transact(laundryState));
   if(['POST','DELETE'].includes(req.method)&&url.pathname.startsWith('/api/laundry/snooze/')){
    const id=decodeURIComponent(url.pathname.slice('/api/laundry/snooze/'.length));
    if(!['laundry-top','laundry-bottom'].includes(id))throw errorWith('Unknown reminder.',400);
    const input=req.method==='POST'?await jsonBody(req):null;
    const state=await transact(async()=>{
     const snoozes=await loadSnoozes();
     if(req.method==='POST'){if(!laundryReminders(await load()).some(r=>r.id===id))throw errorWith('Laundry is no longer needed for this category.',409);await saveSnoozes(snoozeReminder(snoozes,id,input?.until,now()));}
     else {delete snoozes[id];await saveSnoozes(snoozes);}
     return laundryState();
    });return send(200,state);
   }
   if(req.method==='GET'&&url.pathname==='/api/closet')return send(200,{items:await load()});
   if(req.method==='POST'&&url.pathname==='/api/closet'){
    const input=await jsonBody(req);const fields=validateItemFields(input),image=await normalizeImage(input.imageBase64);
    const id=randomUUID(),file=join(dataDir,'images',`${id}.jpg`);await writeFile(file,image);
    const item={id,...fields,imageUrl:`/uploads/${id}.jpg`,createdAt:new Date().toISOString()};
    try{await transact(async()=>{const items=await load();items.push(item);await save(items);});}catch(e){await unlink(file);throw e;}
    return send(201,{item});
   }
   if(req.method==='PATCH'&&url.pathname.startsWith('/api/closet/')){
    const id=decodeURIComponent(url.pathname.slice('/api/closet/'.length));const input=await jsonBody(req);
    if(!['ready','laundry'].includes(input.availability))throw errorWith('Choose ready or laundry.',400);
    const item=await transact(async()=>{const items=await load(),index=items.findIndex(i=>i.id===id);if(index<0)throw errorWith('Item not found.',404);items[index]={...items[index],availability:input.availability};await save(items);return items[index];});
    return send(200,{item});
   }
   if(req.method==='POST'&&url.pathname==='/api/shopping/search')return send(200,await searchShopping(await jsonBody(req),{apiKey,fetchImpl}));
   if(req.method!=='GET')throw errorWith('Not found.',404);
   let file;
   if(/^\/uploads\/[a-f0-9-]{36}\.jpg$/.test(url.pathname))file=join(dataDir,'images',url.pathname.split('/').at(-1));
   else {
    const name=url.pathname==='/'?'app.html':url.pathname.slice(1);
    if(!/^[a-z0-9-]+\.(html|mjs|css)$/.test(name)||name.endsWith('.test.mjs')||['server.mjs','upload.mjs','shopping.mjs','receipt.mjs','receipt-routes.mjs','receipt-ai.mjs','calendar.mjs'].includes(name))throw errorWith('Not found.',404);
    file=resolve(project,name);
   }
   const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-store'});res.end(content);
  }catch(error){send(error.status||(error.code==='ENOENT'?404:400),{error:error.code==='ENOENT'?'Not found.':error.message});}
 });
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const server=await createApp();const port=Number(process.env.ZIALA_PORT||3100);server.listen(port,'127.0.0.1',()=>console.log(`ZIALA local app: http://127.0.0.1:${port}`));
}
