import {reconcile,parseCSV} from './reconcile.mjs';
const initialInvoices=[['INV-1001','Northstar Studio',120000],['INV-1002','Atlas Supply',85000],['INV-1003','Juniper Labs',240000],['INV-1004','Harbor Collective',65000],['INV-1005','Cedar Works',180000]].map(([invoice_id,customer,amount_cents])=>({invoice_id,customer,amount_cents}));
const initialPayments=[['PAY-001','INV-1001',120000],['PAY-002','INV-1002',80000],['PAY-003','INV-1003',140000],['PAY-004','INV-1003',100000],['PAY-005','INV-1004',70000],['PAY-006','INV-9999',30000]].map(([payment_id,invoice_id,amount_cents])=>({payment_id,invoice_id,amount_cents}));
let invoices=structuredClone(initialInvoices),payments=structuredClone(initialPayments);
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
function cell(tr,text){const td=document.createElement('td');td.textContent=text;tr.append(td);return td;}
function render(){
 const result=reconcile(invoices,payments);
 $('invoiced').textContent=money(invoices.reduce((s,i)=>s+i.amount_cents,0));
 $('received').textContent=money(payments.reduce((s,p)=>s+p.amount_cents,0));
 $('exceptions').textContent=result.rows.filter(r=>r.status!=='Matched').length+result.unmatched.length;
 $('matched').textContent=`${result.rows.filter(r=>r.status==='Matched').length}/${invoices.length}`;
 $('rows').replaceChildren();
 const shown=result.rows.filter(r=>($('filter').value==='All'||r.status===$('filter').value)&&`${r.customer} ${r.invoice_id}`.toLowerCase().includes($('search').value.toLowerCase()));
 for(const r of shown){
  const tr=document.createElement('tr');
  for(const value of [r.invoice_id,r.customer,money(r.amount_cents),money(r.paid),money(r.difference)])cell(tr,value);
  cell(tr,r.status).className=r.status==='Matched'?'good':'attention';
  const button=document.createElement('button');button.textContent='Investigate';button.className='subtle';
  button.onclick=()=>{
   $('detail-title').textContent=`${r.invoice_id} · ${r.customer}`;
   const reasons={Matched:'Referenced payments equal the invoice amount.',Unpaid:'No payment references this invoice. Check the ledger before following up.',Underpaid:'Check partial payments, fees, or an incorrect reference.',Overpaid:'Check duplicate payments or credits before taking action.'};
   $('detail-copy').textContent=`${reasons[r.status]} Expected ${money(r.amount_cents)}; received ${money(r.paid)}. Payments: ${r.payments.join(', ')||'none'}.`;
   $('detail').showModal();
  };cell(tr,'').append(button);$('rows').append(tr);
 }
 $('empty').hidden=shown.length>0;$('unmatched').replaceChildren();
 for(const p of result.unmatched){const li=document.createElement('li');li.textContent=`${p.payment_id} · ${money(p.amount_cents)} · Reference ${p.invoice_id||'(blank)'} has no invoice. Verify before allocating.`;$('unmatched').append(li);}
 if(!result.unmatched.length)$('unmatched').textContent='All payments reference an invoice.';
}
$('close').onclick=()=>$('detail').close();$('search').oninput=render;$('filter').onchange=render;
for(const kind of ['invoices','payments'])$(kind+'-file').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{if(file.size>1000000)throw new Error('Use a CSV smaller than 1 MB.');
 const next=parseCSV(await file.text(),kind);reconcile(kind==='invoices'?next:invoices,kind==='payments'?next:payments);
 if(kind==='invoices')invoices=next;else payments=next;render();$('message').textContent=`Imported ${next.length} ${kind}.`;
 }catch(error){$('message').textContent=error.message;}e.target.value='';
};
$('reset').onclick=()=>{invoices=structuredClone(initialInvoices);payments=structuredClone(initialPayments);$('message').textContent='Sample data restored.';render();};render();
