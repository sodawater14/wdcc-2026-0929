import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.PREVIEW_URL||'http://127.0.0.1:4187/',{waitUntil:'networkidle'});
 await p.locator('.cover-skip').evaluate(el=>el.click());await p.waitForFunction(()=>!document.documentElement.classList.contains('cover-pending'));
 const counts=[20,30,30,21,29,30,15,27,23,25,23,26,21,32,38];
 const label=p.locator('.slide[data-offset="0"] .slide-page');
 const check=async(n)=>{await p.waitForFunction(n=>document.querySelector('.slide[data-offset="0"] .slide-page')?.textContent===String(n),n);assert.equal(await label.textContent(),String(n));};
 let total=0;
 for(let id=1;id<=15;id++){
  const data=await (await p.request.get(`http://127.0.0.1:4187/data/${String(id).padStart(2,'0')}.json`)).json();
  assert.equal(data.images.length,counts[id-1]);total+=data.images.length;
  await p.locator(`.card[data-id="${id}"]`).click();await check(1);
  await p.locator('#gallery').focus();await p.keyboard.press('ArrowLeft');await check(counts[id-1]);
  await p.keyboard.press('ArrowRight');await check(1);
  await p.keyboard.press('ArrowRight');await check(2);
  const slots=await p.locator('.slide').evaluateAll(els=>els.map(el=>({index:+el.dataset.index,page:+el.querySelector('.slide-page').textContent})));
  assert(slots.every(s=>s.page===s.index+1));
  assert.equal(await p.locator('#taste-enter').isVisible(),false);
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));
 }
 assert.equal(total,390);
 const link=p.locator('#taste-enter');assert.equal(await link.getAttribute('href'),'#taste');
 for(const width of [1920,1440]){
  await p.setViewportSize({width,height:width===1920?1080:900});await link.scrollIntoViewIfNeeded();
  await p.screenshot({path:`qa/${width}-home-taste-entry.png`});
  await p.locator('.card[data-id="1"]').click();await check(1);
  await p.waitForFunction(()=>document.querySelector('.slide[data-offset="0"] img')?.naturalWidth>0);
  await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#detail')).opacity)>.99);
  await p.locator('.slide[data-offset="0"] img').evaluate(img=>img.decode());
  const boxes=await p.evaluate(()=>({page:document.querySelector('.slide[data-offset="0"] .slide-page').getBoundingClientRect().toJSON(),img:document.querySelector('.slide[data-offset="0"] img').getBoundingClientRect().toJSON(),back:document.querySelector('#back').getBoundingClientRect().toJSON()}));
  assert(boxes.page.top>=boxes.back.bottom);assert(boxes.page.bottom<=boxes.img.top+1);
  assert(Math.abs(boxes.img.height-(width===1920?1080:900)*.6)<1);
  await p.screenshot({path:`qa/${width}-gallery-page-number.png`});
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));
 }
 assert.deepEqual(errors,[]);console.log('PASS: 15 reports / 390 image records; first, last and wraparound page numbers; 1920/1440 spacing; footer taste entry; no page errors.');
}finally{await browser.close()}
