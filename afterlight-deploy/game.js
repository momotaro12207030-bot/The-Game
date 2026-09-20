/* AFTERLIGHT v1.0 — self-contained WebGL game, no third-party runtime. */
(()=>{'use strict';
const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sm=t=>{t=clamp(t,0,1);return t*t*(3-2*t)},TAU=Math.PI*2;
const rand=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x)},rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const rgb=s=>[parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255];
const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const C={white:rgb('eaffec'),mint:rgb('95ffda'),danger:rgb('ff907e'),gold:rgb('ffe6ad')};
const THEMES={
 aurora:{name:'AURORA',ja:'オーロラの結晶海',top:rgb('061824'),fog:rgb('376365'),road:rgb('163c42'),edge:rgb('8efcd8'),solid:rgb('417b83'),sun:rgb('c5ffcb')},
 ember:{name:'SOLSTICE',ja:'陽だまりの空中遺跡',top:rgb('382632'),fog:rgb('ab7270'),road:rgb('574354'),edge:rgb('ffd4a0'),solid:rgb('af827c'),sun:rgb('ffe1b0')},
 prism:{name:'PRISM',ja:'硝子でできた未来都市',top:rgb('17142e'),fog:rgb('655c8b'),road:rgb('2c355a'),edge:rgb('d8bbff'),solid:rgb('6569a0'),sun:rgb('ffaace')},
 abyss:{name:'TIDELIGHT',ja:'星を沈めた深海の空',top:rgb('041824'),fog:rgb('255064'),road:rgb('13313e'),edge:rgb('81ddf1'),solid:rgb('367b88'),sun:rgb('aaecef')}
};
const PATTERN_NAME={ribbon:'RIBBON',slalom:'SLALOM',gates:'GATEWAY',comets:'STARFALL',braid:'BRAID',helix:'SPIRAL',bloom:'BLOOM',rush:'CRYSTAL RUSH'};
const GIMMICK_NAME={crystal:'CRYSTALS',laser:'LASER WALL',mine:'PULSE MINE',shard:'SHARD BED',tower:'TWIN TOWERS',phase:'PHASE GATE',vortex:'VORTEX RING'};
const SECTION=112,LANES=[-3.4,-1.7,0,1.7,3.4],WIDTH=5.1,MAX_STEER=10;
const trackX=s=>Math.sin(s/145)*7+Math.sin(s/64)*1.7,trackY=s=>Math.sin(s/90)*1.65+Math.sin(s/210)*1.1;
let best=0,soundOn=false,hapticOn=false;
try{best=Number(localStorage.getItem('afterlight.best.v1'))||0;soundOn=localStorage.getItem('afterlight.sound')==='1';hapticOn=localStorage.getItem('afterlight.haptic')==='1'}catch(_){}
$('#homeBest').textContent='BEST '+best.toLocaleString();
const G={state:'home',t:0,d:0,prevD:0,x:0,target:0,vx:0,speed:26,health:3,score:0,gems:0,combo:0,flow:0,surge:0,inv:0,seed:1,chunks:[],particles:[],events:[],recent:[],section:-1,hits:0,near:0,maxCombo:0,applied:0,runId:0,shake:0,flash:0,tutorial:0,frameMs:16};
const connection={mode:'local',key:'',url:'',token:'',status:'ローカル生成',calls:0,success:0,fail:0,latency:null,lastAt:-100,lastPlan:null,pending:null,busy:false,abort:null,session:0,retryAt:0,limit:120};
const input={down:false,id:null,start:0,startX:0,left:false,right:false};
let realTime=0,lastTime=0,announceUntil=0,displayedScore=-1,uiTimer=0,homeDrift=0,modeReturn='home';
function showState(state){G.state=state;document.body.dataset.state=state;$('#home').classList.toggle('hidden',state!=='home');$('#pauseOverlay').classList.toggle('hidden',state!=='pause');$('#end').classList.toggle('hidden',state!=='end');$('#pause').disabled=state!=='play';input.down=false;input.left=false;input.right=false;input.id=null;audio.setActive(state==='play');}
function announce(title,subtitle=''){if(G.state!=='play')return;$('#announcement b').textContent=title;$('#announcement small').textContent=subtitle;$('#announcement').classList.add('show');announceUntil=realTime+2.2;}
function event(type,value=1){G.events.push({time:G.t,type,value});}
function telemetry(){
 const e=G.events.filter(e=>e.time>=G.t-12),count=k=>e.filter(e=>e.type===k).reduce((a,b)=>a+b.value,0),b=e.filter(e=>e.type==='bias');
 const active=G.chunks.find(c=>G.d>=c.start&&G.d<c.end)||G.chunks[0];
 return JevDirector.cleanTelemetry({seconds:G.t,distance:G.d,speed:G.speed,health:G.health,hits12:count('hit'),gems12:count('gem'),near12:count('near'),steer12:count('steer'),sideBias:b.length?b.reduce((a,b)=>a+b.value,0)/b.length:0,flow:G.flow,combo:G.combo,section:Math.max(0,G.section),best,pattern:active?.plan.pattern||'ribbon',gimmick:active?.plan.gimmick||'crystal',biome:active?.plan.biome||'aurora',recent:G.recent,repeats:G.recent.filter(p=>p===active?.plan.pattern).length});
}
function localPlan(index){
 const t=telemetry(),r=rng(G.seed+index*19373),recover=t.health<=1||t.hits12>=2;
 if(index<1)return{pattern:'ribbon',gimmick:'crystal',pressure:'calm',biome:'aurora',bias:'center',recovery:false,source:'local'};
 let list=['slalom','gates','braid','comets','helix','rush','bloom'];list=list.filter(v=>v!==G.recent.at(-1));
 const gimmicks=['crystal','laser','mine','shard','tower','phase','vortex'];
 return{pattern:recover?'bloom':list[Math.floor(r()*list.length)],gimmick:recover?'crystal':gimmicks[Math.floor(r()*gimmicks.length)],pressure:recover?'calm':G.t>60&&t.hits12===0?'intense':'steady',biome:JevDirector.BIOMES[Math.floor(index/3)%4],bias:t.sideBias>.35?'left':t.sideBias<-.35?'right':'center',recovery:recover,source:'local'};
}
function choosePlan(index){
 let p;
 if(connection.pending){p={...connection.pending};connection.pending=null;}
 else p=localPlan(index);
 const t=telemetry(),gimmicks=['crystal','laser','mine','shard','tower','phase','vortex'];
 if(!gimmicks.includes(p.gimmick))p={...p,gimmick:'crystal'};
 if(G.health<=1||t.hits12>=2)p={...p,pattern:'bloom',gimmick:'crystal',pressure:'calm',recovery:true};
 if(index===0)p={...p,pattern:'ribbon',gimmick:'crystal',pressure:'calm'};
 const passive=t.seconds>12&&t.hits12===0&&t.health>=2&&t.steer12<.45;
 if(passive&&!p.recovery){
   if(p.pressure==='calm')p={...p,pressure:'steady'};
   if(t.seconds>35)p={...p,pressure:'intense'};
   if(['ribbon','bloom'].includes(p.pattern))p={...p,pattern:index%2?'slalom':'gates'};
   if(['crystal','vortex'].includes(p.gimmick))p={...p,gimmick:index%2?'laser':'phase'};
 }
 if(p.source==='jev'&&!p.recovery&&G.recent.slice(-2).every(v=>v===p.pattern)&&G.recent.length>=2){
   const alt=localPlan(index);p={...p,pattern:alt.pattern,bias:alt.bias};
 }
 const prevG=G.chunks.at(-1)?.plan.gimmick;
 if(p.source==='jev'&&!p.recovery&&prevG===p.gimmick){const alt=localPlan(index);p={...p,gimmick:alt.gimmick};}
 return p;
}
/* Pure procedural generator. Its gem path also certifies a bounded-speed safe route. */
function generateChunk(index,plan,seed,previousLane=2){
 const r=rng((seed+index*4973)>>>0),start=index*SECTION,end=start+SECTION,rows=[],gems=[],guide=[{s:start-6,x:LANES[previousLane]}];let lane=previousLane;
 const intensity=plan.pressure==='intense'?2:plan.pressure==='steady'?1:0;
 const recovery=plan.pattern==='bloom'||plan.recovery;
 const gimmick=plan.gimmick||'crystal';
 const spacing=recovery?32:gimmick==='phase'?22:gimmick==='laser'?24:intensity===2?21:intensity===1?25:30;
 for(let s=start+24,j=0;s<end-10;s+=spacing,j++){
  let target=plan.bias==='left'?1:plan.bias==='right'?3:2;
  if(['slalom','braid','helix'].includes(plan.pattern)||gimmick==='phase')target=(index+j)%2?3:1;
  else if(plan.pattern==='comets')target=Math.floor(r()*5);
  else if(plan.pattern==='rush')target=2;
  else if(gimmick==='laser'&&j%2)target=(index+j)%2?1:3;
  if(index===0)target=2;
  lane=clamp(lane+Math.sign(target-lane),0,4);
  const obstacles=[];let candidates=[0,1,2,3,4].filter(k=>k!==lane);
  for(let q=candidates.length-1;q>0;q--){const k=Math.floor(r()*(q+1));[candidates[q],candidates[k]]=[candidates[k],candidates[q]];}
  let n=recovery?0:intensity+1;
  if(plan.pattern==='gates'&&intensity>0)n=3;
  if(plan.pattern==='ribbon')n=index===0?0:1;
  if(plan.pattern==='rush')n=1;
  if(gimmick==='laser')n=recovery?0:(intensity===0?2:4);
  if(gimmick==='phase')n=recovery?0:(intensity===2?4:3);
  if(gimmick==='tower')n=recovery?0:(intensity===2?3:2);
  if(gimmick==='mine'||gimmick==='shard')n=recovery?0:Math.min(3,n+1);
  if(gimmick==='vortex')n=recovery?0:Math.min(2,Math.max(1,n));
  if(recovery&&j%3===2)n=1;
  if(index===0)n=0;
  const kind=gimmick!=='crystal'?gimmick:plan.pattern==='comets'?'comet':plan.pattern==='gates'?'gate':'crystal';
  for(const k of candidates.slice(0,n))obstacles.push({x:LANES[k],kind,hit:false,near:false,seed:r()});
  rows.push({s,safeLane:lane,obstacles,passed:false});guide.push({s,x:LANES[lane]});
 }
 guide.push({s:end-3,x:LANES[lane]});
 for(let s=start+6,k=0;s<end-3;s+=6,k++){
  let a=guide[0],b=guide.at(-1);for(let j=1;j<guide.length;j++){if(s<=guide[j].s){a=guide[j-1];b=guide[j];break;}}
  const u=sm((s-a.s)/(b.s-a.s));gems.push({s,x:lerp(a.x,b.x,u),taken:false,repair:recovery&&k===8,seed:r()});
 }
 return{index,start,end,plan:{...plan},rows,gems,guide,lastLane:lane,birth:realTime};
}
function ensureChunks(){
 while(!G.chunks.length||G.chunks.at(-1).end<G.d+150){
  const last=G.chunks.at(-1),index=last?last.index+1:0,plan=choosePlan(index),chunk=generateChunk(index,plan,G.seed,last?last.lastLane:2);
  G.chunks.push(chunk);G.recent.push(plan.pattern);if(G.recent.length>6)G.recent.shift();
 }
 while(G.chunks.length>2&&G.chunks[0].end<G.d-25)G.chunks.shift();
}
function planAt(s){return(G.chunks.find(c=>s>=c.start&&s<c.end)||G.chunks.at(-1))?.plan||{biome:'aurora',pattern:'ribbon',source:'local'};}
function start(){
 G.runId++;if(connection.abort)connection.abort.abort();connection.busy=false;connection.retryAt=0;
 Object.assign(G,{t:0,d:0,prevD:0,x:0,target:0,vx:0,speed:26,health:3,score:0,gems:0,combo:0,flow:0,surge:0,inv:2,seed:(Math.random()*2147483647)|0,chunks:[],particles:[],events:[],recent:[],section:-1,hits:0,near:0,maxCombo:0,applied:0,shake:0,flash:0,tutorial:7});
 connection.lastAt=connection.lastPlan?0:-100;if(connection.lastPlan)connection.pending={...connection.lastPlan};
 ensureChunks();showState('play');audio.unlock();displayedScore=-1;updateUI();$('#tip').classList.add('visible');$('#announcement').classList.remove('show');
 if(connection.mode!=='local')requestDecision();
}
function home(){if(connection.abort)connection.abort.abort();connection.busy=false;G.runId++;G.particles=[];$('#announcement').classList.remove('show');$('#tip').classList.remove('visible');showState('home');$('#homeBest').textContent='BEST '+best.toLocaleString();}
function pause(){if(G.state!=='play')return;showState('pause');$('#tip').classList.remove('visible');refreshSummary();}
function resume(){if(G.state!=='pause')return;showState('play');audio.unlock();}
function finish(){
 const score=Math.floor(G.score);const record=score>best;if(record){best=score;try{localStorage.setItem('afterlight.best.v1',String(best))}catch(_){}}
 $('#resultScore').textContent=score.toLocaleString();$('#resultDetail').textContent=`${record?'NEW BEST · ':''}${Math.floor(G.d)} m  /  ${G.gems} crystals  /  ${Math.max(1,G.section+1)} worlds`;
 $('#tip').classList.remove('visible');$('#announcement').classList.remove('show');showState('end');audio.note(220,.6,.035,'sine');
}
function burst(x,s,color,n=16,power=1){for(let i=0;i<n;i++){if(G.particles.length>220)G.particles.shift();G.particles.push({x,y:.8,s,vx:(Math.random()-.5)*6*power,vy:(Math.random()*5+1)*power,vs:(Math.random()-.5)*7,life:.35+Math.random()*.7,max:1,color});}}
function hit(o,s){
 if(o.hit)return;o.hit=true;
 if(G.surge>0){G.score+=60;burst(o.x,s,C.gold,16,1.5);audio.note(440,.09,.022);return;}
 if(G.inv>0)return;
 G.health--;G.hits++;G.combo=0;G.flow*=.5;G.inv=1.7;G.shake=.8;G.flash=.55;event('hit');burst(G.x,G.d,C.danger,28,1.4);audio.hit();vibrate(35);
 if(G.health<=0)finish();
}
function getGem(g){
 g.taken=true;G.gems++;G.combo++;G.maxCombo=Math.max(G.maxCombo,G.combo);G.score+=15+Math.min(30,Math.floor(G.combo/8));event('gem');
 G.flow=clamp(G.flow+(G.surge>0?.008:.048),0,1);burst(g.x,g.s,g.repair?C.gold:C.mint,5,.6);audio.gem(G.combo);
 if(g.repair&&G.health<3){G.health++;announce('REPAIR','光が、シールドをつなぐ。');vibrate(12);}
 if(G.flow>=1&&G.surge<=0){G.flow=0;G.surge=4.5;G.inv=Math.max(G.inv,4.5);G.flash=.16;announce('LIGHT SURGE','いまは、何にも止められない。');audio.surge();vibrate([12,35,12]);}
}
function step(dt){
 if(G.state!=='play')return;
 G.t+=dt;G.prevD=G.d;
 const lastX=G.x;
 if(input.left||input.right)G.target=clamp(G.target+(Number(input.right)-Number(input.left))*dt*8,-4.55,4.55);
 const dx=clamp((G.target-G.x)*11,-MAX_STEER,MAX_STEER)*dt;G.x=clamp(G.x+dx,-4.55,4.55);G.vx=lerp(G.vx,dx/Math.max(.001,dt),1-Math.exp(-dt*8));
 const targetSpeed=26+Math.min(5,G.t*.024)+(G.surge>0?10:0);G.speed=lerp(G.speed,targetSpeed,1-Math.exp(-dt*2));G.d+=G.speed*dt;G.score+=G.speed*dt*.8;
 G.surge=Math.max(0,G.surge-dt);G.inv=Math.max(0,G.inv-dt);G.shake=Math.max(0,G.shake-dt*2);G.flash=Math.max(0,G.flash-dt*1.8);G.tutorial-=dt;
 if(G.tutorial<=0)$('#tip').classList.remove('visible');
 ensureChunks();
 for(const chunk of G.chunks){
  for(const row of chunk.rows){
   if(row.passed||row.s>G.d)continue;row.passed=true;
   if(row.s<G.prevD-.1)continue;
   const atX=lerp(lastX,G.x,clamp((row.s-G.prevD)/Math.max(.001,G.d-G.prevD),0,1));
   for(const o of row.obstacles){const radius=o.kind==='tower'?.88:o.kind==='mine'?.62:o.kind==='shard'?.58:o.kind==='laser'?.72:o.kind==='phase'?.70:o.kind==='vortex'?.68:.77;const gap=Math.abs(atX-o.x);if(gap<radius){hit(o,row.s);if(G.state!=='play')break;}else if(gap<radius+.46&&!o.near&&G.inv<=0){o.near=true;G.near++;G.score+=35;G.flow=Math.min(1,G.flow+.09);event('near');burst(o.x,row.s,C.gold,4,.5);audio.note(760,.045,.008);}}
   if(G.state!=='play')break;
  }
  if(G.state!=='play')return;
  for(const g of chunk.gems){if(g.taken||g.s<G.prevD-2||g.s>G.d+1.5)continue;const atX=lerp(lastX,G.x,clamp((g.s-G.prevD)/Math.max(.001,G.d-G.prevD),0,1));if(Math.abs(g.x-atX)<(G.surge>0?1.8:.95))getGem(g);}
 }
 const idx=Math.floor(G.d/SECTION);
 if(idx!==G.section){G.section=idx;const p=planAt(G.d);if(p.source==='jev')G.applied++;if(idx>0)announce(THEMES[p.biome].name,`${PATTERN_NAME[p.pattern]} · ${GIMMICK_NAME[p.gimmick]||'CRYSTALS'} · ${p.source==='jev'?'JEV DIRECTED':'PROCEDURAL'}`);}
 uiTimer+=dt;
 if(uiTimer>.16){event('bias',G.x/4.55);event('steer',Math.abs(G.vx)*uiTimer);G.events=G.events.filter(e=>e.time>G.t-13);uiTimer=0;updateUI();}
 if(connection.mode!=='local'&&!connection.busy&&G.t-connection.lastAt>=6.2&&realTime>=connection.retryAt)requestDecision();
 audio.update(dt,G);
}
function updateUI(){
 const score=Math.floor(G.score);if(score!==displayedScore){$('#score').textContent=score.toLocaleString();displayedScore=score;}
 const p=planAt(G.d),live=p.source==='jev'&&connection.mode!=='local'&&connection.fail===0&&connection.success>0;
 const mode=live?'JEV LIVE':connection.mode!=='local'&&connection.success&&connection.fail===0?'JEV READY':'LOCAL';
 $('#mode').textContent=mode;$('#mode').classList.toggle('live',live);
 [...$('#health').children].forEach((el,i)=>el.classList.toggle('empty',i>=G.health));$('#health').setAttribute('aria-label',`シールド${G.health}`);
 $('#charge span').style.transform=`scaleX(${G.surge>0?G.surge/4.5:G.flow})`;
}
function vibrate(n){if(hapticOn&&navigator.vibrate)try{navigator.vibrate(n)}catch(_){}}
function refreshSummary(){const p=planAt(G.d);$('#summary').textContent=`${p.source==='jev'?'この区間：Jevの判断':'この区間：ローカル生成'}\n${connection.status}\n成功 ${connection.success} / 送信 ${connection.calls} / 上限 ${connection.limit}${connection.latency!==null?' · '+Math.round(connection.latency)+' ms':''}`;}
function errorMessage(err){if(err.name==='AbortError')return'通信がタイムアウトしました。ローカル生成で続行します。';return String(err.message||'接続に失敗しました。').slice(0,200);}
async function callJev(t,signal,override=null){
 const cfg=override||connection;if(connection.calls>=connection.limit)throw Error('このタブの120判断上限に達しました。ローカル生成で続行します。');
 let url,headers={'Content-Type':'application/json'},body;
 if(cfg.mode==='direct'){
  if(!cfg.key)throw Error('APIキーを入力してください。');url='https://api.typesafe.ai/v1/systemone';headers.Authorization='Bearer '+cfg.key;body=JevDirector.buildRequest(t);
 }else{
  const base=cfg.url||location.origin;
  if(!/^https?:\/\//i.test(base))throw Error('サーバーURLを入力してください。');
  const parsed=new URL(base);if(parsed.username||parsed.password)throw Error('URLに認証情報を含めないでください。');
  if(location.protocol==='https:'&&parsed.protocol!=='https:')throw Error('HTTPSのゲームにはHTTPSのサーバーが必要です。');
  url=base.replace(/\/+$/,'')+'/api/director';headers['X-Game-Token']=cfg.token;body={telemetry:t};
 }
 connection.calls++;const then=performance.now();
 let response;try{response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error'});}catch(err){if(err.name==='AbortError')throw err;throw Error(cfg.mode==='direct'?'公式APIへ直接接続できません。通信環境・CORSを確認するか、付属の安全なサーバーを使ってください。':'ゲームサーバーに接続できません。URLとネットワークを確認してください。');}
 if(!response.ok){const labels={401:cfg.mode==='direct'?'APIキーを確認してください。':'ゲーム用トークンを確認してください。',403:'利用権限、残高、トークンまたは接続元を確認してください。',429:'呼出し回数制限です。間隔を空けて再試行します。',503:'サーバーのAPIキー設定または利用上限を確認してください。',502:'Jev側の通信に失敗しました。',504:'Jevの応答待ちがタイムアウトしました。'};throw Error(`HTTP ${response.status}：${labels[response.status]||'Jev接続を確認してください。'}`);}
 let data;try{data=await response.json();}catch(_){throw Error('JSONではない応答です。サーバーURLを確認してください。');}
 const decision=JevDirector.parseDecision(data,t);return{decision,latency:performance.now()-then};
}
async function requestDecision(){
 if(connection.busy||G.state!=='play')return;
 if(connection.calls>=connection.limit){connection.status='120判断に達したためローカルへ切替';connection.mode='local';return;}
 const run=G.runId,session=connection.session,t=telemetry();connection.busy=true;connection.lastAt=G.t;
 const controller=new AbortController();connection.abort=controller;const timeout=setTimeout(()=>controller.abort(),5000);
 try{const r=await callJev(t,controller.signal);if(run!==G.runId||session!==connection.session)return;connection.pending=r.decision;connection.lastPlan=r.decision;connection.lastAt=G.t;connection.success++;connection.fail=0;connection.latency=r.latency;connection.status=`Jev接続済み · ${r.decision.model}`;}
 catch(err){if(run!==G.runId||session!==connection.session)return;connection.fail++;connection.status=errorMessage(err);connection.retryAt=realTime+Math.min(60,8*Math.pow(2,Math.min(connection.fail,3)));}
 finally{clearTimeout(timeout);if(run===G.runId&&session===connection.session){connection.busy=false;connection.abort=null;}}
}
function updateConnectionFields(){const m=$('#connMode').value;$('#directFields').style.display=m==='direct'?'block':'none';$('#bridgeFields').style.display=m==='bridge'?'block':'none';$('#testConnect').textContent=m==='local'?'ローカルで使う':'接続して使う';}
function openConnection(){modeReturn=G.state;if(G.state==='play')pause();$('#connMode').value=connection.mode;$('#apiKey').value=connection.key;$('#bridgeUrl').value=connection.url;$('#gameToken').value=connection.token;$('#connStatus').textContent=connection.status;updateConnectionFields();$('#connection').classList.remove('hidden');}
function closeConnection(){$('#connection').classList.add('hidden');$('#apiKey').value='';$('#gameToken').value='';refreshSummary();}
async function connect(){
 const mode=$('#connMode').value;const config={mode,key:$('#apiKey').value.trim(),url:$('#bridgeUrl').value.trim().replace(/\/+$/,''),token:$('#gameToken').value.trim()};
 if(mode==='local'){
  connection.session++;connection.abort?.abort();Object.assign(connection,{mode:'local',key:'',url:'',token:'',busy:false,pending:null,lastPlan:null,status:'ローカル生成（外部送信なし）'});closeConnection();return;
 }
 $('#testConnect').disabled=true;$('#connStatus').textContent='接続を確認しています…';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);
 try{
  let latency=0,model='jev-latest';
  if(mode==='bridge'){
   const base=config.url||location.origin;
   if(!/^https?:\/\//i.test(base))throw Error('サーバーURLを入力してください。');
   const parsed=new URL(base);
   if(parsed.username||parsed.password)throw Error('URLに認証情報を含めないでください。');
   if(location.protocol==='https:'&&parsed.protocol!=='https:')throw Error('HTTPSのゲームにはHTTPSのサーバーが必要です。');
   const then=performance.now();
   const response=await fetch(base.replace(/\/+$/,'')+'/api/health',{method:'GET',signal:ctrl.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
   if(!response.ok)throw Error('ゲームサーバーの接続確認に失敗しました。');
   const data=await response.json();
   if(!data.ready)throw Error('ゲームサーバーにJev APIキーが設定されていません。');
   latency=performance.now()-then;model=data.model||model;
  }else{
   const r=await callJev({seconds:0,distance:0,health:3,speed:26,pattern:'ribbon',biome:'aurora'},ctrl.signal,config);
   latency=r.latency;model=r.decision.model;
  }
  connection.session++;connection.abort?.abort();
  Object.assign(connection,config,{lastPlan:null,pending:null,latency,fail:0,busy:false,status:`Jev接続済み · ${model}`,retryAt:0,lastAt:-100});
  $('#connStatus').textContent=`接続できました。${Math.round(latency)} ms\nプレイ開始後の実データからJevが次区間を判断します。`;
  $('#connectHome').textContent='Jev 接続済み ↗';
 }
 catch(err){$('#connStatus').textContent=errorMessage(err);}
 finally{clearTimeout(timer);$('#testConnect').disabled=false;refreshSummary();}
}
/* WebAudio: small generative pentatonic score, synthesized locally. */
const audio={ctx:null,active:false,beat:0,step:0,master:null,
 unlock(){if(!soundOn)return;try{if(!this.ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;this.ctx=new A();this.master=this.ctx.createGain();this.master.gain.value=.32;this.master.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch(_){}},
 setActive(v){this.active=v;},
 note(f,d=.16,v=.03,type='sine'){if(!soundOn||!this.ctx||this.ctx.state!=='running')return;const a=this.ctx,t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,v),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+d+.02);o.onended=()=>{o.disconnect();g.disconnect();};},
 gem(i){const notes=[440,495,550,660,742.5];this.note(notes[i%5]*(i%7===0?2:1),.14,.04);},
 hit(){this.note(65,.3,.08,'triangle');},surge(){[330,440,550,660].forEach((v,i)=>setTimeout(()=>this.note(v,.5,.03),i*45));},
 update(dt,g){if(!this.active||!soundOn)return;this.beat+=dt;if(this.beat>.29){this.beat=0;this.step++;const scale=[220,247.5,275,330,371.25,440,495,550];if(this.step%2===0)this.note(scale[(this.step+Math.floor(g.d/SECTION))%8],.48,.012);if(this.step%8===0)this.note(110,.7,.021,'triangle');}}
};
function toggleSetting(which){if(which==='sound'){soundOn=!soundOn;audio.unlock();try{localStorage.setItem('afterlight.sound',soundOn?'1':'0')}catch(_){}}else{hapticOn=!hapticOn;try{localStorage.setItem('afterlight.haptic',hapticOn?'1':'0')}catch(_){}}$('#soundToggle').textContent='音：'+(soundOn?'ON':'OFF');$('#hapticToggle').textContent='振動：'+(hapticOn?'ON':'OFF');}
$('#soundToggle').textContent='音：'+(soundOn?'ON':'OFF');$('#hapticToggle').textContent='振動：'+(hapticOn?'ON':'OFF');
$('#begin').onclick=start;$('#restart').onclick=start;$('#resume').onclick=resume;$('#pause').onclick=pause;$('#goHome').onclick=home;$('#endHome').onclick=home;$('#connectHome').onclick=openConnection;$('#connectPause').onclick=openConnection;$('#closeConnect').onclick=closeConnection;$('#testConnect').onclick=connect;$('#connMode').onchange=updateConnectionFields;$('#soundToggle').onclick=()=>toggleSetting('sound');$('#hapticToggle').onclick=()=>toggleSetting('haptic');
const canvas=$('#world');
canvas.addEventListener('pointerdown',e=>{if(G.state==='home'){start();}if(G.state!=='play'||input.id!==null)return;audio.unlock();input.down=true;input.id=e.pointerId;input.start=e.clientX;input.startX=G.x;input.left=input.right=false;try{canvas.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(!input.down||input.id!==e.pointerId||G.state!=='play')return;inputChange(e.clientX);e.preventDefault();});
function inputChange(clientX){G.target=clamp(input.startX+(clientX-input.start)/Math.max(230,Math.min(innerWidth,750))*14,-4.55,4.55);}
function release(e){if(e.pointerId!==input.id)return;input.down=false;input.id=null;}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(!$('#connection').classList.contains('hidden')){if(e.key==='Escape')closeConnection();return;}if(['ArrowLeft','ArrowRight',' ','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if((e.key===' '||e.key==='Enter')&&(G.state==='home'||G.state==='end')){start();return;}if(e.key==='Escape'||e.key.toLowerCase()==='p'){G.state==='play'?pause():resume();return;}if(['ArrowLeft','a','A'].includes(e.key))input.left=true;if(['ArrowRight','d','D'].includes(e.key))input.right=true;});
document.addEventListener('keyup',e=>{if(['ArrowLeft','a','A'].includes(e.key))input.left=false;if(['ArrowRight','d','D'].includes(e.key))input.right=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();lastTime=0;});window.addEventListener('blur',()=>{input.left=input.right=false;input.down=false;if(G.state==='play')pause();});
/* Private game token can be passed in a fragment. Strip it without persisting it. */
try{const hash=new URLSearchParams(location.hash.slice(1)),tok=hash.get('t');if(tok&&/^https?:$/.test(location.protocol)){connection.mode='bridge';connection.token=tok;connection.url=location.origin;connection.status='サーバー接続準備済み（プレイ時に接続）';$('#connectHome').textContent='サーバー接続 ↗';history.replaceState(null,'',location.pathname+location.search);}}catch(_){}
/* Minimal batched WebGL renderer. */
function normalize(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l)}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function viewMatrix(eye,target,up){const z=normalize(eye.map((x,i)=>x-target[i])),x=normalize(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((a,b,i)=>a+b*eye[i],0),-y.reduce((a,b,i)=>a+b*eye[i],0),-z.reduce((a,b,i)=>a+b*eye[i],0),1]);}
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function meshTemplate(vertices,faces){const out=[];for(const [inds,shade]of faces){for(let i=1;i<inds.length-1;i++)for(const n of [inds[0],inds[i],inds[i+1]])out.push(...vertices[n],shade);}return new Float32Array(out);}
const BOX=meshTemplate([[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[[[0,1,2,3],.72],[[4,7,6,5],.88],[[0,4,5,1],.4],[[3,2,6,7],1.17],[[1,5,6,2],.67],[[0,3,7,4],.91]]);
const OCT=meshTemplate([[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1,0]],[[[0,1,2],1.1],[[0,2,3],1.25],[[0,3,4],.9],[[0,4,1],.75],[[5,2,1],.6],[[5,3,2],.75],[[5,4,3],.55],[[5,1,4],.45]]);
const SHIP=meshTemplate([[0,0,-1.05],[-.6,-.08,.62],[.6,-.08,.62],[0,.25,.28],[0,-.17,.5]],[[[0,1,3],1.2],[[0,3,2],.86],[[1,2,3],1],[[0,4,1],.7],[[0,2,4],.65],[[1,4,2],.55]]);
class Batch{
 constructor(gl){this.gl=gl;this.a=new Float32Array(7*220000);this.n=0;this.buffer=gl.createBuffer();}
 clear(){this.n=0;}
 v(x,y,z,c,a=1,k=1){if(this.n+7>this.a.length){const b=new Float32Array(this.a.length*2);b.set(this.a);this.a=b;}const b=this.a;let n=this.n;b[n++]=x;b[n++]=y;b[n++]=z;b[n++]=c[0]*k;b[n++]=c[1]*k;b[n++]=c[2]*k;b[n++]=a;this.n=n;}
 tri(a,b,c,col,alpha=1){this.v(...a,col,alpha);this.v(...b,col,alpha);this.v(...c,col,alpha);}
 quad(a,b,c,d,col,alpha=1){this.tri(a,b,c,col,alpha);this.tri(a,c,d,col,alpha);}
 mesh(m,x,y,z,sx,sy,sz,col,ry=0,rz=0,alpha=1){const cy=Math.cos(ry),syy=Math.sin(ry),cz=Math.cos(rz),szz=Math.sin(rz);for(let i=0;i<m.length;i+=4){let ax=m[i]*sx,ay=m[i+1]*sy,az=m[i+2]*sz;const xx=ax*cy+az*syy,zz=-ax*syy+az*cy;this.v(x+xx*cz-ay*szz,y+xx*szz+ay*cz,z+zz,col,alpha,m[i+3]);}}
 ring(x,y,z,r,t,col,rot=0,n=36,alpha=1,arc=TAU){for(let i=0;i<n;i++){const a=rot+i/n*arc,b=rot+(i+1)/n*arc,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);this.quad([x+ca*r,y+sa*r,z],[x+cb*r,y+sb*r,z],[x+cb*(r+t),y+sb*(r+t),z],[x+ca*(r+t),y+sa*(r+t),z],col,alpha);}}
 halo(x,y,z,r,c,alpha=.2){const N=10;for(let i=0;i<N;i++){const a=i/N*TAU,b=(i+1)/N*TAU;this.v(x,y,z,c,alpha);this.v(x+Math.cos(a)*r,y+Math.sin(a)*r,z,c,0);this.v(x+Math.cos(b)*r,y+Math.sin(b)*r,z,c,0);}}
 draw(prog,add=false){const gl=this.gl;if(!this.n)return;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.a.subarray(0,this.n),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(prog.p);gl.vertexAttribPointer(prog.p,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(prog.c);gl.vertexAttribPointer(prog.c,4,gl.FLOAT,false,28,12);gl.depthMask(!add);if(add){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE)}else gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,this.n/7);gl.depthMask(true);}
}

class SoftBatch extends Batch{
 constructor(renderer){super({createBuffer:()=>null});this.renderer=renderer;this.halos=[];}
 clear(){super.clear();this.halos=[];}
 halo(x,y,z,r,c,alpha=.2){this.halos.push({x,y,z,r,c,alpha});}
 paint(mat,fog,add){
  const ctx=this.renderer.ctx,w=canvas.width,h=canvas.height,raw=this.a,items=[];
  const project=(x,y,z)=>{const cw=mat[3]*x+mat[7]*y+mat[11]*z+mat[15];if(cw<.15)return null;return[(mat[0]*x+mat[4]*y+mat[8]*z+mat[12])/cw*w*.5+w*.5,h*.5-(mat[1]*x+mat[5]*y+mat[9]*z+mat[13])/cw*h*.5,cw]};
  for(let i=0;i<this.n;i+=21){
   const a=project(raw[i],raw[i+1],raw[i+2]),b=project(raw[i+7],raw[i+8],raw[i+9]),c=project(raw[i+14],raw[i+15],raw[i+16]);if(!a||!b||!c)continue;
   if((a[0]<0&&b[0]<0&&c[0]<0)||(a[0]>w&&b[0]>w&&c[0]>w)||(a[1]<0&&b[1]<0&&c[1]<0)||(a[1]>h&&b[1]>h&&c[1]>h))continue;
   const depth=-(raw[i+2]+raw[i+9]+raw[i+16])/3,f=sm((depth-60)/170),alpha=(raw[i+6]+raw[i+13]+raw[i+20])/3*(add?1-f:1);
   if(alpha<.005)continue;
   const col=[0,1,2].map(k=>Math.round(clamp(add?raw[i+3+k]:lerp(raw[i+3+k],fog[k],f),0,1)*255));
   items.push({a,b,c,depth,alpha,color:`rgb(${col[0]},${col[1]},${col[2]})`});
  }
  items.sort((a,b)=>b.depth-a.depth);ctx.globalCompositeOperation=add?'lighter':'source-over';
  for(const t of items){ctx.globalAlpha=t.alpha;ctx.fillStyle=t.color;ctx.beginPath();ctx.moveTo(t.a[0],t.a[1]);ctx.lineTo(t.b[0],t.b[1]);ctx.lineTo(t.c[0],t.c[1]);ctx.closePath();ctx.fill();if(!add){ctx.strokeStyle=t.color;ctx.lineWidth=.5;ctx.stroke();}}
  if(add)for(const q of this.halos){
   const a=project(q.x,q.y,q.z),b=project(q.x+q.r,q.y,q.z);if(!a||!b)continue;const r=Math.abs(b[0]-a[0]);if(r<.2||a[0]+r<0||a[0]-r>w||a[1]+r<0||a[1]-r>h)continue;
   const alpha=q.alpha*(1-sm((-q.z-60)/170));if(alpha<.01)continue;const c=q.c.map(v=>Math.round(clamp(v,0,1)*255)).join(',');ctx.globalAlpha=1;const g=ctx.createRadialGradient(a[0],a[1],0,a[0],a[1],r);g.addColorStop(0,`rgba(${c},${alpha})`);g.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=g;ctx.fillRect(a[0]-r,a[1]-r,r*2,r*2);
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }
}

function makeProgram(gl,vs,fs){function sh(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}const p=gl.createProgram(),v=sh(gl.VERTEX_SHADER,vs),f=sh(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
class Renderer{
 constructor(){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});this.gl=gl;this.software=!gl;this.dpr=1;this.frameCount=0;this.theme={...THEMES.aurora};if(!gl){this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('Canvas unavailable');this.solid=new SoftBatch(this);this.glow=new SoftBatch(this);this.resize();return;}this.solid=new Batch(gl);this.glow=new Batch(gl);
  const vs=`attribute vec3 aPosition;attribute vec4 aColor;uniform mat4 uVP;varying vec4 vColor;varying float vDepth;void main(){gl_Position=uVP*vec4(aPosition,1.0);vColor=aColor;vDepth=max(0.,-aPosition.z);}`;
  const fs=`precision mediump float;varying vec4 vColor;varying float vDepth;uniform vec3 uFog;uniform float uAdd;void main(){float f=smoothstep(60.,230.,vDepth);vec3 c=mix(vColor.rgb,uFog,f*(1.-uAdd));gl_FragColor=vec4(c,vColor.a*(1.-f*uAdd));}`;
  this.program=makeProgram(gl,vs,fs);this.prog={p:gl.getAttribLocation(this.program,'aPosition'),c:gl.getAttribLocation(this.program,'aColor')};this.vp=gl.getUniformLocation(this.program,'uVP');this.fog=gl.getUniformLocation(this.program,'uFog');this.add=gl.getUniformLocation(this.program,'uAdd');
  this.sky=makeProgram(gl,`attribute vec2 aPosition;varying vec2 uv;void main(){uv=(aPosition+1.)*.5;gl_Position=vec4(aPosition,0.,1.);}`,`precision mediump float;varying vec2 uv;uniform vec3 uTop,uFog,uSun;uniform float uTime,uAspect;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}void main(){float h=clamp((uv.y-.32)/.68,0.,1.);vec3 col=mix(uFog,uTop,pow(h,.65));vec2 p=vec2((uv.x-.68)*uAspect,uv.y-.67);float sun=length(p);col+=uSun*(.14*exp(-sun*8.)+.46*(1.-smoothstep(.063,.066,sun)));float wisps=sin(uv.x*6.+uTime*.035+sin(uv.y*8.))*sin(uv.y*18.+uv.x*8.+uTime*.06);col+=uSun*.028*max(0.,wisps)*smoothstep(.48,.9,uv.y);vec2 cell=floor(uv*vec2(270.*uAspect,270.));vec2 f=fract(uv*vec2(270.*uAspect,270.));float star=step(.996,hash(cell))*pow(max(0.,1.-length(f-.5)*2.),7.);col+=vec3(star*.5*smoothstep(.57,.95,uv.y));col+=((hash(gl_FragCoord.xy)-.5)/255.);gl_FragColor=vec4(col,1.);}`);
  this.skyPos=gl.getAttribLocation(this.sky,'aPosition');this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  this.su={};for(const n of ['uTop','uFog','uSun','uTime','uAspect'])this.su[n]=gl.getUniformLocation(this.sky,n);
  gl.disable(gl.CULL_FACE);this.resize();
 }
 resize(){this.dpr=Math.min(devicePixelRatio||1,this.software?1.0:innerWidth<700?1.65:1.5);canvas.width=Math.floor(innerWidth*this.dpr);canvas.height=Math.floor(innerHeight*this.dpr);if(this.gl)this.gl.viewport(0,0,canvas.width,canvas.height);}

 drawSoftSky(th){
  const c=this.ctx,w=canvas.width,h=canvas.height,hex=a=>'rgb('+a.map(v=>Math.round(clamp(v,0,1)*255)).join(',')+')';
  const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,hex(th.top));g.addColorStop(.66,hex(th.fog));g.addColorStop(1,hex(mix(th.fog,th.top,.35)));c.fillStyle=g;c.fillRect(0,0,w,h);
  const sx=w*.68,sy=h*.33,sr=h*.065,col=th.sun.map(v=>Math.round(v*255)).join(',');const aura=c.createRadialGradient(sx,sy,sr*.6,sx,sy,sr*3.8);aura.addColorStop(0,`rgba(${col},.20)`);aura.addColorStop(1,`rgba(${col},0)`);c.fillStyle=aura;c.fillRect(sx-sr*4,sy-sr*4,sr*8,sr*8);c.fillStyle=`rgba(${col},.46)`;c.beginPath();c.arc(sx,sy,sr,0,TAU);c.fill();
  c.fillStyle='#e4fff5';for(let i=0;i<75;i++){const x=rand(i*13)*w,y=rand(i*7+42)*h*.38;c.globalAlpha=.12+rand(i+4)*.3;c.fillRect(x,y,.8,.8)}c.globalAlpha=1;
 }

 draw(dt){
  const gl=this.gl,B=this.solid,A=this.glow;B.clear();A.clear();
  const demo=G.state==='home',d=demo?homeDrift:G.d,time=demo?realTime:G.t,baseX=trackX(d),baseY=trackY(d),seed=demo?41:G.seed;
  const active=demo?{biome:'aurora',pattern:'helix'}:planAt(d+12),target=THEMES[active.biome];for(const key of ['top','fog','road','edge','solid','sun'])this.theme[key]=mix(this.theme[key],target[key],1-Math.exp(-dt*.6));const th=this.theme;
  const world=(s,x=0,y=0)=>[trackX(s)-baseX+x,trackY(s)-baseY+y,-(s-d)];
  if(this.software){this.drawSoftSky(th);}else{
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(this.sky);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.enableVertexAttribArray(this.skyPos);gl.vertexAttribPointer(this.skyPos,2,gl.FLOAT,false,0,0);
  gl.uniform3fv(this.su.uTop,th.top);gl.uniform3fv(this.su.uFog,th.fog);gl.uniform3fv(this.su.uSun,th.sun);gl.uniform1f(this.su.uTime,realTime);gl.uniform1f(this.su.uAspect,innerWidth/innerHeight);gl.drawArrays(gl.TRIANGLES,0,3);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);
  }
  /* Floating tiles grow from the mist, but never change under the player. */
  const start=Math.floor((d-14)/4)*4,horizon=demo?d+228:Math.min(d+228,G.chunks.at(-1)?.end??d+228);
  for(let s=start;s<horizon;s+=4){
   const rel=s-d,p=demo?active:planAt(s),pal=THEMES[p.biome];let rise=0;
   const ch=G.chunks.find(c=>s>=c.start&&s<c.end);if(!demo&&ch&&rel>80)rise=(1-sm((realTime-ch.birth)/1.05))*6;
   const a=world(s,0,-rise),b=world(s+3.94,0,-rise);
   const shade=(Math.floor(s/4)%2===0)?.97:1.04,road=pal.road.map(v=>v*shade);
   B.quad([a[0]-WIDTH,a[1],a[2]],[a[0]+WIDTH,a[1],a[2]],[b[0]+WIDTH,b[1],b[2]],[b[0]-WIDTH,b[1],b[2]],road);
   for(const sign of [-1,1]){
    const x=sign*WIDTH,xx=sign*(WIDTH+.055);
    B.quad([a[0]+x,a[1]+.027,a[2]],[a[0]+xx,a[1]+.027,a[2]],[b[0]+xx,b[1]+.027,b[2]],[b[0]+x,b[1]+.027,b[2]],pal.edge);
    B.quad([a[0]+x,a[1],a[2]],[a[0]+x,a[1]-.25,a[2]],[b[0]+x,b[1]-.25,b[2]],[b[0]+x,b[1],b[2]],pal.solid.map(v=>v*.4));
   }
   if(Math.floor(s/4)%3===0){for(const x of [-2.55,2.55])B.quad([a[0]+x-.012,a[1]+.014,a[2]],[a[0]+x+.012,a[1]+.014,a[2]],[b[0]+x+.012,b[1]+.014,b[2]],[b[0]+x-.012,b[1]+.014,b[2]],mix(pal.road,pal.edge,.2));}
  }
  /* Deterministic scenery outside the collision space. */
  for(let i=Math.floor((d-30)/19);i<Math.floor((horizon+2)/19);i++){
   const s=i*19,r1=rand(i+seed*.01),r2=rand(i*3+seed*.002);const p=demo?active:planAt(s),pal=THEMES[p.biome];
   for(const side of [-1,1]){
    const k=r1+(side+1)*.5,r3=rand(i*17+side+seed*.03),x=side*(9+r3*20),h=3+r2*13,w=1.4+r1*4;const pos=world(s+side*3,x,-2-r3*3);
    if(p.biome==='prism'){
     B.mesh(BOX,pos[0],pos[1]+h*.5,pos[2],w,h,w,pal.solid,side*.13);
     for(let j=1;j<5;j++)B.mesh(BOX,pos[0],pos[1]+h*j/5,pos[2]+w*.51,w*.86,.025,.02,pal.edge);
     A.halo(pos[0],pos[1]+h,pos[2],1.3,pal.edge,.1);
    }else if(p.biome==='ember'){
     B.mesh(OCT,pos[0],pos[1]+h*.3,pos[2],w,h,w*.9,pal.solid,r1*3);
     if(i%3===0)B.ring(pos[0],pos[1]+h+2,pos[2],2.4,.08,pal.edge,realTime*.02,24);
    }else if(p.biome==='abyss'){
     B.mesh(OCT,pos[0],pos[1]+3,pos[2],w*1.6,1.5+r2*2,w,pal.solid,r1*3);
     B.mesh(OCT,pos[0],pos[1]+8+Math.sin(realTime+i)*.3,pos[2],.35,.7,.35,pal.edge,realTime*.4);A.halo(pos[0],pos[1]+8,pos[2],1.6,pal.edge,.22);
    }else{
     B.mesh(OCT,pos[0],pos[1]+h*.3,pos[2],w,h,w,pal.solid,r1*3);
     B.mesh(OCT,pos[0]+side*w*.6,pos[1]+h*.25,pos[2]+1,w*.5,h*.6,w*.55,mix(pal.solid,pal.edge,.15),r1*2);
    }
   }
   if(p.pattern==='helix'||(demo&&i%3===0)){
    const pos=world(s,0,4.5);const angle=realTime*.15+i*.35;
    B.ring(pos[0],pos[1],pos[2],7,.085,pal.edge,angle,28,1,TAU*.81);
    A.ring(pos[0],pos[1],pos[2],6.92,.24,pal.edge,angle,28,.12,TAU*.81);
   }
  }
  if(!demo){
   for(const ch of G.chunks){const pal=THEMES[ch.plan.biome];
    if(ch.index>0&&ch.start-d>-15&&ch.start-d<220){const p=world(ch.start,0,4.6);B.ring(...p,6.5,.10,pal.edge,0,44);A.ring(...p,6.35,.42,pal.edge,0,44,.12);}
    for(const row of ch.rows){const rel=row.s-d;if(rel<-12||rel>225)continue;
     for(const o of row.obstacles){if(o.hit)continue;const pos=world(row.s,o.x,0),col=mix(pal.solid,C.danger,.60);
      if(o.kind==='laser'){
       B.mesh(BOX,pos[0],pos[1]+.78,pos[2],1.42,.10,.18,C.danger);B.mesh(BOX,pos[0]-.67,pos[1]+.78,pos[2],.07,1.55,.22,col);B.mesh(BOX,pos[0]+.67,pos[1]+.78,pos[2],.07,1.55,.22,col);A.halo(pos[0],pos[1]+.78,pos[2],1.25,C.danger,.24);
      }else if(o.kind==='mine'){
       B.mesh(OCT,pos[0],pos[1]+.72,pos[2],.48,.48,.48,C.danger,time*2.4+o.seed*5);B.ring(pos[0],pos[1]+.72,pos[2],.72,.045,pal.edge,time*1.5+o.seed*6,18);A.halo(pos[0],pos[1]+.72,pos[2],1.55,C.danger,.22);
      }else if(o.kind==='shard'){
       B.mesh(OCT,pos[0],pos[1]+.72,pos[2],.32,1.35,.34,col,o.seed*4);B.mesh(OCT,pos[0]-.33,pos[1]+.42,pos[2]+.08,.20,.82,.24,C.danger,o.seed*3);B.mesh(OCT,pos[0]+.31,pos[1]+.34,pos[2]-.08,.17,.66,.21,pal.edge,o.seed*6);A.halo(pos[0],pos[1]+.65,pos[2],1.05,C.danger,.15);
      }else if(o.kind==='tower'){
       B.mesh(BOX,pos[0],pos[1]+1.25,pos[2],1.18,2.5,.78,col);B.mesh(OCT,pos[0],pos[1]+2.62,pos[2],.42,.42,.42,C.danger,time*.4+o.seed*4);A.halo(pos[0],pos[1]+2.55,pos[2],1.2,C.danger,.18);
      }else if(o.kind==='phase'){
       B.mesh(BOX,pos[0]-.56,pos[1]+1.05,pos[2],.10,2.1,.20,pal.edge);B.mesh(BOX,pos[0]+.56,pos[1]+1.05,pos[2],.10,2.1,.20,pal.edge);A.mesh(BOX,pos[0],pos[1]+.92,pos[2],1.05,.055,.12,C.danger,0,0,.42);A.halo(pos[0],pos[1]+.92,pos[2],1.3,pal.edge,.20);
      }else if(o.kind==='vortex'){
       B.ring(pos[0],pos[1]+.95,pos[2],.73,.08,C.danger,time*1.8+o.seed*5,22);B.mesh(OCT,pos[0],pos[1]+.95,pos[2],.22,.22,.22,pal.edge,time*2);A.ring(pos[0],pos[1]+.95,pos[2],.98,.18,pal.edge,-time*1.3+o.seed,22,.16);A.halo(pos[0],pos[1]+.95,pos[2],1.5,pal.edge,.18);
      }else if(o.kind==='gate'){
       B.mesh(BOX,pos[0],pos[1]+1.35,pos[2],1.03,2.7,.58,col);B.mesh(BOX,pos[0],pos[1]+2.68,pos[2],1.09,.055,.62,C.danger);
       A.halo(pos[0],pos[1]+1.3,pos[2]+.1,1.0,C.danger,.14);
      }else if(o.kind==='comet'){
       const drop=Math.max(0,(rel-42)/8),h=.9+drop;B.mesh(OCT,pos[0],pos[1]+h,pos[2],.65,.88,.65,col,time*.8+o.seed*5);
       B.mesh(BOX,pos[0],pos[1]+.023,pos[2],1.24,.028,1.25,C.danger);A.halo(pos[0],pos[1]+h,pos[2],1.8,C.danger,.17);
       A.mesh(BOX,pos[0],pos[1]+h+1.4,pos[2],.10,2.8,.08,C.danger,0,0,.28);
      }else{
       B.mesh(OCT,pos[0],pos[1]+.87,pos[2],.68,1.28,.67,col,o.seed*5);B.mesh(OCT,pos[0]+.25,pos[1]+.55,pos[2]+.1,.3,.72,.35,C.danger,o.seed*3);
       A.halo(pos[0],pos[1]+.9,pos[2],1.3,C.danger,.13);
      }
     }
    }
    for(const gem of ch.gems){const rel=gem.s-d;if(gem.taken||rel<-4||rel>225)continue;const p=world(gem.s,gem.x,.88+Math.sin(time*2+gem.seed*6)*.07),col=gem.repair?C.gold:pal.edge;const size=gem.repair?.31:.20;
     B.mesh(OCT,...p,size,size*1.65,size,col,time*1.6+gem.seed*3);A.halo(...p,gem.repair?1.2:.80,col,gem.repair?.48:.30);
     if(gem.repair)B.ring(p[0],p[1],p[2],.6,.035,col,time,16);
    }
   }
  }else{
   for(let s=Math.floor(d/6)*6;s<d+190;s+=6){const p=world(s,Math.sin(s*.033)*1.7,1);B.mesh(OCT,...p,.19,.29,.19,th.edge,realTime);A.halo(...p,.85,th.edge,.25);}
  }
  /* Player, long afterimage, and three orbiting shield sparks. */
  const px=demo?Math.sin(realTime*.4)*.75:G.x,py=.8+Math.sin(time*5)*.045,bank=demo?Math.sin(realTime*.4)*.15:-G.vx*.047;
  const visible=G.inv<=0||G.surge>0||Math.sin(time*28)>.05||demo;
  if(visible){B.mesh(SHIP,px,py,0,.78,.85,.87,G.surge>0?C.gold:C.white,0,bank);B.mesh(OCT,px,py+.24,.18,.11,.21,.14,th.edge,time*1.8);}
  A.halo(px,py,0,1.6,G.surge>0?C.gold:th.edge,.38);
  for(let i=0;i<(demo?3:G.health);i++){const a=time*.9+i/3*TAU;const x=px+Math.cos(a)*.68,y=py+.15+Math.sin(a)*.3,z=.25+Math.sin(a)*.25;B.mesh(OCT,x,y,z,.065,.09,.065,th.edge,time);A.halo(x,y,z,.35,th.edge,.45);}
  for(let j=0;j<16;j++){const s=d-j*.35,p=world(s,px-G.vx*j*.011,.63),fade=1-j/16;A.halo(...p,.24+fade*.10,G.surge>0?C.gold:th.edge,fade*.27);}
  if(G.surge>0)for(let i=0;i<22;i++){const a=rand(i+31)*TAU,s=d+((i*23-time*70)%160+160)%160,p=world(s,Math.cos(a)*7,3+Math.sin(a)*5);A.mesh(BOX,...p,.024,.024,4,th.edge,0,0,.3);}
  for(const p of G.particles){const pos=world(p.s,p.x,p.y),fade=Math.max(0,p.life/p.max);B.mesh(OCT,...pos,.045*fade,.07*fade,.045*fade,p.color,realTime);A.halo(...pos,.26,p.color,fade*.24);}
  if(!this.software)gl.useProgram(this.program);const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,roll=reduced?0:clamp(-G.vx*.002,-.024,.024),shake=G.shake*(reduced?0:.12);
  const follow=px*.72,eye=[follow+Math.sin(time*93)*shake,5.7+Math.cos(time*81)*shake,11.5],look=[follow+clamp((trackX(d+32)-baseX)*.48,-3,3),.15,-32];
  const aspect=canvas.width/canvas.height,fovy=aspect<.8?1.06:.88,mat=multiply(perspective(fovy,aspect,.1,480),viewMatrix(eye,look,[Math.sin(roll),Math.cos(roll),0]));
  const pw=mat[3]*px+mat[7]*py+mat[15];this.playerScreen=[Math.round(((mat[0]*px+mat[4]*py+mat[12])/pw*.5+.5)*innerWidth),Math.round((.5-(mat[1]*px+mat[5]*py+mat[13])/pw*.5)*innerHeight)];
  if(this.software){B.paint(mat,th.fog,false);A.paint(mat,th.fog,true);this.vertices=(B.n+A.n)/7;return;}
  gl.uniformMatrix4fv(this.vp,false,mat);gl.uniform3fv(this.fog,th.fog);gl.uniform1f(this.add,0);B.draw(this.prog);gl.uniform1f(this.add,1);A.draw(this.prog,true);
  this.vertices=(B.n+A.n)/7;
 }
}
/* Canvas fallback retains the same controls, rules and director when WebGL is missing. */
class CanvasFallback{
 constructor(){const old=canvas;const replacement=old.cloneNode();old.replaceWith(replacement);this.canvas=replacement;this.ctx=replacement.getContext('2d');this.resize();$('#fallbackBanner').style.display='block';replacement.addEventListener('pointerdown',e=>{if(G.state==='home')start();if(G.state!=='play')return;input.down=true;input.id=e.pointerId;input.start=e.clientX;input.startX=G.x;replacement.setPointerCapture(e.pointerId)});replacement.addEventListener('pointermove',e=>{if(input.down&&input.id===e.pointerId)inputChange(e.clientX)});replacement.addEventListener('pointerup',release);replacement.addEventListener('pointercancel',release);}
 resize(){this.canvas.width=innerWidth*Math.min(devicePixelRatio||1,1.5);this.canvas.height=innerHeight*Math.min(devicePixelRatio||1,1.5);}
 draw(){const c=this.ctx,w=this.canvas.width,h=this.canvas.height,pal=THEMES[planAt(G.d).biome],hex=a=>'rgb('+a.map(x=>Math.round(clamp(x,0,1)*255)).join(',')+')',grad=c.createLinearGradient(0,0,0,h);grad.addColorStop(0,hex(pal.top));grad.addColorStop(1,hex(pal.fog));c.fillStyle=grad;c.fillRect(0,0,w,h);const project=(s,x,y=0)=>{const z=s-G.d+16,k=9/Math.max(7,z);return[w*.5+(x+trackX(s)-trackX(G.d))*w*.095*k,h*.38+h*.53*k-y*h*.052*k,k]};
 c.fillStyle=hex(pal.road);c.beginPath();for(let s=210;s>=-3;s-=4){const p=project(G.d+s,-5.1);c.lineTo(p[0],p[1])}for(let s=-3;s<=210;s+=4){const p=project(G.d+s,5.1);c.lineTo(p[0],p[1])}c.closePath();c.fill();c.strokeStyle=hex(pal.edge);c.lineWidth=2;c.stroke();const objects=[];for(const ch of G.chunks){for(const row of ch.rows)for(const o of row.obstacles)if(!o.hit)objects.push({s:row.s,x:o.x,kind:'o'});for(const g of ch.gems)if(!g.taken)objects.push({...g,kind:'g'})}objects.sort((a,b)=>b.s-a.s);for(const o of objects){if(o.s<G.d-3||o.s>G.d+210)continue;const [x,y,k]=project(o.s,o.x,o.kind==='g'?.8:0);const size=w*.040*k;c.fillStyle=o.kind==='g'?hex(pal.edge):hex(C.danger);c.beginPath();if(o.kind==='g'){c.moveTo(x,y-size*.3);c.lineTo(x+size*.2,y);c.lineTo(x,y+size*.3);c.lineTo(x-size*.2,y)}else{c.moveTo(x,y-size*1.6);c.lineTo(x+size*.65,y);c.lineTo(x-size*.65,y)}c.closePath();c.fill();}const [x,y]=project(G.d,G.x,.7);c.fillStyle='#efffec';c.beginPath();c.moveTo(x,y-15);c.lineTo(x+12,y+12);c.lineTo(x,y+6);c.lineTo(x-12,y+12);c.closePath();c.fill();}
}
let renderer;try{renderer=new Renderer()}catch(err){console.warn('WebGL compatibility fallback:',err.message);renderer=new CanvasFallback();}
window.addEventListener('resize',()=>renderer.resize());canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();connection.status='描画が中断されました。復帰後に続行してください。';refreshSummary();});canvas.addEventListener('webglcontextrestored',()=>{try{renderer=new Renderer()}catch(_){renderer=new CanvasFallback()}});
function frame(ts){
 if(!lastTime)lastTime=ts;const dt=Math.min(.045,Math.max(0,(ts-lastTime)/1000));lastTime=ts;realTime+=dt;G.frameMs=lerp(G.frameMs,dt*1000,.025);
 if(G.state==='home')homeDrift+=dt*8;step(dt);
 if(G.state==='play')for(const p of G.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.s+=p.vs*dt;p.vy-=5*dt;p.life-=dt;}G.particles=G.particles.filter(p=>p.life>0);
 if(realTime>announceUntil)$('#announcement').classList.remove('show');$('#flash').style.opacity=G.state==='play'?String(G.flash):'0';renderer.draw(dt);requestAnimationFrame(frame);
}
showState('home');requestAnimationFrame(frame);
/* QA surface: never contains keys, tokens or provider request headers. */
window.afterlightInfo=()=>({state:G.state,score:Math.floor(G.score),distance:Math.floor(G.d),health:G.health,mode:connection.mode,successfulDecisions:connection.success,appliedSections:G.applied,section:G.section,vertices:renderer.vertices||0,playerScreen:renderer.playerScreen||null,frameMs:Math.round(G.frameMs),renderer:renderer instanceof Renderer?(renderer.software?'Software 3D':'WebGL'):'Canvas',pattern:planAt(G.d).pattern});
if(new URLSearchParams(location.search).get('test')==='1')window.afterlightTest={start,pause,resume,home,generateChunk,telemetry,step,requestDecision,connectionState:()=>({calls:connection.calls,success:connection.success,fail:connection.fail,busy:connection.busy,status:connection.status}),getGame:()=>G,forcePlan:p=>{connection.pending=p;},setConnection:cfg=>{Object.assign(connection,cfg);},guide:()=>{let gs=[];for(const c of G.chunks)gs=gs.concat(c.guide);let a=gs[0],b=gs.at(-1);for(let i=1;i<gs.length;i++)if(gs[i].s>=G.d+1){a=gs[i-1];b=gs[i];break;}return lerp(a.x,b.x,sm((G.d+1-a.s)/(b.s-a.s)));}};
})();
