import {ImageZoom} from './image-zoom.js?v=zoom-1';
import {configureMedia,mediaURL,alternateMediaURL,setMediaImage,cancelMediaImage} from './media-loader.js?v=range-3';
import {PersonalSummary} from './personal-summary.js';
import {AudioRing} from './audio-ring.js?v=range-3';
import {ShareForm} from './share.js';
import {CurvedScrollbar} from './curved-scrollbar.js';
const $ = (selector) => document.querySelector(selector);
const home = $('#home'), detail = $('#detail'), grid = $('#grid');
const gallery = $('#gallery'), track = $('#gallery-track'), bg = $('#transition-bg');
const panels = {ai:$('#panel-ai'), share:$('#panel-share')};
const shareForm=new ShareForm(panels.share);
const personalSummary=new PersonalSummary($('#personal-summary'),()=>refreshCurvedScrollbars());
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cache = new Map();
const numberAnimations = new WeakMap();
let reports = [], current = null, activeCard = null, currentImage = 0;
let busy = false, moving = false, homeScroll = 0, slots = [], toastTimer;
let wheelGesture = false, wheelTimer, drag = null;
let freshViews = new Set();
let activeView = null;
let curvedScrollbars = [];
let scrollbarFrame = 0;
const audio = new Audio();
audio.preload='none';
let audioRequest=0, audioFallbackTimer, audioWantsPlayback=false;
const audioFallbackSources=new Set();
let galleryImages=new Set();
new ImageZoom(gallery,()=>Boolean(current)&&!busy&&!moving);
const audioRing=new AudioRing(audio,$('#audio-control'),()=>playAudio(),(time,resume)=>fallbackAudio(time,resume));
function prepareAudio(){
  if(!current)return;
  if(!audio.getAttribute('src')||audio.error){
    const retry=Boolean(audio.error);
    if(retry)audioFallbackSources.clear();
    audio.preload='metadata';
    audio.src=mediaURL(current.audio.src)+(retry?`&retry=${++audioRequest}`:'');audio.load();
    watchAudioSource();
  }
}
function fallbackAudio(targetTime,shouldResume){
  clearTimeout(audioFallbackTimer);
  if(!current)return false;
  const alternative=alternateMediaURL(current.audio.src,audio.src);
  // Pages has a repository prefix; the edge host serves the same asset at root.
  // Compare origins, not pathnames, and never cycle failed sources.
  if(new URL(audio.src).origin===new URL(alternative).origin||audioFallbackSources.has(alternative))return false;
  const report=current,request=++audioRequest,time=targetTime??audio.currentTime??0,resume=shouldResume??(audioWantsPlayback&&!audioRing.drag);
  audioFallbackSources.add(audio.src);audioFallbackSources.add(alternative);
  audio.src=alternative;audio.load();
  audio.addEventListener('loadedmetadata',()=>{
    if(current!==report||request!==audioRequest)return;
    if(time)audio.currentTime=Math.min(time,audio.duration);
    if(resume)playAudio();
  },{once:true});
  return true;
}
function watchAudioSource(){
  clearTimeout(audioFallbackTimer);
  const report=current;
  audioFallbackTimer=setTimeout(()=>{
    if(!report||current!==report)return;
    if(!audio.readyState||audio.seeking||(audioWantsPlayback&&audio.readyState<3)){
      if(fallbackAudio())watchAudioSource();
      else audioUI(false,'目标位置加载较慢，请稍候或点击播放重试');
    }
  },6000);
}
audio.addEventListener('loadedmetadata',()=>clearTimeout(audioFallbackTimer));
function audioUI(playing=false,message='') {
  $('#audio-toggle').classList.toggle('playing',playing);
  $('#audio-toggle').setAttribute('aria-pressed',String(playing));
  $('#audio-toggle').setAttribute('aria-label',playing?'暂停录音':'播放录音');
  $('#audio-status').textContent=message;
}
function resetAudio(unload=false) {
  audioRequest++;
  audioWantsPlayback=false;audioFallbackSources.clear();clearTimeout(audioFallbackTimer);
  audioRing.reset();
  audio.pause();
  try{audio.currentTime=0;}catch{}
  if(!unload && audio.getAttribute('src') && audio.readyState===0)audio.load();
  if(unload){audio.removeAttribute('src');audio.load();}
  audioUI();
  audioRing.refresh();
}
async function playAudio(){
  if(!current)return;
  prepareAudio();
  const request=++audioRequest;
  const report=current;
  audioWantsPlayback=true;
  audioUI(false,'加载中…');
  try {
    if(audio.ended)audio.currentTime=0;
    await audio.play();
    if(request!==audioRequest || current!==report)return;
    audioUI(true);
  }catch(error){if(request===audioRequest)audioUI(false,'录音暂时无法播放，请点击重试');}
}
$('#audio-toggle').addEventListener('click',()=>{
  audioRing.cancel(false);
  if(!audio.paused&&!audio.error){audioWantsPlayback=false;audioRequest++;audio.pause();return;}
  if(audio.readyState<3)audioFallbackSources.clear();
  playAudio();
});
audio.addEventListener('seeking',()=>{audioUI(false,'正在定位…');watchAudioSource();});
audio.addEventListener('waiting',()=>{audioUI(false,audio.seeking?'正在定位…':'缓冲中…');watchAudioSource();});
audio.addEventListener('stalled',()=>{if(audio.seeking||audioWantsPlayback)watchAudioSource();});
audio.addEventListener('seeked',()=>{
  clearTimeout(audioFallbackTimer);
  if(audioWantsPlayback&&audio.readyState<3)watchAudioSource();
  audioUI(!audio.paused);
});
audio.addEventListener('playing',()=>{clearTimeout(audioFallbackTimer);audioFallbackSources.clear();audioUI(true);});
audio.addEventListener('pause',()=>audioUI(false,audio.error?'录音暂时无法播放，请点击重试':''));
audio.addEventListener('ended',()=>{audioWantsPlayback=false;audioUI();});
audio.addEventListener('error',()=>{if(audio.getAttribute('src')&&!fallbackAudio())audioUI(false,'录音暂时无法播放，请点击重试');});
window.addEventListener('pagehide',()=>resetAudio(true));
const gsapReady = () => Boolean(window.gsap && window.Flip);
const duration = (seconds) => reduceMotion.matches ? .12 : seconds;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2400);
}

