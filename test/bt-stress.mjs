// Stress test:  node test/bt-stress.mjs <bomber|tron> <n=3> <rounds=3> [chaos|clean] [WxH]
//  chaos = mixed bot skills (smart / slow+mistakes / spammy multi-touch / idle), latency+jitter (one seat worse), host fuzzing,
//          a client page reload with the same ?key= mid-round, invariant watchers, payload + frame-cost metrics.
//  clean = same bots but no lag / fuzz / reload (baseline round durations).
import {launchParty,sleep} from './harness.mjs';
import {lag,watch,metrics,violations,fuzz,BOMBER_BOT,TRON_BOT,rejoin,nextRound,sanePoints} from './bt-lib.mjs';
const game=process.argv[2]||'bomber',n=+process.argv[3]||3,rounds=+process.argv[4]||3,mode=process.argv[5]||'chaos';
const vp=(process.argv[6]||'390x844').split('x').map(Number);
const chaos=mode==='chaos';
const party=await launchParty({n,only:game,rounds:5,viewport:{width:vp[0],height:vp[1]}});
const BOT=game==='bomber'?BOMBER_BOT:TRON_BOT;
const problems=[];const bad=m=>{console.log('  PROBLEM:',m);problems.push(m);};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const roundStats=[];
const botKinds=game==='bomber'
  ?[{aggr:1,ptr:true},{aggr:1,ptr:false},{aggr:1,ptr:true,tick:260,mistake:.12},{kind:'spam'},{kind:'idle'}]
  :[{kind:'smart'},{kind:'smart',react:.2,mistake:.2,tick:140},{kind:'smart',react:.34},{kind:'spam'},{kind:'idle'}];
const botFor=seat=>{ // seats 0,1 always play properly so rounds are meaningful
  if(seat<2)return seat===0?botKinds[0]:pick([botKinds[1],botKinds[2],botKinds[0]]);
  return pick([botKinds[0],botKinds[2],botKinds[3],botKinds[4],botKinds[1]]);
};
for(const p of party.pages)await watch(p,game);

