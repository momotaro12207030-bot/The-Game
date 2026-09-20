import fs from 'node:fs';

const path = 'deploy/game.js';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error('Patch target not found: ' + label);
  s = s.replace(from, to);
}

replaceOnce(
" if(index<2)return{pattern:'ribbon',pressure:'calm',biome:'aurora',bias:'center',recovery:false,source:'local'};",
" if(index<1)return{pattern:'ribbon',pressure:'calm',biome:'aurora',bias:'center',recovery:false,source:'local'};",
'only first chunk is tutorial ribbon'
);

replaceOnce(
`function choosePlan(index){
 let p;if(connection.pending){p={...connection.pending};connection.pending=null;}else if(connection.lastPlan&&G.t-connection.lastAt<19&&connection.mode!=='local'&&connection.fail<2){p={...connection.lastPlan};}else p=localPlan(index);
 if(G.health<=1||telemetry().hits12>=2)p={...p,pattern:'bloom',pressure:'calm',recovery:true};
 if(index===0)p={...p,pattern:'ribbon',pressure:'calm'};
 return p;
}`,
`function choosePlan(index){
 let p;
 if(connection.pending){p={...connection.pending};connection.pending=null;}
 else p=localPlan(index);
 if(G.health<=1||telemetry().hits12>=2)p={...p,pattern:'bloom',pressure:'calm',recovery:true};
 if(index===0)p={...p,pattern:'ribbon',pressure:'calm'};
 if(p.source==='jev'&&!p.recovery&&G.recent.slice(-2).every(v=>v===p.pattern)&&G.recent.length>=2){
   const alt=localPlan(index);
   p={...p,pattern:alt.pattern,bias:alt.bias};
 }
 return p;
}`,
'do not reuse stale Jev plan'
);

replaceOnce(
" if(connection.mode!=='local'&&!connection.lastPlan)requestDecision();",
" if(connection.mode!=='local')requestDecision();",
'always request a fresh gameplay decision'
);

replaceOnce(
" if(connection.mode!=='local'&&!connection.busy&&G.t-connection.lastAt>=8&&realTime>=connection.retryAt)requestDecision();",
" if(connection.mode!=='local'&&!connection.busy&&G.t-connection.lastAt>=6.2&&realTime>=connection.retryAt)requestDecision();",
'align Jev cadence to chunk creation'
);

replaceOnce(
" $('#testConnect').disabled=true;$('#connStatus').textContent='接続を確認しています…（1判断を使用）';",
" $('#testConnect').disabled=true;$('#connStatus').textContent='接続を確認しています…';",
'connection status copy'
);

const oldConnect = ` const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);
 try{const r=await callJev({seconds:0,distance:0,health:3,speed:26,pattern:'ribbon',biome:'aurora'},ctrl.signal,config);connection.session++;connection.abort?.abort();Object.assign(connection,config,{lastPlan:r.decision,pending:r.decision,success:connection.success+1,latency:r.latency,fail:0,busy:false,status:\`Jev接続済み · \${r.decision.model}\`,retryAt:0,lastAt:-100});$('#connStatus').textContent=\`接続できました。\${Math.round(r.latency)} ms\\n次の未生成区間からJevが演出します。キー・トークンは保存しません。\`;$('#connectHome').textContent='Jev 接続済み ↗';}
 catch(err){$('#connStatus').textContent=errorMessage(err);}
 finally{clearTimeout(timer);$('#testConnect').disabled=false;refreshSummary();}`;

const newConnect = ` const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);
 try{
  let latency=0,model='jev-latest';
  if(mode==='bridge'){
   const base=config.url||location.origin;
   if(!/^https?:\\/\\//i.test(base))throw Error('サーバーURLを入力してください。');
   const parsed=new URL(base);
   if(parsed.username||parsed.password)throw Error('URLに認証情報を含めないでください。');
   if(location.protocol==='https:'&&parsed.protocol!=='https:')throw Error('HTTPSのゲームにはHTTPSのサーバーが必要です。');
   const then=performance.now();
   const response=await fetch(base.replace(/\\/+$/,'')+'/api/health',{method:'GET',signal:ctrl.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
   if(!response.ok)throw Error('ゲームサーバーの接続確認に失敗しました。');
   const data=await response.json();
   if(!data.ready)throw Error('ゲームサーバーにJev APIキーが設定されていません。');
   latency=performance.now()-then;model=data.model||model;
  }else{
   const r=await callJev({seconds:0,distance:0,health:3,speed:26,pattern:'ribbon',biome:'aurora'},ctrl.signal,config);
   latency=r.latency;model=r.decision.model;
  }
  connection.session++;connection.abort?.abort();
  Object.assign(connection,config,{lastPlan:null,pending:null,latency,fail:0,busy:false,status:\`Jev接続済み · \${model}\`,retryAt:0,lastAt:-100});
  $('#connStatus').textContent=\`接続できました。\${Math.round(latency)} ms\\nプレイ開始後の実データからJevが次区間を判断します。\`;
  $('#connectHome').textContent='Jev 接続済み ↗';
 }
 catch(err){$('#connStatus').textContent=errorMessage(err);}
 finally{clearTimeout(timer);$('#testConnect').disabled=false;refreshSummary();}`;

replaceOnce(oldConnect, newConnect, 'bridge health check instead of fake course decision');

fs.writeFileSync(path, s);
console.log('AFTERLIGHT Jev pacing patch applied');
