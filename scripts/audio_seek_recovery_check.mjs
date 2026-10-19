import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const base='http://127.0.0.1:4187/';
try{
 const p=await browser.newPage({reducedMotion:'reduce'});
 await p.addInitScript(()=>{const N=Audio;window.Audio=class extends N{constructor(...args){super(...args);window.testAudio=this}}});
 await p.route('**/media-loader.js*',async r=>{const s=await fs.readFile(new URL('../media-loader.js',import.meta.url),'utf8');await r.fulfill({contentType:'text/javascript',body:s.replace("if(local||!config?.baseUrl)return;","if(!config?.baseUrl)return;")})});
 const report=JSON.parse(await fs.readFile(new URL('../data/01.json',import.meta.url),'utf8'));
 const bytes=await fs.readFile(new URL('../'+report.audio.src,import.meta.url));
 let backupRequests=0;const blocked=[];
 await p.route('https://wdcc-0929-media.sodawater14-wdcc.workers.dev/**',async r=>{
  if(!r.request().url().includes('/audio/')){await r.abort();return;}
  backupRequests++;
  const result=await p.request.get(base+report.audio.src,{headers:{Range:r.request().headers()['range']||'bytes=0-'}});
  await r.fulfill({status:result.status(),headers:{...result.headers(),'access-control-allow-origin':'*'},body:await result.body()});
 });
 await p.route('**/assets/media/audio/01.*',async r=>{
  if(!r.request().url().startsWith(base)){await r.fallback();return;}
  const start=Number((r.request().headers()['range']||'bytes=0-').match(/bytes=(\d+)/)?.[1]||0);
  if(start>0){blocked.push(r);return;}
  await r.fulfill({status:206,headers:{'content-type':'audio/mp4','accept-ranges':'bytes','content-range':`bytes 0-262143/${bytes.length}`},body:bytes.subarray(0,262144)});
 });
 await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('.card').first().click();await p.locator('#tab-ai').click();await p.waitForFunction(()=>testAudio.duration>0);
 await p.locator('#audio-toggle').click();await p.waitForFunction(()=>!testAudio.paused);
 if(process.env.CLAMP_SEEK==='1')await p.evaluate(()=>{
  const time=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');
  window.clampedOnce=false;Object.defineProperty(testAudio,'currentTime',{configurable:true,get(){return time.get.call(this)},set(value){
   if(value>200&&!window.clampedOnce){window.clampedOnce=true;time.set.call(this,0);return;}time.set.call(this,value);
  }});
 });
 const box=await p.locator('#audio-seek').boundingBox(),angle=.7*Math.PI*2;
 await p.mouse.click(box.x+24+22*Math.sin(angle),box.y+24-22*Math.cos(angle));
 await p.waitForFunction(()=>testAudio.src.includes('workers.dev')&&!testAudio.seeking&&!testAudio.paused&&testAudio.readyState>=3,null,{timeout:20000});
 const time=await p.evaluate(()=>testAudio.currentTime/testAudio.duration);assert(Math.abs(time-.7)<.01);assert(backupRequests>0);if(process.env.CLAMP_SEEK==='1')assert(await p.evaluate(()=>window.clampedOnce));else assert(blocked.length>0);
 // A source fallback must never resurrect audio after leaving the report.
 await p.locator('#tab-share').click();await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>testAudio.currentTime),0);assert(await p.evaluate(()=>testAudio.paused));
 console.log(process.env.CLAMP_SEEK==='1'?'PASS: browser-clamped seek to zero recovers the intended 70% target on the alternate host without restarting.':'PASS: delayed unbuffered byte range triggers alternate host despite Pages path prefix; target 70% preserved and playback resumes; share resets audio.');
}finally{await browser.close()}
