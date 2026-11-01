import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const categories = ['top','bottom','dress','shoes','bag'];
export function validateItemFields(input) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 100) throw new Error('Enter an item name of 1–100 characters.');
  if (!categories.includes(input.category)) throw new Error('Choose top, bottom, dress, shoes, or bag.');
  if (!['ready','laundry'].includes(input.availability)) throw new Error('Choose ready or laundry.');
  if (!Array.isArray(input.occasions) || input.occasions.length > 12 || input.occasions.some(tag=>typeof tag!=='string'||!tag.trim()||tag.length>40)) throw new Error('Occasion tags must be short text labels.');
  return {name:input.name.trim(),category:input.category,availability:input.availability,occasions:[...new Set(input.occasions.map(tag=>tag.trim().toLowerCase()))]};
}
export async function normalizeImage(base64) {
  if (typeof base64!=='string' || !base64 || base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Upload a JPEG, PNG, or WebP image up to 5 MB.');
  const buffer=Buffer.from(base64,'base64');
  if(buffer.length>MAX_IMAGE_BYTES)throw new Error('Image exceeds 5 MB.');
  try {
    const metadata=await sharp(buffer,{limitInputPixels:30000000,animated:false}).metadata();
    if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages??1)>1)throw new Error('Unsupported image.');
    return await sharp(buffer,{limitInputPixels:30000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
  } catch { throw new Error('Use a valid, non-animated JPEG, PNG, or WebP under 30 megapixels.'); }
}
