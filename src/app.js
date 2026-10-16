import { MangroveScene } from './scene.js';
import { foregroundArt, posterArt } from './art.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const icon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
  pause: icon('<path d="M9 5v14M15 5v14"/>'),
  play: icon('<path d="m8 5 11 7-11 7z"/>'),
  sun: icon('<circle cx="12" cy="12" r="3.7"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  sunset: icon('<path d="M3 17h18M5 21h14M7 17a5 5 0 0 1 10 0M12 2v3M3.5 8.5 6 10m12 0 2.5-1.5"/>'),
  reset: icon('<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>'),
  expand: icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>'),
  collapse: icon('<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>'),
  hide: icon('<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a20 20 0 0 1-3.4 4.1M6 6.1A20 20 0 0 0 2 12s4 7 10 7a11 11 0 0 0 5.9-1.8"/>'),
  show: icon('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
};
$('motion').innerHTML = icons.pause;
$('light').innerHTML = icons.sun;
$('reset').innerHTML = icons.reset;
$('fullscreen').innerHTML = icons.expand;
$('hide-ui').innerHTML = icons.hide;
$('show-ui').innerHTML = icons.show;
$('poster').innerHTML = posterArt();
$('foreground-left').innerHTML = foregroundArt('left');
$('foreground-right').innerHTML = foregroundArt('right');
if (params.get('clean') === '1') document.body.classList.add('clean');

let scene;
let uiHidden = false;
let dragging = false;
let dragPoint = [0, 0];
let toastTimer;
let hintTimer;
const events = new AbortController();
const options = { signal: events.signal };

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600);
}
function label(id, text) { $(id).setAttribute('aria-label', text); $(id).title = text; }
function syncMotion() {
  const paused = scene?.paused ?? true;
  $('motion').innerHTML = paused ? icons.play : icons.pause;
  $('motion').setAttribute('aria-pressed', String(paused));
  label('motion', paused ? 'เล่นการเคลื่อนไหว' : 'หยุดการเคลื่อนไหว');
}
function fail(message) {
  document.body.classList.remove('ready');
  document.body.classList.add('failed');
  $('fallback').hidden = false;
  $('fallback-detail').textContent = message;
  $('hint').classList.remove('visible');
  for (const id of ['motion', 'light', 'reset']) $(id).disabled = true;
}
function start(force = false) {
  scene?.dispose();
  scene = undefined;
  $('fallback').hidden = true;
  document.body.classList.remove('failed', 'ready');
  try {
    if (params.get('fallback') === '1' && !force) throw new Error('Requested static preview');
    scene = new MangroveScene(canvas, {
      reducedMotion: mediaMotion.matches,
      lowPower: window.matchMedia('(max-width: 700px)').matches || params.get('quality') === 'low',
    });
    syncMotion();
    $('light').innerHTML = icons.sun;
    $('light').setAttribute('aria-pressed', 'false');
    label('light', 'เปลี่ยนเป็นแสงเย็น');
  } catch (error) {
    console.info('Mangrove static fallback:', error.message);
    fail('เบราว์เซอร์หรืออุปกรณ์นี้ยังเปิด WebGL 2 ไม่ได้ คุณยังชมฉากนิ่งได้');
  }
}
canvas.addEventListener('scene-ready', () => {
  document.body.classList.add('ready');
  document.body.classList.remove('failed');
  $('fallback').hidden = true;
  for (const id of ['motion', 'light', 'reset']) $(id).disabled = false;
  $('hint').classList.add('visible');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => $('hint').classList.remove('visible'), 6500);
}, options);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  scene?.setVisible(false);
  fail('การเชื่อมต่อกราฟิกหยุดชั่วคราว กรุณาลองเปิดฉาก 3D อีกครั้ง');
}, options);
canvas.addEventListener('webglcontextrestored', () => start(true), options);
$('retry').addEventListener('click', () => start(true), options);
$('motion').addEventListener('click', () => {
  if (!scene) return;
  scene.setPaused(!scene.paused); syncMotion();
  notify(scene.paused ? 'หยุดการเคลื่อนไหวแล้ว' : 'เปิดการเคลื่อนไหวแล้ว');
}, options);
$('light').addEventListener('click', () => {
  if (!scene) return;
  scene.setWarm(!scene.targetWarm);
  $('light').innerHTML = scene.targetWarm ? icons.sunset : icons.sun;
  $('light').setAttribute('aria-pressed', String(Boolean(scene.targetWarm)));
  label('light', scene.targetWarm ? 'เปลี่ยนเป็นแสงกลางวัน' : 'เปลี่ยนเป็นแสงเย็น');
  notify(scene.targetWarm ? 'แสงเย็น' : 'แสงกลางวัน');
}, options);
$('reset').addEventListener('click', () => { scene?.reset(); notify('กลับมุมมองเริ่มต้นแล้ว'); }, options);

