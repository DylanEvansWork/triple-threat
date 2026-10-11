// node test/simon-stress.mjs lag|soak|screens
import {launch,sleep,mk} from './sdt-lib.mjs';
const mode=process.argv[2]||'lag';
const T=mk(),ok=T.ok;
const OUT='test/out/smx-';

const PERSONAS=[
  {skill:.985,tap:[110,260],think:[300,1500],idle:0,spam:0},        // careful
  {skill:.9,tap:[200,520],think:[400,2500],idle:0,spam:.4,two:.1},  // sloppy, double-taps, sometimes two fingers
  {skill:.95,tap:[150,350],think:[300,2000],idle:.25,spam:.1},      // falls asleep 25% of its turns
  {skill:.97,tap:[120,300],think:[300,1800],idle:.1,spam:.2}
];
function bot(page,P){return page.evaluate(P=>{
  const mkE=t=>new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:1,isPrimary:true});
  const tap=i=>{const e=document.querySelectorAll('.sm-pad')[i];if(!e)return;e.dispatchEvent(mkE('pointerdown'));if(Math.random()<P.spam)e.dispatchEvent(mkE('pointerdown'));if(Math.random()<.15)e.dispatchEvent(mkE('pointercancel'));};
  const rr=a=>a[0]+Math.random()*(a[1]-a[0]);
  let turn=-1,mode='',next=0,asleep=false,addAt=0,added=false;
  setInterval(()=>{try{
    if(R.ph!=='play'||!R.S||!document.querySelector('.sm-pad'))return;const S=R.S,now=Date.now(),me=myPid;
    if(S.cur!==me||S.over)return;
    if(S.turn!==turn||S.mode!==mode){if(S.turn!==turn){asleep=Math.random()<P.idle;added=false;}turn=S.turn;mode=S.mode;next=now+rr(P.tap)*2.2/P.K;addAt=now+rr(P.think)/P.K;}
    if(asleep)return;
    if(S.mode==='input'&&now>=next){
      next=now+rr(P.tap)/P.K;let pad=S.seq[S.idx];if(Math.random()>P.skill)pad=(pad+1+Math.floor(Math.random()*3))%4;
      tap(pad);if(Math.random()<(P.two||0)){tap((pad+1)%4);}
    }else if(S.mode==='add'&&now>=addAt){
      addAt=now+rr(P.think)/P.K;const last=S.seq[S.seq.length-1];
      const k=Math.random()<.5&&last!==undefined?last:Math.floor(Math.random()*4);tap(k);if(P.spam&&Math.random()<.5){tap((k+1)%4);tap((k+2)%4);}
    }
  }catch(e){console.error('BOT '+e.message);}},30);
},P);}
const monitor=p=>p.evaluate(()=>{window.__v=[];window.__turns=[];let lt=-1,ll=0,lastLives=null;setInterval(()=>{try{
  const S=H&&H.S;if(!S||H.g!=='simon')return;const v=window.__v;
  for(const id in S.lives){if(!Number.isInteger(S.lives[id])||S.lives[id]<0||S.lives[id]>2)v.push('lives '+id+'='+S.lives[id]);if(lastLives&&S.lives[id]>lastLives[id])v.push('life gained '+id);}
  lastLives=Object.assign({},S.lives);
  if(S.seq.some(x=>!Number.isInteger(x)||x<0||x>3))v.push('bad seq');if(S.seq.length>S.cap)v.push('seq>cap');
  if(S.mode==='input'&&S.idx>S.seq.length)v.push('idx>len');
  if(new Set(S.out).size!==S.out.length)v.push('dup out');
  if(S.turn!==lt){window.__turns.push(S.seq.length-ll);ll=S.seq.length;lt=S.turn;}
}catch(e){}},25);});

async function finish(party,label,timeout=150000){
  await party.waitPhase('result',timeout);
  const st=await party.state();
  const f=await party.host.evaluate(()=>({seq:H.S.seq.length,lives:H.S.lives,out:H.S.out,turn:H.S.turn,t:H.S.t,win:H.S.win,v:window.__v,turns:window.__turns}));
  console.log('   ',label,'final',JSON.stringify({seq:f.seq,lives:f.lives,out:f.out,turn:f.turn,t:+f.t.toFixed(1),win:f.win}));
  ok(st.res.rows.length===party.n,label+': ranking complete '+JSON.stringify(st.res.rows.map(r=>r.rank)));
  ok(f.v.length===0,label+': invariants held '+JSON.stringify([...new Set(f.v)].slice(0,4)));
  ok(f.turns.every(d=>d===0||d===1),label+': chain grew by at most 1 per turn (deltas '+JSON.stringify([...new Set(f.turns)])+')');
  ok(f.t<=121.5,label+': within time cap ('+f.t.toFixed(1)+')');
  const ranks=st.res.rows;
  const lv=id=>f.lives[id];
  for(const a of ranks)for(const b of ranks){if(lv(a.id)>lv(b.id)&&!(st.pl.find(p=>p.id===a.id)||{}).aw)ok(a.rank<=b.rank,label+': more lives never ranks lower');}
  return {st,f};
}

