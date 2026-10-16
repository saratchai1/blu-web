import { MangroveRenderer } from './scene/renderer.js';
import { clamp, mix } from './lib/math.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const saved = key => { try { return localStorage.getItem(`blu:${key}`); } catch { return null; } };
const save = (key,value) => { try { localStorage.setItem(`blu:${key}`,value); } catch { /* Private browsing still works. */ } };
const valid = (value, options, fallback) => options.includes(value) ? value : fallback;
let qualityChoice=valid(params.get('quality') || saved('quality'),['auto','high','low'],'auto');
let light=valid(params.get('light') || saved('light'),['morning','noon','evening'],'morning');
let paused=params.get('motion')==='off' || reducedMotion.matches;
let renderer, running=false, raf=0, lastTime=0, time=0, dirty=true, noticeTimeout;
let yaw=0, pitch=0, zoom=0, targetYaw=0, targetPitch=0, targetZoom=0;
let pointer=[0,0], dragging=false, lastPointer=[0,0];
let slowFrames=0, measuredFrames=0, lastQualityChange=0;
if(params.get('clean')==='1') document.body.classList.add('clean');

function notice(text, persistent=false) {
  clearTimeout(noticeTimeout);
  $('notice').textContent=text;$('notice').hidden=false;
  if(!persistent) noticeTimeout=setTimeout(()=>$('notice').hidden=true,4000);
}
function autoQuality(){
  return (innerWidth<760 || (navigator.hardwareConcurrency || 8)<6 || (navigator.deviceMemory || 8)<4) ? 'low' : 'high';
}
function syncUI(){
  $('quality').value=qualityChoice;
  document.querySelectorAll('[data-light]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.light===light)));
  $('motion').setAttribute('aria-pressed',String(paused));
  const label=paused?'เล่นการเคลื่อนไหว':'หยุดการเคลื่อนไหว';
  $('motion').setAttribute('aria-label',label);$('motion').title=label;
  $('motion-icon').setAttribute('d',paused?'M8 5l11 7-11 7Z':'M9 5v14M15 5v14');
}
function camera(){
  const drift=paused || reducedMotion.matches ? 0 : Math.sin(time*.13)*.09;
  return {
    eye:[Math.sin(yaw)*19+pointer[0]*.16+drift,3.5+pitch*6+(paused?0:Math.sin(time*.55)*.025),28],
    target:[(innerWidth/innerHeight<.9?10:1.2)+Math.sin(yaw)*32+pointer[0]*.2,15.5+pitch*12+pointer[1]*.12,-35],
    fov:(57+zoom)*Math.PI/180,
  };
}
function schedule(){
  dirty=true;
  if(!running && !document.hidden && renderer && !renderer.disposed){running=true;lastTime=performance.now();raf=requestAnimationFrame(frame);}
}
function frame(now){
  running=false;
  if(document.hidden || !renderer || renderer.gl.isContextLost()) return;
  const frameMs=now-lastTime;
  const dt=clamp(frameMs/1000,0,.1);lastTime=now;
  if(!paused) time+=dt;
  const smoothing=reducedMotion.matches?1:1-Math.exp(-dt*9);
  yaw=mix(yaw,targetYaw,smoothing);pitch=mix(pitch,targetPitch,smoothing);zoom=mix(zoom,targetZoom,smoothing);
  const easing=Math.abs(yaw-targetYaw)+Math.abs(pitch-targetPitch)+Math.abs(zoom-targetZoom)>.001;
  if(!paused || dirty || easing){
    const before=performance.now();
    renderer.render(time,camera(),light);
    const renderMs=performance.now()-before;
    if(qualityChoice==='auto' && renderer.quality==='high' && now-lastQualityChange>8000){
      measuredFrames++;
      if(Math.max(renderMs,frameMs)>48) slowFrames++;
      if(measuredFrames>=100){
        if(slowFrames>70){lastQualityChange=now;requestAnimationFrame(()=>initialize('low'));return;}
        measuredFrames=0;slowFrames=0;
      }
    }
    dirty=false;
  }
  if(!paused || easing){running=true;raf=requestAnimationFrame(frame);}
}
function initialize(override){
  cancelAnimationFrame(raf);running=false;
  renderer?.dispose();
  try {
    renderer=new MangroveRenderer(canvas,override || (qualityChoice==='auto'?autoQuality():qualityChoice));
    renderer.render(time,camera(),light);
    canvas.classList.add('ready');canvas.dataset.state='ready';
    canvas.setAttribute('aria-hidden','false');canvas.tabIndex=0;
    $('loader').classList.add('done');$('loader').hidden=true;
    $('fallback').setAttribute('aria-hidden','true');
    for(const id of ['motion','reset','quality']) $(id).disabled=false;
    window.__mangrove={get state(){return canvas.dataset.state;},get stats(){return renderer?.stats;},get time(){return time;},get paused(){return paused;},get light(){return light;},get camera(){return renderer?.lastCamera;}};
    schedule();
  } catch(error) {
    renderer?.dispose();renderer=null;
    canvas.classList.remove('ready');canvas.dataset.state='fallback';
    canvas.setAttribute('aria-hidden','true');canvas.tabIndex=-1;
    $('loader').classList.add('done');$('loader').hidden=true;
    $('fallback').setAttribute('aria-hidden','false');
    $('fallback').setAttribute('role','img');$('fallback').setAttribute('aria-label','ภาพสำรองป่าชายเลน');
    for(const id of ['motion','reset','quality']) $(id).disabled=true;
    notice('เบราว์เซอร์นี้เปิดฉาก 3D ไม่ได้ ขณะนี้แสดงภาพสำรอง ลองเปิดการเร่งกราฟิกหรือใช้เบราว์เซอร์อื่น',true);
    console.warn('Mangrove renderer unavailable:',error instanceof Error?error.message:error);
  }
}
function toggleSettings(open){
  $('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));
  if(open) $('settings').querySelector('button').focus();
}
$('settings-toggle').addEventListener('click',()=>toggleSettings($('settings').hidden));
document.addEventListener('pointerdown',event=>{
  if(!$('settings').hidden && !event.target.closest('#settings,#settings-toggle')) toggleSettings(false);
});
$('motion').addEventListener('click',()=>{paused=!paused;syncUI();schedule();});
document.querySelectorAll('[data-light]').forEach(button=>button.addEventListener('click',()=>{
  light=button.dataset.light;save('light',light);syncUI();schedule();
}));
$('quality').addEventListener('change',()=>{
  qualityChoice=$('quality').value;save('quality',qualityChoice);lastQualityChange=performance.now();
  initialize();syncUI();
});
function resetCamera(){targetYaw=0;targetPitch=0;targetZoom=0;pointer=[0,0];schedule();}
$('reset').addEventListener('click',()=>{resetCamera();notice('กลับมุมมองเริ่มต้นแล้ว');});
$('fullscreen').addEventListener('click',async()=>{
  try {
    if(document.fullscreenElement) await document.exitFullscreen();
    else if($('experience').requestFullscreen) await $('experience').requestFullscreen();
    else notice('เบราว์เซอร์นี้ไม่รองรับปุ่มเต็มหน้าจอ ฉากได้ปรับเต็มพื้นที่หน้าต่างแล้ว');
  } catch {notice('เปิดเต็มหน้าจอไม่ได้ในหน้าต่างนี้ ลองเปิดเว็บในแท็บใหม่');}
});
document.addEventListener('fullscreenchange',()=>{
  const label=document.fullscreenElement?'ออกจากเต็มหน้าจอ':'เต็มหน้าจอ';
  $('fullscreen').setAttribute('aria-label',label);$('fullscreen').title=label;
  renderer?.resize();schedule();
});
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0) return;
  dragging=true;lastPointer=[event.clientX,event.clientY];canvas.setPointerCapture(event.pointerId);
  $('hint').classList.add('faded');
});
canvas.addEventListener('pointermove',event=>{
  if(dragging){
    targetYaw=clamp(targetYaw-(event.clientX-lastPointer[0])*.0016,-.34,.34);
    targetPitch=clamp(targetPitch+(event.clientY-lastPointer[1])*.0013,-.18,.22);
    lastPointer=[event.clientX,event.clientY];
  } else if(!reducedMotion.matches && !paused && event.pointerType==='mouse') {
    pointer=[(event.clientX/innerWidth-.5)*2,-(event.clientY/innerHeight-.5)*2];
  }
  schedule();
});
const release=()=>{dragging=false;};
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
canvas.addEventListener('pointerleave',()=>{if(!dragging){pointer=[0,0];schedule();}});
canvas.addEventListener('wheel',event=>{
  event.preventDefault();targetZoom=clamp(targetZoom+event.deltaY*.009,-12,9);schedule();
},{passive:false});
canvas.addEventListener('keydown',event=>{
  const commands={ArrowLeft:()=>targetYaw=clamp(targetYaw-.035,-.34,.34),ArrowRight:()=>targetYaw=clamp(targetYaw+.035,-.34,.34),ArrowUp:()=>targetPitch=clamp(targetPitch+.025,-.18,.22),ArrowDown:()=>targetPitch=clamp(targetPitch-.025,-.18,.22),'+':()=>targetZoom=clamp(targetZoom-2,-12,9),'-':()=>targetZoom=clamp(targetZoom+2,-12,9),'0':resetCamera,' ':()=>{paused=!paused;syncUI();}};
  if(commands[event.key]){event.preventDefault();commands[event.key]();schedule();}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && !$('settings').hidden){toggleSettings(false);$('settings-toggle').focus();}
});
addEventListener('resize',()=>{renderer?.resize();schedule();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(raf);running=false;}else schedule();
});
reducedMotion.addEventListener('change',event=>{paused=event.matches;syncUI();schedule();});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();cancelAnimationFrame(raf);running=false;
  canvas.classList.remove('ready');canvas.dataset.state='context-lost';
  notice('การเชื่อมต่อกราฟิกหยุดชั่วคราว กำลังรอกู้คืนฉาก',true);
});
canvas.addEventListener('webglcontextrestored',()=>{$('notice').hidden=true;initialize();});
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);running=false;});
addEventListener('pageshow',event=>{if(event.persisted) schedule();});
syncUI();
requestAnimationFrame(()=>initialize());
setTimeout(()=>$('hint').classList.add('faded'),8500);
