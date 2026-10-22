import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4187/';
const errors=[];
const settled=async p=>p.waitForFunction(()=>!document.body.classList.contains('taste-switching'));
const shot=async(p,name)=>p.screenshot({path:`qa/${name}.png`});
try{
 await fs.mkdir('qa',{recursive:true});
 for(const width of [1920,1440]){
  const p=await browser.newPage({viewport:{width,height:width===1920?1080:900},reducedMotion:'no-preference'});
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>sessionStorage.setItem('wdcc-0929-cover-v1','done'));
  await p.goto(base,{waitUntil:'networkidle'});await p.locator('.card').last().waitFor();
  await p.locator('#taste-enter').scrollIntoViewIfNeeded();const homeY=await p.evaluate(()=>scrollY);
  assert.equal(await p.locator('#taste-view').isVisible(),false);await shot(p,`${width}-taste-entry`);
  await p.locator('#taste-enter').click();await settled(p);assert.equal(await p.locator('#home').isVisible(),false);
  assert.equal(new URL(p.url()).hash,'#taste');assert.equal(await p.locator('.taste-section').count(),5);
  assert.equal(await p.locator('.taste-highlight').count(),6);
  await p.waitForFunction(()=>window.ScrollTrigger?.getAll().length===6);
  assert.equal(await p.evaluate(()=>scrollY),0);await shot(p,`${width}-taste-question`);
  // Each effect runs, completes, resets out of view, and runs again on upward entry.
  for(let i=0;i<5;i++){
   const section=p.locator('.taste-section').nth(i);
   const mark=section.locator('.taste-highlight').first();await mark.scrollIntoViewIfNeeded();
   await p.waitForTimeout(2100);await shot(p,`${width}-taste-section-${i+1}`);
   if(i>0&&i<4)assert(Number(await mark.evaluate(el=>getComputedStyle(el).getPropertyValue('--taste-fill')))>.99);
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
  }
  const long=p.locator('.taste-highlight').last();
  const rows=await long.locator('.taste-char').evaluateAll(els=>new Set(els.map(el=>Math.round(el.getBoundingClientRect().top))).size);
  assert(rows>1,'Long Chinese highlight should wrap across lines');
  const external=p.locator('#taste-view .micromobility-link');await external.scrollIntoViewIfNeeded();
  assert.equal(await external.getAttribute('target'),'_blank');
  await p.context().route('https://sodawater14.github.io/wdcc-micromobility/**',r=>r.fulfill({body:'destination checked',contentType:'text/html'}));
  await shot(p,`${width}-taste-footer`);const popupEvent=p.waitForEvent('popup');await external.click();const popup=await popupEvent;
  await popup.waitForLoadState();assert.equal(popup.url(),'https://sodawater14.github.io/wdcc-micromobility/');await popup.close();
  const mark5=p.locator('[data-effect="5"]');await mark5.scrollIntoViewIfNeeded();await p.waitForTimeout(1200);
  assert(Number(await mark5.evaluate(el=>getComputedStyle(el).getPropertyValue('--taste-fill')))>.99);
  await p.locator('#taste-back').click();await settled(p);assert.equal(await p.locator('#home').isVisible(),true);
  assert(Math.abs((await p.evaluate(()=>scrollY))-homeY)<2,'Home scroll must restore');
  assert.equal(await p.evaluate(()=>ScrollTrigger.getAll().length),0);
  assert.equal(await p.locator('.taste-visual').count(),0);
  await p.goForward();await settled(p);assert.equal(await p.locator('#taste-view').isVisible(),true);
  await p.waitForFunction(()=>ScrollTrigger.getAll().length===6);
  await p.reload({waitUntil:'networkidle'});await settled(p);assert.equal(await p.locator('#taste-view').isVisible(),true);
  await p.waitForFunction(()=>ScrollTrigger.getAll().length===6);
  await p.locator('#taste-back').click();await settled(p);assert.equal(await p.locator('#home').isVisible(),true);
  // Repeated clicks during transition must not add multiple history entries.
  await p.locator('#taste-enter').evaluate(el=>{el.click();el.click();el.click()});await settled(p);
  await p.goBack();await settled(p);assert.equal(await p.locator('#home').isVisible(),true);
  assert.equal(await p.evaluate(()=>ScrollTrigger.getAll().length),0);
  // Browser back during the transition must end on a usable home view.
  await p.locator('#taste-enter').click();await p.goBack();await settled(p);
  await p.waitForFunction(()=>!document.querySelector('#home').hidden&&!document.body.classList.contains('taste-switching'));
  assert.equal(await p.evaluate(()=>ScrollTrigger.getAll().length),0);
  // Draft-only check: no POST or test submission touches the database.
  let posts=0;p.on('request',r=>{if(r.method()==='POST')posts++;});
  await p.locator('.card[data-id="1"]').click();
  await p.waitForFunction(()=>!document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));
  await p.locator('#tab-share').click();await p.locator('#share-text').fill('品味页面回归测试：此草稿不提交。');
  await p.waitForTimeout(400);await p.keyboard.press('Escape');
  await p.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));
  await p.locator('#taste-enter').click();await settled(p);await p.locator('#taste-back').click();await settled(p);
  await p.locator('.card[data-id="1"]').click();
  await p.waitForFunction(()=>!document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));
  await p.locator('#tab-share').click();assert.equal(await p.locator('#share-text').inputValue(),'品味页面回归测试：此草稿不提交。');
  assert.equal(posts,0);
  await p.close();
 }
 // Direct #taste entry and reduced motion: no char splitting or ScrollTrigger dependency.
 const reduced=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 reduced.on('pageerror',e=>errors.push(e.message));await reduced.goto(base+'#taste',{waitUntil:'networkidle'});await settled(reduced);
 assert.equal(await reduced.locator('#taste-view').isVisible(),true);assert.equal(await reduced.locator('.taste-char').count(),0);
 assert.equal(await reduced.locator('script[src*="ScrollTrigger"]').count(),0);
 await reduced.locator('#taste-back').click();await settled(reduced);assert.equal(await reduced.locator('#home').isVisible(),true);await reduced.close();
 const failure=await browser.newPage({viewport:{width:1440,height:900}});failure.on('pageerror',e=>errors.push(e.message));
 await failure.route('**/vendor/ScrollTrigger.min.js',r=>r.abort());await failure.goto(base+'#taste',{waitUntil:'networkidle'});await settled(failure);
 await failure.waitForTimeout(200);assert.equal(await failure.locator('.taste-char').count(),0);
 assert.match(await failure.locator('.taste-question').innerText(),/一是环境与长期积累/);
 assert.equal(await failure.locator('#taste-view').isVisible(),true);await failure.close();
 assert.deepEqual(errors,[]);console.log('PASS: five sections / six highlights, motion and replay, Chinese wrapping, direct entry and refresh, back/forward and retained home scroll, rapid clicks, scoped trigger cleanup, reduced motion, dependency failure, external new-tab target; 1920/1440.');
}finally{await browser.close()}
