// Shared helpers for the draw/defuse stress tests: latency injection, host fuzzing, time warp, payload sampling.
import {sleep} from './harness.mjs';
export {sleep};

// One-way latency (ms, +-30% jitter, order preserving) on every connection. base[i] = latency for player/page i (index 0 = host, ignored).
export async function addLatency(party,base){
  await party.host.evaluate(base=>{
    const wrap=(c,ms)=>{if(c.__lat)return;c.__lat=1;const o=c.send.bind(c);let last=0;c.send=d=>{const now=performance.now(),t=Math.max(last,now+ms*(.7+.6*Math.random()));last=t;setTimeout(()=>o(d),t-now);};};
    const ap=()=>{for(const p of H.players)if(p.conn&&p.id>0)wrap(p.conn,base[p.id]||0);};ap();setInterval(ap,150);
  },base);
  for(let i=1;i<party.pages.length;i++)await party.pages[i].evaluate(ms=>{
    const wrap=(c)=>{if(c.__lat)return;c.__lat=1;const o=c.send.bind(c);let last=0;c.send=d=>{const now=performance.now(),t=Math.max(last,now+ms*(.7+.6*Math.random()));last=t;setTimeout(()=>o(d),t-now);};};
    const ap=()=>{if(hostConn)wrap(hostConn);};ap();setInterval(ap,150);
  },base[i]||0);
}
// run the host's clock k times faster (engine tick dt is capped at .25 s so keep k<=4)
export async function warp(party,k){await party.host.evaluate(k=>{const o=performance.now.bind(performance),t0=o();performance.now=()=>t0+(o()-t0)*k;},k);}

// throw garbage at the host's message handler. Returns the number of messages sent. Errors surface through party.errors (act() is try/caught by the engine and console.error'd).
export async function fuzz(party,count,keys){
  return party.host.evaluate(([count,keys])=>{
    const big=Array(500).fill(7),pool=[undefined,null,NaN,Infinity,-Infinity,-1,0,1,2,3,4,8,9,10,255,1e9,-1e9,1.5,'',' ','abc','0','<img src=x onerror=window.__pwn=1>','x'.repeat(5000),[],[1,2],[1,2,3,4],big,{},{a:1},true,false,'🐱🍕','__proto__',{__proto__:{x:1}},'constructor',[[1,2],[3,4]],()=>1];
    const r=a=>a[Math.floor(Math.random()*a.length)],ids=H.players.map(p=>p.id).concat([99,-1,'1',null]);
    let n=0;
    for(let i=0;i<count;i++){
      const m={t:r(['act','act','act','act','act','done','prog','emo','ready','bet','skip','nope',undefined])};
      for(const f of ['k','i','tx','sid','c','w','p','l','h','n','to','e','v'])if(Math.random()<.45)m[f]=r(pool);
      if(Math.random()<.7)m.k=r(keys);
      if(Math.random()<.3&&m.t==='act'&&keys.includes('pts')){m.k='pts';m.p=Array.from({length:2+2*Math.floor(Math.random()*20)},()=>Math.floor(Math.random()*1300));m.sid=Math.floor(Math.random()*5);m.c=Math.floor(Math.random()*5);m.w=Math.floor(Math.random()*3);}
      try{hostHandle(r(ids),m);n++;}catch(e){console.error('hostHandle threw: '+e.message);}
    }
    return n;
  },[count,keys]);
}
// per-player broadcast size (what the engine would send): JSON bytes of public state + that player's priv
export async function sizeSample(party){
  return party.host.evaluate(()=>{if(!H||!H.S)return null;const base=pub(),o={};for(const p of H.players)o[p.id]=JSON.stringify(Object.assign({},base,{priv:privFor(p.id),mybet:null})).length;return o;});
}
export const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
export const chance=p=>Math.random()<p;
