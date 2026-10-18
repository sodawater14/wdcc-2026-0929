import reports from './reports.json' with {type:'json'};
const REPORTS=new Map(reports.map(r=>[r.id,r]));
const encoder=new TextEncoder();
const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(value,status=200,origin=''){
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}});
}
async function boundedJSON(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('invalid');
  const reader=request.body?.getReader();if(!reader)throw Error('invalid');
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000){await reader.cancel();throw Error('large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleRequest(request,env,ctx,{localTest=false}={}){
  const origin=request.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim());
  if(!origin||!allowed.includes(origin))return json({message:'不允许的来源。'},403);
  const path=new URL(request.url).pathname;
  if(path!=='/api/submissions')return json({message:'Not found'},404,origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}});
  if(request.method!=='POST')return json({message:'Method not allowed'},405,origin);
  try{
    const input=await boundedJSON(request);
    const {submissionId:id,reportId,body}=input;
    if(typeof id!=='string'||!uid.test(id)||!Number.isInteger(reportId)||!REPORTS.has(reportId)||typeof body!=='string'||!body.trim()||Array.from(body).length>5000)return json({message:'请填写 1–5000 字符，并选择有效报告。'},400,origin);
    const existing=await env.DB.prepare('SELECT * FROM submissions WHERE id=?').bind(id).first();
    if(existing){
      if(existing.report_id!==reportId||existing.body!==body)return json({message:'提交编号冲突，请修改文字后重新提交。'},409,origin);
      return json({id,localTest},200,origin);
    }
    if(!localTest){
      if(!env.TURNSTILE_SECRET||!env.RATE_LIMIT_SECRET)return json({message:'收集服务尚未配置完成。'},503,origin);
      const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:input.turnstileToken}),signal:AbortSignal.timeout(10000)});
      if(!verify.ok)throw Error('verification');
      const check=await verify.json();
      const hosts=(env.TURNSTILE_HOSTNAMES||'').split(',').map(x=>x.trim());
      if(!check.success||check.action!=='share'||!hosts.includes(check.hostname))return json({message:'请完成验证后重试。'},403,origin);
    }
    const now=Date.now(),hour=Math.floor(now/3600000);
    const ip=request.headers.get('CF-Connecting-IP')||(localTest?'local':'unknown');
    const key=await crypto.subtle.importKey('raw',encoder.encode(env.RATE_LIMIT_SECRET||'local-only'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const hash=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`${hour}:${ip}`))),n=>n.toString(16).padStart(2,'0')).join('');
    const rate=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(hash,(hour+1)*3600000).first();
    if(rate.count>10)return json({message:'分享次数较多，请稍后再试；草稿已保留。'},429,origin);
    await env.DB.prepare('INSERT INTO submissions(id,report_id,body,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,reportId,body,now).run();
    const saved=await env.DB.prepare('SELECT report_id,body FROM submissions WHERE id=?').bind(id).first();
    if(!saved||saved.report_id!==reportId||saved.body!==body)return json({message:'提交编号冲突，请修改文字后重新提交。'},409,origin);
    if(!localTest)ctx.waitUntil(syncOne(env,id).catch(()=>{}));
    return json({id,localTest},201,origin);
  }catch(error){
    return json({message:error.message==='large'?'内容过长，草稿已保留。':error instanceof SyntaxError||error.message==='invalid'?'提交格式不正确。':'服务暂时不可用，请重试；草稿已保留。'},error.message==='large'?413:error instanceof SyntaxError||error.message==='invalid'?400:503,origin);
  }
}
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function installationToken(env){
  if(!env.GITHUB_APP_ID||!env.GITHUB_INSTALLATION_ID||!env.GITHUB_PRIVATE_KEY)throw Error('github-not-configured');
  const pem=env.GITHUB_PRIVATE_KEY.replace(/-----[^-]+-----|\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const now=Math.floor(Date.now()/1000);
  const message=b64(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+b64(encoder.encode(JSON.stringify({iat:now-60,exp:now+540,iss:env.GITHUB_APP_ID})));
  const jwt=message+'.'+b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(message))));
  const response=await github(`/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,jwt,{method:'POST',body:JSON.stringify({repositories:[env.GITHUB_REPO],permissions:{issues:'write'}})});
  return (await response.json()).token;
}
async function github(path,token,options={}){
  const response=await fetch('https://api.github.com'+path,{...options,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'wdcc-private-feedback','Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`github-${response.status}`);return response;
}
export async function syncOne(env,id,transport){
  const now=Date.now();
  const row=await env.DB.prepare("UPDATE submissions SET sync_status='syncing',lease_until=? WHERE id=? AND sync_status!='synced' AND lease_until<? RETURNING *").bind(now+300000,id,now).first();
  if(!row)return;
  try{
    const marker=`<!-- wdcc-submission:${row.id} -->`;
    const token=transport?'test':await installationToken(env);
    const api=transport||((path,options)=>github(path,token,options));
    const base=`/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    const repo=await (await api(base)).json();
    if(repo.private!==true)throw Error('archive-must-be-private');
    let found,complete=false;
    for(let page=1;page<=10;page++){
      const issues=await (await api(`${base}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}&since=${new Date(row.created_at-60000).toISOString()}`)).json();
      found=issues.find(issue=>!issue.pull_request&&issue.body?.includes(marker));
      if(found||issues.length<100){complete=true;break;}
    }
    if(!complete)throw Error('archive-scan-incomplete');
    if(!found){
      const report=REPORTS.get(row.report_id),time=new Date(row.created_at).toISOString();
      // Fence user input to prevent mentions or Markdown from generating extra notifications.
      const runs=row.body.match(/`+/g)||[];const fence='`'.repeat(Math.max(3,...runs.map(x=>x.length+1)));
      const body=`${marker}\n报告：T${String(row.report_id).padStart(2,'0')} ${report.title}\n\n主讲人：${report.speaker}\n\n收到时间（UTC）：${time}\n\n记录编号：${row.id}\n\n${fence}text\n${row.body}\n${fence}`;
      found=await (await api(`${base}/issues`,{method:'POST',body:JSON.stringify({title:`[T${String(row.report_id).padStart(2,'0')}] ${report.speaker} · ${time}`,body,assignees:[env.GITHUB_OWNER]})})).json();
    }
    await env.DB.prepare("UPDATE submissions SET sync_status='synced',issue_number=?,lease_until=0,last_error=NULL WHERE id=?").bind(found.number,id).run();
  }catch(error){
    const delay=Math.min(3600000,60000*2**Math.min(row.attempts,6));
    await env.DB.prepare("UPDATE submissions SET sync_status='pending',attempts=attempts+1,next_retry=?,lease_until=0,last_error=? WHERE id=?").bind(Date.now()+delay,/^github-\d+$|^archive-|^github-not/.test(error.message)?error.message:'sync-unavailable',id).run();
  }
}
export async function retryPending(env){
  const now=Date.now();
  const {results}=await env.DB.prepare("SELECT id FROM submissions WHERE sync_status!='synced' AND lease_until<? AND next_retry<=? ORDER BY created_at LIMIT 10").bind(now,now).all();
  for(const row of results)await syncOne(env,row.id);
  await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run();
}
export default {fetch:handleRequest,scheduled:(_event,env,ctx)=>ctx.waitUntil(retryPending(env))};
