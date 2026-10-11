import {launchParty,sleep} from './harness.mjs';
const n=Math.max(3,+process.argv[2]||3);   // game needs 3-4 players
const party=await launchParty({n,only:'splitsteal',rounds:5});
const OUT='test/out/splitsteal-'+n+'-';
let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok:',m);};
await party.start();
await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.ss'));
const hs=()=>party.host.evaluate(()=>({st:H.S.stage,rd:H.S.rd,t:H.S.t,sa:H.S.sa,part:H.S.part,ch:H.S._ch,pay:H.S.pay,tot:H.S.tot,bet:H.S.bet,over:H.S.over,revN:H.S.revN}));
const waitStage=async(st,rd,to=40000)=>{const t0=Date.now();for(;;){const s=await hs();if(s.rd===rd&&s.st===st)return s;if(s.over&&st==='rev')return s;if(Date.now()-t0>to)throw new Error('timeout waiting '+st+rd+' got '+JSON.stringify(s));await sleep(100);}};
const press=(p,sel,idx=0)=>p.evaluate(([sel,idx])=>{const els=document.querySelectorAll(sel);const e=els[idx%Math.max(1,els.length)];if(!e)return false;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return true;},[sel,idx]);
const expected=(ch,pot)=>{const ids=Object.keys(ch).map(Number),m=ids.length,st=ids.filter(i=>ch[i]==='T'),sp=ids.filter(i=>ch[i]==='S'),e={};ids.forEach(i=>e[i]=0);
  if(!st.length)sp.forEach(i=>e[i]=Math.floor(pot/m));else if(st.length===1)e[st[0]]=pot;else if(sp.length)sp.forEach(i=>e[i]=Math.floor(pot/sp.length));return e;};
const POTS=[12,12,24];
let alive=party.pages.slice();
for(let rd=0;rd<3;rd++){
  await waitStage('neg',rd);
  // chat spam by bots (real buttons)
  for(let k=0;k<4;k++){for(let i=0;i<alive.length;i++){await press(alive[i],k%2?'.ss-emo button':'.ss-pre button',k+i);}await sleep(600);}
  if(rd===0){await party.shot(OUT+'neg-r1.png',1);await party.shot(OUT+'neg-host.png',0);}
  if(rd===1&&n>=3){ // mid-round disconnect
    await party.pages[n-1].evaluate(()=>{hostConn.close();});await party.pages[n-1].close();alive=alive.filter(p=>!p.isClosed());await sleep(500);
    const st=await party.state();ok(st.pl.some(p=>p.aw),'player marked away after closing page');
  }
  // fast-forward negotiation a bit on later rounds to keep run short
  if(rd>=1)await party.host.evaluate(()=>{H.S.sa-=18;});
  await waitStage('dec',rd);
  await sleep(500);
  if(rd===0){await party.shot(OUT+'dec-pre.png',1);}
  // bots decide: page0 splits, page1 steals, page2 random, page3 steals
  for(let i=0;i<alive.length;i++){
    const idx=party.pages.indexOf(alive[i]);
    const choice=idx===0?'.ss-ch .ss-s':idx===1?'.ss-ch .ss-t':idx===2?(Math.random()<.5?'.ss-ch .ss-s':'.ss-ch .ss-t'):'.ss-ch .ss-t';
    await press(alive[i],choice);
    if(!(rd===2&&idx===1))await press(alive[i],'.ss-lockb'); // round 3: Sam never locks -> tests timeout default
    if(rd===0&&i===0)await party.shot(OUT+'dec-locked.png',0);
    await sleep(150);
  }
  if(rd===0)await party.shot(OUT+'dec-mid.png',1);
  const rv=await waitStage('rev',rd);
  const info=await party.host.evaluate(()=>({ch:H.S._ch,pot:H.S.pot,au:H.S.au}));
  await sleep(2200);if(rd===0)await party.shot(OUT+'reveal-mid.png',1);
  // leak check: client state must not hold private keys
  const keys=await party.pages[1].evaluate(()=>Object.keys(R.S));
  ok(!keys.some(k=>k[0]==='_'),'no private keys on client S ('+keys.filter(k=>k[0]==='_')+')');
  const t0=Date.now();let s;
  for(;;){s=await hs();if(s.pay||s.over)break;if(Date.now()-t0>15000)throw new Error('no payout');await sleep(100);}
  await sleep(300);if(rd===0||rd===2)await party.shot(OUT+'payout-r'+(rd+1)+'.png',0);
  s=await hs();
  const exp=expected(info.ch,info.pot);
  ok(JSON.stringify(Object.keys(exp).map(k=>exp[k]))===JSON.stringify(Object.keys(exp).map(k=>s.pay[k])),'round '+(rd+1)+' payouts '+JSON.stringify(s.pay)+' match rule for choices '+JSON.stringify(info.ch));
  if(rd===2){ok(info.au[1]===true,'unlocked player auto-defaulted ('+JSON.stringify(info.au)+')');}
}
await party.waitPhase('result',30000);
await party.shot(OUT+'result.png',0);
const st=await party.state();
console.log('RESULT',JSON.stringify(st.res.rows));
const fin=await hs();
console.log('totals',JSON.stringify(fin.tot),'betrayals',JSON.stringify(fin.bet));
ok(st.res.rows.length===n,'ranking has a row per player');
const sum=Object.values(fin.tot).reduce((a,b)=>a+b,0);ok(sum<=12+12+24+5*n,'coins conserved (<= pots + saint bonus) total='+sum);
await party.waitPhase('final',30000);
console.log('errors:',party.errors);
ok(party.errors.length===0,'no console errors');
await party.close();
console.log(fail?('FAILED '+fail):'PASS n='+n);
process.exit(fail?1:0);
