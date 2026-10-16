export const fullscreenVertex = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.9999, 1.0);
}`;

const noise = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float n = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { n += a * noise2(p); p = mat2(1.6, -1.2, 1.2, 1.6) * p + 12.5; a *= .5; }
  return n;
}
`;

export const environmentFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec3 uEye, uForward, uRight, uUp;
uniform float uAspect, uTanFov, uTime, uWarm;
uniform int uReflection;
uniform sampler2D uMirror;
uniform mat4 uMirrorVP;
${noise}
vec3 sunDirection() { return normalize(mix(vec3(-.43, .64, -.82), vec3(-.5, .31, -.92), uWarm)); }
vec3 horizon() { return mix(vec3(.86, .947, .954), vec3(.94, .857, .69), uWarm); }
vec3 sky(vec3 rd) {
  float y = max(rd.y, 0.0);
  vec3 top = mix(vec3(.38, .745, .925), vec3(.55, .705, .75), uWarm);
  vec3 c = mix(horizon(), top, pow(clamp(y * 1.6, 0.0, 1.0), .65));
  vec2 cp = rd.xz / (max(rd.y, .02) + .27) * 2.7 + vec2(uTime * .002, -uTime * .001);
  float cloud = fbm(cp + vec2(13.2, 6.8));
  float mask = smoothstep(.48, .72, cloud) * smoothstep(.015, .17, y);
  vec3 white = mix(vec3(.987, .994, .98), vec3(1.0, .926, .78), uWarm);
  c = mix(c, white, mask * .91);
  float sun = max(dot(rd, sunDirection()), 0.0);
  c += white * (pow(sun, 11.0) * .095 + pow(sun, 80.0) * .07 + pow(sun, 3200.0) * .7);
  return c;
}
float wave(vec2 p, float t) {
  return sin(dot(p, vec2(.73, .24)) * 1.5 + t * .52) * .027
       + sin(dot(p, vec2(-.23, .95)) * 2.7 + t * .69) * .016
       + sin(dot(p, vec2(.63, -.35)) * 5.6 - t * .82) * .008
       + sin(p.x * 13.1 + p.y * 4.2 + t * .65) * .003;
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec3 ray = normalize(uForward + uRight * p.x * uAspect * uTanFov + uUp * p.y * uTanFov);
  vec3 c = sky(ray);
  if (uReflection == 0 && ray.y < -.002) {
    float dist = min(-uEye.y / ray.y, 1300.0);
    vec3 wp = uEye + ray * dist;
    vec2 q = wp.xz;
    float e = .055;
    float dx = (wave(q + vec2(e, 0), uTime) - wave(q - vec2(e, 0), uTime)) / (2.0 * e);
    float dz = (wave(q + vec2(0, e), uTime) - wave(q - vec2(0, e), uTime)) / (2.0 * e);
    float detail = 1.0 - smoothstep(28.0, 155.0, dist);
    float micro = sin(q.x * 31.0 + q.y * 19.0 + uTime) * .004 * detail;
    dx *= .5 + detail * .5; dz *= .5 + detail * .5;
    vec3 n = normalize(vec3(-dx - micro, 1.0, -dz));
    vec4 rp = uMirrorVP * vec4(wp, 1.0);
    vec2 uv = rp.xy / rp.w * .5 + .5;
    float fade = 1.0 - smoothstep(35.0, 250.0, dist);
    uv += vec2(n.x, n.z) * (.012 + fade * .009);
    uv = clamp(uv, vec2(.002), vec2(.998));
    vec3 reflection = texture(uMirror, uv).rgb;
    float fresnel = .055 + .945 * pow(1.0 - max(dot(-ray, n), 0.0), 4.3);
    vec3 water = mix(vec3(.17, .53, .56), vec3(.24, .49, .45), uWarm);
    float shimmer = sin(q.x * 1.7 + q.y * 2.8 + sin(q.x * .8 - q.y) * 1.9);
    float caustic = pow(max(0.0, shimmer), 12.0) * .045 * exp(-dist * .04);
    water += caustic + sin(q.y * .8 + q.x * .23) * .012;
    c = mix(water, reflection, clamp(fresnel * .77 + .16, .0, .96));
    vec3 h = normalize(sunDirection() - ray);
    float spec = pow(max(dot(n, h), 0.0), 420.0) * 1.4;
    c += mix(vec3(.96, 1.0, .94), vec3(1.0, .88, .53), uWarm) * spec;
    // Fine grazing streaks catch the open sky without washing out the forest reflection.
    float streak = pow(max(sin(q.y * 10.0 + sin(q.x * 2.0) + uTime * .65), 0.0), 22.0);
    c += streak * .028 * fade * detail;
    c = mix(c, horizon(), 1.0 - exp(-dist * .0019));
  }
  float grain = (hash(gl_FragCoord.xy + mod(uTime, 31.0)) - .5) / 255.0;
  outColor = vec4(c + grain, 1.0);
}`;

export const barkVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uVP;
out vec3 vWorld, vNormal, vColor;
void main() {
  vWorld = aPosition; vNormal = aNormal; vColor = aColor;
  gl_Position = uVP * vec4(aPosition, 1.0);
}`;

