// node test/duel-stress.mjs lag|fair|soak|screens
import {launch,sleep,mk} from './sdt-lib.mjs';
const mode=process.argv[2]||'lag';
const T=mk(),ok=T.ok;
const OUT='test/out/dlx-';

// persona: react [min,max] ms after solid green; early/fall/cancel/decoy = probability per duel; idle = never holds; spam = fiddles with the button; two = second finger taps
const PERSONAS=[
  {react:[170,260],early:.08,fall:.5,cancel:.04,decoy:.5,idle:0,spam:.3,two:.3},
  {react:[190,330],early:.1,fall:.6,cancel:.05,decoy:.6,idle:0,spam:.5,two:.2},
  {react:[160,300],early:.15,fall:.4,cancel:.08,decoy:.3,idle:0,spam:.2,two:.4},
  {react:[200,400],early:.05,fall:.7,cancel:.02,decoy:.4,idle:.25,spam:0,two:0}
];
function bot(page,P){return page.evaluate(P=>{
  if(window.__botOn)return;window.__botOn=1;
  const ev=(el,t,id=1)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:id,isPrimary:id===1}));
  const rr=a=>a[0]+Math.random()*(a[1]-a[0]);
  let d=-1,holding=false,reacted=false,st={};
  setInterval(()=>{try{
    const S=R.S;if(R.ph!=='play'||!S||!document.querySelector('.dl'))return;const now=Date.now(),root=document.querySelector('.dl'),fire=document.querySelector('.dl-fire'),dec=document.querySelector('.dl-dec');
    if(S.d!==d){d=S.d;holding=false;reacted=false;st={idle:Math.random()<P.idle,early:Math.random()<P.early,fall:Math.random()<P.fall,cancel:Math.random()<P.cancel,decoy:Math.random()<P.decoy,holdAt:now+rr([100,900]),w0:0,earlyAt:0,decoyAt:0,cancelAt:0,twoAt:0};}
    if(S.mode==='set'&&!holding&&!st.idle&&now>st.holdAt){
      if(Math.random()<P.spam){ev(fire,'pointerdown');ev(fire,'pointerup');}      // fiddling
      ev(fire,'pointerdown');holding=true;}
    if(S.mode==='wait'){
      if(!st.w0){st.w0=now;st.earlyAt=now+rr([300,1500]);st.decoyAt=now+rr([300,1200]);st.cancelAt=now+rr([300,1500]);st.twoAt=now+rr([300,1000]);}
      if(holding&&Math.random()<P.two*.02&&now>st.twoAt&&!st.twoDone){st.twoDone=true;ev(fire,'pointerdown',2);setTimeout(()=>ev(fire,'pointerup',2),60);}   // 2nd finger must not count as release
      if(holding&&st.early&&now>st.earlyAt){st.early=false;holding=false;ev(fire,'pointerup');}
      if(holding&&st.cancel&&now>st.cancelAt){st.cancel=false;holding=false;ev(fire,'pointercancel');}
      if(st.decoy&&now>st.decoyAt&&!dec.disabled){st.decoy=false;ev(dec,'pointerdown');if(Math.random()<.3)ev(dec,'pointerdown');}
      if(holding&&st.fall&&root.classList.contains('fake')){st.fall=false;setTimeout(()=>{if(holding){holding=false;ev(fire,'pointerup');}},rr([80,350]));}
    }
    if(root.classList.contains('go')&&holding&&!reacted){reacted=true;setTimeout(()=>{if(holding){holding=false;ev(fire,'pointerup');if(Math.random()<.3)ev(fire,'pointerup');}},rr(P.react));}
  }catch(e){console.error('BOT '+e.message);}},10);
},P);}
const monitor=p=>p.evaluate(()=>{window.__v=[];let last=-1;setInterval(()=>{try{
  const S=H&&H.S;if(!S||H.g!=='duel')return;
  for(const id in S.pts)if(!Number.isInteger(S.pts[id]))window.__v.push('pts nan '+id);
  for(const id in S.dc)if(S.dc[id]<0||S.dc[id]>2)window.__v.push('dc '+id+'='+S.dc[id]);
  if(S.hist.length>5)window.__v.push('hist>5');
  for(const h of S.hist)for(const id in h.ms)if(h.ms[id]<80)window.__v.push('ms<80');
}catch(e){}},30);});

async function finish(party,label,timeout=100000){
  await party.waitPhase('result',timeout);
  const st=await party.state();
  const f=await party.host.evaluate(()=>({pts:H.S.pts,dc:H.S.dc,hist:H.S.hist,t:H.S.t,v:window.__v}));
  const calc={};Object.keys(f.pts).forEach(k=>calc[k]=0);
  for(const h of f.hist){if(h.w!==null)calc[h.w]+=2;for(const id in h.lock)if(['early','fake','jump'].includes(h.lock[id]))calc[id]-=1;
    const e=Object.entries(h.ms);if(e.length&&h.w!==null){const best=Math.min(...e.map(x=>x[1]));if(h.ms[h.w]!==best)ok(false,label+': winner not fastest '+JSON.stringify(h));}}
  ok(JSON.stringify(calc)===JSON.stringify(f.pts),label+': points '+JSON.stringify(f.pts)+' match history');
  ok(f.hist.length>=4&&f.hist.length<=5,label+': '+f.hist.length+' duels played, t='+f.t.toFixed(1)+'s');
  ok(f.t<=75.5,label+': within dur');
  ok(f.v.length===0,label+': invariants held '+JSON.stringify([...new Set(f.v)].slice(0,4)));
  ok(st.res.rows.length===party.n,label+': ranking complete');
  return f;
}

