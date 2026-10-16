/** Small vector/matrix helpers. Matrices are column-major. */
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, n) => a.map(v => v * n);
export const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = a => scale(a, 1 / (Math.hypot(...a) || 1));
export const lerp3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

export function seededRandom(seed = 1042) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
  }
  return out;
}

export function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}

export function orthographic(l, r, b, t, n, f) {
  return new Float32Array([2 / (r-l), 0, 0, 0, 0, 2 / (t-b), 0, 0, 0, 0, -2 / (f-n), 0, -(r+l) / (r-l), -(t+b) / (t-b), -(f+n) / (f-n), 1]);
}

export function lookAt(eye, target, up = [0, 1, 0]) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

export function cameraBasis(eye, target, up = [0, 1, 0]) {
  const forward = normalize(sub(target, eye));
  const right = normalize(cross(forward, up));
  return [...right, ...cross(right, forward), ...forward];
}

export function quatFromEuler(x, y, z) {
  const a = Math.cos(x/2), b = Math.sin(x/2), c = Math.cos(y/2), d = Math.sin(y/2), e = Math.cos(z/2), f = Math.sin(z/2);
  return [b*c*e + a*d*f, a*d*e - b*c*f, a*c*f + b*d*e, a*c*e - b*d*f];
}
