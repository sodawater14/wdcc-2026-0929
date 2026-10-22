import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4187/';
const errors=[];const ready=p=>p.waitForFunction(()=>document.documentElement.classList.contains('cover-running'));
const finished=p=>p.waitForFunction(()=>!document.documentElement.classList.contains('cover-pending'));
const area=p=>p.evaluate(()=>[...document.querySelectorAll('.cover-blinds rect')].reduce((n,r)=>n+Number(r.getAttribute('height')),0)/document.querySelector('.cover-viewport').clientHeight);
const shot=(p,name)=>p.screenshot({path:`qa/${name}.png`});
try{
 await fs.mkdir('qa',{recursive:true});
 for(const width of [1920,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1920?1080:900},reducedMotion:'no-preference'});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base,{waitUntil:'networkidle'});await ready(p);
  assert.equal(await p.locator('.cover-blinds rect').count(),60);
  assert.equal(await p.locator('#home').evaluate(el=>el.inert),true);
  assert.equal(await p.locator('.cover-photo').getAttribute('preserveAspectRatio'),'xMidYMid slice');
  assert.equal(await p.locator('.cover-hint').count(),0);
  assert.equal(await area(p),0);await shot(p,`${width}-cover-start`);
  // Native wheel advances the SVG, rather than swapping screenshots or translating the home.
  await p.mouse.move(width/2,300);await p.mouse.wheel(0,Math.round((width===1920?1080:900)*.7));await p.waitForTimeout(1500);
  const middle=await area(p);assert(middle>.1&&middle<.95,`Expected partial mask, got ${middle}`);
  await shot(p,`${width}-cover-mid`);
  await p.evaluate(()=>scrollTo(0,innerHeight*.15));await p.waitForTimeout(1500);
  assert((await area(p))<middle,'Reverse scroll should restore the photo');
  await p.evaluate(()=>scrollTo(0,innerHeight*.7));await p.waitForTimeout(1500);
  const beforeResize=await area(p);
  await p.setViewportSize({width:width===1920?1440:1920,height:width===1920?900:1080});await p.waitForTimeout(1500);
  assert(Math.abs((await area(p))-beforeResize)<.04,'Resize should preserve visual progress');
  await p.setViewportSize({width,height:width===1920?1080:900});await p.waitForTimeout(1500);
  // Rapid scroll to the end must retain the cover until the scrubbed mask really completes.
  await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  assert.equal(await p.locator('.cover-viewport').count(),1);
  await finished(p);assert.equal(await p.locator('#cover-intro').count(),0);
  assert.equal(await p.locator('#home').evaluate(el=>el.inert),false);
  assert.equal(await p.evaluate(()=>scrollY),0);
  assert.equal(await p.evaluate(()=>ScrollTrigger.getAll().length),0);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#home')).position),'static');
  assert.equal(await p.evaluate(()=>sessionStorage.getItem('wdcc-0929-cover-v1')),'done');
  await shot(p,`${width}-cover-reports`);
  await p.evaluate(()=>scrollTo(0,0));assert.equal(await p.locator('#cover-intro').count(),0);
  await p.reload({waitUntil:'networkidle'});assert.equal(await p.locator('#cover-intro').count(),0);
  await p.locator('#taste-enter').click();await p.waitForFunction(()=>!document.querySelector('#taste-view').hidden&&!document.body.classList.contains('taste-switching'));
  await p.locator('#taste-back').click();await p.waitForFunction(()=>!document.querySelector('#home').hidden&&!document.body.classList.contains('taste-switching'));
  assert.equal(await p.locator('#cover-intro').count(),0);
  // A separate tab in the same browser context has a separate sessionStorage session.
  const fresh=await context.newPage();await fresh.goto(base,{waitUntil:'networkidle'});await ready(fresh);
  await fresh.keyboard.press('Tab');assert.equal(await fresh.locator('.cover-skip').evaluate(el=>el===document.activeElement),true);
  await fresh.keyboard.press('Enter');await finished(fresh);assert.equal(await fresh.locator('#cover-intro').count(),0);
  await context.close();
 }
 // Keyboard PageDown / Home use native scroll, without gallery-key interception.
 const keyboard=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 keyboard.on('pageerror',e=>errors.push(e.message));await keyboard.goto(base,{waitUntil:'networkidle'});await ready(keyboard);
 await keyboard.keyboard.press('PageDown');await keyboard.waitForTimeout(1500);assert((await area(keyboard))>0);
 await keyboard.keyboard.press('Home');await keyboard.waitForTimeout(1500);assert((await area(keyboard))<.01);
 await keyboard.keyboard.press('End');await finished(keyboard);await keyboard.close();
 const reduced=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 reduced.on('pageerror',e=>errors.push(e.message));await reduced.goto(base,{waitUntil:'networkidle'});await ready(reduced);
 assert.equal(await reduced.locator('.cover-blinds rect').count(),0);await reduced.mouse.wheel(0,100);await finished(reduced);await reduced.close();
 const direct=await browser.newPage();direct.on('pageerror',e=>errors.push(e.message));
 await direct.goto(base+'#taste',{waitUntil:'networkidle'});assert.equal(await direct.locator('#cover-intro').count(),0);
 await direct.waitForFunction(()=>!document.querySelector('#taste-view').hidden);await direct.close();
 // Dependency and image failures must release the live report DOM.
 for(const blocked of ['**/assets/intro/meeting.webp','**/vendor/ScrollTrigger.min.js','**/vendor/gsap.min.js','**/cover-intro.js*']){
  const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.route(blocked,r=>r.abort());await p.goto(base,{waitUntil:'networkidle'});await finished(p);
  assert.equal(await p.locator('#home').evaluate(el=>el.inert),false);assert.equal(await p.locator('.card').count(),15);
  await p.close();
 }
 // If sessionStorage is disabled, the current document still completes once.
 const storage=await browser.newPage();storage.on('pageerror',e=>errors.push(e.message));
 await storage.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')}});
 await storage.goto(base,{waitUntil:'networkidle'});await ready(storage);await storage.locator('.cover-skip').evaluate(el=>el.click());await finished(storage);
 assert.equal(await storage.locator('#cover-intro').count(),0);await storage.close();
 assert.deepEqual(errors,[]);console.log('PASS: 30 paired SVG blinds, 1920/1440 centered fullscreen photo without scroll caption, wheel/keyboard/reverse/resize, visual completion before teardown, clean home flow, per-tab session once, direct taste, reduced motion, keyboard skip, image/plugin/module failures and blocked storage.');
}finally{await browser.close()}
