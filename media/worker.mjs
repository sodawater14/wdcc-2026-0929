/** Explicit byte-range service: static asset responses can be 200/non-seekable. */
export function parseRange(value,size){
 const match=/^bytes=(\d*)-(\d*)$/.exec(value||'');
 if(!match||(!match[1]&&!match[2]))return null;
 let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
 let end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&start<size?{start,end}:null;
}
export default {
 async fetch(request,env){
  if(!new URL(request.url).pathname.startsWith('/assets/media/audio/'))return env.ASSETS.fetch(request);
  const headers=new Headers(request.headers);
  for(const key of ['range','if-range','if-none-match','if-modified-since'])headers.delete(key);
  headers.set('accept-encoding','identity');
  const source=await env.ASSETS.fetch(new Request(request.url,{method:'GET',headers}));
  if(!source.ok)return source;
  const body=await source.arrayBuffer(),size=body.byteLength;
  const out=new Headers(source.headers);
  out.delete('content-encoding');out.delete('content-range');
  out.set('content-type','audio/mp4');out.set('accept-ranges','bytes');
  out.set('access-control-allow-origin','*');
  out.set('access-control-expose-headers','Accept-Ranges, Content-Range, Content-Length');
  const range=request.headers.get('range');
  if(range){
   const part=parseRange(range,size);
   if(!part){out.set('content-range',`bytes */${size}`);out.set('content-length','0');return new Response(null,{status:416,headers:out});}
   out.set('content-range',`bytes ${part.start}-${part.end}/${size}`);
   out.set('content-length',String(part.end-part.start+1));
   return new Response(request.method==='HEAD'?null:body.slice(part.start,part.end+1),{status:206,headers:out});
  }
  out.set('content-length',String(size));
  return new Response(request.method==='HEAD'?null:body,{headers:out});
 }
};
