import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { seededRandom, normalize, dot, cross, lookAt, multiply, perspective, quatFromEuler, clamp } from '../src/lib/math.js';
import { createWorld, createLeafGeometry, QUALITY } from '../src/scene/world.js';

const world=createWorld('low');
test('seeded forest generation is deterministic',()=>{
  const a=seededRandom(42),b=seededRandom(42);
  for(let i=0;i<1000;i++) assert.equal(a(),b());
});
test('vector basis remains orthogonal',()=>{
  const n=normalize([3,4,5]),side=normalize(cross(n,[0,1,0]));
  assert.ok(Math.abs(dot(n,side))<1e-8);
  assert.ok(Math.abs(Math.hypot(...n)-1)<1e-8);
});
test('lookAt maps the eye to the camera origin',()=>{
  const eye=[3,5,17],m=lookAt(eye,[0,2,-30]);
  for(let row=0;row<3;row++) assert.ok(Math.abs(m[row]*eye[0]+m[4+row]*eye[1]+m[8+row]*eye[2]+m[12+row])<1e-5);
});
test('perspective and reflection matrices stay finite',()=>{
  const p=perspective(1,16/9,.1,700),m=multiply(p,lookAt([0,-3.5,28],[1.2,-15.5,-35],[0,-1,0]));
  assert.equal(m.length,16);assert.ok([...m].every(Number.isFinite));
});
test('leaf quaternion rotations remain unit length',()=>{
  for(let i=0;i<100;i++) assert.ok(Math.abs(Math.hypot(...quatFromEuler(i*.11,i*.2,-i*.07))-1)<1e-8);
});
test('mobile geometry stays within the declared budget',()=>{
  assert.ok(world.treeCount>=100);
  assert.ok(world.leafCount>20000 && world.leafCount<80000);
  assert.equal(world.leaves.length%12,0);assert.equal(world.wood.length%27,0);
  assert.ok(QUALITY.low.pixelRatio<=QUALITY.high.pixelRatio);
});
test('all geometry is finite and leaf instances have valid transforms',()=>{
  for(const value of world.wood) assert.ok(Number.isFinite(value));
  for(let i=0;i<world.leaves.length;i+=12){
    assert.ok(world.leaves[i+3]>0);
    assert.ok(Math.abs(Math.hypot(...world.leaves.subarray(i+4,i+8))-1)<1e-6);
    for(let j=0;j<12;j++) assert.ok(Number.isFinite(world.leaves[i+j]));
  }
});
test('leaf mesh uses normalized smooth normals',()=>{
  const mesh=createLeafGeometry();assert.equal(mesh.length%18,0);
  for(let i=0;i<mesh.length;i+=6) assert.ok(Math.abs(Math.hypot(...mesh.subarray(i+3,i+6))-1)<1e-6);
});
test('camera bounds cannot exceed their allowed range',()=>{
  assert.equal(clamp(-999,-.34,.34),-.34);assert.equal(clamp(999,-12,9),9);
});
test('all browser imports are relative and resolvable without a CDN',async()=>{
  const files=['src/main.js','src/scene/renderer.js','src/scene/world.js','src/scene/shaders.js','src/lib/math.js'];
  for(const file of files){
    const text=await readFile(new URL(`../${file}`,import.meta.url),'utf8');
    for(const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('.'));
      await access(resolve(dirname(file),match[1]));
    }
  }
});
