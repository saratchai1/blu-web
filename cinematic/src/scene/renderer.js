import { normalize, scale, add, perspective, lookAt, multiply, orthographic, cameraBasis } from '../lib/math.js';
import { QUALITY, createWorld, createLeafGeometry } from './world.js';
import * as shaders from './shaders.js';

export const LIGHTS = Object.freeze({
  morning: { sun: normalize([-.43,.69,-.44]), fog: [.90,.963,.977], warmth: 0 },
  noon: { sun: normalize([-.2,.94,.19]), fog: [.80,.92,.96], warmth: 0.03 },
  evening: { sun: normalize([-.66,.30,-.25]), fog: [.95,.88,.75], warmth: 1 },
});

export class MangroveRenderer {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas;
    this.quality = quality in QUALITY ? quality : 'high';
    this.config = QUALITY[this.quality];
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!this.gl) throw new Error('WebGL 2 is not available');
    this.resources = [];
    this.disposed = false;
    try {
      this.frame = 0;
      this.lightKey = '';
      this.lightDirty = true;
      const gl = this.gl;
      this.programs = {
        sky: this.program(shaders.fullscreenVertex, shaders.skyFragment),
        wood: this.program(shaders.woodVertex, shaders.surfaceFragment),
        leaf: this.program(shaders.leafVertex, shaders.surfaceFragment),
        depthWood: this.program(shaders.woodVertex, shaders.depthFragment),
        depthLeaf: this.program(shaders.leafVertex, shaders.depthFragment),
        water: this.program(shaders.waterVertex, shaders.waterFragment),
      };
      const world = createWorld(this.quality);
      this.stats = { trees: world.treeCount, leaves: world.leafCount, quality: this.quality };
      this.wood = this.mesh(world.wood, 9, [[0,3,0],[1,3,3],[2,3,6]]);
      this.leaf = this.mesh(createLeafGeometry(), 6, [[0,3,0],[1,3,3]]);
      gl.bindVertexArray(this.leaf.vao);
      const instances = this.track('Buffer', gl.createBuffer());
      gl.bindBuffer(gl.ARRAY_BUFFER, instances);
      gl.bufferData(gl.ARRAY_BUFFER, world.leaves, gl.STATIC_DRAW);
      for (const [location, offset] of [[3,0],[4,4],[5,8]]) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location,4,gl.FLOAT,false,48,offset*4);
        gl.vertexAttribDivisor(location,1);
      }
      this.leaf.instances = world.leafCount;
      gl.bindVertexArray(null);
      const plane = new Float32Array([-600,0,-600, 600,0,-600, -600,0,600, -600,0,600, 600,0,-600, 600,0,600]);
      this.water = this.mesh(plane,3,[[0,3,0]]);
      this.emptyVao = this.track('VertexArray',gl.createVertexArray());
      this.shadow = this.depthTarget(this.config.shadow);
      this.mirror = this.colorTarget(this.config.reflection);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      this.resize();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  track(type, resource) {
    if (!resource) throw new Error(`Unable to allocate WebGL ${type}`);
    this.resources.push([type, resource]);
    return resource;
  }

  program(vertex, fragment) {
    const gl = this.gl;
    const compile = (kind, source) => {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || 'Shader compilation failed');
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER,vertex), fs = compile(gl.FRAGMENT_SHADER,fragment);
    const program = this.track('Program',gl.createProgram());
    gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
    const uniforms = new Map();
    for (let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++) {
      const info = gl.getActiveUniform(program,i);
      uniforms.set(info.name,{ location: gl.getUniformLocation(program,info.name), type: info.type });
    }
    return { program, uniforms };
  }

  use(program, values) {
    const gl = this.gl;
    gl.useProgram(program.program);
    for (const [key,value] of Object.entries(values)) {
      const entry = program.uniforms.get(key);
      if (!entry) continue;
      const { location: p, type } = entry;
      if (type === gl.FLOAT_MAT4) gl.uniformMatrix4fv(p,false,value);
      else if (type === gl.FLOAT_MAT3) gl.uniformMatrix3fv(p,false,value);
      else if (type === gl.FLOAT_VEC3) gl.uniform3fv(p,value);
      else if (type === gl.SAMPLER_2D || type === gl.INT) gl.uniform1i(p,value);
      else gl.uniform1f(p,value);
    }
  }

  mesh(data, stride, attributes) {
    const gl=this.gl;
    const vao=this.track('VertexArray',gl.createVertexArray());
    gl.bindVertexArray(vao);
    const buffer=this.track('Buffer',gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    for(const [location,size,offset] of attributes){
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,size,gl.FLOAT,false,stride*4,offset*4);
    }
    gl.bindVertexArray(null);
    return { vao, count: data.length/stride };
  }

  texture(size, internal, format, type, filter) {
    const gl=this.gl;
    const texture=this.track('Texture',gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,internal,size,size,0,format,type,null);
    for(const wrap of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,wrap,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    return texture;
  }

  depthTarget(size) {
    const gl=this.gl;
    const texture=this.texture(size,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.NEAREST);
    const framebuffer=this.track('Framebuffer',gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    this.checkTarget();
    return { texture, framebuffer, size };
  }

  colorTarget(size) {
    const gl=this.gl;
    const texture=this.texture(size,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR);
    const framebuffer=this.track('Framebuffer',gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    const depth=this.track('Renderbuffer',gl.createRenderbuffer());
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,size,size);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    this.checkTarget();
    return { texture, framebuffer, size };
  }

  checkTarget() {
    const gl=this.gl;
    const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    if(status!==gl.FRAMEBUFFER_COMPLETE) throw new Error(`Render target not supported: ${status}`);
  }

  bindTexture(texture,slot) {
    const gl=this.gl;
    gl.activeTexture(gl.TEXTURE0+slot); gl.bindTexture(gl.TEXTURE_2D,texture);
  }

  draw(mesh) {
    const gl=this.gl;
    gl.bindVertexArray(mesh.vao);
    if(mesh.instances) gl.drawArraysInstanced(gl.TRIANGLES,0,mesh.count,mesh.instances);
    else gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }

  resize() {
    const ratio=Math.min(window.devicePixelRatio || 1,this.config.pixelRatio);
    const width=Math.max(1,Math.round(this.canvas.clientWidth*ratio));
    const height=Math.max(1,Math.round(this.canvas.clientHeight*ratio));
    if(this.canvas.width!==width || this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    this.aspect=width/height;
  }

  render(time, camera, lightKey='morning') {
    if(this.disposed || this.gl.isContextLost()) return;
    const gl=this.gl;
    const light=LIGHTS[lightKey] || LIGHTS.morning;
    if(this.lightKey!==lightKey){this.lightKey=lightKey;this.lightDirty=true;}
    const center=[13,0,-38];
    const lightView=lookAt(add(center,scale(light.sun,130)),center);
    const lightMatrix=multiply(orthographic(-72,72,-72,72,1,260),lightView);
    const base={uLight:lightMatrix,uTime:time,uSun:light.sun,uWarmth:light.warmth,uFog:light.fog,uShadow:0};
    if(this.frame%6===0 || this.lightDirty){
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadow.framebuffer);
      gl.viewport(0,0,this.shadow.size,this.shadow.size);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.use(this.programs.depthWood,{uViewProjection:lightMatrix,uTime:time});this.draw(this.wood);
      this.use(this.programs.depthLeaf,{uViewProjection:lightMatrix,uTime:time});this.draw(this.leaf);
      this.lightDirty=false;
    }
    this.bindTexture(this.shadow.texture,0);
    const fov=camera.fov;
    const projection=perspective(fov,this.aspect,.12,700);
    const view=lookAt(camera.eye,camera.target);
    const viewProjection=multiply(projection,view);
    const mirrorEye=[camera.eye[0],-camera.eye[1],camera.eye[2]];
    const mirrorTarget=[camera.target[0],-camera.target[1],camera.target[2]];
    const reflectionMatrix=multiply(projection,lookAt(mirrorEye,mirrorTarget,[0,-1,0]));

    const renderScene=(eye,target,matrix,reflection)=>{
      this.use(this.programs.sky,{...base,uBasis:cameraBasis(eye,target,reflection?[0,-1,0]:[0,1,0]),uAspect:this.aspect,uFov:fov});
      gl.bindVertexArray(this.emptyVao);gl.drawArrays(gl.TRIANGLES,0,3);
      const uniforms={...base,uViewProjection:matrix,uEye:eye,uReflection:reflection?1:0};
      this.use(this.programs.wood,{...uniforms,uLeaf:0});this.draw(this.wood);
      this.use(this.programs.leaf,{...uniforms,uLeaf:1});this.draw(this.leaf);
    };

    gl.bindFramebuffer(gl.FRAMEBUFFER,this.mirror.framebuffer);
    gl.viewport(0,0,this.mirror.size,this.mirror.size);
    gl.clearColor(...light.fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    renderScene(mirrorEye,mirrorTarget,reflectionMatrix,true);

    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    renderScene(camera.eye,camera.target,viewProjection,false);
    this.bindTexture(this.mirror.texture,1);
    this.use(this.programs.water,{...base,uViewProjection:viewProjection,uReflectionMatrix:reflectionMatrix,uEye:camera.eye,uMirror:1});
    this.draw(this.water);
    gl.bindVertexArray(null);
    this.frame++;
    this.lastCamera=camera;
  }

  dispose() {
    if(this.disposed) return;
    for(const [type,resource] of this.resources) this.gl[`delete${type}`](resource);
    this.resources=[];this.disposed=true;
  }
}
