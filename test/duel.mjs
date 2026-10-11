import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3;
const party=await launchParty({n,only:'duel',rounds:5});
const OUT='test/out/duel-'+n+'-';
let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok:',m);};
await party.start();
await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dl-fire'));
// in-page bots: hold in 'set', release `react` ms after solid green; optional early releases / decoys / fall for fakes.
const cfgs=[
  {react:160,slow:[0],fall:[2]},                      // Dyl: fast, but deliberately slow in duel 0 (lets us screenshot GO on his phone)
  {react:230,decoy:[0,2]},                    // Sam: decoys in duels 0 and 2
  {react:300,early:[1],fall:[0]},             // Jo: false-starts in duel 1, falls for the decoy in duel 0
  {react:260,fall:[2]}                        // Kai: falls for the decoy in duel 2
];
if(n===2)cfgs[0].early=[1];
for(let i=0;i<n;i++)await party.pages[i].evaluate(cfg=>{
  const fire=document.querySelector('.dl-fire'),dec=document.querySelector('.dl-dec');
  const ev=(el,t)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:1,isPrimary:true}));
  let d=-1,holding=false,reacted=false,earlyDone=false,decoyDone=false,fellDone=false,wStart=0;
  setInterval(()=>{
    const S=R.S;if(!S||R.ph!=='play')return;
    const root=document.querySelector('.dl');
    if(S.d!==d){d=S.d;holding=false;reacted=false;earlyDone=false;decoyDone=false;fellDone=false;wStart=0;}
    if(S.mode==='set'&&!holding){ev(fire,'pointerdown');holding=true;}
    if(S.mode==='wait'){
      if(!wStart)wStart=performance.now();
      if(cfg.early&&cfg.early.includes(d)&&holding&&!earlyDone&&performance.now()-wStart>700){earlyDone=true;holding=false;ev(fire,'pointerup');}
      if(cfg.decoy&&cfg.decoy.includes(d)&&!decoyDone&&performance.now()-wStart>600&&!dec.disabled){decoyDone=true;ev(dec,'pointerdown');}
      if(cfg.fall&&cfg.fall.includes(d)&&holding&&!fellDone&&root.classList.contains('fake')){fellDone=true;setTimeout(()=>{if(holding){holding=false;ev(fire,'pointerup');}},150);}
    }
    if(root.classList.contains('go')&&holding&&!reacted){reacted=true;const r=(cfg.slow&&cfg.slow.includes(d))?1100:cfg.react;setTimeout(()=>{if(holding){holding=false;ev(fire,'pointerup');}},r);}
  },10);
},cfgs[i]);
const hs=()=>party.host.evaluate(()=>({d:H.S.d,mode:H.S.mode,pts:H.S.pts,dc:H.S.dc,lock:H.S.lock,hist:H.S.hist,over:H.S.over,t:H.S.t,rs:H.S.rs}));
const shots={};let closed=false,maxLen=0;
const t0=Date.now();
while(Date.now()-t0<100000){
  const ph=await party.phase();if(ph!=='play')break;
  const s=await hs();
  if(!shots.set&&s.mode==='set'){shots.set=1;await party.shot(OUT+'hold-wait.png',1);}
  if(!shots.wait&&s.mode==='wait'&&s.d===0){shots.wait=1;await sleep(300);await party.shot(OUT+'wait.png',1);}
  if(!shots.fake){const cl=await party.pages[n>2?2:1].evaluate(()=>document.querySelector('.dl').className);if(cl.includes('fake')){shots.fake=1;await party.shot(OUT+'fake.png',n>2?2:1);}}
  if(!shots.go&&s.mode==='go'&&s.d===0){shots.go=1;await sleep(120);await party.shot(OUT+'go.png',0);}
  if(!shots.res&&s.mode==='res'&&s.d===1){shots.res=1;await sleep(500);await party.shot(OUT+'result-duel.png',0);await party.shot(OUT+'result-duel-p1.png',1);}
  if(!shots.fs&&s.mode==='wait'&&s.d===1&&Object.values(s.lock).some(v=>v==='early')){shots.fs=1;await sleep(100);await party.shot(OUT+'false-start.png',n>2?2:1);}
  if(!closed&&n>=3&&s.d===3&&s.mode==='wait'){closed=true;await party.pages[n-1].evaluate(()=>{hostConn.close();});await party.pages[n-1].close();await sleep(300);const st=await party.state();ok(st.pl.some(p=>p.aw),'player marked away after closing page mid-duel');}
  await sleep(60);
}
await party.waitPhase('result',40000);
const f=await hs();
console.log('hist',JSON.stringify(f.hist));console.log('pts',JSON.stringify(f.pts),'decoys left',JSON.stringify(f.dc),'t',f.t.toFixed(1));
// recompute points from the public history
const calc={};Object.keys(f.pts).forEach(k=>calc[k]=0);
for(const h of f.hist){if(h.w!==null)calc[h.w]+=2;for(const id in h.lock)if(['early','fake','jump'].includes(h.lock[id]))calc[id]-=1;
  const ms=Object.entries(h.ms);if(ms.length){const best=Math.min(...ms.map(x=>x[1]));ok(h.ms[h.w]===best,'duel winner has fastest reaction '+JSON.stringify(h.ms));ok(ms.every(x=>x[1]>=80),'no reaction < 80 ms counted');}}
ok(JSON.stringify(calc)===JSON.stringify(f.pts),'points match history '+JSON.stringify(calc));
ok(f.hist.length>=4,'played '+f.hist.length+' duels');
ok(f.hist.some(h=>Object.values(h.lock).includes('fake')),'a decoy victim was penalised');
ok(f.hist.some(h=>Object.values(h.lock).includes('early')),'a false start was penalised');
ok(f.t<=75,'finished within dur ('+f.t.toFixed(1)+'s)');
if(n>=2)ok(f.dc[1]===0,'decoy charges spent by Sam (left '+f.dc[1]+')');
await party.shot(OUT+'result.png',0);
const st=await party.state();console.log('RESULT',JSON.stringify(st.res.rows));
ok(st.res.rows.length===n,'ranking row per player');
await party.waitPhase('final',30000);
console.log('errors:',party.errors);ok(party.errors.length===0,'no console errors');
await party.close();
console.log(fail?('FAILED '+fail):'PASS n='+n);
process.exit(fail?1:0);
