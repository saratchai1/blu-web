import { clamp, mix, basis, perspective, viewMatrix, multiply } from './math.js';
import { makeForest } from './forest.js';
import * as shaders from './shaders.js';

/** WebGL2 renderer. All geometry and materials are local and generated, with no network assets. */
export class MangroveScene {
  constructor(canvas, { reducedMotion = false, lowPower = false } = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: lowPower ? 'low-power' : 'high-performance', preserveDrawingBuffer: false });
    if (!this.gl) throw new Error('WebGL2 is unavailable');
    this.paused = reducedMotion;
    this.reducedMotion = reducedMotion;
    this.lowPower = lowPower;
    this.visible = !document.hidden;
    this.disposed = false;
    this.time = 0;
    this.warm = 0;
    this.targetWarm = 0;
    this.target = { yaw: 0, pitch: 0, zoom: 0 };
    this.current = { yaw: 0, pitch: 0, zoom: 0 };
    this.pointer = [0, 0];
    this.frameCount = 0;
    this.lastTime = 0;
    this.raf = 0;
    this.resources = { buffers: [], programs: [], vaos: [] };
    this.dprCap = lowPower ? 1.15 : 1.65;
    this.fpsSamples = [];
    this.qualityAdjusted = false;
    this.draw = this.draw.bind(this);
    try {
      this.init();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  program(vertexSource, fragmentSource) {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed: ${log}`);
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    let fs;
    try { fs = compile(gl.FRAGMENT_SHADER, fragmentSource); }
    catch (error) { gl.deleteShader(vs); throw error; }
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p); gl.deleteProgram(p);
      throw new Error(`Shader linking failed: ${log}`);
    }
    this.resources.programs.push(p);
    const uniforms = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
      const info = gl.getActiveUniform(p, i);
      uniforms[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, uniforms };
  }

  buffer(data, target = this.gl.ARRAY_BUFFER) {
    const gl = this.gl, b = gl.createBuffer();
    gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW);
    this.resources.buffers.push(b);
    return b;
  }

  vao() {
    const v = this.gl.createVertexArray();
    this.resources.vaos.push(v); this.gl.bindVertexArray(v);
    return v;
  }

  attribute(location, size, stride, offset, divisor = 0) {
    const gl = this.gl;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
    gl.vertexAttribDivisor(location, divisor);
  }

  init() {
    const gl = this.gl;
    this.environment = this.program(shaders.fullscreenVertex, shaders.environmentFragment);
    this.barkProgram = this.program(shaders.barkVertex, shaders.barkFragment);
    this.leafProgram = this.program(shaders.leafVertex, shaders.leafFragment);
    const forest = makeForest(this.lowPower ? .3 : .65);
    this.barkVAO = this.vao();
    this.buffer(forest.bark);
    this.attribute(0, 3, 9, 0); this.attribute(1, 3, 9, 3); this.attribute(2, 3, 9, 6);
    this.barkCount = forest.bark.length / 9;
    this.leafVAO = this.vao();
    this.buffer(forest.leafVertices);
    this.attribute(0, 3, 8, 0); this.attribute(1, 3, 8, 3); this.attribute(2, 2, 8, 6);
    this.buffer(forest.leafIndices, gl.ELEMENT_ARRAY_BUFFER);
    this.indexCount = forest.leafIndices.length;
    this.buffer(forest.leaves);
    this.attribute(3, 4, 12, 0, 1); this.attribute(4, 4, 12, 4, 1); this.attribute(5, 4, 12, 8, 1);
    this.leafCount = forest.leafCount;
    this.emptyVAO = this.vao();
    gl.bindVertexArray(null);
    this.mirrorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mirrorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.mirrorDepth = gl.createRenderbuffer();
    this.mirrorFBO = gl.createFramebuffer();
    // Separate dummy texture avoids a feedback loop while rendering into the mirror.
    this.dummyTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dummyTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([215, 241, 242, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    this.canvas.dataset.trees = String(forest.treeCount);
    this.canvas.dataset.leaves = String(this.leafCount);
    this.resize();
  }

  resize() {
    if (this.disposed) return;
    const gl = this.gl;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.width = Math.max(1, Math.round(rect.width * dpr));
    this.height = Math.max(1, Math.round(rect.height * dpr));
    this.canvas.width = this.width; this.canvas.height = this.height;
    this.aspect = rect.width / Math.max(rect.height, 1);
    const scale = Math.min(1, (this.lowPower ? 512 : 1024) / Math.max(this.width, this.height));
    this.mirrorWidth = Math.max(1, Math.round(this.width * scale));
    this.mirrorHeight = Math.max(1, Math.round(this.height * scale));
    gl.bindTexture(gl.TEXTURE_2D, this.mirrorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.mirrorWidth, this.mirrorHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.mirrorDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.mirrorWidth, this.mirrorHeight);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mirrorFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.mirrorTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.mirrorDepth);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Reflection framebuffer is unavailable');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.requestRender();
  }

  camera() {
    const portrait = this.aspect < .9;
    const fov = (portrait ? 59 : 48) * Math.PI / 180;
    const drift = this.reducedMotion ? 0 : Math.sin(this.time * .095) * .006;
    const yaw = this.current.yaw + (this.reducedMotion ? 0 : this.pointer[0] * .010) + drift;
    const pitch = .207 + this.current.pitch + (this.reducedMotion ? 0 : this.pointer[1] * .005);
    const eye = [Math.sin(this.time * .07) * (this.reducedMotion ? 0 : .075), 3.1, (portrait ? 44 : 24) + this.current.zoom];
    const target = [eye[0] + Math.sin(yaw - .025) * 74, eye[1] + Math.tan(pitch) * 74, eye[2] - Math.cos(yaw) * 74];
    const projection = perspective(fov, this.aspect);
    const vp = multiply(projection, viewMatrix(eye, target));
    const mirrorEye = [eye[0], -eye[1], eye[2]];
    const mirrorTarget = [target[0], -target[1], target[2]];
    const mirrorVP = multiply(projection, viewMatrix(mirrorEye, mirrorTarget, [0, -1, 0]));
    return { eye, target, vp, mirrorEye, mirrorTarget, mirrorVP, fov };
  }

  environmentPass(camera, mirrored) {
    const gl = this.gl, { p, uniforms: u } = this.environment;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(p); gl.bindVertexArray(this.emptyVAO);
    const eye = mirrored ? camera.mirrorEye : camera.eye;
    const b = basis(eye, mirrored ? camera.mirrorTarget : camera.target, mirrored ? [0, -1, 0] : [0, 1, 0]);
    gl.uniform3fv(u.uEye, eye); gl.uniform3fv(u.uForward, b.forward); gl.uniform3fv(u.uRight, b.right); gl.uniform3fv(u.uUp, b.up);
    gl.uniform1f(u.uAspect, this.aspect); gl.uniform1f(u.uTanFov, Math.tan(camera.fov / 2));
    gl.uniform1f(u.uTime, this.time); gl.uniform1f(u.uWarm, this.warm); gl.uniform1i(u.uReflection, mirrored ? 1 : 0);
    gl.uniformMatrix4fv(u.uMirrorVP, false, camera.mirrorVP);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mirrored ? this.dummyTexture : this.mirrorTexture);
    gl.uniform1i(u.uMirror, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  }

  forestPass(camera, mirrored) {
    const gl = this.gl;
    const vp = mirrored ? camera.mirrorVP : camera.vp;
    for (const [program, vao, leaves] of [[this.barkProgram, this.barkVAO, false], [this.leafProgram, this.leafVAO, true]]) {
      const { p, uniforms: u } = program;
      gl.useProgram(p); gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(u.uVP, false, vp);
      // Lighting uses the real viewpoint for consistent reflected highlights.
      gl.uniform3fv(u.uEye, camera.eye); gl.uniform1f(u.uWarm, this.warm);
      if (leaves) {
        gl.uniform1f(u.uTime, this.time);
        gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, this.leafCount);
      } else gl.drawArrays(gl.TRIANGLES, 0, this.barkCount);
    }
  }

  draw(now) {
    this.raf = 0;
    if (this.disposed || !this.visible || this.gl.isContextLost()) return;
    const delta = this.lastTime ? Math.min((now - this.lastTime) / 1000, .1) : 1 / 60;
    this.lastTime = now;
    if (!this.paused) this.time += delta;
    const easing = 1 - Math.exp(-delta * 6);
    for (const key of ['yaw', 'pitch', 'zoom']) this.current[key] = mix(this.current[key], this.target[key], easing);
    this.warm = mix(this.warm, this.targetWarm, easing * .6);
    const camera = this.camera(), gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mirrorFBO);
    gl.viewport(0, 0, this.mirrorWidth, this.mirrorHeight);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    this.environmentPass(camera, true); this.forestPass(camera, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    this.environmentPass(camera, false); this.forestPass(camera, false);
    gl.bindVertexArray(null);
    this.frameCount++;
    this.canvas.dataset.frames = String(this.frameCount);
    this.canvas.dataset.yaw = this.current.yaw.toFixed(4);
    this.canvas.dataset.time = this.time.toFixed(3);
    this.canvas.dataset.state = this.paused ? 'paused' : 'playing';
    this.canvas.dataset.light = this.targetWarm ? 'evening' : 'daylight';
    if (this.frameCount === 1) this.canvas.dispatchEvent(new CustomEvent('scene-ready'));
    if (!this.paused && this.frameCount > 15 && !this.qualityAdjusted) {
      this.fpsSamples.push(delta);
      if (this.fpsSamples.length === 45) {
        const average = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
        this.qualityAdjusted = true;
        if (average > .038) {
          this.dprCap = Math.max(.7, this.dprCap * .65);
          this.resize();
        }
      }
    }
    const settling = ['yaw', 'pitch', 'zoom'].some(key => Math.abs(this.target[key] - this.current[key]) > .0001) || Math.abs(this.targetWarm - this.warm) > .0005;
    if (!this.paused || settling) this.requestRender();
  }

  requestRender() {
    if (!this.raf && !this.disposed && this.visible) this.raf = requestAnimationFrame(this.draw);
  }
  setPaused(paused) { this.paused = paused; this.lastTime = 0; this.requestRender(); }
  setWarm(warm) { this.targetWarm = warm ? 1 : 0; if (this.reducedMotion) this.warm = this.targetWarm; this.requestRender(); }
  move(dx, dy) {
    this.target.yaw = clamp(this.target.yaw + dx, -.21, .21);
    this.target.pitch = clamp(this.target.pitch + dy, -.055, .065);
    if (this.reducedMotion) this.current = { ...this.target };
    this.requestRender();
  }
  zoom(delta) { this.target.zoom = clamp(this.target.zoom + delta, -7, 16); if (this.reducedMotion) this.current.zoom = this.target.zoom; this.requestRender(); }
  reset() { this.target = { yaw: 0, pitch: 0, zoom: 0 }; this.pointer = [0, 0]; if (this.reducedMotion) this.current = { ...this.target }; this.requestRender(); }
  setVisible(visible) {
    this.visible = visible; this.lastTime = 0;
    if (!visible) { cancelAnimationFrame(this.raf); this.raf = 0; }
    else this.requestRender();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.raf);
    const gl = this.gl;
    for (const b of this.resources.buffers) gl.deleteBuffer(b);
    for (const v of this.resources.vaos) gl.deleteVertexArray(v);
    for (const p of this.resources.programs) gl.deleteProgram(p);
    if (this.mirrorTexture) gl.deleteTexture(this.mirrorTexture);
    if (this.dummyTexture) gl.deleteTexture(this.dummyTexture);
    if (this.mirrorDepth) gl.deleteRenderbuffer(this.mirrorDepth);
    if (this.mirrorFBO) gl.deleteFramebuffer(this.mirrorFBO);
  }
}
