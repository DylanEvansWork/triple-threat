// Stress / soak harness for spy, runner, artillery.
//  node test/stress.mjs --game=spy --n=3 [--rounds=1] [--lat] [--reload] [--fuzz] [--bots=human|idle|spam] [--vp=320x568] [--cheat=0.04] [--label=x]
import {launchParty,sleep} from './harness.mjs';
import {spyBot,runnerBot,artBot} from './bots.mjs';
const A=Object.fromEntries(process.argv.slice(2).map(a=>{const m=a.match(/^--([^=]+)(?:=(.*))?$/);return[m[1],m[2]===undefined?true:m[2]];}));
const game=A.game||'spy',n=+(A.n||3),rounds=+(A.rounds||1),botMode=A.bots||'human',cheat=+(A.cheat||0.03);
const vp=A.vp?{width:+A.vp.split('x')[0],height:+A.vp.split('x')[1]}:undefined;
const botFn={spy:spyBot,runner:runnerBot,artillery:artBot}[game];
const problems=[];const fail=m=>{if(!problems.includes(m)){problems.push(m);console.log('PROBLEM:',m);}process.exitCode=1;};
const log=(...a)=>console.log(`[${game} n=${n}${A.lat?' lat':''}${A.reload?' reload':''}${A.fuzz?' fuzz':''} ${botMode}]`,...a);
const party=await launchParty({n,only:Array(rounds).fill(game).join(','),rounds:5,viewport:vp});
const dur={spy:75,runner:75,artillery:86}[game];

// ---- network shim: count bytes, optionally add latency+jitter (ordered delivery, like a reliable data channel) ----
const LAT=A.lat?{1:[150,50],2:[300,100],3:[200,60]}:{};   // one-way ms [base,jitter]; player 2 is the worst
const shim=(page,pidOf)=>page.evaluate(([LAT])=>{
  const wrap=(c,lat,count)=>{
    if(!c||c.__w)return;c.__w=1;const orig=c.send.bind(c);let last=0;
    c.send=d=>{
      if(count){const L=JSON.stringify(d).length;const n=window.__net=window.__net||{st:0,stB:0,max:0,ev:0,evB:0,t0:performance.now()};if(d&&d.t==='st'){n.st++;n.stB+=L;n.max=Math.max(n.max,L);}else if(d&&d.t==='ev'){n.ev++;n.evB+=L;}}
      if(!lat){orig(d);return;}
      const t=Math.max(last,performance.now()+lat[0]+(Math.random()*2-1)*lat[1]);last=t;setTimeout(()=>orig(d),Math.max(0,t-performance.now()));
    };
  };
  if(isHost&&H)for(const p of H.players)if(p.conn)wrap(p.conn,LAT[p.id],p.id===1);
  else if(!isHost&&hostConn)wrap(hostConn,LAT[myPid]);
  if(isHost&&H)for(const p of H.players)if(p.conn)wrap(p.conn,LAT[p.id],p.id===1);
},[LAT]);
const shimAll=async()=>{for(const p of party.pages)await shim(p).catch(()=>{});};
await shimAll();
await party.start();await party.waitPhase('play');

// ---- bots + metrics wrappers (re-applied every round) ----
const botCfg={mode:botMode,cheat,skill:.85,noise:.9};
const arm=async(i)=>{const pg=party.pages[i];await pg.evaluate(()=>{if(window.__bot){clearInterval(window.__bot);window.__bot=0;}}).catch(()=>{});
  await pg.evaluate(botFn,botCfg).catch(()=>{});};
const wrapMetrics=pg=>pg.evaluate(()=>{if(typeof cur==='undefined'||!cur||cur.__w)return;cur.__w=1;window.__fc=window.__fc||{n:0,t:0,max:0,un:0,ut:0};
  const f=cur.frame;if(f)cur.frame=function(r){const t=performance.now();f.call(cur,r);const e=performance.now()-t;__fc.n++;__fc.t+=e;__fc.max=Math.max(__fc.max,e);};
  const u=cur.update;cur.update=function(a,b){const t=performance.now();u.call(cur,a,b);const e=performance.now()-t;__fc.un++;__fc.ut+=e;};}).catch(()=>{});
for(let i=0;i<n;i++)await arm(i);

