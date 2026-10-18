const LIMIT=5000, PREFIX='wdcc:feedback:v1:';
const uuid=()=>crypto.randomUUID();
const size=text=>Array.from(text).length;
export class ShareForm {
  constructor(panel){
    this.panel=panel;this.states=new Map();this.reportId=null;this.timer=null;
    panel.innerHTML=`<form class="share-form" novalidate>
      <div class="share-heading"><span aria-hidden="true" class="pen-mark">✎</span><label for="share-text">记录你的想法</label><span id="share-mode"></span></div>
      <textarea id="share-text" aria-describedby="share-privacy share-draft share-count" placeholder="关于这场报告，你有哪些想法、问题或启发？" spellcheck="false"></textarea>
      <div class="share-meta"><span id="share-draft" role="status"></span><span id="share-count">0 / 5000</span></div>
      <p id="share-privacy">提交内容仅供整理者查看。草稿仅保存在当前浏览器，不跨设备同步。</p>
      <div id="share-challenge"></div><div class="share-action"><button type="submit" id="share-submit">分享</button><span id="share-result" role="status" aria-live="polite"></span></div>
    </form>`;
    this.text=panel.querySelector('textarea');this.button=panel.querySelector('button');
    this.text.addEventListener('input',()=>this.input());
    panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();this.submit();});
    window.addEventListener('pagehide',()=>this.flush());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.flush();});
    this.configuration=this.loadConfig();
  }
  async loadConfig(){
    const local=['127.0.0.1','localhost'].includes(location.hostname);
    try{
      const r=await fetch(local&&new URLSearchParams(location.search).get('feedback')!=='remote'?'api/share-config':'share-config.json',{cache:'no-store'});
      if(!r.ok)throw Error();this.config=await r.json();
    }catch{this.config={endpoint:''};}
    this.render();return this.config;
  }
  select(id){
    this.flush();this.reportId=id;
    if(!this.states.has(id)){
      let state={text:'',submissionId:uuid(),sentText:null,sentEndpoint:null,saved:false,pending:false};
      try{const stored=JSON.parse(localStorage.getItem(PREFIX+id));
        if(stored&&typeof stored.text==='string')state={...state,text:stored.text,submissionId:/^[\da-f-]{36}$/i.test(stored.submissionId)?stored.submissionId:uuid(),sentText:typeof stored.sentText==='string'?stored.sentText:null,sentEndpoint:typeof stored.sentEndpoint==='string'?stored.sentEndpoint:null,saved:true};
      }catch{state.storageError=true;}
      this.states.set(id,state);
    }
    this.text.value=this.state.text;this.render();
  }
  get state(){return this.states.get(this.reportId);}
  input(){
    const s=this.state;if(!s)return;
    // Preserve one id for an unchanged retry; new edits form a new submission.
    if(this.text.value!==s.text){s.submissionId=uuid();s.text=this.text.value;s.saved=false;s.message='';}
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),300);this.render();
  }
  flush(){
    clearTimeout(this.timer);const s=this.state;if(!s)return;
    try{localStorage.setItem(PREFIX+this.reportId,JSON.stringify({text:s.text,submissionId:s.submissionId,sentText:s.sentText,sentEndpoint:s.sentEndpoint}));s.saved=true;s.storageError=false;}
    catch{s.saved=false;s.storageError=true;}
    this.render();
  }
  render(){
    const s=this.state;if(!s)return;
    const count=size(s.text),sent=s.sentText!==null&&s.text===s.sentText&&s.sentEndpoint===this.config?.endpoint;
    this.panel.querySelector('#share-count').textContent=`${count} / ${LIMIT}`;
    this.panel.querySelector('#share-count').classList.toggle('invalid',count>LIMIT);
    this.text.setAttribute('aria-invalid',String(count>LIMIT));
    this.text.readOnly=s.pending;
    this.panel.querySelector('#share-draft').textContent=s.storageError?'草稿保存失败，请勿关闭页面':s.saved?'草稿已保存在此浏览器':'正在保存草稿…';
    this.panel.querySelector('#share-mode').textContent=this.config?.localTest?'本地测试 · 不上传 GitHub':'';
    this.button.textContent=s.pending?'分享中…':sent?'已分享':'分享';
    this.button.classList.toggle('shared',sent);
    this.button.disabled=s.pending||sent||!s.text.trim()||count>LIMIT;
    this.panel.querySelector('#share-result').textContent=s.message||(!this.config?.endpoint&&this.config?'收集服务尚未接入，草稿仍可保存。':'');
  }
  async challenge(){
    if(this.config.localTest)return '';
    if(!this.config.turnstileSiteKey)throw Error('验证服务尚未配置，草稿已保留。');
    if(!window.turnstile){
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>reject(Error('验证加载失败，请重试。'));document.head.append(script);
      });
    }
    if(this.widget!==undefined)window.turnstile.remove(this.widget);
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('验证超时，请重试。')),120000);
      const finish=fn=>value=>{clearTimeout(timeout);fn(value);};
      this.widget=window.turnstile.render(this.panel.querySelector('#share-challenge'),{sitekey:this.config.turnstileSiteKey,action:'share',callback:finish(resolve),'error-callback':finish(()=>reject(Error('验证失败，请重试。'))),'expired-callback':finish(()=>reject(Error('验证已过期，请重试。')))});
    });
  }
  async submit(){
    const s=this.state;if(!s||s.pending||!s.text.trim()||size(s.text)>LIMIT||(s.text===s.sentText&&s.sentEndpoint===this.config?.endpoint))return;
    const reportId=this.reportId;s.pending=true;s.message='';this.flush();
    try{
      await this.configuration;
      if(!this.config.endpoint)throw Error('收集服务尚未接入，草稿已保留。');
      const token=await this.challenge();
      const response=await fetch(this.config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reportId,body:s.text,submissionId:s.submissionId,turnstileToken:token}),signal:AbortSignal.timeout(20000)});
      const result=await response.json();
      if(!response.ok||!result.id)throw Error(result.message||'分享失败，请重试。');
      s.sentText=s.text;s.sentEndpoint=this.config.endpoint;s.message=this.config.localTest?'本地测试已保存，未上传 GitHub。':'已收到，谢谢你的分享。';
    }catch(error){s.message=error.name==='TimeoutError'?'请求超时，草稿已保留；请重试确认。':error instanceof TypeError?'网络连接失败，草稿已保留；请重试。':error.message||'分享失败，草稿已保留。';}
    finally{
      s.pending=false;
      // Save the originating report even if the visitor navigated away mid-request.
      try{localStorage.setItem(PREFIX+reportId,JSON.stringify({text:s.text,submissionId:s.submissionId,sentText:s.sentText,sentEndpoint:s.sentEndpoint}));s.saved=true;s.storageError=false;}catch{s.storageError=true;}
      this.render();
    }
  }
}
