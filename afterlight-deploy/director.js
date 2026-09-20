/* AFTERLIGHT - Jev director. No secrets, telemetry only. Shared by browser and bridge. */
(function(root){
'use strict';
const PATTERNS=['ribbon','slalom','gates','comets','braid','helix','bloom','rush'];
const BIOMES=['aurora','ember','prism','abyss'];
const GIMMICKS=['crystal','laser','mine','shard','tower','phase','vortex'];
const NUMBER_LIMITS={seconds:[0,86400],distance:[0,10000000],speed:[0,80],health:[0,3],hits12:[0,30],gems12:[0,500],near12:[0,200],steer12:[0,10000],sideBias:[-1,1],flow:[0,1],combo:[0,5000],section:[0,100000],best:[0,100000000],repeats:[0,100]};
function cleanTelemetry(raw){
 const x=raw&&typeof raw==='object'?raw:{};const out={};
 for(const [k,[lo,hi]]of Object.entries(NUMBER_LIMITS)){const v=Number(x[k]);out[k]=Number.isFinite(v)?Math.round(Math.max(lo,Math.min(hi,v))*100)/100:0;}
 out.pattern=PATTERNS.includes(x.pattern)?x.pattern:'ribbon';out.gimmick=GIMMICKS.includes(x.gimmick)?x.gimmick:'crystal';out.biome=BIOMES.includes(x.biome)?x.biome:'aurora';
 out.recent=Array.isArray(x.recent)?x.recent.filter(v=>PATTERNS.includes(v)).slice(-5):[];
 return out;
}
function buildRequest(raw){
 const t=cleanTelemetry(raw);
 return {model:'jev-latest',state:JSON.stringify({game:'AFTERLIGHT: a fair one-finger endless hover-surfing game. Auto forward; horizontal drag only. This is a game director, not a player bot.',goal:'Choose the next unseen short section: motif, obstacle gimmick, intensity, scenery and safe-lane invitation. Keep it varied and readable. If the player has gone mostly straight for 12+ seconds with no hits, add lateral movement demand. After sustained effortless straight play, a stronger challenge is appropriate. On low health or recent mistakes favor recovery. Use observed gameplay only. Never alter already visible hazards. The engine independently guarantees a navigable corridor.',telemetry:t,units:'seconds=active run time; hits12/gems12/near12/steer12 are rolling 12-second counts or movement; very low steer12 means little lateral input; sideBias -1=left +1=right; health 0..3; flow 0..1.'}),questions:{
 pattern:{type:'choice',instructions:'Choose the NEXT course motif. Avoid boring repetition. If steer12 is very low while the player remains unharmed, prefer a motif that requests lateral movement.',criteria:{ribbon:'Wide calm ribbon; best for introduction or recovery.',slalom:'Alternating rhythm requiring left-right movement.',gates:'Portal sequence with clear safe gaps.',comets:'Telegraphed impact columns and spectacle.',braid:'Braided gem trails and lane changes.',helix:'Spiralling visual tunnel around the course.',bloom:'Recovery garden with sparse danger.',rush:'Rewarding crystal sprint with a few hazards.'}},
 gimmick:{type:'choice',instructions:'Choose one obstacle gimmick for the next unseen section. Keep the safe route readable. Avoid using the same gimmick repeatedly. Low health should favor crystal or vortex spectacle; low steering with no hits should favor laser or phase.',criteria:{crystal:'Classic solid crystals; readable baseline hazard.',laser:'Laser wall segments across blocked lanes, leaving a visible lane gap.',mine:'Pulsing floating mines with compact hit zones and strong warning glow.',shard:'Crystal beds rising from blocked lanes; narrow but visually tall.',tower:'Large twin-style monoliths that create dramatic corridors.',phase:'Sequential phase gates that encourage rhythmic lane changes.',vortex:'Glowing vortex rings used as compact lane hazards with strong spectacle.'}},
 pressure:{type:'choice',instructions:'Choose challenge intensity from recent performance. Low health or hits12>=2 requires calm. First 15 seconds should not be intense. If seconds>12, steer12 is very low, hits12=0 and health>=2, do not stay calm; after prolonged effortless straight play intense can be appropriate.',criteria:{calm:'Wide gaps and low density.',steady:'Moderate density with predictable rhythm.',intense:'Denser but still navigable challenge for stable clean play.'}},
 biome:{type:'choice',instructions:'Choose a contrasting visual biome when useful; visuals do not change controls.',criteria:{aurora:'Mint auroras and crystal peaks.',ember:'Warm peach sun and terracotta spires.',prism:'Lilac glass city and pink nebula.',abyss:'Deep blue islands and turquoise lanterns.'}},
 recovery:{type:'noul',instructions:'Does the player need a recovery section now because of low health or repeated recent collisions?'},
 bias:{type:'choice',instructions:'Where should the next safe gem trail gently invite the player? After damage favor center.',criteria:{left:'Gentle left invitation.',center:'Centered forgiving trail.',right:'Gentle right invitation.'}}
 }};
}
function parseDecision(raw,telemetry){
 if(!raw||!raw.answers||typeof raw.answers!=='object')throw Error('Jevの応答形式を確認できませんでした。');
 const a=raw.answers,read=(k,opts,fallback)=>{const q=a[k];if(!q||!opts.includes(q.choice))return fallback;const c=Number(q.confidence);return Number.isFinite(c)&&c<.12?fallback:q.choice;};
 if(!a.pattern||!PATTERNS.includes(a.pattern.choice)||!a.pressure||!['calm','steady','intense'].includes(a.pressure.choice))throw Error('Jevのコース判断が不正です。');
 const t=cleanTelemetry(telemetry),recovery=Number(a.recovery&&a.recovery.noul)>.64||t.health<=1||t.hits12>=2;
 let pattern=read('pattern',PATTERNS,'ribbon'),gimmick=read('gimmick',GIMMICKS,'crystal'),pressure=read('pressure',['calm','steady','intense'],'steady');
 if(recovery){pattern='bloom';gimmick='crystal';pressure='calm';}
 if(t.seconds<15)pressure='calm';
 const passive=t.seconds>12&&t.hits12===0&&t.health>=2&&t.steer12<.45;
 if(passive&&!recovery){if(pressure==='calm')pressure='steady';if(t.seconds>35)pressure='intense';if(['ribbon','bloom'].includes(pattern))pattern='slalom';if(['crystal','vortex'].includes(gimmick))gimmick=t.seconds>35?'laser':'phase';}
 return {pattern,gimmick,pressure,biome:read('biome',BIOMES,t.biome),bias:read('bias',['left','center','right'],'center'),recovery,source:'jev',model:typeof raw.model==='string'?raw.model.slice(0,80):'jev-latest',confidence:Number.isFinite(Number(a.pattern.confidence))?Number(a.pattern.confidence):null};
}
const api={PATTERNS,BIOMES,GIMMICKS,cleanTelemetry,buildRequest,parseDecision};
if(typeof module==='object'&&module.exports)module.exports=api;else root.JevDirector=api;
})(typeof globalThis!=='undefined'?globalThis:this);
