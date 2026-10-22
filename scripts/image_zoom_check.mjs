import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{const N=Audio;window.Audio=class extends N{constructor(...a){super(...a);window.testAudio=this}}});
 const base=process.env.PREVIEW_URL||'http://127.0.0.1:4187/';await p.goto(base,{waitUntil:'networkidle'});
 await p.locator('.cover-skip').evaluate(el=>el.click());await p.waitForFunction(()=>!document.documentElement.classList.contains('cover-pending'));
 await p.locator('.card').first().click();await p.waitForFunction(()=>!document.querySelector('#detail').hidden);
 const img=p.locator('.slide[data-offset="0"] img'),gallery=p.locator('#gallery'),zoom=p.locator('.image-zoom');
 await p.waitForFunction(()=>document.querySelector('.slide[data-offset="0"] img')?.naturalWidth>0);
 await img.click({force:true});await zoom.waitFor({state:'visible'});assert(await zoom.locator('img').getAttribute('src'));
 assert((await zoom.locator('img').boundingBox()).height>(await gallery.boundingBox()).height);
 await zoom.locator('img').click();assert(!(await zoom.isVisible()));assert(!(await p.locator('#detail').isHidden()));
 await p.locator('#tab-ai').click();await p.waitForFunction(()=>testAudio.duration>0);await p.locator('#audio-toggle').click();await p.waitForFunction(()=>!testAudio.paused&&testAudio.currentTime>.1);
 const time=await p.evaluate(()=>testAudio.currentTime),src=await p.evaluate(()=>testAudio.src);
 await img.click({force:true});await zoom.waitFor({state:'visible'});await p.waitForTimeout(700);
 assert(await p.evaluate(t=>!testAudio.paused&&testAudio.currentTime>t,time));assert.equal(await p.evaluate(()=>testAudio.src),src);
 await p.keyboard.press('ArrowRight');await p.keyboard.press('Escape');assert(!(await zoom.isVisible()));assert(!(await p.locator('#detail').isHidden()));
 assert(await p.evaluate(()=>!testAudio.paused));assert.match(await p.locator('#gallery-status').textContent(),/第 1 张/);
 // Dragging retains the old gallery gesture, rather than opening the viewer.
 const box=await gallery.boundingBox();await p.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.3,box.y+box.height*.5,{steps:10});await p.mouse.up();
 await p.waitForFunction(()=>document.querySelector('#gallery-status').textContent.includes('第 2 张'));assert(!(await zoom.isVisible()));
 await gallery.focus();await p.keyboard.press('Enter');await zoom.waitFor({state:'visible'});await p.keyboard.press('Escape');assert(await p.evaluate(()=>!testAudio.paused));
 await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(200);await gallery.focus();await p.keyboard.press('Enter');await zoom.waitFor({state:'visible'});await fs.mkdir('qa',{recursive:true});await p.screenshot({path:'qa/1440-image-zoom.png'});
 await zoom.locator('.image-zoom-close').click();await gallery.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>document.querySelector('#gallery-status').textContent.includes('第 3 张'));
 await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('#detail').hidden);assert(await p.evaluate(()=>testAudio.paused));
 assert.deepEqual(errors,[]);console.log('PASS: click enlarge/restore, Esc only closes viewer, drag still changes images, keyboard navigation, audio continuously advances with unchanged source, report close still resets audio; 1920/1440.');
}finally{await browser.close()}
