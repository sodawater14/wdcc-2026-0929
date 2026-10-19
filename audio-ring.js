const clamp=value=>Math.max(0,Math.min(1,value));
const format=value=>{
  if(!Number.isFinite(value))return '--:--';
  const seconds=Math.max(0,Math.floor(value));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
};

/** A seek control for the existing shared audio element; never owns a second player. */
export class AudioRing {
  constructor(audio,root,resume,recover=()=>false){
    this.audio=audio;this.root=root;this.resume=resume;this.recover=recover;this.seekResume=false;
    this.slider=root.querySelector('[role="slider"]');
    this.progress=root.querySelector('.audio-progress');
    this.dot=root.querySelector('.audio-progress-dot');
    this.hint=root.querySelector('.audio-time');
    this.drag=null;this.pending=null;this.frame=0;this.visible=false;
    for(const event of ['loadedmetadata','durationchange','timeupdate','seeked','emptied','pause','ended'])audio.addEventListener(event,()=>this.refresh());
    audio.addEventListener('seeking',()=>{if(this.pending===null)this.pending=this.audio.currentTime;this.refresh();});
    audio.addEventListener('seeked',()=>{
      if(this.pending!==null&&Math.abs(this.audio.currentTime-this.pending)>1){
        if(this.recover(this.pending,this.seekResume)){this.refresh();return;}
      }
      this.pending=null;this.refresh();
    });
    audio.addEventListener('playing',()=>{this.refresh();this.animate();});
    audio.addEventListener('error',()=>{this.cancel(false);this.refresh();});
    this.slider.addEventListener('pointerdown',event=>this.start(event));
    this.slider.addEventListener('pointermove',event=>this.move(event));
    this.slider.addEventListener('pointerup',event=>this.finish(event));
    this.slider.addEventListener('pointercancel',()=>this.cancel(true));
    this.slider.addEventListener('lostpointercapture',()=>this.cancel(true));
    this.slider.addEventListener('keydown',event=>this.keyboard(event));
    this.refresh();
  }
  get duration(){return Number.isFinite(this.audio.duration)&&this.audio.duration>0&&!this.audio.error?this.audio.duration:0;}
  setVisible(visible){
    this.visible=visible;
    if(!visible)this.cancel(true);
    this.refresh();if(visible)this.animate();
  }
  refresh(){
    const duration=this.duration;
    const time=this.drag?this.drag.progress*duration:(this.pending??this.audio.currentTime)||0;
    const progress=duration?clamp(time/duration):0;
    this.progress.setAttribute('stroke-dashoffset',String(100-progress*100));
    const angle=progress*Math.PI*2;
    this.dot.setAttribute('cx',String(24+22*Math.sin(angle)));
    this.dot.setAttribute('cy',String(24-22*Math.cos(angle)));
    this.slider.setAttribute('aria-disabled',String(!duration));
    this.slider.setAttribute('aria-valuemax',String(duration||0));
    this.slider.setAttribute('aria-valuenow',String(duration?Math.min(duration,Number(time.toFixed(2))):0));
    this.slider.setAttribute('aria-valuetext',duration?`${format(time)} / ${format(duration)}`:'录音时长加载后可调节进度');
    this.hint.textContent=`${this.drag?'跳转至 ':this.pending!==null?'正在定位 ':''}${format(time)} / ${format(duration||NaN)}`;
    this.root.classList.toggle('seek-ready',Boolean(duration));
    if(this.audio.paused||!this.visible){cancelAnimationFrame(this.frame);this.frame=0;}
  }
  animate(){
    if(this.frame||!this.visible||this.audio.paused)return;
    const tick=()=>{
      this.frame=0;this.refresh();
      if(this.visible&&!this.audio.paused)this.frame=requestAnimationFrame(tick);
    };
    this.frame=requestAnimationFrame(tick);
  }
  angle(event){
    const box=this.slider.getBoundingClientRect();
    const angle=Math.atan2(event.clientX-box.left-box.width/2,-(event.clientY-box.top-box.height/2))/(Math.PI*2);
    return (angle+1)%1;
  }
  start(event){
    if(event.button!==0||!this.duration||this.drag)return;
    event.preventDefault();event.stopPropagation();
    const angle=this.angle(event),original=this.audio.currentTime;
    // At the shared top point choose the endpoint nearest the current position.
    const progress=angle<.005&&original/this.duration>.5?1:angle;
    this.drag={id:event.pointerId,original,playing:!this.audio.paused&&!this.audio.ended,lastAngle:angle,progress};
    this.audio.pause();this.root.classList.add('seeking');
    this.slider.setPointerCapture(event.pointerId);this.slider.focus({preventScroll:true});this.refresh();
  }
  move(event){
    if(!this.drag||event.pointerId!==this.drag.id)return;
    event.preventDefault();event.stopPropagation();
    const angle=this.angle(event);let delta=angle-this.drag.lastAngle;
    if(delta>.5)delta-=1;if(delta<-.5)delta+=1;
    this.drag.progress=clamp(this.drag.progress+delta);this.drag.lastAngle=angle;this.refresh();
  }
  release(){
    const state=this.drag;this.drag=null;this.root.classList.remove('seeking');
    if(state&&this.slider.hasPointerCapture(state.id))this.slider.releasePointerCapture(state.id);
    return state;
  }
  finish(event){
    if(!this.drag||event.pointerId!==this.drag.id)return;
    event.preventDefault();event.stopPropagation();
    const state=this.release();this.seek(state.progress*this.duration,state.playing);
  }
  seek(time,resume){
    if(!this.duration)return;
    this.seekResume=resume;
    try{this.pending=Math.max(0,Math.min(this.duration,time));this.audio.currentTime=this.pending;}
    catch{this.pending=null;this.refresh();return;}
    this.refresh();
    if(resume&&time<this.duration)this.resume();
  }
  cancel(restore){
    const state=this.release();
    if(state&&restore)this.seek(state.original,state.playing);
    this.refresh();
  }
  reset(){
    this.pending=null;this.cancel(false);cancelAnimationFrame(this.frame);this.frame=0;this.visible=false;
  }
  keyboard(event){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();if(!this.duration)return;
    this.cancel(false);
    const time=event.key==='Home'?0:event.key==='End'?this.duration:this.audio.currentTime+(event.key==='ArrowRight'?5:-5);
    this.seek(time,!this.audio.paused&&!this.audio.ended);
  }
}