// ---- invariants (host side) ----
const INV={
 spy:()=>{const S=H.S,bad=[];if(!S||!S._dots)return bad;for(const d of S._dots){if(!d.alive)continue;if(![d.x,d.y,d.vx,d.vy].every(Number.isFinite))bad.push('non-finite dot');if(d.x<0||d.x>100||d.y<0||d.y>120)bad.push('dot out of arena');}
   for(const k in S.pl){const p=S.pl[k];if(![p.k,p.w,p.cd,p.lk].every(Number.isFinite))bad.push('non-finite player stat');}
   if(S.d.some(r=>r.length!==5||r.some(v=>typeof v!=='number'||!isFinite(v))))bad.push('bad S.d row');return bad;},
 runner:()=>{const S=H.S,bad=[];if(!S||!S.pos)return bad;for(const k in S.pos){const p=S.pos[k];if(![p.x,p.y,p.v,p.f].every(Number.isFinite))bad.push('non-finite pos');if(p.x<0||p.x>620.01)bad.push('pos out of range');if(!Array.isArray(p.w)||p.w.length>3)bad.push('bad walls list');}
   for(const k in S.fin)if(!Number.isFinite(S.fin[k]))bad.push('non-finite fin');return bad;},
 artillery:()=>{const S=H.S,bad=[];if(!S||!S.tk)return bad;for(const k in S.tk){const t=S.tk[k];if(![t.x,t.y,t.hp].every(Number.isFinite))bad.push('non-finite tank');if(t.hp<0||t.hp>100)bad.push('hp out of range '+t.hp);}
   if(!Number.isFinite(S.wind))bad.push('wind');if(S._T.length!==201||S._T.some(v=>!Number.isFinite(v)||v<0||v>64))bad.push('terrain invalid');
   for(const s of S.sh)if(s.some(v=>!Number.isFinite(v)))bad.push('shell non-finite');if(S.sh.length>6*H.players.length)bad.push('too many shells');
   for(const k in S.sc)if(![S.sc[k].d,S.sc[k].s,S.sc[k].k].every(Number.isFinite))bad.push('score non-finite');return bad;}
};
const JUNK=[{},{k:null},{k:undefined},{k:'s'},{k:'s',x:NaN,y:Infinity},{k:'s',x:'abc',y:{}},{k:'s',x:50,y:50,h:{}},{k:'s',x:-1e9,y:1e9,h:'x'},{k:'s',x:[1],y:[2]},
 {k:'j',x:1e308,y:-1e308},{k:'j',x:{},y:[]},{k:'j',x:'5',y:'-5'},{k:'j'},
 {k:'p',x:'9e9',y:0,v:0,f:0},{k:'p',x:NaN,y:NaN,v:NaN,f:NaN},{k:'p',x:100,y:1,v:5,f:1e12,w:'x'},{k:'p',x:50,y:0,v:5,f:0,w:[1,2,3,4,5,6,'a',null]},{k:'p',x:-500,y:-1e9,v:-4,f:-3,w:{}},
 {k:'fin',ft:-5},{k:'fin',ft:1e9},{k:'fin',ft:'x'},{k:'fin'},
 {k:'item',i:'wall',to:99},{k:'item',i:'__proto__',to:1},{k:'item',i:'wall'},{k:'item',i:'fog',to:'1'},{k:'item',i:'boost',to:0},
 {k:'fire',a:null,p:undefined},{k:'fire',a:'x',p:'y'},{k:'fire',a:1e9,p:-1e9},{k:'fire',a:90,p:50},{k:'hold',a:'x'},{k:'hold',a:NaN},{k:'rel'},{k:'aim'},
 {k:'__proto__'},{k:'constructor'},{k:['s']},{k:{}},{k:'s'.repeat(10000)},{t:'act'},{x:1,y:2},
 JSON.parse('{"__proto__":{"k":"s","x":1}}'),JSON.parse('{"k":"s","x":{"__proto__":{"a":1}},"y":5}'),Array.from({length:50},(_,i)=>i),'str',5,null,true];
