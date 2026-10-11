// node test/splitsteal-stress.mjs lag|soak|screens
import {launch,sleep,mk} from './sdt-lib.mjs';
const mode=process.argv[2]||'lag';
const T=mk(),ok=T.ok;
const OUT='test/out/ssx-';

const PERSONAS=[
  {steal:.15,ready:[2500,9000],lock:[600,5500],chat:.35},     // Dyl: honest-ish
  {steal:.7,ready:[3000,12000],lock:[500,6500],chat:.5,spam:true},   // Sam: thief + spammer (double taps everything)
  {steal:.4,ready:[2000,8000],lock:[1500,7800],chat:.2,flip:true},   // Jo: indecisive, flips pick, locks late
  {steal:.5,idle:true,ready:[1e9,1e9],lock:[1e9,1e9],chat:0}         // Kai: asleep (never readies / locks)
];
function bot(page,P){return page.evaluate(P=>{
  const press=(sel,i)=>{const els=document.querySelectorAll(sel);const e=els[i===undefined?Math.floor(Math.random()*els.length):i];if(!e)return;
    const mkE=t=>new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:1,isPrimary:true});e.dispatchEvent(mkE('pointerdown'));if(P.spam)e.dispatchEvent(mkE('pointerdown'));
    if(Math.random()<.1){e.dispatchEvent(mkE('pointercancel'));}};
  let rd=-1,stage='',t0=0,rAt=0,lAt=0,picked=false,locked=false,flipAt=0;
  setInterval(()=>{
    try{
    if(R.ph!=='play'||!R.S||!document.querySelector('.ss'))return;const S=R.S,now=Date.now();
    if(S.rd!==rd||S.stage!==stage){rd=S.rd;stage=S.stage;t0=now;rAt=now+P.ready[0]+Math.random()*(P.ready[1]-P.ready[0]);lAt=now+P.lock[0]+Math.random()*(P.lock[1]-P.lock[0]);picked=false;locked=false;flipAt=now+800;}
    if(P.idle&&S.stage==='dec'&&Math.random()<.02)press('.ss-emo button');
    if(S.stage==='neg'){
      if(Math.random()<P.chat*.12)press(Math.random()<.5?'.ss-pre button':'.ss-emo button');
      if(now>rAt)press('.ss-rdy');
    }else if(S.stage==='dec'&&!P.idle){
      if(!picked&&now>t0+300){picked=true;press(Math.random()<P.steal?'.ss-t':'.ss-s');}
      if(P.flip&&picked&&!locked&&now>flipAt){flipAt=now+500;press(Math.random()<P.steal?'.ss-t':'.ss-s');}
      if(now>lAt&&picked){press('.ss-lockb');if(Math.random()<.5)locked=true;}
    }
    }catch(e){console.error('BOT '+e.message);}
  },80);
},P);}

const expected=(ch,pot)=>{const ids=Object.keys(ch),m=ids.length,st=ids.filter(i=>ch[i]==='T'),sp=ids.filter(i=>ch[i]==='S'),e={};ids.forEach(i=>e[i]=0);
  if(!st.length)sp.forEach(i=>e[i]=Math.floor(pot/m));else if(st.length===1)e[st[0]]=pot;else if(sp.length)sp.forEach(i=>e[i]=Math.floor(pot/sp.length));return e;};
const collector=p=>p.evaluate(()=>{window.__log=[];let last=-1;setInterval(()=>{try{const S=H&&H.S;if(S&&H.g==='splitsteal'&&S.pay&&S.rd!==last){last=S.rd;window.__log.push({rd:S.rd,pot:S.pot,ch:S._ch,pay:S.pay,au:S.au});}}catch(e){}},30);});

async function playRounds(party,count,label,opts={}){
  const n=party.n;
  for(let r=0;r<count;r++){
    await party.start();
    await party.waitPhase('play',30000);
    for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.ss'),null,{timeout:15000}).catch(()=>{});
    await party.host.evaluate(()=>{window.__log=[];});
    if(opts.during)opts.during(r);
    const t0=Date.now();
    await party.waitPhase('result',opts.timeout||150000);
    const st=await party.state();
    const log=await party.host.evaluate(()=>window.__log);
    const dt=((Date.now()-t0)/1000).toFixed(0);
    ok(st.res&&st.res.rows.length===n,`${label} round ${r+1}: ended with ${st.res&&st.res.rows.length} ranked rows (${dt}s real)`);
    ok(log.length===3,`${label} round ${r+1}: 3 reveals logged (${log.length})`);
    let allOk=true;for(const l of log){const e=expected(l.ch,l.pot);for(const k in e)if(l.pay[k]!==e[k]){allOk=false;console.log('   payout mismatch',JSON.stringify(l),JSON.stringify(e));}}
    ok(allOk,`${label} round ${r+1}: payouts match rules`);
    const tot=await party.host.evaluate(()=>H.S.tot);
    const paid=log.reduce((a,l)=>a+Object.values(l.pay).reduce((x,y)=>x+y,0),0),sum=Object.values(tot).reduce((a,b)=>a+b,0);
    ok(sum>=paid&&sum<=paid+5*n,`${label} round ${r+1}: totals ${sum} = paid ${paid} + saint bonus`);
    await party.waitPhase('final',30000);
    if(r<count-1){await party.host.click('#again');await party.waitPhase('lobby',10000);await sleep(300);}
  }
}

