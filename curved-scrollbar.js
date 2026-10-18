// Inspired by cbolson's Custom curved corner scrollbars:
// https://codepen.io/cbolson/pen/vELrOPz
// Keep native scrolling; the SVG is a synchronized, draggable overlay.
const NS = 'http://www.w3.org/2000/svg';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class CurvedScrollbar {
  constructor(content) {
    this.content = content;
    this.shell = content.parentElement;
    this.abort = new AbortController();
    this.frame = 0;
    this.drag = null;
    this.destroyed = false;
    this.length = 0;
    this.thumbLength = 0;
    try {
      this.svg = document.createElementNS(NS, 'svg');
      this.svg.classList.add('curved-scrollbar');
      this.svg.setAttribute('role', 'scrollbar');
      this.svg.setAttribute('aria-label', `${content.getAttribute('aria-label')}滚动条`);
      this.svg.setAttribute('aria-controls', content.id);
      this.svg.setAttribute('aria-orientation', 'vertical');
      this.svg.setAttribute('aria-valuemin', '0');
      this.svg.setAttribute('aria-valuemax', '100');
      this.svg.setAttribute('aria-valuenow', '0');
      this.svg.setAttribute('tabindex', '0');
      this.svg.setAttribute('hidden', '');
      this.track = this.path('curved-track');
      this.thumb = this.path('curved-thumb');
      this.hit = this.path('curved-hit');
      this.svg.append(this.track, this.thumb, this.hit);
      this.shell.append(this.svg);
      const options = {signal:this.abort.signal};
      content.addEventListener('scroll', () => this.schedule(), {...options, passive:true});
      this.hit.addEventListener('pointerdown', event => this.startDrag(event), options);
      this.hit.addEventListener('pointermove', event => this.moveDrag(event), options);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        this.hit.addEventListener(type, () => this.endDrag(), options);
      }
      this.svg.addEventListener('keydown', event => this.keyScroll(event), options);
      this.svg.addEventListener('wheel', event => {
        if(event.ctrlKey)return;
        event.preventDefault();
        const unit=event.deltaMode===1?24:event.deltaMode===2?content.clientHeight:1;
        content.scrollTop+=event.deltaY*unit;
      }, {...options, passive:false});
      this.resizeObserver = new ResizeObserver(() => this.refresh());
      this.resizeObserver.observe(this.shell);
      this.resizeObserver.observe(content);
      this.refresh();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  path(className) {
    const path = document.createElementNS(NS, 'path');
    path.classList.add(className);
    path.setAttribute('aria-hidden', 'true');
    return path;
  }

  refresh() {
    if (this.destroyed) return;
    // Hidden tabs have no usable geometry. Recalculate after they are revealed.
    const w = this.shell.clientWidth, h = this.shell.clientHeight;
    if (!w || !h || !this.content.clientHeight) {this.endDrag(); return;}
    try {
      const inset = 7;
      const r = Math.max(0, Math.min(parseFloat(getComputedStyle(this.shell).borderRadius) || 0, w/2, h/2) - inset);
      const x = w-inset, top = inset, bottom = h-inset, corner = x-r;
      const start = Math.min(corner, Math.max(w*.8, x-r*2));
      const d = r > 0
        ? `M ${start} ${top} L ${corner} ${top} A ${r} ${r} 0 0 1 ${x} ${top+r} L ${x} ${bottom-r} A ${r} ${r} 0 0 1 ${corner} ${bottom} L ${start} ${bottom}`
        : `M ${x} ${top} L ${x} ${bottom}`;
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      for (const path of [this.track, this.thumb, this.hit]) path.setAttribute('d', d);
      this.length = this.track.getTotalLength();
      const ratio = this.content.clientHeight / Math.max(1, this.content.scrollHeight);
      this.thumbLength = clamp(this.length*ratio, Math.min(24,this.length), this.length);
      this.samples = Array.from({length:161}, (_,i) => {
        const distance = i*this.length/160;
        const point = this.track.getPointAtLength(distance);
        return {x:point.x,y:point.y,distance};
      });
      this.shell.classList.add('curved-ready');
      this.update();
    } catch (error) {
      console.warn('Curved scrollbar unavailable; using native scrolling.', error);
      this.destroy();
    }
  }

  schedule() {
    if (this.frame || this.destroyed) return;
    this.frame = requestAnimationFrame(() => {this.frame=0;this.update();});
  }

  update() {
    if (this.destroyed || !this.length || !this.content.clientHeight) return;
    const max = this.content.scrollHeight-this.content.clientHeight;
    const overflow = max > 1;
    this.svg.toggleAttribute('hidden', !overflow);
    if (!overflow) {this.endDrag();return;}
    const progress = clamp(this.content.scrollTop/max,0,1);
    const offset = (this.length-this.thumbLength)*progress;
    for (const path of [this.thumb,this.hit]) {
      path.setAttribute('stroke-dasharray', `${this.thumbLength} ${this.length+1}`);
      path.setAttribute('stroke-dashoffset', String(-offset));
    }
    this.svg.setAttribute('aria-valuenow', String(Math.round(progress*100)));
  }

  project(event) {
    const rect = this.svg.getBoundingClientRect();
    const x = (event.clientX-rect.left)*this.shell.clientWidth/rect.width;
    const y = (event.clientY-rect.top)*this.shell.clientHeight/rect.height;
    const distance = point => (point.x-x)**2+(point.y-y)**2;
    let best = this.samples[0];
    for (const sample of this.samples) if (distance(sample)<distance(best)) best=sample;
    let low = Math.max(0,best.distance-this.length/160);
    let high = Math.min(this.length,best.distance+this.length/160);
    // Refine the nearest point on the arc, including its horizontal end sections.
    for(let i=0;i<10;i++) {
      const a=low+(high-low)/3, b=high-(high-low)/3;
      if(distance(this.track.getPointAtLength(a))<distance(this.track.getPointAtLength(b)))high=b;
      else low=a;
    }
    return (low+high)/2;
  }

  startDrag(event) {
    if (event.button!==0 || this.svg.hasAttribute('hidden') || this.destroyed) return;
    event.preventDefault();
    const max=this.content.scrollHeight-this.content.clientHeight;
    const start=(this.length-this.thumbLength)*clamp(this.content.scrollTop/max,0,1);
    this.drag={id:event.pointerId,grab:this.project(event)-start};
    this.shell.classList.add('curved-dragging');
    this.hit.setPointerCapture(event.pointerId);
    this.svg.focus({preventScroll:true});
  }

  moveDrag(event) {
    if(!this.drag || event.pointerId!==this.drag.id) return;
    event.preventDefault();
    const travel=this.length-this.thumbLength;
    if(travel<=0)return;
    const progress=clamp((this.project(event)-this.drag.grab)/travel,0,1);
    this.content.scrollTop=progress*(this.content.scrollHeight-this.content.clientHeight);
    this.schedule();
  }

  endDrag() {
    const drag=this.drag;
    this.drag=null;
    this.shell.classList.remove('curved-dragging');
    if(drag && this.hit?.hasPointerCapture(drag.id))this.hit.releasePointerCapture(drag.id);
  }

  keyScroll(event) {
    const max=this.content.scrollHeight-this.content.clientHeight;
    const page=this.content.clientHeight*.9;
    const targets={ArrowDown:this.content.scrollTop+40,ArrowUp:this.content.scrollTop-40,
      PageDown:this.content.scrollTop+page,PageUp:this.content.scrollTop-page,Home:0,End:max};
    if(!(event.key in targets))return;
    event.preventDefault();event.stopPropagation();
    this.content.scrollTop=clamp(targets[event.key],0,max);
    this.schedule();
  }

  destroy() {
    this.destroyed=true;
    this.endDrag();
    this.abort.abort();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frame);
    this.svg?.remove();
    this.shell.classList.remove('curved-ready');
  }
}
