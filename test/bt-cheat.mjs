// node test/bt-cheat.mjs <bomber|tron> [n=3]  -- can a malicious/buggy phone cheat? (teleport, speed spam, bomb spam, queue spam, out-of-phase acts)
import {launchParty,sleep} from './harness.mjs';
import {BOMBER_BOT,TRON_BOT} from './bt-lib.mjs';
const game=process.argv[2]||'bomber',n=+process.argv[3]||3;
const party=await launchParty({n,only:game,rounds:5});
const problems=[];const bad=m=>{console.log('  PROBLEM:',m);problems.push(m);};
await party.start();
if(game==='tron'){
  // out-of-phase: spam turns during countdown -> must be ignored
  await party.waitPhase('count',20000).catch(()=>{});
}
await party.waitPhase('play',30000);
await party.host.evaluate(()=>{window.__cheatLog=[];});
if(game==='bomber'){
  const r=await party.host.evaluate(async()=>{
    const G=GAMES.bomber,S=H.S,out={};const pid=H.players[1].id,i=1,p=S._p[i];
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    // 1) teleport: 300 claims at far tiles inside one tick
    const o={x:p.x,y:p.y};
    for(let k=0;k<300;k++)G.act(H,S,pid,{t:'act',k:'mv',x:(k%2)*8,y:(k%3)*5,f:0,m:1});
    out.teleportMoved=+dist(p,o).toFixed(2);
    // 2) claim straight into a crate/pillar neighbour
    const before={x:p.x,y:p.y};G.act(H,S,pid,{t:'act',k:'mv',x:7,y:9.9,f:0,m:1});
    out.afterBadClaim=[+p.x.toFixed(2),+p.y.toFixed(2)];
    // 3) speed spam for 2 s real-time: 12 claims per 50 ms toward a far corner along the whole board
    const t0=performance.now(),start={x:p.x,y:p.y};let path=0,last={x:p.x,y:p.y};
    while(performance.now()-t0<2000){
      for(let k=0;k<12;k++){const tx=Math.max(0,Math.min(8,p.x+(Math.random()<.5?-1:1)*1.5)),ty=Math.max(0,Math.min(10,p.y+(Math.random()<.5?-1:1)*1.5));G.act(H,S,pid,{t:'act',k:'mv',x:tx,y:ty,f:1,m:1});path+=dist(p,last);last={x:p.x,y:p.y};}
      await new Promise(r=>setTimeout(r,50));
    }
    out.spamPath2s=+path.toFixed(1);out.allowed=+(p.sp*1.3*2+1.8).toFixed(1);
    // 4) bomb spam: 60 bomb acts
    for(let k=0;k<60;k++)G.act(H,S,pid,{t:'act',k:'bomb',x:p.x+k*.01,y:p.y,f:0,m:0});
    out.bombsOwned=S._b.filter(b=>b.o===i).length;out.cap=p.nb;
    // 5) bomb claims from a far-away position must land on the validated tile only
    const nb0=S._b.length;G.act(H,S,pid,{t:'act',k:'bomb',x:8,y:10,f:0,m:0});
    out.farBombNearPlayer=S._b.slice(nb0).every(b=>Math.abs(b.x-p.x)<=1.5&&Math.abs(b.y-p.y)<=1.5);
    // 6) dead / unknown pid / wrong types
    for(const m of [{k:'mv',x:'a',y:[]},{k:'bomb'},{k:'mv',x:1e308,y:-1e308},null])try{G.act(H,S,pid,Object.assign({t:'act'},m));}catch(e){out.threw=String(e);}
    try{G.act(H,S,999,{t:'act',k:'mv',x:1,y:1});G.act(H,S,-1,{t:'act',k:'bomb'});}catch(e){out.threw=String(e);}
    out.finite=[p.x,p.y].every(Number.isFinite);
    return out;
  });
  console.log('bomber cheat results:',JSON.stringify(r));
  if(r.teleportMoved>2.3)bad('teleport moved '+r.teleportMoved);
  if(r.spamPath2s>r.allowed+1)bad(`speed spam travelled ${r.spamPath2s} > allowed ${r.allowed}`);
  if(r.bombsOwned>r.cap)bad('bomb spam exceeded capacity');
  if(!r.farBombNearPlayer)bad('bomb placed far from player');
  if(r.threw)bad('threw '+r.threw);
  if(!r.finite)bad('non finite');
}else{
  const r=await party.host.evaluate(async()=>{
    const G=GAMES.tron,S=H.S,out={};const pid=H.players[1].id,b=S._b[1];
    // wait until running
    while(S.st!=='run')await new Promise(r=>setTimeout(r,50));
    for(let k=0;k<100;k++)G.act(H,S,pid,{t:'act',k:'t',r:k%2?1:-1,at:b.k+k*1000,seq:k});
    out.queueLen=b.q.length;out.maxAt=Math.max(...b.q.map(q=>q.at),0)-b.k;
    for(const m of [{k:'t',r:NaN,at:NaN,seq:'x'},{k:'t',r:'zzz',at:-1e9,seq:1e12},{k:'t'},{k:'p',id:'abc'},{k:'bomb'},null])try{G.act(H,S,pid,Object.assign({t:'act'},m));}catch(e){out.threw=String(e);}
    try{G.act(H,S,12345,{t:'act',k:'t',r:1,at:0,seq:1});}catch(e){out.threw=String(e);}
    out.qAfter=b.q.length;
    return out;
  });
  console.log('tron cheat results:',JSON.stringify(r));
  if(r.queueLen>2||r.qAfter>2)bad('turn queue exceeded 2');
  if(r.threw)bad('threw '+r.threw);
  // countdown abuse on the NEXT mini-round: turn spam while st==='cd' must be ignored
  await party.host.evaluate(async()=>{while(H.S.st!=='end'&&H.S.st!=='cd'&&H.ph==='play')await new Promise(r=>setTimeout(r,50));});
}
await sleep(1500);
const alive=await party.host.evaluate(()=>H.ph);
if(alive!=='play'&&alive!=='result')bad('engine in odd phase '+alive);
console.log('errors:',party.errors);if(party.errors.length)bad('page errors');
console.log(problems.length?'FAILED':'ALL OK');if(problems.length)process.exitCode=1;
await party.close();
