import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
const require=createRequire(import.meta.url);
const english=require('@tesseract.js-data/eng');
const MAX_BYTES=5*1024*1024;
export function receiptCategory(name){
 const rules=[['bag',/\b(bag|handbag|purse|tote|clutch|backpack)\b/i],['dress',/\b(dress|gown|jumpsuit)\b/i],['shoes',/\b(shoes?|heels?|boots?|sneakers?|sandals?|loafers?|flats)\b/i],['bottom',/\b(trousers|pants|jeans|skirt|shorts|leggings)\b/i],['top',/\b(top|blouse|shirt|tee|sweater|cardigan|jacket|blazer|hoodie)\b/i]];
 return rules.find(([,pattern])=>pattern.test(name))?.[0]||'';
}
export function receiptLines(text){
 if(typeof text!=='string'||text.length>30000)throw new Error('Receipt text must be under 30,000 characters.');
 return text.split(/\r?\n/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean).flatMap((line,index)=>{
  // Conservative line-item suggestions, never an assertion that this was a clothing purchase.
  if(/^(?:sub\s*total|total|tax|sales tax|shipping|delivery|discount|savings|balance|amount|change|cash|visa|mastercard|amex|payment|order|receipt|invoice|date|time|tel|phone|email|address|thank|return|refund)\b/i.test(line))return [];
  const match=line.match(/^(.+?)\s+(?:USD\s*|\$|£|€)?(\d{1,6}(?:,\d{3})*\.\d{2})\s*$/i);
  if(!match||!/[a-z]/i.test(match[1])||/@|https?:|\*{3}|\b(?:street|avenue|road|zip|card ending)\b/i.test(match[1]))return [];
  let name=match[1].trim(),quantity=1;
  const qty=name.match(/^(\d{1,2})\s*[x×]\s+(.+)$/i);if(qty){quantity=Number(qty[1]);name=qty[2];}
  if(name.length>100||quantity<1||quantity>10)return [];
  return [{rowId:String(index),name,quantity,category:receiptCategory(name),printedAmount:match[2],sourceLine:line}];
 }).slice(0,50);
}
export async function readReceipt(input){
 if(typeof input?.fileBase64!=='string'||!input.fileBase64||input.fileBase64.length>Math.ceil(MAX_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.fileBase64))throw new Error('Upload a receipt file up to 5 MB.');
 const bytes=Buffer.from(input.fileBase64,'base64');if(bytes.length>MAX_BYTES)throw new Error('Receipt exceeds 5 MB.');
 let text='',method;
 if(bytes.subarray(0,5).toString()==='%PDF-'){
  method='pdf-text';const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,verbosity:0});
  let timer;try{
   text=await Promise.race([(async()=>{const doc=await task.promise;if(doc.numPages>5)throw new Error('Use a receipt PDF with at most 5 pages.');let result='';for(let n=1;n<=doc.numPages;n++){
    const page=await doc.getPage(n),content=await page.getTextContent();let y=null;
    for(const item of content.items){if(!('str' in item))continue;const nextY=item.transform?.[5];if(y!==null&&Math.abs(nextY-y)>3)result+='\n';result+=item.str+(item.hasEOL?'\n':' ');y=nextY;}
    result+='\n';if(result.length>30000)throw new Error('Receipt text exceeds the extraction limit.');page.cleanup();
   }return result;})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('PDF reading timed out. Use a shorter receipt.')),15000);})]);
  }catch(error){throw new Error(/at most|limit|timed out/.test(error.message)?error.message:'Cannot read this PDF. Use an unlocked PDF with selectable text, or upload a receipt photo.');}finally{clearTimeout(timer);await task.destroy();}
 }else if(input.type==='text/plain'){
  method='text';text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(/[\x00-\x08\x0e-\x1f]/.test(text))throw new Error('Use a plain text receipt.');
 }else{
  method='local-ocr';let image;try{const metadata=await sharp(bytes,{limitInputPixels:30000000}).metadata();if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages??1)>1)throw Error();image=await sharp(bytes,{limitInputPixels:30000000}).rotate().resize({width:2400,height:4000,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).normalize().png().toBuffer();}catch{throw new Error('Use a valid JPEG, PNG, WebP, text file, or text-based PDF.');}
  let worker,timer,stopped=false;try{
   const recognize=(async()=>{worker=await createWorker('eng',1,{langPath:english.langPath,gzip:true,cacheMethod:'none'});if(stopped){await worker.terminate();throw new Error('Receipt reading timed out.');}await worker.setParameters({preserve_interword_spaces:'1'});return (await worker.recognize(image)).data.text;})();
   text=await Promise.race([recognize,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Receipt reading timed out. Try a clearer cropped photo or text receipt.')),45000);})]);
  }finally{stopped=true;clearTimeout(timer);if(worker)await worker.terminate();}
 }
 if(!text.trim())throw new Error('No readable text found. For scanned PDFs, upload a clear photo of the receipt instead.');
 if(text.length>30000)throw new Error('Receipt text exceeds 30,000 characters.');
 return {fingerprint:createHash('sha256').update(bytes).digest('hex'),text,method,rows:receiptLines(text)};
}
