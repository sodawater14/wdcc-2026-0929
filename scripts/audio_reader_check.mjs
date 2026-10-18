import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
await page.addInitScript(()=>{const NativeAudio=window.Audio;window.Audio=class extends NativeAudio{constructor(...args){super(...args);window.testAudio=this;}};});
const errors=[],audioRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('.m4a'))audioRequests.push(r.url());});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4187';
await fs.mkdir(new URL('../qa/',import.meta.url),{recursive:true});
async function open(id){await page.locator(`.card[data-id="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));}
async function close(){await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));}
async function play(){await page.locator('#audio-toggle').click();await page.waitForFunction(()=>window.testAudio.currentTime>.1&&!window.testAudio.paused&&document.querySelector('#audio-toggle').getAttribute('aria-pressed')==='true');assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'),'true');}
async function expand(){await page.locator('#tab-ai').click();await page.waitForFunction(()=>document.querySelectorAll('.curved-ready').length===2);await page.waitForTimeout(150);}
async function shot(name){await page.screenshot({path:fileURLToPath(new URL(`../qa/${name}.png`,import.meta.url))});}
try{
await page.goto(base,{waitUntil:'networkidle'});
assert.equal(await page.locator('.card').count(),15);
assert.equal(audioRequests.length,0);
for(const id of [1,6,10,15]){
 await open(id);
 assert.equal(await page.locator('.tab').count(),2);
 assert.equal(await page.locator('.panel:visible').count(),0);
 assert.equal(await page.locator('.tab.active').count(),0);
 assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'),'false');
 assert.equal(await page.evaluate(()=>testAudio.getAttribute('src')),null);
 await expand();
 assert.equal(await page.locator('#personal-summary .personal-section').count(),4);
 assert((await page.locator('#transcript').textContent()).length>800);
 await play();
 assert((await page.evaluate(()=>testAudio.src)).endsWith(`/assets/audio/${String(id).padStart(2,'0')}.m4a`));
 if(id===1){
  const top=await page.locator('#audio-toggle').evaluate(e=>e.getBoundingClientRect().top);
  const rightBefore=await page.locator('#personal-summary').evaluate(e=>e.scrollTop);
  await page.locator('#transcript').hover();await page.mouse.wheel(0,400);await page.waitForTimeout(150);
  assert((await page.locator('#transcript').evaluate(e=>e.scrollTop))>100);
  assert.equal(await page.locator('#personal-summary').evaluate(e=>e.scrollTop),rightBefore);
  assert.equal(await page.locator('#audio-toggle').evaluate(e=>e.getBoundingClientRect().top),top);
  await shot('1920-audio-playing');
  await page.locator('#audio-toggle').click();
  const paused=await page.evaluate(()=>testAudio.currentTime);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>testAudio.paused),true);
  assert(Math.abs((await page.evaluate(()=>testAudio.currentTime))-paused)<.05);
  await play();
  assert((await page.evaluate(()=>testAudio.currentTime))>paused);
  await page.locator('#tab-ai').click();
  assert.equal(await page.evaluate(()=>testAudio.paused),false);
  await page.locator('#tab-ai').click();
  assert((await page.locator('#transcript').evaluate(e=>e.scrollTop))>100);
  await page.locator('#tab-share').click();
  assert.equal(await page.evaluate(()=>testAudio.paused),true);
  assert.equal(await page.evaluate(()=>testAudio.currentTime),0);
  await page.locator('#tab-ai').click();
  // Keyboard and draggable curved thumbs on both columns.
  for(const selector of ['.transcript-shell','.summary-shell']){
   const svg=page.locator(`${selector} .curved-scrollbar`);await svg.focus();await page.keyboard.press('End');await page.waitForTimeout(80);
   assert.equal(await svg.getAttribute('aria-valuenow'),'100');
   await page.keyboard.press('Home');await page.waitForTimeout(80);
   const point=await svg.evaluate(e=>{const path=e.querySelector('.curved-track'),thumb=e.querySelector('.curved-thumb');const p=path.getPointAtLength(parseFloat(thumb.getAttribute('stroke-dasharray'))*.5);const rect=e.getBoundingClientRect();return{x:rect.left+p.x,y:rect.top+p.y};});
   await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x,point.y+160,{steps:8});await page.mouse.up();
   assert((await page.locator(`${selector} .reading-scroll`).evaluate(e=>e.scrollTop))>0);
  }
  // Actual decoded recording end state and replay.
  await play();await page.waitForFunction(()=>Number.isFinite(testAudio.duration));
  await page.evaluate(()=>testAudio.currentTime=testAudio.duration-.1);
  await page.waitForFunction(()=>testAudio.ended);
  assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'),'false');
  await play();assert((await page.evaluate(()=>testAudio.currentTime))<5);
 }
 await close();
 assert.equal(await page.evaluate(()=>testAudio.paused),true);
 assert.equal(await page.evaluate(()=>testAudio.getAttribute('src')),null);
}
for(const viewport of [{width:1920,height:1080},{width:1440,height:900}]){
 await page.setViewportSize(viewport);await open(1);await shot(`${viewport.width}-audio-collapsed`);await expand();
 for(const selector of ['.transcript-shell','.summary-shell']){
  const box=await page.locator(selector).boundingBox();assert(Math.abs(viewport.height-(box.y+box.height)-24)<3);
 }
 await shot(`${viewport.width}-audio-paused`);await play();await shot(`${viewport.width}-audio-active`);
 await page.locator('#personal-summary').evaluate(e=>e.scrollTop=e.scrollHeight);await shot(`${viewport.width}-summary-bottom`);
 await page.mouse.move(30,400);const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-450);await page.waitForTimeout(200);assert((await page.evaluate(()=>scrollY))<before);
 await close();
}
// Loading failure stays recoverable, without falsely showing a playing state.
await page.route('**/assets/audio/02.m4a*',r=>r.abort());await open(2);await expand();await page.locator('#audio-toggle').click();
await page.waitForFunction(()=>document.querySelector('#audio-status').textContent.includes('重试'));
assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'),'false');
await page.unroute('**/assets/audio/02.m4a*');await play();await close();
assert.deepEqual(errors,[]);
console.log('PASS: real M4A playback/resume/end/replay; collapse/share/close lifecycle; corrected report mappings; both curved scrollbars; fixed toolbar; 1920 and 1440 layout; network failure retry; no page errors.');
}catch(error){console.log(await page.evaluate(()=>({status:document.querySelector('#audio-status').textContent,paused:testAudio.paused,time:testAudio.currentTime,ready:testAudio.readyState,error:testAudio.error?.message})));throw error;}finally{await browser.close();}
