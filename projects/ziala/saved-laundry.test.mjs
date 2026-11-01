import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createApp} from './server.mjs';
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function fixture(run){
 const dataDir=await mkdtemp(join(tmpdir(),'ziala-snooze-'));let server,url,current='2026-11-01T14:00:00Z';
 const stop=async()=>{if(server)await new Promise(resolve=>server.close(resolve));server=null;};
 const start=async()=>{server=await createApp({dataDir,now:()=>current});server.listen(0,'127.0.0.1');await once(server,'listening');url=`http://127.0.0.1:${server.address().port}`;};
 const request=(path,options)=>fetch(url+path,options);
 const get=async()=>await (await request('/api/laundry')).json();
 const patch=async(id,availability)=>assert.equal((await request(`/api/closet/${id}`,{...json({availability}),method:'PATCH'})).status,200);
 const snooze=(id,until)=>request(`/api/laundry/snooze/${id}`,json({until}));
 try{await start();await run({request,get,patch,snooze,restart:async()=>{await stop();await start();},clock:value=>{current=value;}});}finally{await stop();await rm(dataDir,{recursive:true,force:true});}
}
test('saved snoozes survive restart and expire independently at the selected time',()=>fixture(async({get,patch,snooze,restart,clock})=>{
 await patch('sample-top','laundry');await patch('sample-bottom','laundry');
 assert.deepEqual((await get()).visible.map(r=>r.id),['laundry-top','laundry-bottom']);
 assert.equal((await snooze('laundry-top','2026-11-01T14:01:00Z')).status,200);
 assert.equal((await snooze('laundry-bottom','2026-11-01T15:00:00Z')).status,200);
 await restart();assert.deepEqual((await get()).visible,[]);
 clock('2026-11-01T14:01:00Z');assert.deepEqual((await get()).visible.map(r=>r.id),['laundry-top']);
}));
test('cancel restores the reminder; cleaning clears snooze so a new laundry cycle is not hidden',()=>fixture(async({request,get,patch,snooze,clock})=>{
 await patch('sample-top','laundry');await snooze('laundry-top','2026-11-01T15:00:00Z');
 assert.equal((await request('/api/laundry/snooze/laundry-top',{method:'DELETE'})).status,200);
 assert.ok((await get()).visible.some(r=>r.id==='laundry-top'));
 await snooze('laundry-top','2026-11-01T15:00:00Z');await patch('sample-top','ready');
 assert.equal((await get()).snoozes['laundry-top'],undefined);
 await patch('sample-top','laundry');assert.ok((await get()).visible.some(r=>r.id==='laundry-top'));
 await patch('sample-top','ready');clock('2026-11-01T16:00:00Z');assert.deepEqual((await get()).visible,[]);
}));
test('invalid, stale, and cross-origin snoozes cannot change the saved reminder settings',()=>fixture(async({request,get,patch,snooze})=>{
 assert.equal((await snooze('laundry-top','2026-11-01T15:00:00Z')).status,409);
 await patch('sample-top','laundry');await snooze('laundry-top','2026-11-01T15:00:00Z');
 const before=(await get()).snoozes;
 for(const until of ['2026-11-01T14:00:00Z','2026-11-01T13:00:00Z','bad','2026-11-01T15:00:00'])assert.equal((await snooze('laundry-top',until)).status,400);
 assert.equal((await request('/api/laundry/snooze/laundry-top',json(null))).status,400);
 assert.equal((await snooze('invalid','2026-11-01T15:00:00Z')).status,400);
 const options=json({until:'2026-11-01T15:00:00Z'});options.headers.Origin='https://untrusted.example';
 assert.equal((await request('/api/laundry/snooze/laundry-top',options)).status,403);
 assert.deepEqual((await get()).snoozes,before);
}));