const fuzz=async()=>{
  const r=await party.host.evaluate(([JUNK])=>{
    const out={thrown:[],n:0},ids=H.players.map(p=>p.id).concat([99,-1,'0','x']);
    const G=GAMES[H.g];
    for(const pid of ids)for(const m of JUNK){
      if(!m||typeof m!=='object'||Array.isArray(m))continue;   // the engine only forwards objects (null/primitives are dropped in onHostData)
      const msg=Object.assign({t:'act'},m);out.n++;
      try{hostHandle(pid,msg);}catch(e){out.thrown.push('hostHandle: '+e.message);}
      try{if(G.act&&H.S)G.act(H,H.S,pid,msg);}catch(e){out.thrown.push('act('+JSON.stringify(m).slice(0,60)+'): '+e.message);}
    }
    for(const m of [{t:'done',v:'x'},{t:'done',v:NaN},{t:'prog',v:1},{t:'ready'},{t:'bet',to:'x'},{t:'bet',to:-1},{t:'start'},{t:'rounds',n:'x'},{t:'games',list:'x'},{t:'emo',e:{}},{t:'nope'},{t:'again'},{}])
      for(const pid of [0,1,99]){try{hostHandle(pid,m);}catch(e){out.thrown.push('engine '+m.t+': '+e.message);}}
    return out;
  },[JUNK]);
  if(r.thrown.length){fail('fuzz: host threw on malformed input: '+[...new Set(r.thrown)].slice(0,4).join(' | '));}
  log('fuzz sent',r.n,'malformed messages; threw',r.thrown.length);
};
const rejoin=async(i)=>{
  const pg=party.pages[i],url=pg.url(),pre=await pg.evaluate(()=>({pm:R&&R.priv&&R.priv.me,x:cur&&cur.dbg&&cur.dbg.sim&&cur.dbg.sim.x})).catch(()=>({}));
  await pg.goto(url,{waitUntil:'load'});
  await pg.fill('#name',party.names[i]);await pg.fill('#code',party.code);await pg.click('#join');
  const t0=Date.now();
  try{await pg.waitForFunction(()=>R&&R.ph==='play'&&typeof cur!=='undefined'&&cur&&cur.dbg,null,{timeout:15000});}catch(e){fail('rejoin: page never returned to play ('+e.message.slice(0,40)+')');return;}
  log('rejoin took',Date.now()-t0,'ms');
  await sleep(1500);await shim(pg).catch(()=>{});await shim(party.host).catch(()=>{});
  const post=await pg.evaluate(()=>({ph:R.ph,me:myPid,pm:R.priv&&R.priv.me,x:cur.dbg.sim&&cur.dbg.sim.x,hasCanvas:!!document.querySelector('#gbox canvas'),dT:cur.dbg.dT&&!!cur.dbg.dT(),dots:cur.dbg.dots&&cur.dbg.dots().length,t:R.S.t})).catch(e=>({err:e.message}));
  const host=await party.host.evaluate(()=>({x:H.S.pos&&H.S.pos[1]&&H.S.pos[1].x}));
  log('post-rejoin',JSON.stringify(post),'pre',JSON.stringify(pre));
  if(!post.hasCanvas)fail('rejoin: game canvas missing after reload');
  if(game==='spy'){if(post.pm!==pre.pm)fail('rejoin: spy ring/dot id changed');if(!(post.dots>5))fail('rejoin: spy dots not rendered');}
  if(game==='runner'){if(Math.abs((post.x||0)-(host.x||0))>60)fail('rejoin: runner position not restored (client '+post.x+' host '+host.x+')');}
  if(game==='artillery'&&!post.dT)fail('rejoin: artillery terrain not synced');
  await arm(i);
};