if(mode==='lag'){
  console.log('== lag/jitter + fuzz + reload + blip, n=4 (Kai asleep, Sam spams, Jo flips)');
  const party=await launch({n:4,only:'splitsteal',lat:[[0,0],[150,100],[200,100],[300,150]]});
  for(let i=0;i<4;i++)await bot(party.pages[i],PERSONAS[i]);
  // (bots must be installed after pages have a game; they poll so install now)
  await collector(party.host);
  await party.start();await party.waitPhase('play',30000);
  for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.ss'));
  await party.host.waitForFunction(()=>H.S.stage==='dec'&&H.S.rd===0,null,{timeout:60000});
  // reload the first player who locks in (while the decide stage is still running)
  let victim=-1;const tw=Date.now();
  while(victim<0&&Date.now()-tw<7000){const d=await party.host.evaluate(()=>({st:H.S.stage,dec:H.S._dec}));if(d.st!=='dec')break;victim=[0,1,2].filter(i=>i>0).find(i=>d.dec[i])??-1;await sleep(100);}
  if(victim>0){
    await party.reload(victim);bot(party.pages[victim],PERSONAS[victim]).catch(()=>{});
    const stillDec=await party.host.evaluate(()=>H.S.stage==='dec');
    await party.pages[victim].waitForFunction(()=>document.querySelector('.ss-lockb.done'),null,{timeout:5000}).then(()=>ok(true,'reloaded locked player sees LOCKED state again (dec still running: '+stillDec+')')).catch(()=>ok(false,'reloaded player did not recover locked UI'));
    const o=await party.overflow(victim);ok(o.length===0,'no overflow after reload '+o.join(' | '));
  }else console.log('   (nobody locked in time; reload skipped)');
  party.fuzz(100000,60).catch(()=>{});   // fuzz for the rest of the round
  await party.blip(1).catch(()=>{});await sleep(3000);
  const ph=await party.phase();ok(ph==='play','still playing after blip/rejoin');
  await party.waitPhase('result',150000);
  const st=await party.state();
  ok(st.res.rows.length===4,'round finished under lag+fuzz, 4 ranked');
  const log=await party.host.evaluate(()=>window.__log);
  ok(log.length===3,'3 reveals happened');
  let allOk=true;for(const l of log){const e=expected(l.ch,l.pot);for(const k in e)if(l.pay[k]!==e[k])allOk=false;}ok(allOk,'payouts match rules under fuzz');
  const sz=await party.maxPayload();ok(sz<5000,'max broadcast payload '+sz+' bytes');
  console.log('   RESULT',JSON.stringify(st.res.rows));
  ok(party.errors.length===0,'no console errors '+JSON.stringify(party.errors.slice(0,5)));
  await party.close();
}else if(mode==='soak'){
  for(const n of [3,4]){
    console.log('== soak n='+n+' (warp x4, random bots, 3 consecutive rounds, fuzz on)');
    const party=await launch({n,only:'splitsteal',warp:4});
    for(let i=0;i<n;i++){const P=Object.assign({},PERSONAS[i]);P.steal=Math.random();if(i===3)P.idle=Math.random()<.5;if(i!==3)P.idle=false;await bot(party.pages[i],P);}
    await collector(party.host);
    party.fuzz(60000,30).catch(()=>{});
    await playRounds(party,3,'n'+n,{timeout:90000});
    const sz=await party.maxPayload();ok(sz<5000,'max payload '+sz+' bytes');
    ok(party.errors.length===0,'no console errors '+JSON.stringify(party.errors.slice(0,5)));
    await party.close();
  }
}else if(mode==='screens'){
  for(const [w,h] of [[320,568],[430,932]]){
    console.log(`== screens ${w}x${h} n=4`);
    const party=await launch({n:4,only:'splitsteal',viewport:{width:w,height:h},warp:1});
    for(let i=0;i<4;i++)await bot(party.pages[i],Object.assign({},PERSONAS[i],{idle:false,ready:[3000,5000],lock:[800,4000]}));
    await party.start();await party.waitPhase('play',30000);
    for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.ss'));
    const seen={};
    const t0=Date.now();
    while(Date.now()-t0<110000){
      const s=await party.host.evaluate(()=>H&&H.S?{st:H.S.stage,rd:H.S.rd,pay:!!H.S.pay,rv:H.S.revN,ph:R.ph}:null);if(!s||s.ph!=='play')break;
      const key=s.st+s.rd+(s.pay?'p':'')+(s.rv>=2?'r':'');
      if(!seen[key]&&(s.rd===0||s.st==='bonus'||s.rd===2)){
        seen[key]=1;await sleep(s.st==='neg'?9000:(s.st==='rev'?3200:600));
        for(const i of [0,3]){const o=await party.overflow(i);ok(o.length===0,`${w}px ${key} p${i} no overflow ${o.join(' | ')}`);}
        await party.shot(`${OUT}${w}-${key}.png`,0);
      }
      await sleep(250);
    }
    ok(party.errors.length===0,'no console errors');
    await party.close();
  }
}
console.log(T.fail?'FAILED '+T.fail:'ALL PASS');
process.exit(T.fail?1:0);
