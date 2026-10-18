import http from 'node:http';
import {Readable} from 'node:stream';
import {createLocalHandler} from './backend/local.mjs';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const localHandler=createLocalHandler(root);
const port = Number(process.env.PORT || 4187);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.md':'text/plain; charset=utf-8','.m4a':'audio/mp4'};
http.createServer(async (req,res) => {
  try {
    const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name==='/api/share-config'){
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({endpoint:'/api/submissions',localTest:true}));return;
    }
    if(name.startsWith('/api/')){
      const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
      const result=await localHandler(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;
    }
    if(name.split('/').some(part=>part.startsWith('.'))||/^\/(backend|qa)(\/|$)/.test(name)){res.writeHead(404).end();return;}
    const file = path.resolve(root,'.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const headers={'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
    let start=0,end=info.size-1,status=200;
    if(req.headers.range){
      const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!range || (!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
      start=range[1]?Number(range[1]):Math.max(0,info.size-Number(range[2]));
      end=range[1]&&range[2]?Math.min(Number(range[2]),end):end;
      if(start>end || start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length']=Math.max(0,end-start+1);
    res.writeHead(status,headers);
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(file,{start,end});
    stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  } catch {res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',() => console.log(`WDCC local preview: http://127.0.0.1:${port}`));