function renderHome() {
  grid.innerHTML = reports.map((report, i) => `
    <button class="card" data-id="${report.id}" style="--angle:${i % 2 ? -4 : 2}deg" aria-label="${report.code} ${escapeText(report.title)}，${escapeText(report.speaker)}，${report.time}${report.enabled ? '' : '，后续开放'}">
      <span class="card-bg"></span>
      <img class="card-photo" src="${mediaURL(report.cover.src)}" width="${report.cover.width}" height="${report.cover.height}" alt="${escapeText(report.title)}" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async">
      <span class="card-time">${report.time}</span>
      <span class="card-number">${[...report.code].map(c=>`<span>${c}</span>`).join('')}</span>
    </button>`).join('');
  grid.querySelectorAll('.card').forEach(card => {
    const report=reports.find(r=>r.id===Number(card.dataset.id));
    setMediaImage(card.querySelector('.card-photo'),report.cover.src,report.id<=3?'high':'low');
    card.addEventListener('click', () => openReport(Number(card.dataset.id), card));
    card.addEventListener('pointermove', event => {
      if (busy || !gsapReady() || reduceMotion.matches || event.pointerType === 'touch') return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      gsap.to(card.querySelector('.card-photo'), {x:x*25,y:y*18,duration:.8,ease:'power3.out',overwrite:'auto'});
      gsap.to(card.querySelector('.card-time'), {x:x*12,y:-y*10,duration:.8,overwrite:'auto'});
      gsap.to(card.querySelector('.card-number'), {x:-x*12,y:-y*15,duration:.8,overwrite:'auto'});
    });
    card.addEventListener('pointerenter', () => {
      if (busy || !gsapReady() || reduceMotion.matches) return;
      gsap.to(card.querySelector('.card-bg'),{scale:1.06,duration:.7,ease:'power3.out'});
      animateNumber(card,true);
    });
    card.addEventListener('pointerleave', () => {
      resetCard(card);
      if(busy || current || reduceMotion.matches) resetNumber(card);
      else animateNumber(card,false);
    });
  });
}

