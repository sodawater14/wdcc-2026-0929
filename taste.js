/** Five selected effects adapted from Codrops OnScrollTextHighlight (MIT).
 * Source: https://github.com/codrops/OnScrollTextHighlight/
 * License: vendor/OnScrollTextHighlight-LICENSE.txt
 * Chinese grapheme wrapping and view lifecycle are specific to this site.
 * This module never accesses report, image, audio or submission state.
 */
let scrollTriggerLoading;
export function loadScrollTrigger(){
  if(window.ScrollTrigger)return Promise.resolve(window.ScrollTrigger);
  if(!scrollTriggerLoading){
    scrollTriggerLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=new URL('./vendor/ScrollTrigger.min.js',import.meta.url).href;
      script.onload=()=>window.ScrollTrigger?resolve(window.ScrollTrigger):reject(new Error('ScrollTrigger unavailable'));
      script.onerror=()=>{script.remove();reject(new Error('ScrollTrigger failed to load'));};
      document.head.append(script);
    }).catch(error=>{scrollTriggerLoading=null;throw error;});
  }
  return scrollTriggerLoading;
}

class TasteHighlights{
  constructor(root,gsap,ScrollTrigger){
    this.entries=[];this.gsap=gsap;
    gsap.registerPlugin(ScrollTrigger);
    const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'grapheme'}):null;
    try{
      for(const mark of root.querySelectorAll('.taste-highlight')){
        const text=mark.textContent;
        const entry={mark,text,timeline:null,trigger:null,pending:null};this.entries.push(entry);
        const spoken=document.createElement('span');spoken.className='sr-only';spoken.textContent=text;
        const visual=document.createElement('span');visual.className='taste-visual';visual.setAttribute('aria-hidden','true');
        const segments=segmenter?[...segmenter.segment(text)].map(s=>s.segment):Array.from(text);
        for(const char of segments){
          const wrapper=document.createElement('span');wrapper.className='taste-char';
          const glyph=document.createElement('span');glyph.className='taste-glyph';glyph.textContent=char;wrapper.append(glyph);
          if(mark.dataset.effect==='9'){
            const ghost=document.createElement('span');ghost.className='taste-ghost';ghost.textContent=char;wrapper.append(ghost);
          }
          visual.append(wrapper);
        }
        mark.replaceChildren(spoken,visual);
        entry.chars=[...mark.querySelectorAll('.taste-glyph')];entry.ghosts=[...mark.querySelectorAll('.taste-ghost')];
        this.reset(entry);
        // Visibility, rather than a percentage reading line: a visible word near
        // the bottom of a short/zoomed viewport must still reveal without scrolling.
        entry.trigger=ScrollTrigger.create({trigger:mark,start:'top bottom-=24',end:'bottom top+=24',
          onEnter:()=>this.queue(entry),onEnterBack:()=>this.queue(entry),
          onLeave:()=>this.reset(entry),onLeaveBack:()=>this.reset(entry)});
      }
      ScrollTrigger.refresh();
    }catch(error){this.destroy();throw error;}
  }
  reset(entry){
    entry.pending?.kill();entry.pending=null;
    const {mark,chars,ghosts}=entry;entry.timeline?.kill();
    this.gsap.set([...chars,...ghosts],{clearProps:'all'});
    this.gsap.set(mark,{'--taste-fill':0,color:'#171717'});
  }
  queue(entry){
    this.reset(entry);
    entry.pending=this.gsap.delayedCall(.6,()=>{entry.pending=null;this.play(entry);});
  }
  play(entry){
    this.reset(entry);
    const {mark,chars,ghosts}=entry,gsap=this.gsap;
    const effect=mark.dataset.effect;
    const tl=entry.timeline=gsap.timeline({onComplete:()=>gsap.set([...chars,...ghosts],{clearProps:'willChange'})});
    if(effect==='3'){
      tl.to(chars,{opacity:0,scale:.8,duration:.5,stagger:.06,ease:'power1.inOut'})
        .to(chars,{opacity:1,scale:1,color:'#ff0000',textShadow:'0px 0px 18px rgba(255,0,0,.32)',duration:.5,stagger:.06},.5);
    }else if(effect==='5'){
      tl.fromTo(chars,{scale:1.3,opacity:0},{scale:1,opacity:1,duration:.4,stagger:.05,ease:'power1.out'},0)
        .to(mark,{'--taste-fill':1,color:'#fff',duration:.8,ease:'expo.out'},0);
    }else if(effect==='6'){
      tl.to(chars,{opacity:0,duration:.1,stagger:{each:.06,from:'end'}})
        .to(chars,{opacity:1,duration:.1,stagger:.05},'+=.1')
        .to(mark,{'--taste-fill':1,color:'#fff',duration:1,ease:'power4.out'},'<');
    }else if(effect==='7'){
      tl.fromTo(chars,{scaleY:0,transformOrigin:'50% 80%'},{scaleY:1,duration:.2,stagger:.05,ease:'sine.out'})
        .to(mark,{'--taste-fill':1,color:'#fff',duration:.7,ease:'sine.inOut'},0);
    }else if(effect==='9'){
      // A fixed flow box per grapheme keeps long Chinese highlights wrapping normally.
      const rotations=chars.map(()=>gsap.utils.random(-35,35));
      tl.set(mark,{color:'#9900ff'},0)
        .fromTo(chars,{opacity:0,yPercent:80,rotation:i=>rotations[i]},
          {opacity:1,yPercent:0,rotation:0,duration:.2,stagger:.04,ease:'sine.out'},0)
        .fromTo(ghosts,{opacity:.65,xPercent:0,yPercent:0,scale:1,rotation:0},
          {opacity:0,xPercent:()=>gsap.utils.random(-15,15),yPercent:()=>gsap.utils.random(-130,-50),
            rotation:i=>-rotations[i],scale:()=>gsap.utils.random(1,1.6),duration:1,stagger:.04,ease:'expo.out'},0);
    }
  }
  destroy(){
    for(const entry of this.entries){
      entry.trigger?.kill();entry.timeline?.kill();entry.pending?.kill();
      entry.mark.replaceChildren(document.createTextNode(entry.text));entry.mark.removeAttribute('style');
    }
    this.entries=[];
  }
}

