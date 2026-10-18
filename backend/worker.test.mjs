import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {sqliteBinding} from './local.mjs';
import {handleRequest,syncOne} from './worker.mjs';
function setup(){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  const env={DB:sqliteBinding(db),ALLOWED_ORIGINS:'https://example.test',RATE_LIMIT_SECRET:'test',GITHUB_OWNER:'sodawater14',GITHUB_REPO:'private-test'};
  const request=(data,origin='https://example.test',method='POST')=>new Request('https://api.example.test/api/submissions',{method,headers:{Origin:origin,'Content-Type':'application/json'},...(['POST','PUT'].includes(method)?{body:JSON.stringify(data)}:{})});
  const send=(data,origin)=>handleRequest(request(data,origin),env,{waitUntil(){}},{localTest:true});
  return {db,env,request,send};
}
const data=(extra={})=>({submissionId:crypto.randomUUID(),reportId:1,body:'一条测试想法 <script>alert(1)</script> @someone',...extra});
test('real SQLite persistence, idempotent retries, conflict and private write-only API',async()=>{
  const {db,send,env,request}=setup();const item=data();
  assert.equal((await send(item)).status,201);assert.equal((await send(item)).status,200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get().n,1);
  assert.equal((await send({...item,body:'different'})).status,409);
  for(const invalid of [data({reportId:16}),data({reportId:'1'}),data({body:'  '}),data({body:'中'.repeat(5001)}),data({submissionId:'bad'})])assert.equal((await send(invalid)).status,400);
  assert.equal((await send(data(),'https://evil.test')).status,403);
  assert.equal((await handleRequest(request(null,undefined,'GET'),env,{})).status,405);
  assert.equal(db.prepare('SELECT body FROM submissions').get().body,item.body);db.close();
});
test('10 per source per hour, replay allowed, oversized requests rejected',async()=>{
  const {db,send}=setup();const first=data();await send(first);
  for(let i=1;i<10;i++)assert.equal((await send(data())).status,201);
  assert.equal((await send(data())).status,429);assert.equal((await send(first)).status,200);
  assert.equal((await send(data({body:'x'.repeat(25000)}))).status,413);db.close();
});
test('production requires Turnstile; token hostname and action checked',async()=>{
  const {db,env,request}=setup();assert.equal((await handleRequest(request(data()),env,{})).status,503);
  env.TURNSTILE_SECRET='test';env.TURNSTILE_HOSTNAMES='example.test';const original=globalThis.fetch;
  try{globalThis.fetch=async()=>Response.json({success:true,hostname:'evil.test',action:'share'});assert.equal((await handleRequest(request(data()),env,{})).status,403);}
  finally{globalThis.fetch=original;db.close();}
});
test('GitHub outage retries; reconciliation avoids duplicates; user Markdown fenced',async()=>{
  const {db,env,send}=setup();const item=data();await send(item);
  await syncOne(env,item.submissionId,async()=>{throw Error('github-503');});
  assert.equal(db.prepare('SELECT sync_status FROM submissions').get().sync_status,'pending');
  let creations=0;const issues=[];
  const api=async(path,options)=>{
    if(path.endsWith('/private-test'))return Response.json({private:true});
    if(options?.method==='POST'){
      creations++;const issue={number:9,...JSON.parse(options.body)};issues.push(issue);assert.match(issue.body,/```text/);assert.deepEqual(issue.assignees,['sodawater14']);
      // Simulate GitHub accepting the issue but the response being lost.
      throw Error('timeout');
    }
    return Response.json(issues);
  };
  await syncOne(env,item.submissionId,api);assert.equal(creations,1);
  await syncOne(env,item.submissionId,api);assert.equal(creations,1);
  assert.equal(db.prepare('SELECT sync_status,issue_number FROM submissions').get().sync_status,'synced');
  assert.equal(db.prepare('SELECT issue_number FROM submissions').get().issue_number,9);
  db.close();
});
test('public archives rejected and concurrent sync lease permits one writer',async()=>{
  const {db,env,send}=setup();const item=data();await send(item);let writes=0;
  await syncOne(env,item.submissionId,async()=>Response.json({private:false}));
  assert.equal(db.prepare('SELECT last_error FROM submissions').get().last_error,'archive-must-be-private');
  const api=async(path,options)=>{if(options){writes++;return Response.json({number:3});}return Response.json(path.endsWith('/private-test')?{private:true}:[]);};
  await Promise.all([syncOne(env,item.submissionId,api),syncOne(env,item.submissionId,api)]);assert.equal(writes,1);db.close();
});
