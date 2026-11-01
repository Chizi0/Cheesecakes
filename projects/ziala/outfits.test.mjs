import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClosetOutfits } from './outfits.mjs';
const item=(id,category,extra={})=>({id,category,availability:'ready',occasions:['dinner'],...extra});
const separates=()=>[item('T','top'),item('B','bottom'),item('S','shoes'),item('G','bag')];

test('separates require top bottom shoes and bag',()=>{
 const result=buildClosetOutfits(separates(),'dinner');
 assert.equal(result.hasSuitableReadyOutfit,true);
 assert.equal(result.patterns[0].complete,true);
 assert.equal(result.patterns[0].items.length,4);
});
test('dress pattern also requires shoes and bag',()=>{
 const result=buildClosetOutfits([item('D','dress'),item('S','shoes'),item('G','bag')],'dinner');
 assert.equal(result.patterns[1].complete,true);
 assert.equal(result.patterns[0].complete,false);
});
test('missing bag leaves both patterns incomplete',()=>{
 const items=[...separates().filter(i=>i.category!=='bag'),item('D','dress')];
 const result=buildClosetOutfits(items,'dinner');
 assert.equal(result.hasSuitableReadyOutfit,false);
 for(const pattern of result.patterns)assert.ok(pattern.missingCategories.includes('bag'));
});
test('laundry bag is excluded with its reason',()=>{
 const result=buildClosetOutfits(separates().map(i=>i.category==='bag'?{...i,availability:'laundry'}:i),'dinner');
 assert.equal(result.hasSuitableReadyOutfit,false);
 assert.match(result.reviewedItems.find(i=>i.id==='G').reason,/laundry/);
});
test('ready but unsuitable bag does not complete the outfit',()=>{
 const result=buildClosetOutfits(separates().map(i=>i.category==='bag'?{...i,occasions:['gym']}:i),'dinner');
 assert.equal(result.hasSuitableReadyOutfit,false);
 assert.match(result.reviewedItems.find(i=>i.id==='G').reason,/not tagged suitable/);
});
test('unknown availability or suitability is not assumed',()=>{
 for(const extra of [{availability:undefined},{occasions:undefined}]){
  assert.equal(buildClosetOutfits(separates().map(i=>i.category==='bag'?{...i,...extra}:i),'dinner').hasSuitableReadyOutfit,false);
 }
});
test('one complete pattern is sufficient without mixing dress and separates',()=>{
 const result=buildClosetOutfits([item('D','dress'),item('S','shoes'),item('G','bag'),item('T','top')],'dinner');
 assert.equal(result.hasSuitableReadyOutfit,true);
 assert.deepEqual(result.patterns[1].items.map(i=>i.category),['dress','shoes','bag']);
});
test('selection preserves original records and uses repeatable ID order',()=>{
 const items=[...separates(),item('A','bag')],before=structuredClone(items);
 const result=buildClosetOutfits(items,'dinner');
 assert.equal(result.patterns[0].items.at(-1).id,'A');assert.deepEqual(items,before);
});

test('bag availability drives closet versus shopping policy',async()=>{
 const {outfitFallback}=await import('./outfit-policy.mjs');
 const request={mode:'occasion',today:'2026-11-01',occasionDate:'2026-11-08'};
 const ready=buildClosetOutfits(separates(),'dinner');
 assert.equal(outfitFallback({...request,hasSuitableReadyOutfit:ready.hasSuitableReadyOutfit}).action,'closet');
 const laundry=buildClosetOutfits(separates().map(i=>i.category==='bag'?{...i,availability:'laundry'}:i),'dinner');
 assert.equal(outfitFallback({...request,hasSuitableReadyOutfit:laundry.hasSuitableReadyOutfit}).action,'shopping');
});