export class TasteView{
  constructor(home,root,canEnter){
    this.home=home;this.root=root;this.canEnter=canEnter;this.showing=false;this.switching=false;
    this.homeY=Number(history.state?.wdccHomeY)||0;this.effectsVersion=0;this.effect=null;
    this.enter=document.querySelector('#taste-enter');this.back=root.querySelector('#taste-back');
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    this.motion.addEventListener('change',()=>{if(this.showing)this.mountEffects();});
    this.enter.addEventListener('click',event=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();if(this.switching||!canEnter())return;
      this.homeY=scrollY;
      history.replaceState({...history.state,wdccHomeY:this.homeY},'');
      history.pushState({...history.state,wdccTasteEntry:true},'','#taste');this.reconcile();
    });
    this.back.addEventListener('click',event=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();if(this.switching)return;
      if(history.state?.wdccTasteEntry)history.back();
      else{history.replaceState({...history.state,wdccTasteEntry:false},'',location.pathname+location.search);this.reconcile();}
    });
    window.addEventListener('popstate',()=>this.reconcile());
    window.addEventListener('hashchange',()=>this.reconcile());
    if(location.hash==='#taste')this.reconcile(true);
  }
  clearEffects(){this.effectsVersion++;this.effect?.destroy();this.effect=null;}
  async mountEffects(){
    this.clearEffects();
    if(!this.showing||this.motion.matches||!window.gsap){this.root.classList.remove('taste-awaiting');return;}
    this.root.classList.add('taste-awaiting');
    const version=this.effectsVersion;
    try{
      const plugin=await loadScrollTrigger();
      if(!this.showing||this.motion.matches||version!==this.effectsVersion)return;
      this.effect=new TasteHighlights(this.root,window.gsap,plugin);
      this.root.classList.remove('taste-awaiting');
    }catch(error){
      if(version===this.effectsVersion)this.root.classList.remove('taste-awaiting');
      console.warn('Taste highlights unavailable; complete static text remains visible.',error);
    }
  }
  fade(element,enter,instant){
    if(instant||this.motion.matches||!window.gsap)return Promise.resolve();
    return new Promise(resolve=>{
      if(enter)window.gsap.fromTo(element,{opacity:0,y:18},{opacity:1,y:0,duration:.5,ease:'power2.out',clearProps:'opacity,transform',onComplete:resolve});
      else window.gsap.to(element,{opacity:0,y:-14,duration:.3,ease:'power2.in',onComplete:resolve});
    });
  }
  async reconcile(instant=false){
    // popstate and hashchange may fire together. Read the latest hash after each transition.
    if(this.switching)return;
    const wanted=location.hash==='#taste';if(wanted===this.showing)return;
    if(wanted&&!this.canEnter()){
      history.replaceState(history.state,'',location.pathname+location.search);return;
    }
    this.switching=true;document.body.classList.add('taste-switching');
    const oldRestoration=history.scrollRestoration;history.scrollRestoration='manual';
    const source=wanted?this.home:this.root,target=wanted?this.root:this.home;
    source.inert=true;
    try{
      if(!wanted)this.clearEffects();
      await this.fade(source,false,instant);
      source.hidden=true;source.style.removeProperty('opacity');source.style.removeProperty('transform');source.inert=false;
      this.root.classList.toggle('taste-awaiting',wanted&&!this.motion.matches&&Boolean(window.gsap));
      target.hidden=false;target.inert=true;this.showing=wanted;
      document.title=wanted?'品味 — WDCC 9.29':'WDCC 2026 / 9.29 TJU';
      document.body.classList.toggle('in-taste',wanted);
      const y=wanted?0:(Number(history.state?.wdccHomeY)||this.homeY);
      window.scrollTo(0,y);
      await this.fade(target,true,instant);
      target.inert=false;
      (wanted?this.back:this.enter).focus({preventScroll:true});
      if(wanted)this.mountEffects();
      else window.scrollTo(0,y);
    }finally{
      source.inert=false;target.inert=false;this.switching=false;
      document.body.classList.remove('taste-switching');history.scrollRestoration=oldRestoration;
    }
    if((location.hash==='#taste')!==this.showing)this.reconcile();
  }
}