// ---- main loop ----
const results=[],roundsSeen=new Set();let lastRn=0,roundStart=Date.now(),fuzzMid=0,fuzzEnd=0,reloaded=false,lastSample=0,metricsT=0;
const samples={tv:-1,tvT:0,dev:[],lag:[],terr:[],tankhp:[]};
const T0=Date.now(),limit=rounds*(dur+28)*1000+60000;
while(true){
  await sleep(600);
  const s=await party.host.evaluate(()=>({ph:R&&R.ph,rn:R&&R.rn,t:H&&H.S&&H.S.t,res:R&&R.res,over:!!(H&&H.S&&H.S.over)})).catch(()=>null);
  if(!s)continue;
  if(Date.now()-T0>limit){fail('timeout: stuck in phase '+s.ph);break;}
  if(s.ph==='final')break;
  if(s.rn!==lastRn){lastRn=s.rn;roundStart=Date.now();await sleep(300);for(let i=0;i<n;i++)await arm(i);}
  if(s.ph==='result'&&s.res&&!roundsSeen.has(s.rn)){
    roundsSeen.add(s.rn);const rows=s.res.rows,real=((Date.now()-roundStart)/1000).toFixed(1);
    results.push({rn:s.rn,rows});
    const ok=rows.length===n&&rows.every(r=>Number.isInteger(r.pts)&&r.pts>=0&&r.pts<=n)&&rows.some(r=>r.rank===0);
    if(!ok)fail('insane result rows '+JSON.stringify(rows));
    log('round',s.rn,'finished',real+'s',rows.map(r=>`${party.names[r.id]}:${r.label}(+${r.pts})`).join(' '));
  }
  if(s.ph!=='play')continue;
  // invariants
  const bad=await party.host.evaluate(INV[game]).catch(e=>['inv threw '+e.message]);for(const b of bad)fail('invariant: '+b);
  if(A.fuzz&&s.t>10&&fuzzMid!==s.rn){fuzzMid=s.rn;await fuzz();}
  if(A.fuzz&&s.over&&fuzzEnd!==s.rn){fuzzEnd=s.rn;await fuzz();}   // after S.over (end-of-round hold)
  if(A.reload&&!reloaded&&s.t>18&&!s.over&&n>=2){reloaded=true;await rejoin(1);}
  if(Date.now()-metricsT>2500){metricsT=Date.now();for(const p of party.pages)await wrapMetrics(p);}
  if(Date.now()-lastSample>1000){lastSample=Date.now();
    try{
      if(game==='spy'){const d=await party.host.evaluate(()=>H.S._dots.filter(d=>d.alive).map(d=>[d.id,d.x,d.y]));
        const c=await party.pages[1].evaluate(()=>cur.dbg.dots().map(o=>[o.id,o.x,o.y]));const m=new Map(d.map(r=>[r[0],r]));let sum=0,k=0;for(const r of c){const h=m.get(r[0]);if(h){sum+=Math.hypot(h[1]-r[1],h[2]-r[2]);k++;}}if(k)samples.dev.push(sum/k);}
      if(game==='runner'){const h=await party.host.evaluate(()=>Object.fromEntries(H.players.map(p=>[p.id,H.S.pos[p.id].x])));
        const c=await Promise.all(party.pages.map(p=>p.evaluate(()=>cur.dbg.sim.x).catch(()=>null)));c.forEach((x,i)=>{if(x!=null&&h[i]!=null)samples.lag.push(x-h[i]);});}
      if(game==='artillery'){const h=await party.host.evaluate(()=>({T:H.S._T,tv:H.S.tv,hp:H.players.map(p=>H.S.tk[p.id].hp),sh:H.S._sh.length}));if(h.tv!==samples.tv){samples.tv=h.tv;samples.tvT=Date.now();}
        const c=await party.pages[1].evaluate(()=>({T:cur.dbg.dT(),hp:Object.values(cur.dbg.tanks()).map(t=>t.hp),sh:cur.dbg.shells().size}));
        if(h.sh===0&&c.sh===0&&c.T&&Date.now()-samples.tvT>2000){let mx=0;for(let i=0;i<201;i++)mx=Math.max(mx,Math.abs(h.T[i]-c.T[i]));samples.terr.push(mx);}}
    }catch(e){}
  }
}
// ---- report ----
const net=await party.host.evaluate(()=>window.__net).catch(()=>null);
const fc=await party.pages[n>1?1:0].evaluate(()=>window.__fc).catch(()=>null);
if(net){const sec=(Date.now()-T0)/1000;log(`payload: ${net.st} state msgs to player1, avg ${(net.stB/net.st).toFixed(0)} B, max ${net.max} B, ~${(net.stB/1024/sec).toFixed(1)} KB/s state + ${net.ev} events (${(net.evB/1024).toFixed(1)} KB)`);}
if(fc)log(`client cost (headless desktop): frame avg ${(fc.t/Math.max(1,fc.n)).toFixed(2)} ms max ${fc.max.toFixed(1)} ms | update avg ${(fc.ut/Math.max(1,fc.un)).toFixed(2)} ms`);
const stat=a=>a.length?`avg ${(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2)} max ${Math.max(...a.map(Math.abs)).toFixed(2)} (n=${a.length})`:'n/a';
if(game==='spy')log('client dot position error vs host (units):',stat(samples.dev));
if(game==='runner')log('client sim x minus host-known x (units, lag):',stat(samples.lag));
if(game==='artillery'){log('terrain client-vs-host max diff when idle:',stat(samples.terr));if(samples.terr.some(v=>v>.5))fail('artillery terrain desync > 0.5 units');}
if(game==='spy'&&A.lat&&samples.dev.length&&samples.dev.reduce((a,b)=>a+b,0)/samples.dev.length>6)fail('spy: client dots far from host under latency');
log('rounds completed',results.length,'/',rounds,'| page errors:',JSON.stringify(party.errors));
if(party.errors.length)fail('page errors');
if(results.length!==rounds)fail('did not complete all rounds ('+results.length+'/'+rounds+')');
console.log(problems.length?'STRESS FAILED: '+problems.length+' problem(s)':'STRESS OK');
await party.close();
