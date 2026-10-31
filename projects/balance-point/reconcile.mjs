export function reconcile(invoices, payments) {
  for (const [rows, key] of [[invoices,'invoice_id'],[payments,'payment_id']]) {
    const ids = new Set();
    for (const row of rows) {
      if (!row[key] || ids.has(row[key])) throw new Error(`${key} must be present and unique.`);
      ids.add(row[key]);
      if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents < 0) throw new Error('Amounts must be nonnegative whole cents.');
    }
  }
  return {
    rows: invoices.map(invoice => {
      const linked = payments.filter(p => p.invoice_id === invoice.invoice_id);
      const paid = linked.reduce((s,p) => s+p.amount_cents,0);
      const difference = paid-invoice.amount_cents;
      return {...invoice, paid, difference, payments:linked.map(p=>p.payment_id), status:!linked.length?'Unpaid':difference===0?'Matched':difference<0?'Underpaid':'Overpaid'};
    }),
    unmatched:payments.filter(p=>!invoices.some(i=>i.invoice_id===p.invoice_id))
  };
}
export function parseCSV(text, kind) {
  const records=[]; let row=[], field='', quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {
      if(quoted && text[i+1]==='"') {field+='"';i++;}
      else if(!field || quoted) quoted=!quoted;
      else throw new Error('Unexpected CSV quote.');
    } else if(c===',' && !quoted) {row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted) {
      if(c==='\r' && text[i+1]==='\n') i++;
      row.push(field);if(row.some(v=>v.trim()))records.push(row);row=[];field='';
    } else field+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote.');
  row.push(field);if(row.some(v=>v.trim()))records.push(row);
  if(records.length<2)throw new Error('CSV needs headers and data.');
  const headers=records.shift().map(v=>v.trim());
  const required=kind==='invoices'?['invoice_id','customer','amount_cents']:['payment_id','invoice_id','amount_cents'];
  if(new Set(headers).size!==headers.length || required.some(k=>!headers.includes(k)))throw new Error(`Required unique columns: ${required.join(', ')}`);
  return records.map((values,i)=>{
    if(values.length!==headers.length)throw new Error(`Wrong number of columns on row ${i+2}.`);
    const record=Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));
    if(!/^\d+$/.test(record.amount_cents))throw new Error('amount_cents must contain nonnegative whole cents.');
    record.amount_cents=Number(record.amount_cents);return record;
  });
}
