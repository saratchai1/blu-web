/** Small, dependency-free column-major camera math. */
export const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
export function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map(x => x / length);
}
export function basis(eye, target, up = [0, 1, 0]) {
  const forward = normalize(sub(target, eye));
  const right = normalize(cross(forward, up));
  return { forward, right, up: cross(right, forward) };
}
export function viewMatrix(eye, target, up = [0, 1, 0]) {
  const b = basis(eye, target, up);
  const f = b.forward, r = b.right, u = b.up;
  return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1]);
}
export function perspective(fov, aspect, near = .1, far = 700) {
  const f = 1 / Math.tan(fov / 2);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}
export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
export function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6D2B79F5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function quaternion(x, y, z) {
  const a = Math.cos(x / 2), b = Math.sin(x / 2), c = Math.cos(y / 2), d = Math.sin(y / 2), e = Math.cos(z / 2), f = Math.sin(z / 2);
  return [b * c * e + a * d * f, a * d * e - b * c * f, a * c * f + b * d * e, a * c * e - b * d * f];
}