export const leafVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in vec4 aOffsetScale;
layout(location=4) in vec4 aQuaternion;
layout(location=5) in vec4 aColorPhase;
uniform mat4 uVP;
uniform float uTime;
out vec3 vWorld, vNormal, vColor;
out vec2 vUv;
vec3 rotateQ(vec3 v, vec4 q) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 local = aPosition;
  float flutter = sin(uTime * 1.05 + aColorPhase.w + aOffsetScale.x * .24) * .042;
  local.y += flutter * aUv.y * aUv.y;
  vec3 wp = rotateQ(local * aOffsetScale.w, aQuaternion) + aOffsetScale.xyz;
  wp.x += sin(uTime * .38 + wp.z * .17) * .058 * max(wp.y - 2.0, 0.0) / 7.0;
  vWorld = wp; vNormal = rotateQ(aNormal, aQuaternion); vColor = aColorPhase.rgb; vUv = aUv;
  gl_Position = uVP * vec4(wp, 1.0);
}`;

const atmosphere = `
uniform vec3 uEye;
uniform float uWarm;
vec3 sunDirection() { return normalize(mix(vec3(-.43, .64, -.82), vec3(-.5, .31, -.92), uWarm)); }
vec3 finish(vec3 c, vec3 p) {
  float dist = length(p - uEye);
  float fog = 1.0 - exp(-dist * .0037 - max(dist - 70.0, 0.0) * .005);
  vec3 haze = mix(vec3(.77, .899, .917), vec3(.9, .806, .62), uWarm);
  return mix(c, haze, fog);
}
`;

export const barkFragment = `#version 300 es
precision highp float;
in vec3 vWorld, vNormal, vColor;
out vec4 outColor;
${atmosphere}
void main() {
  if (vWorld.y < -.015) discard;
  vec3 n = normalize(vNormal);
  float diffuse = max(dot(n, sunDirection()), 0.0);
  float wet = smoothstep(.0, .65, vWorld.y);
  float grain = sin(vWorld.y * 38.0 + sin(vWorld.x * 32.0 + vWorld.z * 27.0) * 4.0) * .045;
  vec3 c = vColor * (.5 + .56 * diffuse + grain) * mix(.48, 1.0, wet);
  c *= mix(vec3(1.0), vec3(1.15, 1.03, .78), uWarm);
  outColor = vec4(finish(c, vWorld), 1.0);
}`;

export const leafFragment = `#version 300 es
precision highp float;
in vec3 vWorld, vNormal, vColor;
in vec2 vUv;
out vec4 outColor;
${atmosphere}
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float diffuse = max(dot(n, sunDirection()), 0.0);
  float translucent = pow(max(dot(-n, sunDirection()), 0.0), 1.7) * .34;
  float vein = exp(-abs(vUv.x - .5) * 95.0) * .035;
  float veins = pow(max(cos((vUv.y + abs(vUv.x - .5) * .46) * 69.0), .0), 18.0) * .022;
  float gloss = pow(max(dot(reflect(-sunDirection(), n), normalize(uEye - vWorld)), 0.0), 25.0) * .1;
  vec3 c = vColor * (.52 + diffuse * .89 + translucent) + vec3(vein + veins + gloss);
  c *= mix(vec3(1.08, 1.12, .95), vec3(1.35, 1.09, .70), uWarm);
  outColor = vec4(finish(c, vWorld), 1.0);
}`;