function escapeText(value) {
  return value.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function resetCard(card, instant=false) {
  if (!gsapReady()) return;
  gsap.to(card.querySelector('.card-bg'),{scale:1,duration:instant?0:.7,overwrite:true});
  gsap.to(card.querySelectorAll('.card-photo,.card-time,.card-number'),{x:0,y:0,duration:instant?0:.8,ease:'power3.out',overwrite:true});
  if(instant) resetNumber(card);
}

function resetNumber(card) {
  numberAnimations.get(card)?.kill();
  numberAnimations.delete(card);
  if(gsapReady()) gsap.set(card.querySelectorAll('.card-number span'),{y:0,yPercent:0,opacity:1});
}

function animateNumber(card, entering) {
  if(!gsapReady()) return;
  numberAnimations.get(card)?.kill();
  if(reduceMotion.matches) {resetNumber(card);return;}
  const letters=card.querySelectorAll('.card-number span');
  const timeline=gsap.timeline({onComplete:()=>numberAnimations.delete(card)});
  numberAnimations.set(card,timeline);
  letters.forEach((letter,index)=>{
    const start=index*.1;
    timeline.to(letter,{yPercent:entering?-50:50,opacity:0,duration:.2,ease:'power1.in'},start)
      .set(letter,{y:0,yPercent:entering?70:-70,opacity:0},start+.2)
      .to(letter,{yPercent:0,opacity:1,duration:entering?.6:1,ease:entering?'expo.out':'elastic.out(1,0.4)'},start+.2);
  });
}

async function getReport(id) {
  if (!cache.has(id)) {
    const response = await fetch(`data/${String(id).padStart(2,'0')}.json`);
    if (!response.ok) throw new Error('报告数据加载失败');
    cache.set(id, await response.json());
  }
  return cache.get(id);
}

function populateReader() {
  clearCurvedScrollbars();
  shareForm.select(current.id);
  detail.dataset.reportId=String(current.id);
  freshViews=new Set(['ai','share']);
  $('#transcript').innerHTML = current.transcript;
  resetAudio(true);
  personalSummary.render(current.personalSummary);
  Object.values(panels).forEach(p=>p.scrollTop=0);
  $('#transcript').scrollTop=0;
  $('#personal-summary').scrollTop=0;
  setTab(null,false);
}

function setTab(name, reveal=true) {
  shareForm.flush();
  if(name==='share')resetAudio();
  if(name==='ai'&&current)prepareAudio();
  audioRing.setVisible(name==='ai');
  activeView=name;
  $('#reader').classList.toggle('collapsed',name===null);
  Object.entries(panels).forEach(([key,panel])=>panel.hidden=key!==name);
  detail.classList.toggle('curved-reading',Boolean(current) && name==='ai');
  if(freshViews.has(name)) {
    panels[name].scrollTop=0;
    panels[name].querySelectorAll('.reading-scroll').forEach(el=>el.scrollTop=0);
    freshViews.delete(name);
  }
  document.querySelectorAll('.tab').forEach(tab=>{
    const selected = tab.dataset.tab===name;
    tab.classList.toggle('active',selected);
    tab.setAttribute('aria-selected',String(selected));
    tab.tabIndex=selected || (name===null && tab.dataset.tab==='ai')?0:-1;
  });
  if(name==='ai' && current)refreshCurvedScrollbars();
  else curvedScrollbars.forEach(scrollbar=>scrollbar.endDrag());
  if (reveal && name!==null) {
    const navTop = $('#tabs').getBoundingClientRect().top + window.scrollY;
    if (window.scrollY < navTop - 1) window.scrollTo({top:navTop,behavior:reduceMotion.matches?'instant':'smooth'});
  }
}

function clearCurvedScrollbars() {
  cancelAnimationFrame(scrollbarFrame);
  curvedScrollbars.forEach(scrollbar=>scrollbar.destroy());
  curvedScrollbars=[];
}

function refreshCurvedScrollbars() {
  cancelAnimationFrame(scrollbarFrame);
  scrollbarFrame=requestAnimationFrame(()=>{
    if(!current || activeView!=='ai' || detail.hidden)return;
    if(!curvedScrollbars.length) {
      try {
        for(const content of [$('#transcript'),$('#personal-summary')])curvedScrollbars.push(new CurvedScrollbar(content));
      } catch(error) {
        clearCurvedScrollbars();
        console.warn('Curved scrollbar unavailable; using native scrolling.',error);
      }
    }
    curvedScrollbars.forEach(scrollbar=>scrollbar.refresh());
  });
}
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>setTab(activeView===tab.dataset.tab?null:tab.dataset.tab)));
$('#tabs').addEventListener('keydown',event=>{
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  const tabs=[...document.querySelectorAll('.tab')];
  const index=tabs.indexOf(document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
  setTab(tabs[next].dataset.tab,false);tabs[next].focus();
});

function normalize(index) {return (index+current.images.length)%current.images.length;}
function stepWidth() {return window.innerWidth*.766;}
function imageRect(image, frame) {
  const ratio=Math.min(frame.width/image.width,frame.height/image.height);
  const width=image.width*ratio, height=image.height*ratio;
  return {left:frame.left+(frame.width-width)/2,top:frame.top+(frame.height-height)/2,width,height};
}

function buildGallery() {
  if (gsapReady()) gsap.killTweensOf(slots);
  for(const image of galleryImages)cancelMediaImage(image);galleryImages.clear();
  track.replaceChildren();slots=[];moving=false;
  for(let offset=-2;offset<=2;offset++) {
    const index=normalize(currentImage+offset), image=current.images[index];
    const figure=document.createElement('figure');
    figure.className='slide pending';figure.dataset.offset=offset;figure.dataset.index=index;
    figure.style.transform=`translateX(${offset*stepWidth()}px)`;
    figure.style.opacity=offset===0?'1':'.25';
    figure.setAttribute('aria-hidden',String(offset!==0));
    const pageNumber=document.createElement('figcaption');
    pageNumber.className='slide-page';pageNumber.textContent=String(index+1);
    pageNumber.setAttribute('aria-hidden','true');figure.append(pageNumber);
    if(Math.abs(offset)<=1) {
      const img=new Image();img.alt=`${current.title} — ${index+1} / ${current.images.length}`;
      img.width=image.width;img.height=image.height;img.draggable=false;
      galleryImages.add(img);figure.append(img);
      const preview=index===0?(activeCard?.querySelector('.card-photo').currentSrc||reports.find(r=>r.id===current.id).cover.src):(image.preview?.src||image.src);
      let fallback=false;
      img.addEventListener('load',()=>figure.classList.remove('pending'));
      img.addEventListener('error',()=>{
        if(!fallback){fallback=true;setMediaImage(img,image.src,offset===0?'high':'low');return;}
        figure.classList.remove('pending');img.remove();
        const retry=document.createElement('span');retry.className='image-retry';
        retry.textContent='图片加载失败，请按左右方向键切换后重试';figure.append(retry);
      });
      if(offset===0){
        img.addEventListener('load',()=>{
          const full=new Image();galleryImages.add(full);
          full.onload=()=>{if(img.isConnected)img.src=full.src;};
          // Keep a readable preview if the high-resolution request fails.
          setMediaImage(full,image.src,'high');
        },{once:true});
      }
      setMediaImage(img,preview,offset===0?'high':'low');
    }
    track.append(figure);slots.push(figure);
  }
  $('#gallery-status').textContent=`${current.title}，第 ${currentImage+1} 张，共 ${current.images.length} 张`;
}

function changeImage(direction) {
  if (!current || busy || moving) return;
  moving=true;
  if(!gsapReady()) {currentImage=normalize(currentImage+direction);buildGallery();return;}
  const timeline=gsap.timeline({onComplete:()=>{currentImage=normalize(currentImage+direction);buildGallery();}});
  slots.forEach(slide=>{
    const destination=Number(slide.dataset.offset)-direction;
    timeline.to(slide,{x:destination*stepWidth(),opacity:destination===0?1:.25,duration:duration(.55),ease:'power3.inOut'},0);
  });
}

gallery.addEventListener('wheel',event=>{
  if (!current || busy || event.ctrlKey) return;
  event.preventDefault();
  const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
  if(Math.abs(delta)<2) return;
  clearTimeout(wheelTimer);
  wheelTimer=setTimeout(()=>wheelGesture=false,220);
  if(wheelGesture) return;
  wheelGesture=true;
  changeImage(delta>0?1:-1);
},{passive:false});
gallery.addEventListener('pointerdown',event=>{
  if(busy||moving||event.button!==0) return;
  drag={x:event.clientX,delta:0};gallery.setPointerCapture(event.pointerId);gallery.classList.add('dragging');
});
gallery.addEventListener('pointermove',event=>{
  if(!drag) return;
  drag.delta=event.clientX-drag.x;
  const displacement=Math.max(-stepWidth(),Math.min(stepWidth(),drag.delta));
  slots.forEach(slide=>{
    const offset=Number(slide.dataset.offset);
    const visual=offset+displacement/stepWidth();
    if(gsapReady())gsap.set(slide,{x:offset*stepWidth()+displacement,opacity:Math.max(.25,1-Math.abs(visual)*.75)});
  });
});
function releaseDrag(event) {
  if(!drag)return;
  const delta=drag.delta;drag=null;gallery.classList.remove('dragging');
  if(gallery.hasPointerCapture(event.pointerId))gallery.releasePointerCapture(event.pointerId);
  if(Math.abs(delta)>55)changeImage(delta<0?1:-1);
  else slots.forEach(slide=>{if(gsapReady())gsap.to(slide,{x:Number(slide.dataset.offset)*stepWidth(),opacity:Number(slide.dataset.offset)===0?1:.25,duration:duration(.3),overwrite:true});});
}
gallery.addEventListener('pointerup',releaseDrag);
gallery.addEventListener('pointercancel',releaseDrag);

function makeClone(src,rect,rotation=0) {
  const clone=new Image();clone.src=src;clone.className='transition-photo';clone.alt='';
  Object.assign(clone.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  document.body.append(clone);
  if(gsapReady())gsap.set(clone,{rotation});
  return clone;
}

async function openReport(id,card) {
  if(busy||current) return;
  const report=reports.find(r=>r.id===id);
  if(!report.enabled){toast('此报告将在后续版本开放');return;}
  clearTimeout(toastTimer);$('#toast').classList.remove('visible');
  busy=true;card.setAttribute('aria-busy','true');
  grid.querySelectorAll('.card').forEach(resetNumber);
  try {
    current=await getReport(id);activeCard=card;homeScroll=window.scrollY;
    resetCard(card,true);
    currentImage=0;populateReader();
    const source=card.querySelector('.card-photo'), rect=source.getBoundingClientRect();
    const backgroundRect=card.getBoundingClientRect();
    detail.hidden=false;detail.style.position='fixed';detail.style.inset='0';detail.style.visibility='hidden';
    buildGallery();
    const targetFrame=slots[2].getBoundingClientRect();
    const target=imageRect(current.images[0],targetFrame);
    document.body.classList.add('animating');
    const finish=()=>{
      home.hidden=true;detail.style.position='';detail.style.inset='';detail.style.visibility='';
      document.body.classList.remove('animating');document.body.classList.add('in-detail');
      $('#transcript').scrollTop=0;$('#personal-summary').scrollTop=0;
      window.scrollTo(0,0);busy=false;document.title=`${report.code} ${report.title} — WDCC 9.29`;
      $('#back').focus({preventScroll:true});
    };
    if(!gsapReady()||reduceMotion.matches){
      finish();
      if(gsapReady())gsap.fromTo(detail,{opacity:0},{opacity:1,duration:.12,clearProps:'opacity'});
      return;
    }
    const clone=makeClone(source.currentSrc,{left:rect.left+(rect.width-source.offsetWidth)/2,top:rect.top+(rect.height-source.offsetHeight)/2,width:source.offsetWidth,height:source.offsetHeight},Number.parseFloat(card.style.getPropertyValue('--angle')));
    const state=Flip.getState(clone);
    Object.assign(clone.style,{left:`${target.left}px`,top:`${target.top}px`,width:`${target.width}px`,height:`${target.height}px`});
    gsap.set(clone,{rotation:0});
    Object.assign(bg.style,{display:'block',left:`${backgroundRect.left}px`,top:`${backgroundRect.top}px`,width:`${backgroundRect.width}px`,height:`${backgroundRect.height}px`});
    gsap.set(bg,{clearProps:'transform',backgroundColor:'#fff'});
    source.style.visibility='hidden';
    const others=[...grid.querySelectorAll('.card')].filter(c=>c!==card).sort((a,b)=>{
      const distance=c=>{const r=c.getBoundingClientRect();return Math.hypot(r.left-backgroundRect.left,r.top-backgroundRect.top);};
      return distance(a)-distance(b);
    });
    gsap.to(others,{opacity:0,scale:.86,duration:duration(.45),stagger:reduceMotion.matches?0:.018,ease:'power2.in'});
    gsap.to(bg,{left:0,top:0,width:innerWidth,height:innerHeight,backgroundColor:'#f1f1f1',duration:duration(.9),ease:'power3.inOut'});
    Flip.from(state,{duration:duration(1),ease:'power3.inOut',onComplete:()=>{
      finish();clone.remove();bg.style.display='none';source.style.visibility='';
      gsap.set(others,{clearProps:'opacity,scale'});
      gsap.fromTo([$('#reader'),$('#back')],{opacity:0},{opacity:1,duration:duration(.3),clearProps:'opacity'});
    }});
  } catch(error) {
    current=null;detail.hidden=true;document.body.classList.remove('animating');busy=false;
    toast('报告加载失败，请再次点击重试');console.error(error);
  } finally {card.removeAttribute('aria-busy');}
}

function closeReport() {
  if(busy||!current)return;
  shareForm.flush();
  resetAudio(true);
  busy=true;moving=false;clearTimeout(wheelTimer);wheelGesture=false;
  clearCurvedScrollbars();
  if(gsapReady())gsap.killTweensOf(slots);
  window.scrollTo(0,0);
  const sourceReport=reports.find(r=>r.id===current.id);
  const frame=slots[2].getBoundingClientRect();
  const sourceRect=imageRect(current.images[currentImage],frame);
  const clone=makeClone(current.images[currentImage].src,sourceRect);
  detail.hidden=true;home.hidden=false;
  document.body.classList.remove('in-detail');document.body.classList.add('animating');
  window.scrollTo(0,homeScroll);
  const photo=activeCard.querySelector('.card-photo');resetCard(activeCard,true);
  const rect=photo.getBoundingClientRect();
  const finish=()=>{
    clone.remove();photo.style.visibility='';bg.style.display='none';document.body.classList.remove('animating');
    document.title='WDCC 2026 / 9.29 TJU';current=null;busy=false;
    activeCard.focus({preventScroll:true});
  };
  if(!gsapReady()||reduceMotion.matches){
    finish();
    if(gsapReady())gsap.fromTo(home,{opacity:0},{opacity:1,duration:.12,clearProps:'opacity'});
    return;
  }
  photo.style.visibility='hidden';
  const state=Flip.getState(clone);
  Object.assign(clone.style,{left:`${rect.left+(rect.width-photo.offsetWidth)/2}px`,top:`${rect.top+(rect.height-photo.offsetHeight)/2}px`,width:`${photo.offsetWidth}px`,height:`${photo.offsetHeight}px`});
  gsap.set(clone,{rotation:parseFloat(activeCard.style.getPropertyValue('--angle'))});
  const bgRect=activeCard.getBoundingClientRect();
  Object.assign(bg.style,{display:'block',left:'0px',top:'0px',width:`${innerWidth}px`,height:`${innerHeight}px`});
  gsap.set(bg,{clearProps:'transform',backgroundColor:'#f1f1f1'});
  gsap.to(bg,{left:bgRect.left,top:bgRect.top,width:bgRect.width,height:bgRect.height,backgroundColor:'#fff',duration:duration(.9),ease:'power3.inOut'});
  const others=[...grid.querySelectorAll('.card')].filter(c=>c!==activeCard);
  gsap.fromTo(others,{opacity:0,scale:.86},{opacity:1,scale:1,duration:duration(.6),delay:duration(.28),stagger:reduceMotion.matches?0:.012,clearProps:'opacity,scale'});
  // Return the report cover even when a later slide was being read.
  setTimeout(()=>{clone.src=sourceReport.cover.src;},duration(.25)*1000);
  Flip.from(state,{duration:duration(1),ease:'power3.inOut',onComplete:finish});
}
$('#back').addEventListener('click',closeReport);
document.addEventListener('keydown',event=>{
  if(!current)return;
  if(event.key==='Escape'){event.preventDefault();closeReport();return;}
  if(['ArrowLeft','ArrowRight'].includes(event.key) && !event.target.closest('#reader') && window.scrollY<innerHeight*.75){
    event.preventDefault();changeImage(event.key==='ArrowRight'?1:-1);
  }
});
let resizeFrame;
window.addEventListener('resize',()=>{
  cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>{if(current&&!busy)buildGallery();});
});

try {
  if(gsapReady())gsap.registerPlugin(Flip);
  const [response,mediaConfig]=await Promise.all([fetch('data/reports.json'),fetch('media-config.json').then(r=>r.ok?r.json():{}).catch(()=>({}))]);
  configureMedia(mediaConfig);
  if(!response.ok)throw new Error('Content not generated');
  reports=await response.json();renderHome();
} catch(error) {
  $('#error').hidden=false;
  $('#error').textContent='内容加载失败。请通过本地服务器打开本页，并确认已生成 data/reports.json。';
  console.error(error);
}
