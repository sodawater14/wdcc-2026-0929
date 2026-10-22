/** Horizontal Blinds adapted from Hiroki / Codrops Scroll-Transition (MIT).
 * https://github.com/Hiro-kiii/Scroll-Transition/
 * Original 30 pairs, bottom-up ordering, 0.02 stagger and power3.out.
 * The mask cuts away the photograph AND matte to reveal the live report DOM.
 * License: vendor/Scroll-Transition-LICENSE.txt
 */
import {loadScrollTrigger} from './taste.js?v=taste-3';
const SESSION_KEY='wdcc-0929-cover-v1';
const SVG_NS='http://www.w3.org/2000/svg';

export class CoverIntro{
  constructor(){
    this.root=document.querySelector('#cover-intro');this.home=document.querySelector('#home');
    if(!document.documentElement.classList.contains('cover-pending')){this.root?.remove();return;}
    this.finished=false;this.active=false;this.homeReady=Boolean(document.querySelector('#grid .card'));
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');this.reduced=this.motion.matches;
    this.viewport=this.root.querySelector('.cover-viewport');this.svg=this.root.querySelector('svg');
    this.homeInert=this.home.inert;this.homeAria=this.home.getAttribute('aria-hidden');
    this.home.inert=true;this.home.setAttribute('aria-hidden','true');
    this.originalRestoration=history.scrollRestoration;history.scrollRestoration='manual';
    window.scrollTo(0,0);
    this.onReady=()=>{this.homeReady=true;this.startIfReady();};
    this.onFailure=()=>this.finish('fallback');
    this.onHash=()=>{if(location.hash==='#taste')this.finish('route');};
    this.onResize=()=>{cancelAnimationFrame(this.resizeFrame);this.resizeFrame=requestAnimationFrame(()=>this.resize());};
    this.onMotion=()=>{if(this.active)this.finish('reduced');};
    this.skip=()=>this.finish('skip');
    window.addEventListener('wdcc:home-ready',this.onReady);
    window.addEventListener('wdcc:home-failed',this.onFailure);
    window.addEventListener('wdcc:cover-failed',this.onFailure);
    window.addEventListener('hashchange',this.onHash);
    window.addEventListener('resize',this.onResize);
    this.motion.addEventListener('change',this.onMotion);
    this.root.querySelector('.cover-skip').addEventListener('click',this.skip);
    this.prepare();
  }
  async prepare(){
    const image=new Image();
    const readyImage=new Promise((resolve,reject)=>{
      image.onload=()=>resolve();image.onerror=()=>reject(new Error('Cover image unavailable'));
      image.src=new URL('./assets/intro/meeting.webp',import.meta.url).href;
    });
    try{
      if(!window.gsap)throw new Error('GSAP unavailable');
      const dependencies=await Promise.all([readyImage,this.reduced?Promise.resolve(null):loadScrollTrigger()]);
      if(this.finished)return;
      this.plugin=dependencies[1];this.prepared=true;this.startIfReady();
    }catch(error){
      console.warn('Opening cover unavailable; reports remain accessible.',error);this.finish('fallback');
    }
  }
  startIfReady(){
    if(this.finished||this.active||!this.prepared||!this.homeReady)return;
    clearTimeout(window.__wdccCoverFailsafe);this.active=true;
    document.documentElement.classList.add('cover-running');window.scrollTo(0,0);
    this.viewport.focus({preventScroll:true});
    if(this.reduced){
      this.resize();
      // A single native scroll (including keyboard) requests the short fade.
      this.onReducedScroll=()=>{if(scrollY>0)this.finish('reduced');};
      window.addEventListener('scroll',this.onReducedScroll,{passive:true});
      return;
    }
    window.gsap.registerPlugin(this.plugin);
    this.onPluginRefresh=()=>{
      if(this.finished||this.pendingResizeY===undefined)return;
      const y=this.pendingResizeY;this.pendingResizeY=undefined;
      window.scrollTo(0,y);this.plugin.update();
    };
    this.plugin.addEventListener('refresh',this.onPluginRefresh);this.resize();
  }
  resize(){
    if(this.finished)return;
    const width=this.viewport.clientWidth,height=this.viewport.clientHeight;
    this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    for(const el of this.svg.querySelectorAll('mask,.cover-mask-base,.cover-matte,.cover-photo')){
      el.setAttribute('width',width);el.setAttribute('height',height);
    }
    if(!this.active||this.reduced)return;
    const progress=this.visualProgress||0;
    const scrollProgress=this.scrollProgress;
    this.layoutWidth=width;this.layoutHeight=height;
    this.trigger?.kill();this.timeline?.kill();
    const group=this.svg.querySelector('.cover-blinds');group.replaceChildren();
    const pairs=[],stripe=height/30;
    for(let i=0;i<30;i++){
      const center=height-(i+.5)*stripe;
      const pair={center,half:stripe/2};
      for(const side of ['top','bottom']){
        const rect=document.createElementNS(SVG_NS,'rect');
        for(const [key,value] of Object.entries({x:0,y:center,width,height:0,fill:'black','shape-rendering':'crispEdges'}))rect.setAttribute(key,value);
        group.append(rect);pair[side]=rect;
      }
      pairs.push(pair);
    }
    this.timeline=window.gsap.timeline({paused:true,onUpdate:()=>{
      if(this.viewport.clientHeight===this.layoutHeight&&this.viewport.clientWidth===this.layoutWidth)this.visualProgress=this.timeline.progress();
      if(!this.finished&&this.timeline.progress()>=.99999&&this.trigger?.progress>=.99999){
        cancelAnimationFrame(this.finishFrame);this.finishFrame=requestAnimationFrame(()=>this.finish('complete'));
      }
    }}).to(pairs.flatMap(b=>[b.top,b.bottom]),{
      attr:{y:i=>{const b=pairs[Math.floor(i/2)];return i%2===0?b.center-b.half:b.center;},
        height:i=>pairs[Math.floor(i/2)].half+.5},
      duration:.5,ease:'power3.out',stagger:{each:.02,from:'start'}
    },0);
    this.timeline.progress(progress);
    if(scrollProgress!==undefined){
      this.pendingResizeY=height*1.5*scrollProgress;
      window.scrollTo(0,this.pendingResizeY);
      clearTimeout(this.resizeExpiry);this.resizeExpiry=setTimeout(()=>{this.pendingResizeY=undefined;},600);
    }
    this.trigger=this.plugin.create({trigger:this.root,start:'top top',end:()=>`+=${this.viewport.clientHeight*1.5}`,
      animation:this.timeline,scrub:1,invalidateOnRefresh:true,onUpdate:trigger=>{
        if(this.viewport.clientHeight===this.layoutHeight&&this.viewport.clientWidth===this.layoutWidth)this.scrollProgress=trigger.progress;
      }});
    this.trigger.refresh();
  }
  finish(reason){
    if(this.finished)return;this.finished=true;this.active=false;
    clearTimeout(window.__wdccCoverFailsafe);
    clearTimeout(this.resizeExpiry);
    cancelAnimationFrame(this.resizeFrame);cancelAnimationFrame(this.finishFrame);
    this.trigger?.kill();this.timeline?.kill();
    if(this.onPluginRefresh)this.plugin.removeEventListener('refresh',this.onPluginRefresh);
    window.removeEventListener('wdcc:home-ready',this.onReady);
    window.removeEventListener('wdcc:home-failed',this.onFailure);
    window.removeEventListener('wdcc:cover-failed',this.onFailure);
    window.removeEventListener('hashchange',this.onHash);
    window.removeEventListener('resize',this.onResize);
    window.removeEventListener('scroll',this.onReducedScroll);
    this.motion.removeEventListener('change',this.onMotion);
    try{sessionStorage.setItem(SESSION_KEY,'done');}catch{}
    const reveal=()=>{
      const focused=this.root.contains(document.activeElement);
      this.root.remove();document.documentElement.classList.remove('cover-pending','cover-running');
      this.home.inert=this.homeInert;
      if(this.homeAria===null)this.home.removeAttribute('aria-hidden');else this.home.setAttribute('aria-hidden',this.homeAria);
      window.scrollTo(0,0);history.scrollRestoration=this.originalRestoration;
      if(focused&&reason!=='route'){
        const previous=this.home.getAttribute('tabindex');this.home.setAttribute('tabindex','-1');this.home.focus({preventScroll:true});
        if(previous===null)this.home.removeAttribute('tabindex');else this.home.setAttribute('tabindex',previous);
      }
      window.dispatchEvent(new CustomEvent('wdcc:cover-complete',{detail:{reason}}));
    };
    if(reason==='reduced'&&window.gsap)window.gsap.to(this.viewport,{opacity:0,duration:.15,onComplete:reveal});
    else reveal();
  }
}
new CoverIntro();
