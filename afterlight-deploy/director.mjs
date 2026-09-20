const PATTERNS=['ribbon','slalom','gates','comets','braid','helix','bloom','rush'];
const BIOMES=['aurora','ember','prism','abyss'];
const NUMBER_LIMITS={seconds:[0,86400],distance:[0,10000000],speed:[0,80],health:[0,3],hits12:[0,30],gems12:[0,500],near12:[0,200],steer12:[0,10000],sideBias:[-1,1],flow:[0,1],combo:[0,5000],section:[0,100000],best:[0,100000000],repeats:[0,100]};
function cleanTelemetry(raw){
 const x=raw&&typeof raw==='object'?raw:{};const out={};
 for(const [k,[lo,hi]]of Object.entries(NUMBER_LIMITS)){const v=Number(x[k]);out[k]=Number.isFinite(v)?Math.round(Math.max(lo,Math.min(hi,v))*100)/100:0;}
 out.pattern=PATTERNS.includes(x.pattern)?x.pattern:'ribbon';out.biome=BIOMES.includes(x.biome)?x.biome:'aurora';
 out.recent=Array.isArray(x.recent)?x.recent.filter(v=>PATTERNS.includes(v)).slice(-5):[];
 return out;
}
function buildRequest(raw){
 const t=cleanTelemetry(raw);
 return {model:'jev-latest',state:JSON.stringify({game:'AFTERLIGHT: a fair one-finger endless hover-surfing game. Auto forward; horizontal drag only. This is a game director, not a player bot.',goal:'Choose the next unseen 5-second section. Keep difficulty fair and offer variety. Do not target compulsive play. On low health or recent mistakes favor recovery. Use observed gameplay, not assumptions about personality. No moving hazards into an already visible path. Engine independently guarantees a navigable corridor.',telemetry:t,units:'seconds=active run time; hits12/gems12/near12/steer12 are rolling 12-second counts or movement; sideBias -1=left +1=right; health 0..3; flow 0..1; recent lists last course motifs.'}),questions:{
 pattern:{type:'choice',instructions:'Which one motif best fits the NEXT short section, considering recovery needs and recent repeated motifs? Choose a new motif when the current one repeats, but favor ribbon or bloom after mistakes.',criteria:{ribbon:'A calm wide ribbon. Few obstacles; easy introductory or recovery course.',slalom:'Alternating pillars requiring small rhythmic left-right movement.',gates:'Glowing portals with fixed side barriers, leaving a clear escape lane.',comets:'Falling comet visuals with fixed, well-telegraphed impact columns; more spectacle.',braid:'Braided gem trails and a gentle lane-change rhythm, for variety.',helix:'A spiralling non-colliding tunnel around a normal course; spectacle without extra motor complexity.',bloom:'A recovery garden. Sparse hazards and a repair pickup. Best at low health.',rush:'A generous crystal run with a few obstacles, rewarding a clean run.'}},
 pressure:{type:'choice',instructions:'Select only an appropriate challenge intensity from observed recent performance. Low health or hits12>=2 requires calm. A first 15 seconds should not be intense.',criteria:{calm:'Low difficulty, wide gaps and reduced obstacle density.',steady:'Moderate difficulty and predictable rhythm.',intense:'Higher obstacle density for a player with stable clean control.'}},
 biome:{type:'choice',instructions:'Which visual biome should the next section visit? Aim for contrasting scenery after several sections; do not infer preference from demographics. Visual choice does not alter physical controls.',criteria:{aurora:'Mint auroras, blue crystalline peaks, silver bridges.',ember:'Warm peach sun, terracotta spires, golden rings.',prism:'Lilac glass city, luminous architecture, pink nebula.',abyss:'Deep blue floating islands and turquoise lanterns.'}},
 recovery:{type:'noul',instructions:'Does this player need a recovery section now because of low health or recent repeated collisions?'},
 bias:{type:'choice',instructions:'Where should the next safe gem trail gently invite the player, without abrupt crossing? A strong persistent sideBias can be counterbalanced, but after damage favor center.',criteria:{left:'A small safe invitation toward the left.',center:'A centered forgiving trail.',right:'A small safe invitation toward the right.'}}
 }};
}
function parseDecision(raw,telemetry){
 if(!raw||!raw.answers||typeof raw.answers!=='object')throw Error('Jevの応答形式を確認できませんでした。');
 const a=raw.answers;
 const read=(k,opts,fallback)=>{const q=a[k];if(!q||!opts.includes(q.choice))return fallback;const c=Number(q.confidence);return Number.isFinite(c)&&c<0.12?fallback:q.choice;};
 if(!a.pattern||!PATTERNS.includes(a.pattern.choice)||!a.pressure||!['calm','steady','intense'].includes(a.pressure.choice))throw Error('Jevのコース判断が不正です。');
 const t=cleanTelemetry(telemetry), recovery=Number(a.recovery&&a.recovery.noul)>0.64||t.health<=1||t.hits12>=2;
 let pattern=read('pattern',PATTERNS,'ribbon'),pressure=read('pressure',['calm','steady','intense'],'steady');
 if(recovery){pattern='bloom';pressure='calm';}
 if(t.seconds<15)pressure='calm';
 return {pattern,pressure,biome:read('biome',BIOMES,t.biome),bias:read('bias',['left','center','right'],'center'),recovery,source:'jev',model:typeof raw.model==='string'?raw.model.slice(0,80):'jev-latest',confidence:Number.isFinite(Number(a.pattern.confidence))?Number(a.pattern.confidence):null};
}
export {PATTERNS,BIOMES,cleanTelemetry,buildRequest,parseDecision};
