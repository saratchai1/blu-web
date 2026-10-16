const header = `#version 300 es
precision highp float;
`;

const common = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
}
float fbm(vec2 p) {
  float f=0.0, a=0.5;
  for(int i=0;i<5;i++){ f+=a*noise(p); p=mat2(1.6,-1.2,1.2,1.6)*p+13.1; a*=0.5; }
  return f;
}
vec3 grade(vec3 c) {
  c=max(c,vec3(0));
  c=(c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14);
  return pow(clamp(c,0.0,1.0),vec3(0.454545));
}
`;

export const fullscreenVertex = header + `
out vec2 vUv;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  vUv=p;
  gl_Position=vec4(p*2.0-1.0,1.0,1.0);
}
`;

export const skyFragment = header + common + `
in vec2 vUv;
out vec4 outColor;
uniform mat3 uBasis;
uniform float uAspect, uFov, uTime, uWarmth;
uniform vec3 uSun;
uniform vec3 uFog;
void main(){
  vec2 uv=vUv*2.0-1.0;
  vec3 ray=normalize(uBasis*vec3(uv.x*uAspect*tan(uFov*.5),uv.y*tan(uFov*.5),1));
  float altitude=max(ray.y,0.0);
  vec3 zenith=mix(vec3(.52,.78,.94),vec3(.34,.56,.73),uWarmth);
  vec3 col=mix(uFog,zenith,pow(altitude,.48));
  float sun=max(dot(ray,uSun),0.0);
  col+=vec3(1.0,.93,.73)*pow(sun,48.0)*.19;
  col+=vec3(1.0,.95,.86)*pow(sun,550.0)*.72;
  if(ray.y>0.012){
    vec2 p=ray.xz/(ray.y+.24)*2.25 + vec2(uTime*.003,0);
    float billow=fbm(p*1.45);
    float cloud=smoothstep(.48,.71,billow)*smoothstep(.02,.18,ray.y);
    cloud*=1.0-smoothstep(.78,1.0,ray.y)*.5;
    float light=fbm(p*1.45+vec2(.13,.17));
    vec3 cloudColor=mix(vec3(.77,.88,.93),vec3(1.0,.995,.96),smoothstep(.42,.65,light));
    cloudColor=mix(cloudColor,vec3(1.0,.84,.68),uWarmth*.48);
    col=mix(col,cloudColor,cloud*.72);
    float cirrus=smoothstep(.59,.79,fbm(p*vec2(.5,3.5)+12.0));
    col=mix(col,vec3(.97,.99,1.0),cirrus*.14*smoothstep(.06,.4,ray.y));
  }
  outColor=vec4(col,1);
}
`;

const uniforms = `
uniform mat4 uViewProjection, uLight;
uniform float uTime;
out vec3 vWorld, vNormal, vColor;
out float vShade;
out vec2 vLeafUV;
`;

export const woodVertex = header + `
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
` + uniforms + `
void main(){
  vWorld=aPosition; vNormal=aNormal; vColor=aColor; vShade=1.0; vLeafUV=vec2(0);
  gl_Position=uViewProjection*vec4(vWorld,1);
}
`;

export const leafVertex = header + `
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=3) in vec4 aOffsetSize;
layout(location=4) in vec4 aRotation;
layout(location=5) in vec4 aTintShade;
` + uniforms + `
vec3 rotate(vec3 v,vec4 q){return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
void main(){
  vec3 p=aOffsetSize.xyz;
  vec3 local=rotate(aPosition*aOffsetSize.w,aRotation);
  float wind=sin(uTime*.72+p.x*.30+p.z*.17)*.065+sin(uTime*1.4+p.z*.8)*.024;
  local.x+=wind*(aPosition.z+.5);
  p.x+=sin(uTime*.39+p.z*.08)*.035*max(p.y-2.0,0.0);
  vWorld=p+local;
  vNormal=rotate(aNormal,aRotation);
  vColor=aTintShade.rgb;
  vShade=aTintShade.a;
  vLeafUV=vec2(aPosition.x,aPosition.z+.42);
  gl_Position=uViewProjection*vec4(vWorld,1);
}
`;

const shadows = `
uniform sampler2D uShadow;
uniform mat4 uLight;
float shadowAt(vec3 world, float bias){
  vec4 lp=uLight*vec4(world,1);
  vec3 p=lp.xyz/lp.w*.5+.5;
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0) return 1.0;
  vec2 texel=1.0/vec2(textureSize(uShadow,0));
  float s=0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++){
    float d=texture(uShadow,p.xy+vec2(x,y)*texel).r;
    s+=p.z-bias>d ? 0.0 : 1.0;
  }
  return s/9.0;
}
`;

export const surfaceFragment = header + common + shadows + `
in vec3 vWorld, vNormal, vColor;
in float vShade;
in vec2 vLeafUV;
out vec4 outColor;
uniform vec3 uSun, uEye, uFog;
uniform float uWarmth, uReflection, uLeaf;
void main(){
  if(uReflection>.5 && vWorld.y<.012) discard;
  vec3 n=normalize(vNormal);
  if(!gl_FrontFacing) n=-n;
  float diffuse=max(dot(n,uSun),0.0);
  float shadow=shadowAt(vWorld,.0014);
  float hemi=n.y*.5+.5;
  vec3 ambient=mix(vec3(.32,.43,.37),vec3(.85,1.02,1.10),hemi)*.52;
  vec3 sunColor=mix(vec3(1.10,1.05,.86),vec3(1.3,.91,.60),uWarmth);
  vec3 base=pow(vColor,vec3(2.2));
  float midrib=1.0-smoothstep(.003,.017,abs(vLeafUV.x));
  base*=1.0+uLeaf*midrib*.13;
  float bark=1.0;
  if(uLeaf<.5){ bark=.87+.13*noise(vec2(vWorld.x*24.0+vWorld.z*17.0,vWorld.y*2.0)); }
  vec3 col=base*bark*(ambient + sunColor*diffuse*shadow*1.85)*vShade;
  col+=base*sunColor*.33*max(dot(-n,uSun),0.0)*shadow*uLeaf;
  vec3 viewDir=normalize(uEye-vWorld);
  float spec=pow(max(dot(n,normalize(uSun+viewDir)),0.0),35.0);
  col+=sunColor*spec*.035*shadow*uLeaf;
  col=grade(col*1.1);
  float d=length(uEye-vWorld);
  float fog=1.0-exp(-d*d*.000028);
  outColor=vec4(mix(col,uFog,fog),1);
}
`;

export const depthFragment = header + `
void main(){}
`;

export const waterVertex = header + `
layout(location=0) in vec3 aPosition;
uniform mat4 uViewProjection, uReflectionMatrix;
out vec3 vWorld;
out vec4 vMirror;
void main(){
  vWorld=aPosition;
  vMirror=uReflectionMatrix*vec4(aPosition,1);
  gl_Position=uViewProjection*vec4(aPosition,1);
}
`;

export const waterFragment = header + common + shadows + `
in vec3 vWorld;
in vec4 vMirror;
out vec4 outColor;
uniform sampler2D uMirror;
uniform vec3 uEye, uSun, uFog;
uniform float uTime, uWarmth;
void main(){
  vec2 p=vWorld.xz;
  float t=uTime;
  vec2 slope=vec2(0);
  for(int i=0;i<7;i++){
    float fi=float(i);
    float a=fi*2.399;
    vec2 direction=vec2(cos(a),sin(a));
    float freq=.52*pow(1.64,fi);
    float phase=dot(p,direction)*freq+t*(.48+fi*.13);
    phase+=sin(p.y*.12+p.x*.04+t*.16)*.7;
    slope+=direction*cos(phase)*(.065/(1.0+fi*.3));
  }
  vec3 n=normalize(vec3(-slope.x,1,-slope.y));
  vec3 viewDir=normalize(uEye-vWorld);
  float distanceToEye=length(uEye-vWorld);
  vec2 uv=vMirror.xy/vMirror.w*.5+.5;
  uv+=slope*.047/(1.0+distanceToEye*.015);
  vec3 reflection=texture(uMirror,clamp(uv,.002,.998)).rgb;
  float fresnel=.34+.62*pow(1.0-max(dot(n,viewDir),0.0),4.0);
  vec3 tint=mix(vec3(.23,.57,.59),vec3(.20,.42,.39),uWarmth);
  float rippleLight=.98+slope.x*.32+slope.y*.12;
  vec3 col=mix(tint*rippleLight,reflection,fresnel);
  float spec=pow(max(dot(n,normalize(viewDir+uSun)),0.0),190.0);
  col+=vec3(1.0,.95,.81)*spec*1.3;
  col+=vec3(.88,.97,1)*pow(max(dot(n,normalize(viewDir+uSun)),0.0),24.0)*.045;
  float shadow=shadowAt(vWorld,.002);
  col*=.90+.10*shadow;
  float fog=1.0-exp(-distanceToEye*distanceToEye*.000025);
  col=mix(col,uFog,fog);
  outColor=vec4(col,1);
}
`;
