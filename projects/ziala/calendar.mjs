import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,unlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
export const CALENDAR_SCOPE='https://www.googleapis.com/auth/calendar.events.readonly';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const secret=()=>randomBytes(32).toString('base64url');
const cookie=value=>`ziala_calendar_state=${value}; HttpOnly; SameSite=Lax; Path=/api/calendar/callback; Max-Age=${value?600:0}`;
export function calendarEventDate(event,timeZone){
 if(event.start?.date)return /^\d{4}-\d{2}-\d{2}$/.test(event.start.date)?event.start.date:null;
 const instant=event.start?.dateTime;if(typeof instant!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(instant)||!Number.isFinite(Date.parse(instant)))return null;
 try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:event.start.timeZone||timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;}catch{return null;}
}
export function normalizeCalendarEvents(items,timeZone){
 return (Array.isArray(items)?items:[]).filter(event=>event&&event.status!=='cancelled'&&!event.attendees?.some(person=>person.self&&person.responseStatus==='declined')).flatMap(event=>{
  const date=calendarEventDate(event,timeZone);if(!date||typeof event.id!=='string')return [];
  return [{id:event.id,title:typeof event.summary==='string'?event.summary.slice(0,200):'Untitled event',date,allDay:!!event.start?.date,start:event.start.dateTime||event.start.date,timeZone:event.start.timeZone||timeZone||'UTC'}];
 });
}
export function createCalendar({dataDir,clientId=process.env.GOOGLE_CALENDAR_CLIENT_ID,clientSecret=process.env.GOOGLE_CALENDAR_CLIENT_SECRET,fetchImpl=fetch,clock=()=>Date.now()}){
 const file=join(dataDir,'google-calendar.json'),states=new Map();let pending=Promise.resolve();
 const configured=()=>!!clientId&&!!clientSecret;
 async function load(){try{const value=JSON.parse(await readFile(file,'utf8'));return value.clientId===clientId?value:null;}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 async function save(tokens){const temp=join(dataDir,`${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify({...tokens,clientId}),{mode:0o600});await rename(temp,file);await chmod(file,0o600);}
 async function remove(){try{await unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}}
 async function remote(url,options){try{return await fetchImpl(url,{...options,signal:AbortSignal.timeout(15000)});}catch{fail('Google could not be reached. Try again.',502);}}
 async function tokenRequest(params){
  const response=await remote('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...params})});
  let body;try{body=await response.json();}catch{fail('Google returned an unreadable authorization response.',502);}
  if(!response.ok){if(body.error==='invalid_grant'){await remove();fail('Google authorization expired or was revoked. Connect Calendar again.',401);}if(body.error==='invalid_client')fail('Google rejected the Calendar client credentials. Check the local setup.',503);fail('Google Calendar authorization failed. Connect again or check the client setup.',502);}
  if(typeof body.access_token!=='string'||!body.access_token||!Number.isFinite(body.expires_in)||body.expires_in<=0)fail('Google returned incomplete authorization details.',502);
  return body;
 }
 async function accessToken(force=false){
  const tokens=await load();if(!tokens)fail('Connect Google Calendar first.',401);
  if(!force&&tokens.expiresAt>clock()+60000)return tokens.accessToken;
  if(!tokens.refreshToken){await remove();fail('Google authorization expired. Connect Calendar again.',401);}
  const refreshed=await tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refreshToken});
  const next={...tokens,accessToken:refreshed.access_token,refreshToken:refreshed.refresh_token||tokens.refreshToken,expiresAt:clock()+refreshed.expires_in*1000};await save(next);return next.accessToken;
 }
 async function handle(method,url,headers){
  const path=url.pathname;
  if(method==='GET'&&path==='/api/calendar/status'){const tokens=await load();return {data:{configured:configured(),connected:!!tokens,scope:CALENDAR_SCOPE,expiresAt:tokens?new Date(tokens.expiresAt).toISOString():null}};}
  if(method==='POST'&&path==='/api/calendar/connect'){
   if(!configured())fail('Google Calendar needs its own OAuth client setup. See the README; no AI credits are needed.',503);
   if(url.hostname!=='127.0.0.1')fail('Open ZIALA at http://127.0.0.1 with your app port before connecting Calendar.');
   for(const [state,entry]of states)if(entry.until<=clock())states.delete(state);if(states.size>=10)fail('Too many pending Google sign-ins. Wait ten minutes.',429);
   const state=secret(),verifier=secret(),redirect=`${url.origin}/api/calendar/callback`;states.set(state,{verifier,redirect,until:clock()+600000});
   const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');auth.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:CALENDAR_SCOPE,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account'});
   return {data:{authorizationUrl:auth.href},cookie:cookie(state)};
  }
  if(method==='GET'&&path==='/api/calendar/callback'){
   const state=url.searchParams.get('state'),entry=states.get(state),browserState=headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('ziala_calendar_state='))?.split('=')[1];
   if(!entry||state!==browserState||entry.until<=clock()||entry.redirect!==`${url.origin}/api/calendar/callback`)fail('This Google sign-in is invalid or expired. Return to ZIALA and connect again.');
   states.delete(state);
   if(url.searchParams.has('error'))return {redirect:'/?calendar=denied#calendar',cookie:cookie('')};
   const code=url.searchParams.get('code');if(!code||code.length>4096)fail('Google did not return an authorization code.');
   const tokens=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:entry.redirect,code_verifier:entry.verifier});
   if(typeof tokens.scope!=='string'||!tokens.scope.split(' ').includes(CALENDAR_SCOPE))fail('Google Calendar read access was not granted. Connect again and approve Calendar access.',403);
   await save({accessToken:tokens.access_token,refreshToken:tokens.refresh_token||null,expiresAt:clock()+tokens.expires_in*1000});
   return {redirect:'/?calendar=connected#calendar',cookie:cookie('')};
  }
  if(method==='POST'&&path==='/api/calendar/disconnect'){
   const tokens=await load();await remove();states.clear();let revoked=true;
   if(tokens){try{const result=await remote('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:tokens.refreshToken||tokens.accessToken})});revoked=result.ok||result.status===400;}catch{revoked=false;}}
   return {data:{connected:false,revoked,notice:revoked?'Calendar disconnected.':'Local Calendar access removed. Google revocation could not be confirmed; remove ZIALA access in your Google Account connections too.'},cookie:cookie('')};
  }
  if(method==='GET'&&path==='/api/calendar/events'){
   let token=await accessToken(),pageToken,events=[],timeZone='UTC',truncated=false;
   const timeMin=new Date(clock()).toISOString(),timeMax=new Date(clock()+90*86400000).toISOString();
   for(let page=0;page<5;page++){
    const endpoint=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');endpoint.search=new URLSearchParams({timeMin,timeMax,singleEvents:'true',orderBy:'startTime',maxResults:'100',showDeleted:'false',fields:'timeZone,nextPageToken,items(id,summary,status,start,attendees(self,responseStatus))',...(pageToken?{pageToken}:{})});
    const request=()=>remote(endpoint,{headers:{Authorization:`Bearer ${token}`}});let response=await request();
    if(response.status===401){token=await accessToken(true);response=await request();}
    if(!response.ok){if(response.status===401){await remove();fail('Google Calendar access is no longer valid. Connect again.',401);}if(response.status===403)fail('Google denied Calendar access. Check that Calendar API is enabled and read access was granted.',403);if(response.status===429)fail('Google Calendar rate limit reached. Try again later.',429);fail('Google Calendar events could not be loaded. Try again.',502);}
    let body;try{body=await response.json();}catch{fail('Google returned unreadable event data.',502);}
    timeZone=typeof body.timeZone==='string'?body.timeZone:timeZone;events.push(...normalizeCalendarEvents(body.items,timeZone));pageToken=typeof body.nextPageToken==='string'?body.nextPageToken:null;if(!pageToken)break;if(page===4)truncated=true;
   }
   return {data:{events:[...new Map(events.map(event=>[event.id,event])).values()],timeZone,truncated,windowDays:90,loadedAt:new Date(clock()).toISOString()}};
  }
  fail('Not found.',404);
 }
 return {handle(method,url,headers){const work=pending.then(()=>handle(method,url,headers));pending=work.catch(()=>{});return work;}};
}
