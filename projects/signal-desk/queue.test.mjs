import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankTickets } from './queue.mjs';
const ticket=(id,count,minutes,working=false)=>({id,customersAffected:count,arrivedAt:new Date(Date.UTC(2026,10,1,12,-minutes)).toISOString(),hasWorkingPaymentLink:working});
test('Critical comes before High even when High affects more customers',()=>{
 assert.deepEqual(rankTickets([ticket('high',200,40,true),ticket('critical',2,5)]).map(t=>t.id),['critical','high']);
});
test('larger customer impact wins over arrival age at equal priority',()=>{
 assert.deepEqual(rankTickets([ticket('older',2,30),ticket('larger',50,5)]).map(t=>t.id),['larger','older']);
});
test('oldest arrival breaks a tie in priority and impact',()=>{
 assert.deepEqual(rankTickets([ticket('new',50,5),ticket('old',50,30)]).map(t=>t.id),['old','new']);
});
test('reranking reflects edits without mutating the input order',()=>{
 const source=[ticket('small',2,30),ticket('large',50,5)];
 assert.equal(rankTickets(source)[0].id,'large');source[0].customersAffected=60;
 assert.equal(rankTickets(source)[0].id,'small');assert.equal(source[0].id,'small');
});
test('unknown workaround stays Critical and needs triage',()=>{
 const t=ticket('unknown',50,5);delete t.hasWorkingPaymentLink;
 const result=rankTickets([ticket('high',100,30,true),t]);assert.equal(result[0].id,'unknown');assert.equal(result[0].needsTriage,true);
});
test('invalid arrival times and duplicate identifiers are rejected',()=>{
 assert.throws(()=>rankTickets([{...ticket('x',2,5),arrivedAt:'invalid'}]));
 assert.throws(()=>rankTickets([ticket('x',2,5),ticket('x',50,30)]));
});
