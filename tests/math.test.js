import test from 'node:test';
import assert from 'node:assert/strict';
import { basis, perspective, viewMatrix, multiply, random, quaternion, clamp, dot } from '../src/math.js';

test('camera basis is orthonormal', () => {
  const b = basis([0, 3, 24], [-2, 19, -50]);
  for (const v of Object.values(b)) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-7);
  assert.ok(Math.abs(dot(b.right, b.up)) < 1e-7);
  assert.ok(Math.abs(dot(b.forward, b.up)) < 1e-7);
});
test('view matrix moves the eye to the origin', () => {
  const eye = [2, 3, 24], m = viewMatrix(eye, [0, 9, -20]);
  for (let row = 0; row < 3; row++) {
    const result = m[row] * eye[0] + m[row + 4] * eye[1] + m[row + 8] * eye[2] + m[row + 12];
    assert.ok(Math.abs(result) < 1e-5);
  }
});
test('projection and view produce finite clip coordinates', () => {
  const p = perspective(.8, 16 / 9);
  const vp = multiply(p, viewMatrix([0, 3, 24], [0, 10, -50]));
  assert.equal(vp.length, 16);
  assert.ok([...vp].every(Number.isFinite));
});
test('mirrored camera reflects water-plane points consistently', () => {
  const p = perspective(.8, 16 / 9);
  const normal = multiply(p, viewMatrix([0, 3, 24], [0, 18, -50]));
  const mirror = multiply(p, viewMatrix([0, -3, 24], [0, -18, -50], [0, -1, 0]));
  const project = (m, p) => [0, 1].map(r => (m[r] * p[0] + m[r + 4] * p[1] + m[r + 8] * p[2] + m[r + 12]) / (m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]));
  for (const pt of [[0, 0, -30], [10, 0, -5], [-30, 0, -80]]) {
    const a = project(normal, pt), b = project(mirror, pt);
    assert.ok(Math.abs(a[0] + b[0]) < 1e-6);
    assert.ok(Math.abs(a[1] - b[1]) < 1e-6);
  }
});
test('seeded forest randomness is reproducible and bounded', () => {
  const a = random(42), b = random(42);
  for (let i = 0; i < 500; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
});
test('quaternion is normalized; movement clamps to safe bounds', () => {
  assert.ok(Math.abs(Math.hypot(...quaternion(.5, 2.4, -.3)) - 1) < 1e-7);
  assert.equal(clamp(100, -7, 16), 16);
  assert.equal(clamp(-100, -7, 16), -7);
});

test('camera movement and zoom cannot escape the scene bounds', async () => {
  const { MangroveScene } = await import('../src/scene.js');
  const state = { target: { yaw: 0, pitch: 0, zoom: 0 }, current: {}, reducedMotion: true, requestRender() {} };
  MangroveScene.prototype.move.call(state, 999, -999);
  assert.equal(state.target.yaw, .21);
  assert.equal(state.target.pitch, -.055);
  MangroveScene.prototype.zoom.call(state, 999);
  assert.equal(state.target.zoom, 16);
  MangroveScene.prototype.reset.call(state);
  assert.deepEqual(state.current, { yaw: 0, pitch: 0, zoom: 0 });
});
test('procedural forest attributes and instance counts are valid', async () => {
  const { makeForest } = await import('../src/forest.js');
  const forest = makeForest(.03);
  assert.equal(forest.treeCount, 142);
  assert.equal(forest.leaves.length % 12, 0);
  assert.equal(forest.leafCount, forest.leaves.length / 12);
  assert.equal(forest.bark.length % 9, 0);
  for (const array of [forest.bark, forest.leaves, forest.leafVertices]) assert.ok(array.every(Number.isFinite));
  assert.ok(Math.max(...forest.leafIndices) < forest.leafVertices.length / 8);
});