if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { notify('เบราว์เซอร์นี้ไม่อนุญาตให้เปิดเต็มจอ'); }
}, options);
document.addEventListener('fullscreenchange', () => {
  const full = Boolean(document.fullscreenElement);
  $('fullscreen').innerHTML = full ? icons.collapse : icons.expand;
  $('fullscreen').setAttribute('aria-pressed', String(full));
  label('fullscreen', full ? 'ออกจากเต็มจอ' : 'เต็มจอ');
}, options);
function toggleUI() {
  uiHidden = !uiHidden;
  $('toolbar').hidden = uiHidden;
  $('show-ui').hidden = !uiHidden;
  $('hint').classList.remove('visible');
  (uiHidden ? $('show-ui') : $('hide-ui')).focus({ preventScroll: true });
}
$('hide-ui').addEventListener('click', toggleUI, options);
$('show-ui').addEventListener('click', toggleUI, options);
canvas.addEventListener('pointerdown', e => {
  if (!scene || (e.pointerType === 'mouse' && e.button !== 0)) return;
  dragging = true; dragPoint = [e.clientX, e.clientY];
  canvas.setPointerCapture(e.pointerId);
  $('hint').classList.remove('visible');
}, options);
canvas.addEventListener('pointermove', e => {
  if (!scene) return;
  if (dragging) {
    scene.move(-(e.clientX - dragPoint[0]) * .00065, (e.clientY - dragPoint[1]) * .0003);
    dragPoint = [e.clientX, e.clientY];
  } else {
    scene.pointer = [(e.clientX / innerWidth - .5) * 2, (.5 - e.clientY / innerHeight) * 2];
    if (!scene.paused) scene.requestRender();
  }
}, options);
const stopDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', stopDrag, options);
canvas.addEventListener('pointercancel', stopDrag, options);
canvas.addEventListener('lostpointercapture', stopDrag, options);
canvas.addEventListener('pointerleave', () => { if (scene) scene.pointer = [0, 0]; }, options);
canvas.addEventListener('wheel', e => {
  if (!scene) return;
  e.preventDefault();
  scene.zoom(e.deltaY * .012);
}, { ...options, passive: false });
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key.toLowerCase() === 'h' && !document.body.classList.contains('clean')) { e.preventDefault(); toggleUI(); }
  if (e.target !== canvas || !scene) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Home', '+', '-'].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft') scene.move(-.025, 0);
  if (e.key === 'ArrowRight') scene.move(.025, 0);
  if (e.key === 'ArrowUp') scene.move(0, .012);
  if (e.key === 'ArrowDown') scene.move(0, -.012);
  if (e.key === '+') scene.zoom(-2);
  if (e.key === '-') scene.zoom(2);
  if (e.key === 'Home') scene.reset();
  if (e.key === ' ') { scene.setPaused(!scene.paused); syncMotion(); }
}, options);
const resizeObserver = new ResizeObserver(() => { try { scene?.resize(); } catch { fail('หน่วยความจำกราฟิกไม่เพียงพอ ลองเปิดฉากอีกครั้ง'); } });
resizeObserver.observe(canvas);
document.addEventListener('visibilitychange', () => scene?.setVisible(!document.hidden), options);
mediaMotion.addEventListener('change', () => {
  if (!scene) return;
  scene.reducedMotion = mediaMotion.matches;
  if (mediaMotion.matches) { scene.setPaused(true); syncMotion(); }
}, options);
window.addEventListener('pagehide', event => {
  if (event.persisted) scene?.setVisible(false);
  else {
    events.abort(); resizeObserver.disconnect(); scene?.dispose();
    clearTimeout(toastTimer); clearTimeout(hintTimer);
  }
});
window.addEventListener('pageshow', event => { if (event.persisted) scene?.setVisible(!document.hidden); });
start();