if(mode==='lag'){
  console.log('== lag/jitter + fuzz + reload + blip + sloppy/idle/spam bots, n=3');
  const party=await launch({n:3,only:'simon',lat:[[0,0],[200,100],[300,150]]});
  for(let i=0;i<3;i++)await bot(party.pages[i],Object.assign({K:1},PERSONAS[i]));
  await monitor(party.host);
  await party.start();await party.waitPhase('play',30000);
  for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.sm-pad'));
  await sleep(15000);
  // reload whoever is mid-input (UI must rebuild from public state and keep playing)
  const who=await party.host.evaluate(()=>({cur:H.S.cur,mode:H.S.mode}));
  const rl=who.cur===0?1:who.cur;
  await party.reload(rl);bot(party.pages[rl],Object.assign({K:1},PERSONAS[rl])).catch(()=>{});
  await party.pages[rl].waitForFunction(()=>document.querySelectorAll('.sm-c').length===3&&document.querySelector('.sm-big').textContent.length>0,null,{timeout:5000}).then(()=>ok(true,'reloaded player UI rebuilt (chips+banner)')).catch(()=>ok(false,'reloaded UI broken'));
  const o=await party.overflow(rl);ok(o.length===0,'no overflow after reload '+o.join(' | '));
  party.fuzz(90000,50).catch(()=>{});
  await sleep(5000);await party.blip(2).catch(()=>{});
  const {st}=await finish(party,'lag');
  const sz=await party.maxPayload();ok(sz<4000,'max payload '+sz+' bytes');
  ok(party.errors.length===0,'no console errors '+JSON.stringify(party.errors.slice(0,5)));
  await party.close();
}else if(mode==='soak'){
  for(const n of [3,4,2]){
    console.log('== soak n='+n+' (warp x4, 3 consecutive rounds, fuzz on)');
    const K=4;
    const party=await launch({n,only:'simon',warp:K});
    for(let i=0;i<n;i++)await bot(party.pages[i],Object.assign({K},PERSONAS[i]));
    await monitor(party.host);party.fuzz(70000,25).catch(()=>{});
    for(let r=0;r<3;r++){
      await party.start();await party.waitPhase('play',30000);
      for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.sm-pad'),null,{timeout:15000}).catch(()=>{});
      await party.host.evaluate(()=>{window.__v=[];window.__turns=[];});
      await finish(party,`n${n} r${r+1}`,60000);
      await party.waitPhase('final',30000);
      if(r<2){await party.host.click('#again');await party.waitPhase('lobby',10000);await sleep(300);}
    }
    ok(party.errors.length===0,'no console errors '+JSON.stringify(party.errors.slice(0,5)));
    await party.close();
  }
}else if(mode==='screens'){
  for(const [w,h] of [[320,568],[430,932]]){
    console.log(`== screens ${w}x${h} n=4`);
    const party=await launch({n:4,only:'simon',viewport:{width:w,height:h}});
    for(let i=0;i<4;i++)await bot(party.pages[i],Object.assign({K:1},PERSONAS[i],{idle:0,skill:i===1?.8:1}));
    await party.start();await party.waitPhase('play',30000);
    for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.sm-pad'));
    const seen={};const t0=Date.now();
    while(Date.now()-t0<100000){
      const s=await party.host.evaluate(()=>H&&H.S?{m:H.S.mode,L:H.S.seq.length,cur:H.S.cur,fb:H.S.fb&&H.S.fb.k,ph:R.ph,over:H.S.over}:null);if(!s||s.ph!=='play')break;
      const key=s.m+(s.fb||'')+(s.L>=5?'L':'s');
      if(!seen[key]&&s.L>=1&&Object.keys(seen).length<8){seen[key]=1;await sleep(150);
        for(const i of [0,1]){const o=await party.overflow(i);ok(o.length===0,`${w}px ${key} p${i} no overflow ${o.join(' | ')}`);}
        await party.shot(`${OUT}${w}-${key}-spect.png`,(s.cur+1)%4);await party.shot(`${OUT}${w}-${key}-cur.png`,s.cur);}
      await sleep(120);
    }
    ok(party.errors.length===0,'no console errors');
    await party.close();
  }
}
console.log(T.fail?'FAILED '+T.fail:'ALL PASS');
process.exit(T.fail?1:0);