if(mode==='lag'){
  console.log('== lag + chaos (spam, two-finger, cancel, idle, decoy storms) + fuzz + reload + blip, n=4');
  const party=await launch({n:4,only:'duel',lat:[[0,0],[150,100],[200,100],[300,150]]});
  for(let i=0;i<4;i++)await party.pages[i].waitForFunction(()=>document.querySelector('.dl-fire')||true);
  await party.start();await party.waitPhase('play',30000);
  for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dl-fire'));
  for(let i=0;i<4;i++)await bot(party.pages[i],PERSONAS[i]);
  await monitor(party.host);
  await sleep(6000);
  // reload someone while the host thinks they are holding; engine must not hang waiting for them
  await party.host.waitForFunction(()=>H.S.mode==='wait',null,{timeout:30000});
  await party.reload(1);await bot(party.pages[1],PERSONAS[1]);
  const t1=Date.now();let lk=null;
  while(Date.now()-t1<6000){lk=await party.host.evaluate(()=>({m:H.S.mode,l:H.S.lock[1],d:H.S.d}));if(lk.l==='nohold'||lk.m==='res')break;await sleep(100);}
  ok(lk&&(lk.l==='nohold'||lk.m==='res'),'reloaded holder is released by the host (lock='+(lk&&lk.l)+', mode='+(lk&&lk.m)+')');
  party.fuzz(60000,50).catch(()=>{});
  await sleep(4000);await party.blip(2).catch(()=>{});
  await finish(party,'lag');
  const sz=await party.maxPayload();ok(sz<4000,'max payload '+sz+' bytes');
  ok(party.errors.length===0,'no console errors '+JSON.stringify(party.errors.slice(0,5)));
  await party.close();
}else if(mode==='fair'){
  // The laggiest player has the FASTEST true reflexes: with lag compensation they must still win the duels (and every reaction must be counted).
  console.log('== fairness under lag: P2 has 300-450ms RTT but the best reflexes');
  const party=await launch({n:3,only:'duel',lat:[[0,0],[120,60],[300,150]]});
  await party.start();await party.waitPhase('play',30000);
  for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dl-fire'));
  const clean={early:0,fall:0,cancel:0,decoy:0,idle:0,spam:0,two:0};
  await bot(party.pages[0],Object.assign({},clean,{react:[250,290]}));
  await bot(party.pages[1],Object.assign({},clean,{react:[230,260]}));
  await bot(party.pages[2],Object.assign({},clean,{react:[150,190]}));
  await monitor(party.host);
  const f=await finish(party,'fair');
  console.log('   hist',JSON.stringify(f.hist.map(h=>({w:h.w,ms:h.ms}))));
  const wins2=f.hist.filter(h=>h.w===2).length;
  ok(wins2===f.hist.length,'laggy-but-fast player won '+wins2+'/'+f.hist.length+' duels');
  ok(f.hist.every(h=>Object.keys(h.ms).length===3),'every duel counted all 3 reactions (nobody dropped by the collect window)');
  ok(party.errors.length===0,'no console errors');
  await party.close();
}else if(mode==='soak'){
  for(const n of [3,4,2]){
    console.log('== soak n='+n+' (3 consecutive rounds, random chaos bots, fuzz on)');
    const party=await launch({n,only:'duel'});
    for(let i=0;i<n;i++)await bot(party.pages[i],PERSONAS[i]);
    await monitor(party.host);party.fuzz(110000,25).catch(()=>{});
    for(let r=0;r<3;r++){
      await party.start();await party.waitPhase('play',30000);
      for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dl-fire'),null,{timeout:15000}).catch(()=>{});
         await party.host.evaluate(()=>{window.__v=[];});
      await finish(party,`n${n} r${r+1}`,90000);
      await party.waitPhase('final',30000);
      if(r<2){await party.host.click('#again');await party.waitPhase('lobby',10000);await sleep(300);}
    }
    ok(party.errors.length===0,'no console errors '+JSON.stringify(party.errors.slice(0,5)));
    await party.close();
  }
}else if(mode==='screens'){
  for(const [w,h] of [[320,568],[430,932]]){
    console.log(`== screens ${w}x${h} n=4`);
    const party=await launch({n:4,only:'duel',viewport:{width:w,height:h}});
    await party.start();await party.waitPhase('play',30000);
    for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dl-fire'));
    for(let i=0;i<4;i++)await bot(party.pages[i],Object.assign({},PERSONAS[i],{idle:0,early:i===2?1:0,fall:i===3?1:0,decoy:i===1?1:0,cancel:0,react:[400,600]}));
    const seen={};const t0=Date.now();
    while(Date.now()-t0<80000){
      const s=await party.host.evaluate(()=>H&&H.S?{m:H.S.mode,d:H.S.d,fk:H.S.fk,t:H.S.t,ph:R.ph}:null);if(!s||s.ph!=='play')break;
      const fake=await party.pages[0].evaluate(()=>document.querySelector('.dl').className);
      const key=fake.includes('fake')?'fake':fake.includes('fs')?'fs':s.m;
      if(!seen[key]&&s.d<=2){seen[key]=1;await sleep(80);
        for(const i of [0,2]){const o=await party.overflow(i);ok(o.length===0,`${w}px ${key} p${i} no overflow ${o.join(' | ')}`);}
        await party.shot(`${OUT}${w}-${key}-p0.png`,0);await party.shot(`${OUT}${w}-${key}-p2.png`,2);}
      await sleep(40);
    }
    console.log('   states seen:',Object.keys(seen).join(','));
    ok(party.errors.length===0,'no console errors');
    await party.close();
  }
}
console.log(T.fail?'FAILED '+T.fail:'ALL PASS');
process.exit(T.fail?1:0);
