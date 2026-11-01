import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createApp} from './server.mjs';
import {CALENDAR_SCOPE,normalizeCalendarEvents} from './calendar.mjs';
const json=()=>({method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
const ok=data=>({ok:true,status:200,json:async()=>data});
async function fixture(run,{configured=true,scope=CALENDAR_SCOPE,revocationOK=true}={}){
 const dataDir=await mkdtemp(join(tmpdir(),'ziala-calendar-'));let server,url,time=Date.parse('2026-11-01T12:00:00Z'),refreshes=0,tokenBody,lastQuery;const calls=[];
 async function start(){server=await createApp({dataDir,calendarClientId:configured?'test-client':'',calendarClientSecret:configured?'test-secret':'',calendarClock:()=>time,calendarFetchImpl:async(endpoint,options)=>{
  const target=new URL(endpoint);calls.push({url:target,options});
  if(target.pathname==='/token'){tokenBody=new URLSearchParams(options.body);if(tokenBody.get('grant_type')==='refresh_token'){refreshes++;return ok({access_token:'refreshed-private-access',expires_in:3600});}return ok({access_token:'private-access',refresh_token:'private-refresh',expires_in:3600,scope});}
  if(target.pathname==='/revoke')return {ok:revocationOK,status:revocationOK?200:503};
  lastQuery=target;return ok({timeZone:'America/New_York',...(target.searchParams.has('pageToken')?{}:{nextPageToken:'page-two'}),items:[{id:target.searchParams.has('pageToken')?'event-two':'event-one',summary:'Dinner',start:{dateTime:'2026-11-05T00:30:00Z'}},{id:'cancelled',status:'cancelled',summary:'Cancelled',start:{date:'2026-11-06'}},{id:'declined',summary:'Declined',start:{date:'2026-11-06'},attendees:[{self:true,responseStatus:'declined'}]}]});
 }});server.listen(0,'127.0.0.1');await once(server,'listening');url=`http://127.0.0.1:${server.address().port}`;}
 async function stop(){await new Promise(resolve=>server.close(resolve));}
 const request=(path,options)=>fetch(url+path,options);
 const data=async(path,options)=>await (await request(path,options)).json();
 async function authorize(){const response=await request('/api/calendar/connect',json());assert.equal(response.status,200);const auth=new URL((await response.json()).authorizationUrl),cookie=response.headers.get('set-cookie');const state=auth.searchParams.get('state');const callback=await request(`/api/calendar/callback?state=${state}&code=fake-code`,{headers:{Cookie:cookie.split(';')[0]},redirect:'manual'});return {auth,cookie,state,callback};}
 try{await start();await run({request,data,authorize,dataDir,calls,refreshes:()=>refreshes,tokenBody:()=>tokenBody,lastQuery:()=>lastQuery,clock:value=>{time=value;},restart:async()=>{await stop();await start();}});}finally{await stop();await rm(dataDir,{recursive:true,force:true});}
}
test('calendar event normalization preserves all-day dates, uses calendar timezone and excludes declined/cancelled events',()=>{
 const events=normalizeCalendarEvents([{id:'all',start:{date:'2026-11-05'}},{id:'timed',start:{dateTime:'2026-11-05T00:30:00Z'}},{id:'bad',start:{dateTime:'not-date'}},{id:'cancel',status:'cancelled',start:{date:'2026-11-05'}}],'America/New_York');
 assert.equal(events[0].date,'2026-11-05');assert.equal(events[1].date,'2026-11-04');assert.equal(events.length,2);
});
test('Google OAuth uses read-only scope, browser-bound one-time state and PKCE; tokens stay server-side with restricted file mode',()=>fixture(async({request,data,authorize,dataDir,tokenBody})=>{
 const {auth,cookie,state,callback}=await authorize();assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'/?calendar=connected#calendar');assert.equal(auth.searchParams.get('scope'),CALENDAR_SCOPE);assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('client_secret'),null);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);
 const verifier=tokenBody().get('code_verifier');assert.equal(createHash('sha256').update(verifier).digest('base64url'),auth.searchParams.get('code_challenge'));
 const status=await data('/api/calendar/status');assert.equal(status.connected,true);assert.ok(!JSON.stringify(status).includes('private-'));
 const path=join(dataDir,'google-calendar.json');assert.equal((await stat(path)).mode&0o777,0o600);assert.match(await readFile(path,'utf8'),/private-refresh/);
 assert.equal((await request(`/api/calendar/callback?state=${state}&code=fake`,{headers:{Cookie:cookie.split(';')[0]}})).status,400);
 assert.equal((await request('/calendar.mjs')).status,404);
}));
test('state mismatch and expired callbacks fail without exchanging codes; declined consent leaves disconnected',()=>fixture(async({request,data,calls,clock})=>{
 const response=await request('/api/calendar/connect',json()),body=await response.json(),state=new URL(body.authorizationUrl).searchParams.get('state'),cookie=response.headers.get('set-cookie').split(';')[0];
 assert.equal((await request(`/api/calendar/callback?state=${state}&code=code`,{headers:{Cookie:'ziala_calendar_state=wrong'}})).status,400);assert.equal(calls.length,0);
 const denied=await request(`/api/calendar/callback?state=${state}&error=access_denied`,{headers:{Cookie:cookie},redirect:'manual'});assert.equal(denied.headers.get('location'),'/?calendar=denied#calendar');assert.equal((await data('/api/calendar/status')).connected,false);
 const fresh=await request('/api/calendar/connect',json()),next=new URL((await fresh.json()).authorizationUrl).searchParams.get('state');clock(Date.parse('2026-11-01T12:11:00Z'));assert.equal((await request(`/api/calendar/callback?state=${next}&code=code`,{headers:{Cookie:fresh.headers.get('set-cookie').split(';')[0]}})).status,400);assert.equal(calls.length,0);
}));
test('calendar events page through a bounded window, survive restart via tokens, and refresh expired access',()=>fixture(async({data,authorize,restart,clock,refreshes,lastQuery,calls})=>{
 await authorize();await restart();clock(Date.parse('2026-11-01T14:00:00Z'));const events=await data('/api/calendar/events');assert.equal(events.events.length,2);assert.ok(events.events.every(e=>e.date==='2026-11-04'));assert.equal(events.windowDays,90);assert.equal(refreshes(),1);assert.equal(lastQuery().searchParams.get('calendarId'),null);assert.match(lastQuery().pathname,/calendars\/primary\/events/);assert.equal(lastQuery().searchParams.get('singleEvents'),'true');assert.equal(lastQuery().searchParams.get('orderBy'),'startTime');assert.equal(lastQuery().searchParams.get('pageToken'),'page-two');assert.ok(!JSON.stringify(events).includes('private-'));assert.ok(calls.filter(call=>call.url.pathname.includes('/events')).every(call=>call.options.headers.Authorization==='Bearer refreshed-private-access'));
}));
test('disconnect removes saved tokens even if Google revocation cannot be confirmed',()=>fixture(async({request,data,authorize,dataDir})=>{
 await authorize();const result=await data('/api/calendar/disconnect',json());assert.equal(result.connected,false);assert.equal(result.revoked,false);assert.match(result.notice,/Google Account/);assert.equal((await data('/api/calendar/status')).connected,false);await assert.rejects(()=>readFile(join(dataDir,'google-calendar.json')));assert.equal((await request('/api/calendar/events')).status,401);
},{revocationOK:false}));
test('calendar missing setup, missing scope, and foreign-origin requests fail clearly',async()=>{
 await fixture(async({request,data})=>{assert.equal((await data('/api/calendar/status')).configured,false);assert.equal((await request('/api/calendar/connect',json())).status,503);const options=json();options.headers.Origin='https://evil.example';assert.equal((await request('/api/calendar/connect',options)).status,403);},{configured:false});
 await fixture(async({authorize,data})=>{assert.equal((await authorize()).callback.status,403);assert.equal((await data('/api/calendar/status')).connected,false);},{scope:'unrelated-scope'});
});
