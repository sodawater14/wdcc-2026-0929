/** Isolated image viewer. It never reads or changes the shared audio instance. */
export class ImageZoom {
 constructor(gallery,canOpen){
  this.gallery=gallery;this.canOpen=canOpen;this.gesture=null;this.source=null;
  this.dialog=document.createElement('dialog');this.dialog.className='image-zoom';
  this.dialog.setAttribute('aria-label','放大图片，再次点击还原');
  this.dialog.innerHTML='<button type="button" class="image-zoom-close" aria-label="还原图片">还原 ×</button><img alt=""><span class="image-zoom-hint">再次点击图片还原 · Esc 关闭</span>';
  this.image=this.dialog.querySelector('img');document.body.append(this.dialog);
  this.sync=()=>{if(this.source?.naturalWidth){this.image.src=this.source.currentSrc||this.source.src;this.image.alt=this.source.alt;}};
  gallery.addEventListener('pointerdown',event=>{
   if(event.button!==0||!canOpen()){this.gesture=null;return;}
   this.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  },true);
  gallery.addEventListener('pointermove',event=>{
   const g=this.gesture;if(g&&g.id===event.pointerId&&Math.hypot(event.clientX-g.x,event.clientY-g.y)>8)g.moved=true;
  },true);
  gallery.addEventListener('pointercancel',()=>{this.gesture=null;},true);
  gallery.addEventListener('click',event=>{
   const g=this.gesture;this.gesture=null;
   if(!g||g.moved||!canOpen()||Math.hypot(event.clientX-g.x,event.clientY-g.y)>8)return;
   const img=this.currentImage();if(!img?.naturalWidth)return;
   // The image element fills the frame: exclude the object-fit letterboxing.
   const box=img.getBoundingClientRect(),scale=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight);
   const width=img.naturalWidth*scale,height=img.naturalHeight*scale,left=box.left+(box.width-width)/2,top=box.top+(box.height-height)/2;
   if(event.clientX>=left&&event.clientX<=left+width&&event.clientY>=top&&event.clientY<=top+height)this.open(img);
  });
  gallery.addEventListener('keydown',event=>{
   if(event.target!==gallery||!['Enter',' '].includes(event.key)||!canOpen())return;
   event.preventDefault();const img=this.currentImage();if(img?.naturalWidth)this.open(img);
  });
  this.dialog.addEventListener('click',()=>this.close());
  this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
  // Native dialog isolates pointer input; capture keys before existing report shortcuts.
  document.addEventListener('keydown',event=>{
   if(!this.dialog.open)return;
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close();}
   else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown',' '].includes(event.key)){
    event.preventDefault();event.stopImmediatePropagation();
   }
  },true);
  this.dialog.addEventListener('wheel',event=>event.preventDefault(),{passive:false});
 }
 currentImage(){return this.gallery.querySelector('.slide[data-offset="0"] img');}
 open(img){
  if(this.dialog.open||!this.canOpen())return;
  this.source=img;this.focusBefore=document.activeElement;this.scrollBefore={x:scrollX,y:scrollY};
  this.sync();img.addEventListener('load',this.sync);
  document.body.classList.add('image-zoom-open');this.dialog.showModal();
 }
 close(){
  if(!this.dialog.open)return;
  this.source?.removeEventListener('load',this.sync);this.source=null;
  this.dialog.close();document.body.classList.remove('image-zoom-open');this.image.removeAttribute('src');
  if(this.focusBefore?.isConnected)this.focusBefore.focus({preventScroll:true});
  window.scrollTo(this.scrollBefore.x,this.scrollBefore.y);this.gesture=null;
 }
}
