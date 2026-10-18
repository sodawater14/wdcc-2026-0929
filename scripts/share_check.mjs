import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4187';
const shot=async name=>page.screenshot({path:fileURLToPath(new URL(`../qa/${name}.png`,import.meta.url))});
async function open(id){await page.locator(`.card[data-id="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));await page.locator('#tab-share').click();await page.waitForTimeout(200);}
async function close(){await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#detail').hidden&&!document.body.classList.contains('animating'));}
const text=page.locator('#share-text'),button=page.locator('#share-submit');
try{
 await fs.mkdir(new URL('../qa/',import.meta.url),{recursive:true});await page.goto(base,{waitUntil:'networkidle'});await open(1);
 assert.match(await page.locator('#share-mode').textContent(),/本地测试/);assert(await button.isDisabled());
 await text.fill('   ');assert(await button.isDisabled());await text.fill('中'.repeat(5001));assert(await button.isDisabled());
 await text.fill('这场报告让我想到：如何让人机协作过程可追溯？\n希望进一步了解选择性撤销的实现。');
 await page.waitForTimeout(400);assert.match(await page.locator('#share-draft').textContent(),/已保存/);
 await shot('1920-share-draft');await close();await open(2);assert.equal(await text.inputValue(),'');
 await text.fill('第二场独立草稿');await close();await open(1);assert.match(await text.inputValue(),/人机协作/);
 await page.reload({waitUntil:'networkidle'});await open(1);assert.match(await text.inputValue(),/人机协作/);
 await button.click();await page.waitForFunction(()=>document.querySelector('#share-submit').textContent==='已分享');
 assert(await button.isDisabled());assert.match(await page.locator('#share-result').textContent(),/本地测试/);assert.match(await text.inputValue(),/人机协作/);await shot('1920-share-success');
 await text.fill('分享后的新草稿');assert.equal(await button.textContent(),'分享');await page.waitForTimeout(350);
 // The server commits but the first response is lost. Retrying keeps the id.
 const ids=[];let first=true;
 await page.route('**/api/submissions',async route=>{ids.push(route.request().postDataJSON().submissionId);if(first){first=false;await route.fetch();await route.abort();}else await route.continue();});
 await button.click();await page.waitForFunction(()=>!document.querySelector('#share-submit').disabled);assert.equal(await text.inputValue(),'分享后的新草稿');
 await button.click();await page.waitForFunction(()=>document.querySelector('#share-submit').textContent==='已分享');assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);await page.unroute('**/api/submissions');
 await text.fill('离开后仍保留的最后一段');await page.locator('#tab-ai').click();await page.locator('#tab-share').click();assert.equal(await text.inputValue(),'离开后仍保留的最后一段');
 await page.route('**/api/submissions',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'测试服务暂时不可用，请重试；草稿已保留。'})}));
 await button.click();await page.waitForFunction(()=>document.querySelector('#share-result').textContent.includes('暂时不可用'));await shot('1920-share-failure');await page.unroute('**/api/submissions');
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(200);await shot('1440-share-draft');
 const box=await page.locator('#panel-share').boundingBox();assert(box.x>0&&box.x+box.width<1440);assert(box.y+box.height<=900+2);
 await text.fill('长文\n'.repeat(500));await text.hover();await page.mouse.wheel(0,400);await page.waitForTimeout(150);assert((await text.evaluate(e=>e.scrollTop))>0);assert(await button.isVisible());
 // Simulate browser storage being unavailable without changing user settings.
 await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota');};});
 await text.fill('保存失败仍可编辑');await page.waitForTimeout(400);assert.match(await page.locator('#share-draft').textContent(),/保存失败/);await shot('1440-share-storage-failure');
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await text.fill('恢复保存');await page.waitForTimeout(400);assert.match(await page.locator('#share-draft').textContent(),/已保存/);
 assert.deepEqual(errors,[]);console.log('PASS: private local persistence; report-isolated drafts; reload/close restore; blank/5000 limit; success/edit; lost-response retry id; failure retention; quota errors; 1920/1440 layout and text scrolling.');
}finally{await browser.close();}