for(let r=0;r<rounds;r++){
  if(r===0)await party.start();else await nextRound(party);
  await party.waitPhase('play',40000);
  const t0=Date.now();
  const kinds=party.pages.map((p,i)=>botFor(i));
  for(const [i,p] of party.pages.entries()){await p.evaluate(()=>clearInterval(window.__bot));await p.evaluate(BOT,kinds[i]);}
  if(chaos){
    if(n>1)await lag(party.pages[1],{ms:70,jit:40}),await lag(party.host,{host:true,idx:1,ms:70,jit:40});
    if(n>2)await lag(party.pages[2],{ms:150,jit:80}),await lag(party.host,{host:true,idx:2,ms:150,jit:80});
  }
  const label=`round ${r+1}/${rounds} n=${n} bots=${kinds.map(k=>k.kind||(k.ptr?'ptr':'keys')+(k.mistake?'*':'')).join(',')}`;
  console.log(label);
  const reloadAt=chaos?4000+Math.random()*9000:1e9,reloadSeat=1,markAway=Math.random()<.5;
  let reloaded=false,lastFuzz=0,fuzzN=0;const fuzzErrs=[];let shots=0;const minis={};
  while(true){
    const ph=await party.phase();if(ph!=='play')break;
    const el=Date.now()-t0;
    let st;try{st=await party.state();}catch(e){break;}
    const S=st.S;
    if(game==='tron'&&S){if(S.st==='run')minis[S.mr]=S.mt;}
    if(chaos&&!reloaded&&el>reloadAt){
      reloaded=true;
      if(markAway)await party.host.evaluate(()=>{const p=H.players[1];if(p.conn)onHostClose(p.conn);});   // host notices the close
      await rejoin(party,reloadSeat);
      await watch(party.pages[reloadSeat],game);
      await party.pages[reloadSeat].evaluate(BOT,kinds[reloadSeat]);
      await lag(party.pages[reloadSeat],{ms:70,jit:40});await lag(party.host,{host:true,idx:reloadSeat,ms:70,jit:40});
      // UI recovery check
      await sleep(400);
      const ui=await party.pages[reloadSeat].evaluate(()=>({ph:R&&R.ph,canvas:!!document.querySelector('#gbox canvas'),joy:!!document.querySelector('.bm-joy'),zone:!!document.querySelector('.tr-zone'),intro:document.querySelector('#intro').classList.contains('on'),count:document.querySelector('#count').classList.contains('on')}));
      console.log('  reloaded seat 1 (hostNoticed='+markAway+') UI:',JSON.stringify(ui));
      if(ph==='play'&&(!ui.canvas||ui.intro||ui.count)&&(await party.phase())==='play')bad('UI did not recover after reload '+JSON.stringify(ui));
    }
    if(chaos&&el-lastFuzz>3500){lastFuzz=el;const f=await fuzz(party.host,game,150);fuzzN+=150;fuzzErrs.push(...f.errs);if(f.ms>150)bad('fuzz batch slow '+f.ms+'ms');}
    if(shots<2&&el>(shots?18000:6000)){shots++;await party.shot(`test/out/stress-${game}-n${n}-r${r}-${shots}.png`,shots%n);}
    await sleep(100);
    if(Date.now()-t0>200000){bad('round did not finish in 200s');break;}
  }
  await party.waitPhase('result',20000).catch(()=>bad('never reached result'));
  const dur=(Date.now()-t0)/1000;
  const st=await party.state();
  const hs=await party.host.evaluate(g=>({t:H.S.t,over:H.S.over,mr:H.S.mr,tot:H.S._tot,mpts:H.S.mpts,bad:(function chk(o,p){let b=[];if(typeof o==='number'&&!isFinite(o))b.push(p);else if(o&&typeof o==='object')for(const k in o){if(k==='_g'||k==='_cp')continue;b=b.concat(chk(o[k],p+'.'+k));}return b;})(H.S,'S')}),game);
  const v=await violations(party.host);
  const probs=sanePoints(st.res.rows,n);
  console.log(`  done in ${dur.toFixed(1)}s (S.t=${hs.t.toFixed(1)}) rows=${st.res.rows.map(x=>x.pts+':'+x.label).join(' | ')}`);
  if(game==='tron')console.log('  mini-round durations (s):',JSON.stringify(Object.values(minis).map(x=>+x.toFixed(1))),'tot',JSON.stringify(hs.tot));
  if(hs.bad.length)bad('non-finite numbers in host state: '+hs.bad.slice(0,5));
  if(hs.t>=119)bad('hit dur cap');
  if(game==='bomber'&&!hs.over)bad('round ended without S.over');
  if(game==='tron'&&(!hs.over||hs.mr!==3))bad('tron did not finish 3 mini-rounds '+hs.mr);
  probs.forEach(bad);
  if(v.length)bad('invariant violations: '+JSON.stringify(v.slice(0,6)));
  if(fuzzErrs.length)bad('fuzz made host throw: '+JSON.stringify(fuzzErrs));
  if(chaos)console.log(`  fuzzed ${fuzzN} messages, host threw ${fuzzErrs.length} distinct errors`);
  roundStats.push({dur,t:hs.t});
  await party.shot(`test/out/stress-${game}-n${n}-r${r}-result.png`,0);
}
const m=await metrics(party.pages);
console.log('METRICS per page (frame ms / update ms / payload bytes):');m.forEach((x,i)=>x&&console.log('  seat',i,JSON.stringify(x)));
const gm=await party.host.evaluate(()=>({reject:H.S&&H.S._rl?H.S._rl.length:0}));
console.log('page errors:',party.errors);
if(party.errors.length)bad('page errors');
console.log(problems.length?`FAILED (${problems.length} problems)`:'ALL OK',' round durations:',roundStats.map(r=>r.dur.toFixed(0)).join(','));
if(problems.length)process.exitCode=1;
await party.close();
