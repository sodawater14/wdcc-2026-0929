import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 for(const viewport of [{width:1920,height:900},{width:2048,height:951},{width:1920,height:1080},{width:1440,height:900}]){
  const p=await browser.newPage({viewport,reducedMotion:'no-preference'});await p.goto('http://127.0.0.1:4187/#taste',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-effect="3"] .taste-glyph')&&!document.body.classList.contains('taste-switching'));
  const word=p.locator('[data-effect="3"] .taste-glyph').first();
  assert.equal(await word.evaluate(el=>getComputedStyle(el).color),'rgb(23, 23, 23)');
  await p.waitForTimeout(180);assert.equal(await word.evaluate(el=>getComputedStyle(el).color),'rgb(23, 23, 23)');
  await p.waitForFunction(()=>getComputedStyle(document.querySelector('[data-effect="3"] .taste-glyph')).color==='rgb(255, 0, 0)');
  assert.equal(await p.evaluate(()=>scrollY),0,'Visible word must reveal without requiring more scroll');
  if(viewport.width===1920&&viewport.height===900)await p.screenshot({path:'qa/1920x900-taste-visible-fix.png'});
  await p.close();
 }
 console.log('PASS: first word starts black and reveals bright red after entry without extra scrolling, including 1920x900 and zoom-equivalent 2048x951.');
}finally{await browser.close()}
