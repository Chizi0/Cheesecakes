import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcile,parseCSV} from '../reconcile.mjs';
const invoice={invoice_id:'I1',customer:'Example',amount_cents:100};
const payment=(id,amount,reference='I1')=>({payment_id:id,invoice_id:reference,amount_cents:amount});
test('sums split payments before deciding a match',()=>assert.equal(reconcile([invoice],[payment('P1',40),payment('P2',60)]).rows[0].status,'Matched'));
test('distinguishes unpaid, underpaid and overpaid',()=>{
 for(const [payments,status] of [[[],'Unpaid'],[[payment('P1',99)],'Underpaid'],[[payment('P1',101)],'Overpaid']])assert.equal(reconcile([invoice],payments).rows[0].status,status);
});
test('unknown references remain unallocated',()=>{const result=reconcile([invoice],[payment('P1',100,'missing')]);assert.equal(result.unmatched.length,1);assert.equal(result.rows[0].status,'Unpaid');});
test('rejects duplicate IDs and invalid amounts',()=>{
 assert.throws(()=>reconcile([invoice,invoice],[]));assert.throws(()=>reconcile([invoice],[payment('P1',1),payment('P1',2)]));
 for(const amount of [-1,NaN,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>reconcile([{...invoice,amount_cents:amount}],[]));
});
test('CSV preserves quoted commas, quotes and multiline customer names',()=>{
 const rows=parseCSV('invoice_id,customer,amount_cents\r\nI1,"Example, ""Inc""\nStudio",100','invoices');assert.equal(rows[0].customer,'Example, "Inc"\nStudio');assert.equal(rows[0].amount_cents,100);
});
test('CSV rejects missing headers, invalid amounts and unclosed quotes',()=>{
 for(const text of ['x,y\na,b','invoice_id,customer,amount_cents\nI1,X,1.5','invoice_id,customer,amount_cents\nI1,"X,100'])assert.throws(()=>parseCSV(text,'invoices'));
});
