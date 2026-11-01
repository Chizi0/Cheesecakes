import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outfitFallback, reviewShoppingOptions, reviewStoreOptions } from './outfit-policy.mjs';
const occasion={mode:'occasion',hasSuitableReadyOutfit:false,hasReadyAlternative:true,today:'2026-11-01',occasionDate:'2026-11-08'};
test('suitable ready closet outfit takes precedence over shopping',()=>{
 assert.equal(outfitFallback({...occasion,hasSuitableReadyOutfit:true}).action,'closet');
});
test('daily wear offers a ready alternative with a compromise explanation',()=>{
 const result=outfitFallback({mode:'daily',hasSuitableReadyOutfit:false,hasReadyAlternative:true});
 assert.equal(result.action,'alternative');assert.match(result.reason,/compromise/);
});
test('no ready daily alternative returns no match',()=>{
 assert.equal(outfitFallback({mode:'daily',hasSuitableReadyOutfit:false}).action,'no_match');
});
test('delivery shopping begins at 7 calendar days; 6 days uses in-store options',()=>{
 assert.equal(outfitFallback(occasion).action,'shopping');
 assert.equal(outfitFallback({...occasion,occasionDate:'2026-11-07'}).action,'in_store');
});
test('occasions do not silently accept a daily-wear alternative',()=>{
 assert.notEqual(outfitFallback(occasion).action,'alternative');
});
test('buying options need suitability and an estimated delivery before the occasion',()=>{
 const reviewed=reviewShoppingOptions([
 {id:'early',occasionSuitable:true,estimatedDeliveryDate:'2026-11-07'},
 {id:'same-day',occasionSuitable:true,estimatedDeliveryDate:'2026-11-08'},
 {id:'late',occasionSuitable:true,estimatedDeliveryDate:'2026-11-09'},
 {id:'unknown',occasionSuitable:true},
 {id:'wrong',occasionSuitable:false,estimatedDeliveryDate:'2026-11-07'},
 ],'2026-11-08');
 assert.deepEqual(reviewed.filter(o=>o.eligible).map(o=>o.id),['early']);
 assert.match(reviewed[0].reason,/Estimated delivery/);
});
test('past and invalid calendar dates are rejected',()=>{
 assert.throws(()=>outfitFallback({...occasion,occasionDate:'2026-10-31'}),/past/);
 assert.throws(()=>outfitFallback({...occasion,occasionDate:'2026-02-30'}),/Invalid/);
});
test('shopping review does not modify supplied product records',()=>{
 const options=[{id:'early',occasionSuitable:true,estimatedDeliveryDate:'2026-11-07'}],before=structuredClone(options);
 reviewShoppingOptions(options,'2026-11-08');assert.deepEqual(options,before);
});

test('same-day occasion uses the in-store fallback when no suitable closet outfit exists',()=>{
 assert.equal(outfitFallback({...occasion,occasionDate:occasion.today}).action,'in_store');
});
test('a suitable closet outfit still wins for a near occasion',()=>{
 assert.equal(outfitFallback({...occasion,occasionDate:occasion.today,hasSuitableReadyOutfit:true}).action,'closet');
});
test('store options require suitable nearby confirmed stock',()=>{
 const base={occasionSuitable:true,nearby:true,inStock:true,availableSizes:['M']};
 const options=[{...base,id:'eligible'},{...base,id:'far',nearby:false},{...base,id:'sold-out',inStock:false},{...base,id:'unknown-stock',inStock:undefined},{...base,id:'wrong-occasion',occasionSuitable:false}];
 const result=reviewStoreOptions(options,'M');
 assert.deepEqual(result.filter(o=>o.eligible).map(o=>o.id),['eligible']);
 assert.match(result[0].reason,/opening hours/);
});
test('unknown nearby status does not count as nearby',()=>{
 assert.equal(reviewStoreOptions([{occasionSuitable:true,inStock:true}],'M')[0].eligible,false);
});
test('review keeps exclusions and leaves store data unchanged',()=>{
 const options=[{id:'sample',occasionSuitable:true,nearby:true,inStock:false}],before=structuredClone(options);
 const result=reviewStoreOptions(options,'M');
 assert.equal(result.length,1);assert.equal(result[0].eligible,false);
 assert.deepEqual(options,before);
});


test('item stock without the selected size does not qualify',()=>{
 const option={id:'dress',occasionSuitable:true,nearby:true,inStock:true,availableSizes:['S','L']};
 const result=reviewStoreOptions([option],'M')[0];
 assert.equal(result.eligible,false);assert.match(result.reason,/size M/);
});
test('confirmed size availability qualifies and tolerates case and surrounding spaces',()=>{
 const option={occasionSuitable:true,nearby:true,inStock:true,availableSizes:[' m ']};
 assert.equal(reviewStoreOptions([option],'M')[0].eligible,true);
});
test('missing size inventory stays excluded',()=>{
 assert.equal(reviewStoreOptions([{occasionSuitable:true,nearby:true,inStock:true}],'M')[0].eligible,false);
});
test('user must choose a size',()=>{
 for(const size of [undefined,'','  '])assert.throws(()=>reviewStoreOptions([],size),/Choose a size/);
});
test('sizes from different systems are not silently converted',()=>{
 const option={occasionSuitable:true,nearby:true,inStock:true,availableSizes:['UK 10']};
 assert.equal(reviewStoreOptions([option],'US 10')[0].eligible,false);
});
