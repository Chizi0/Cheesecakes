const categories=['top','bottom','dress','shoes','bag'];
function safeURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function shoppingRequest(input){
 if(!categories.includes(input.category))throw new Error('Choose a clothing category.');
 const text=(value,max)=>typeof value==='string'&&value.trim().length<=max?value.trim():'';
 const occasion=text(input.occasion,60),size=text(input.size,30),location=text(input.location,100);
 if(!occasion||!size)throw new Error('Enter an occasion and selected size.');
 const budget=input.budget===''||input.budget==null?null:Number(input.budget);
 if(budget!==null&&(!Number.isFinite(budget)||budget<=0||budget>100000))throw new Error('Enter a valid maximum price.');
 const productName=text(input.productName,100),retailer=text(input.retailer,100),sku=text(input.sku,60),color=text(input.color,60);
 return {category:input.category,occasion,size,location,budget,...(productName?{productName,retailer,sku,color}:{})};
}
export function normalizeShoppingResults(payload,request){
 const checkedAt=new Date().toISOString();
 return (Array.isArray(payload.shopping_results)?payload.shopping_results:[]).slice(0,20).map((product,index)=>({
  id:String(product.product_id||`result-${index}`),name:String(product.title||'Untitled product').slice(0,300),
  seller:String(product.source||'Seller not supplied').slice(0,150),price:typeof product.price==='string'?product.price:null,
  amount:Number.isFinite(product.extracted_price)?product.extracted_price:null,
  url:safeURL(product.product_link||product.link),imageUrl:safeURL(product.thumbnail),
  deliveryText:typeof product.delivery==='string'?product.delivery:null,
  estimatedDeliveryDate:null,availableSizes:[],inStock:null,nearby:null,occasionSuitable:null,
  requestedSize:request.size,category:request.category,verification:'unverified',checkedAt,
 })).filter(product=>product.url&&(request.budget===null||product.amount===null||product.amount<=request.budget));
}
export async function searchShopping(input,{apiKey,fetchImpl=fetch}={}){
 const request=shoppingRequest(input);
 if(!apiKey) {const error=new Error('Shopping search needs SERPAPI_API_KEY in the server environment.');error.status=503;throw error;}
 const url=new URL('https://serpapi.com/search.json');
 url.search=new URLSearchParams({engine:'google_shopping',q:request.productName?[request.retailer,request.productName,request.sku,request.color,request.category,`size ${request.size}`].filter(Boolean).join(' '):`women ${request.category} ${request.occasion} size ${request.size}`,gl:'us',hl:'en',api_key:apiKey,...(request.location?{location:request.location}:{})});
 let response;try{response=await fetchImpl(url,{signal:AbortSignal.timeout(15000)});}catch{throw new Error('Shopping provider could not be reached. Try again.');}
 if(!response.ok)throw new Error('Shopping provider rejected the request. Check the server key and search quota.');
 const payload=await response.json();if(payload.error)throw new Error('Shopping provider could not complete this search. Check the server key and query.');
 return {provider:'SerpApi Google Shopping',request,products:normalizeShoppingResults(payload,request),notice:'Search candidates only. Selected size, local stock, occasion suitability, and arrival date require retailer verification.'};
}
