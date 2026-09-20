const UPSTREAM='https://api.typesafe.ai/v1/systemone';
const MODEL=process.env.TYPESAFE_MODEL||'jev-latest';
const buckets=globalThis.__jevProbabilityBuckets||(globalThis.__jevProbabilityBuckets=new Map());

function send(res,status,data){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  return res.status(status).json(data);
}
function header(req,name){
  const v=req.headers?.[name.toLowerCase()];
  return Array.isArray(v)?v[0]:String(v||'');
}
function clientKey(req){
  return header(req,'x-forwarded-for').split(',')[0].trim()||header(req,'x-real-ip')||'unknown';
}
function allow(req){
  const now=Date.now(),key=clientKey(req),hour=3600000;
  const recent=(buckets.get(key)||[]).filter(t=>now-t<hour);
  if(recent.length&&now-recent.at(-1)<1400)return false;
  if(recent.length>=240)return false;
  recent.push(now);buckets.set(key,recent);
  if(buckets.size>1200)for(const [k,v] of buckets)if(!v.length||now-v.at(-1)>hour)buckets.delete(k);
  return true;
}
async function readBody(req){
  if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body))return req.body;
  if(typeof req.body==='string')return JSON.parse(req.body);
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
}
function cleanOptions(v){
  return (Array.isArray(v)?v:[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,10);
}

export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{ok:false,error:'method_not_allowed'});}
  if(!process.env.TYPESAFE_API_KEY)return send(res,503,{ok:false,error:'typesafe_api_key_missing'});
  const len=Number(header(req,'content-length')||0);
  if(Number.isFinite(len)&&len>16000)return send(res,413,{ok:false,error:'request_too_large'});
  if(!allow(req))return send(res,429,{ok:false,error:'rate_limited'});

  let body;try{body=await readBody(req);}catch{return send(res,400,{ok:false,error:'invalid_json'});}
  const state=String(body?.state||'').trim().slice(0,4000);
  const instructions=String(body?.instructions||'').trim().slice(0,1200);
  const type=['noul','choice','score'].includes(body?.type)?body.type:'noul';
  const options=cleanOptions(body?.options);
  if(!state||!instructions)return send(res,400,{ok:false,error:'state_and_instructions_required'});
  if(type!=='noul'&&options.length<2)return send(res,400,{ok:false,error:'at_least_two_options_required'});

  const optionMap={},question={type,instructions};
  if(type==='choice'){
    question.criteria={};
    options.forEach((label,i)=>{const k='option_'+(i+1);question.criteria[k]=label;optionMap[k]=label;});
  }else if(type==='score')question.criteria=options;

  const payload={state,model:MODEL,questions:{decision:question}};
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000),started=Date.now();
  try{
    const upstream=await fetch(UPSTREAM,{
      method:'POST',
      headers:{Authorization:'Bearer '+process.env.TYPESAFE_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:ctrl.signal
    });
    const latency_ms=Date.now()-started;
    let raw=null;try{raw=await upstream.json();}catch{}
    if(!upstream.ok)return send(res,[401,403,429].includes(upstream.status)?upstream.status:502,{ok:false,error:'provider_rejected_request',provider_status:upstream.status});
    const answer=raw?.answers?.decision;
    if(!answer)return send(res,502,{ok:false,error:'invalid_provider_response'});
    const base={ok:true,type,model:raw.model||MODEL,latency_ms,usage:raw.usage||null,raw};
    if(type==='noul')return send(res,200,{...base,probability_yes:Number(answer.noul??0)});
    if(type==='choice'){
      const probabilities={};
      for(const [k,v] of Object.entries(answer.probabilities||{}))probabilities[optionMap[k]||k]=Number(v);
      return send(res,200,{...base,choice_key:answer.choice,choice_label:optionMap[answer.choice]||answer.choice,probabilities,confidence:answer.confidence==null?null:Number(answer.confidence)});
    }
    const probabilities={},legend=answer.legend||{};
    for(const [k,v] of Object.entries(answer.probabilities||{}))probabilities[String(legend[k]??options[Number(k)]??k)]=Number(v);
    return send(res,200,{...base,score:Number(answer.score??0),probabilities,confidence:answer.confidence==null?null:Number(answer.confidence),legend});
  }catch(err){
    return send(res,err?.name==='AbortError'?504:502,{ok:false,error:err?.name==='AbortError'?'provider_timeout':'provider_unavailable'});
  }finally{clearTimeout(timer);}
}
