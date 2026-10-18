import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
await page.addInitScript(()=>{const N=Audio;window.Audio=class extends N{constructor(...args){super(...args);window.testAudio=this;}};});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4187';
const root=page.locator('#personal-summary');
const countItems=items=>items.reduce((sum,i)=>sum+1+countItems(i.children||[]),0);
const open=async id=>{await page.locator(`.card[data-id="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));await page.locator('#tab-ai').click();await page.waitForFunction(()=>document.querySelectorAll('.curved-ready').length===2);await page.waitForTimeout(150);};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));};
const shot=async name=>page.screenshot({path:fileURLToPath(new URL(`../qa/${name}.png`,import.meta.url))});
async function bar(){return root.evaluate(content=>{const svg=content.parentElement.querySelector('.curved-scrollbar'),path=svg.querySelector('.curved-track'),thumb=svg.querySelector('.curved-thumb');return{height:content.clientHeight,full:content.scrollHeight,scroll:content.scrollTop,length:path.getTotalLength(),thumb:parseFloat(thumb.getAttribute('stroke-dasharray')),progress:Number(svg.getAttribute('aria-valuenow')),hidden:svg.hasAttribute('hidden')};});}
async function synced(){await page.waitForTimeout(100);const b=await bar();if(b.full>b.height+1){assert(!b.hidden);assert(Math.abs(b.thumb-Math.max(24,b.length*b.height/b.full))<1);assert(Math.abs(b.progress-Math.round(b.scroll/(b.full-b.height)*100))<=1);}else assert(b.hidden);return b;}
try{
 await fs.mkdir(new URL('../qa/',import.meta.url),{recursive:true});await page.goto(base,{waitUntil:'networkidle'});
 for(let id=1;id<=15;id++){
  await open(id);const data=JSON.parse(await fs.readFile(new URL(`../data/${String(id).padStart(2,'0')}.json`,import.meta.url),'utf8'));
  assert.equal(await root.locator('.personal-section').count(),4);
  assert.equal(await root.locator('details').count(),data.personalSummary.slice(1,3).reduce((n,s)=>n+countItems(s.items),0));
  assert.equal(await root.locator('details[open]').count(),0);
  const expected=data.personalSummary.map(s=>s.title+s.html).join('');
  assert(await root.evaluate((el,original)=>{const old=document.createElement('div');old.innerHTML=original;const norm=s=>s.replace(/\s/g,'');return norm(el.textContent)===norm(old.textContent);},expected));
  assert.equal(await root.locator('.summary-keyword').count(),data.personalSummary[3].keywords.length);
  assert(await root.locator('.summary-label').evaluateAll(els=>els.every(e=>getComputedStyle(e).color==='rgb(255, 0, 0)')));
  assert.equal(await root.locator('.summary-core details,.summary-keywords details').count(),0);
  const first=root.locator('details').first();await first.locator('summary').first().click();await page.waitForTimeout(100);assert(await first.evaluate(e=>e.open));
  const second=root.locator('.summary-points').first().locator(':scope > details').nth(1);await second.locator('summary').first().click();await page.waitForTimeout(100);assert(await first.evaluate(e=>e.open));assert(await second.evaluate(e=>e.open));
  await synced();
  if([12,15].includes(id)){
   const title=id===12?'三项设计能力：':'人机分工随阶段变化：';
   const group=root.locator('details').filter({has:page.locator(':scope > summary .summary-label').filter({hasText:title})});
   // Find by its direct summary to distinguish the nested children.
   const info=await root.evaluate((el,title)=>{const d=[...el.querySelectorAll('details')].find(d=>d.querySelector(':scope > summary .summary-label').textContent===title);return{found:Boolean(d),children:d?.querySelectorAll(':scope > .summary-body > .summary-children > details').length};},title);
   assert(info.found);assert.equal(info.children,3);
  }
  if(id===1){
   const summary=first.locator('summary').first();await summary.focus();await page.keyboard.press('Enter');await page.waitForTimeout(80);assert(!(await first.evaluate(e=>e.open)));await page.keyboard.press('Space');await page.waitForTimeout(80);assert(await first.evaluate(e=>e.open));
   await root.evaluate(e=>e.scrollTop=100);const saved=await root.evaluate(e=>e.scrollTop);await page.locator('#tab-ai').click();await page.locator('#tab-ai').click();await page.waitForTimeout(180);assert.equal(await root.evaluate(e=>e.scrollTop),saved);assert(await first.evaluate(e=>e.open));
   await page.locator('#tab-share').click();await page.locator('#tab-ai').click();await page.waitForTimeout(180);assert.equal(await root.evaluate(e=>e.scrollTop),saved);assert(await first.evaluate(e=>e.open));
   await page.locator('#audio-toggle').click();await page.waitForFunction(()=>!testAudio.paused&&document.querySelector('#audio-toggle').getAttribute('aria-pressed')==='true');
   await summary.click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>testAudio.paused),false);
  }
  await close();
 }
 for(const viewport of [{width:1920,height:1080},{width:1440,height:900}]){
  await page.setViewportSize(viewport);await open(1);assert.equal(await root.locator('details[open]').count(),0);await shot(`${viewport.width}-summary-collapsed`);
  const points=root.locator('.summary-points').first().locator(':scope > details');await points.nth(0).locator('summary').click();await points.nth(1).locator('summary').click();await root.evaluate(e=>e.scrollTop=0);await synced();await shot(`${viewport.width}-summary-expanded`);
  const before=await bar();await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));const after=await synced();assert(after.full>before.full);
  const left=await page.locator('#transcript').evaluate(e=>e.scrollTop);await root.evaluate(e=>e.scrollTop=e.scrollHeight);await synced();await shot(`${viewport.width}-summary-bottom`);assert.equal(await page.locator('#transcript').evaluate(e=>e.scrollTop),left);
  // At the bottom, closing many points must clamp scroll and hide a non-overflowing bar if needed.
  await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=false));const end=await synced();assert(end.scroll>=0&&end.scroll<=Math.max(0,end.full-end.height)+1);
  // A visible clicked title retains its screen position when enough scroll room exists.
  await root.evaluate(e=>e.scrollTop=0);const summary=points.nth(0).locator('summary');const top=await summary.evaluate(e=>e.getBoundingClientRect().top);await summary.click();await page.waitForTimeout(100);assert(Math.abs((await summary.evaluate(e=>e.getBoundingClientRect().top))-top)<2);
  await close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: all 15 reports, complete rendered text/keywords, default collapse, multi-open, T12/T15 nested groups, keyboard, state memory/reset, audio unaffected, scrollbar size/progress/boundary and click anchor; 1920/1440 screenshots.');
}finally{await browser.close();}
