let edgeBase='',selectedBase='';
const states=new WeakMap();
const local=['localhost','127.0.0.1'].includes(location.hostname);
const absolute=src=>new URL(src,document.baseURI).href;
const at=(base,src)=>base?new URL(src,base).href:absolute(src);

const versionAudio=url=>{const u=new URL(url);if(u.pathname.endsWith('.m4a'))u.searchParams.set('stream','range-v2');return u.href;};
export function mediaURL(src){return versionAudio(at(selectedBase,src));}
export function alternateMediaURL(src,usedURL){
  if(usedURL)return versionAudio(new URL(usedURL).origin===new URL(absolute(src)).origin?at(edgeBase,src):absolute(src));
  return versionAudio(at(selectedBase?'':edgeBase,src));
}

export function configureMedia(config){
  if(local||!config?.baseUrl)return;
  edgeBase=config.baseUrl;
  // Probe a small public resource once; never hold up rendering or trust a
  // CDN simply because it exists. The first complete response selects a route.
  const controllers=[new AbortController(),new AbortController()];
  const timeout=setTimeout(()=>controllers.forEach(c=>c.abort()),3000);
  const probe=config.probe||'assets/covers/01.webp';
  Promise.any(['',edgeBase].map(async(base,index)=>{
    const response=await fetch(at(base,probe),{headers:{Range:'bytes=0-16383'},credentials:'omit',signal:controllers[index].signal});
    if(!response.ok)throw Error('media unavailable');
    await response.arrayBuffer();return base;
  })).then(base=>{selectedBase=base;}).catch(()=>{}).finally(()=>{
    clearTimeout(timeout);controllers.forEach(c=>c.abort());
  });
}

export function cancelMediaImage(img){
  states.get(img)?.cancel();states.delete(img);img.removeAttribute('src');
}

export function setMediaImage(img,src,priority='auto'){
  states.get(img)?.cancel();
  const controller=new AbortController(),primary=mediaURL(src),alternative=alternateMediaURL(src);
  let backup=null,timer=null,settled=false,failed=false;
  const cleanup=()=>{clearTimeout(timer);controller.abort();if(backup){backup.onload=null;backup.onerror=null;backup.removeAttribute('src');}};
  const state={cancel:cleanup};states.set(img,state);
  const startBackup=()=>{
    if(backup||settled||primary===alternative)return;
    backup=new Image();backup.decoding='async';backup.fetchPriority=priority==='high'?'auto':'low';
    backup.onload=()=>{
      if(settled)return;settled=true;
      const winner=backup.src;cleanup();img.src=winner;
    };
    backup.onerror=()=>{if(failed&&!settled){settled=true;cleanup();img.dispatchEvent(new Event('error'));}};
    backup.src=alternative;
  };
  img.addEventListener('load',()=>{settled=true;cleanup();},{signal:controller.signal});
  img.addEventListener('error',event=>{
    if(primary===alternative||settled)return;
    event.stopImmediatePropagation();failed=true;startBackup();
    if(backup?.complete&&!backup.naturalWidth){settled=true;cleanup();img.dispatchEvent(new Event('error'));}
  },{capture:true,signal:controller.signal});
  img.decoding='async';img.fetchPriority=priority;img.src=primary;
  if(primary!==alternative)timer=setTimeout(startBackup,1800);
}
