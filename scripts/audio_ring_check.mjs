import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
await page.addInitScript(()=>{const N=Audio;window.Audio=class extends N{constructor(...args){super(...args);window.testAudio=this;}};});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const slider=page.locator('#audio-seek'),button=page.locator('#audio-toggle');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4187';
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));};
const open=async(id)=>{await page.locator(`.card[data-id="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));};
const expand=async()=>{await page.locator('#tab-ai').click();await page.waitForFunction(()=>document.querySelector('#audio-seek').getAttribute('aria-disabled')==='false');await page.waitForTimeout(100);};
const audio=()=>page.evaluate(()=>({time:testAudio.currentTime,duration:testAudio.duration,paused:testAudio.paused,src:testAudio.getAttribute('src')}));
const point=async(progress,radius=22)=>{const b=await slider.boundingBox(),a=progress*Math.PI*2;return{x:b.x+24+radius*Math.sin(a),y:b.y+24-radius*Math.cos(a)};};
const move=async(progress,radius=22)=>{const p=await point(progress,radius);await page.mouse.move(p.x,p.y,{steps:5});};
const down=async progress=>{await move(progress);await page.mouse.down();};
const click=async progress=>{await down(progress);await page.mouse.up();};
const play=async()=>{await button.click();await page.waitForFunction(()=>!testAudio.paused&&document.querySelector('#audio-toggle').getAttribute('aria-pressed')==='true');};
const shot=async name=>page.screenshot({path:fileURLToPath(new URL(`../qa/${name}.png`,import.meta.url))});
try{
await fs.mkdir(new URL('../qa/',import.meta.url),{recursive:true});await page.goto(base,{waitUntil:'networkidle'});
for(let id=1;id<=15;id++){
 await open(id);assert.equal((await audio()).src,null);await expand();
 const info=await audio();assert(info.duration>600&&info.duration<2400);assert(info.paused);assert.equal(info.time,0);
 assert(info.src.includes(`/assets/media/audio/${String(id).padStart(2,'0')}.`));assert.equal(await slider.getAttribute('aria-valuenow'),'0');
 if([1,6,15].includes(id)){
  await slider.focus();await page.keyboard.press('ArrowRight');assert(Math.abs((await audio()).time-5)<.2);
  await page.keyboard.press('ArrowLeft');assert.equal((await audio()).time,0);
  await page.keyboard.press('End');assert(Math.abs((await audio()).time-info.duration)<.2);await page.keyboard.press('Home');
  await click(.25);assert(Math.abs((await audio()).time/info.duration-.25)<.005);assert((await audio()).paused);
  const original=(await audio()).time;
  await down(.25);await move(.5);await move(.75);
  assert(Math.abs((await audio()).time-original)<.2);assert(Number(await slider.getAttribute('aria-valuenow'))/info.duration>.74);
  await move(.75,95);await page.mouse.up();assert(Math.abs((await audio()).time/info.duration-.75)<.005);
  await down(.95);await move(.99);await move(.01);await move(.05);assert(Number(await slider.getAttribute('aria-valuenow'))/info.duration>.99);
  await move(.01);assert(Number(await slider.getAttribute('aria-valuenow'))/info.duration>.9);await page.mouse.up();
  await slider.focus();await page.keyboard.press('Home');await play();await page.waitForTimeout(150);
  await down(.1);assert((await audio()).paused);await move(.2);await page.mouse.up();
  await page.waitForFunction(()=>!testAudio.paused);assert(Math.abs((await audio()).time/info.duration-.2)<.01);
  const beforeCancel=(await audio()).time;await down(.2);await move(.4);
  await slider.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
  await page.waitForFunction(()=>!testAudio.paused);assert(Math.abs((await audio()).time-beforeCancel)<2);
  const top=await button.evaluate(e=>e.getBoundingClientRect().top);await page.locator('#transcript').hover();await page.mouse.wheel(0,450);await page.waitForTimeout(120);assert.equal(await button.evaluate(e=>e.getBoundingClientRect().top),top);
  if(id===1){
   await move(.2);await shot('1920-audio-ring-playing');
   await button.click();await down(.2);await move(.55);await shot('1920-audio-ring-seeking');
   await page.keyboard.press('Escape');await page.mouse.up();await page.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));
   assert((await audio()).paused);assert.equal((await audio()).src,null);assert.equal(await page.locator('.audio-control.seeking').count(),0);
   continue;
  }
 }
 await close();assert((await audio()).paused);assert.equal((await audio()).src,null);
}
await page.setViewportSize({width:1440,height:900});await open(1);await expand();await click(.35);await play();await move(.35);await shot('1440-audio-ring-playing');
await down(.35);await move(.6);await shot('1440-audio-ring-seeking');
await page.evaluate(()=>document.querySelector('#tab-share').click());await page.mouse.up();assert((await audio()).paused);assert.equal((await audio()).time,0);assert.equal(await slider.getAttribute('aria-valuenow'),'0');
await close();
// Failed metadata must not enable a misleading seek control.
await page.route('**/assets/media/audio/02.*',r=>r.abort());await open(2);await page.locator('#tab-ai').click();await page.waitForFunction(()=>Boolean(testAudio.error));
assert.equal(await slider.getAttribute('aria-disabled'),'true');await click(.5);assert.equal((await audio()).time,0);
await page.unroute('**/assets/media/audio/02.*');await play();await page.waitForFunction(()=>document.querySelector('#audio-seek').getAttribute('aria-disabled')==='false');await close();
assert.deepEqual(errors,[]);
console.log('PASS: 15 real recording durations/no autoplay; T01/T06/T15 click, keyboard, drag and seam; pause/resume/cancel; release outside ring; close/share during drag; pinned toolbar; metadata failure/retry; 1920/1440 screenshots.');
}finally{await browser.close();}
