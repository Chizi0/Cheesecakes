import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitImageDimensions } from './client-image.mjs';

test('48-megapixel phone photo is resized rather than rejected',()=>{
 assert.deepEqual(fitImageDimensions(8000,6000),{width:1600,height:1200});
});
test('portrait dimensions preserve aspect ratio',()=>{
 assert.deepEqual(fitImageDimensions(6000,8000),{width:1200,height:1600});
});
test('small photos are not enlarged',()=>{
 assert.deepEqual(fitImageDimensions(600,800),{width:600,height:800});
});
test('invalid or exceptionally large dimensions are rejected with distinct errors',()=>{
 assert.throws(()=>fitImageDimensions(0,800),/invalid dimensions/);
 assert.throws(()=>fitImageDimensions(10000,10000),/80 megapixels/);
});
