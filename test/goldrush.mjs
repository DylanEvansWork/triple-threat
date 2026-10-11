// node test/goldrush.mjs <n=3> [drop]  — bots with different risk appetites play a full Gold Rush round through the UI.
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, drop=process.argv[3]==='drop';
const party=await launchParty({n,only:'goldrush',rounds:5,autoready:false});
const T0=Date.now();
await party.start();
await party.waitPhase('intro');
await sleep(400);await party.shot(`test/out/goldrush-intro-${n}.png`,1);
for(const p of party.pages)await p.click('#iready');
await party.waitPhase('play',30000);
const strats=['greedy','careful','random','idle'];
const bot=(strat)=>{
  if(!R||R.ph!=='play'||!R.S||R.S.ph!=='pick'||R.S.over)return 'x';
  const S=R.S,me=myPid;if(!S.inside[me])return 'out';
  if(S.locked[me]&&strat!=='random')return 'locked';
  const key='s'+S.pickAt;if(window.__k!==key){window.__k=key;window.__thr=0.3+Math.random()*(strat==='idle'?9:1.6);}
  if(S.t-S.pickAt<window.__thr)return 'wait';
  if(strat==='idle')return 'idle';
  const click=sel=>{const e=document.querySelector(sel);if(e)e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));};
  const pk=S.pocket[me],risk=S.dg/Math.max(1,S.dn);let leave=false;
  if(strat==='greedy')leave=pk>=22||risk>.2;
  else if(strat==='careful')leave=pk>=6||S.dg>0;
  else leave=Math.random()<.3;
  if(strat==='random'&&S.locked[me])return 'locked';
  click(leave?'.gr-b.leave':'.gr-b.stay');return leave?'leave':'stay';
};
const shots={};let dropped=false,lastEx=0,steps=0,collapses=0,lastStep=0;
while(true){
  if((await party.phase())!=='play')break;
  if(Date.now()-T0>170000){console.log('TIMEOUT');break;}
  for(let i=0;i<party.pages.length;i++){if(party.pages[i].isClosed())continue;try{await party.pages[i].evaluate(bot,strats[i%4]);}catch(e){}}
  let S=null;try{S=await party.pages[0].evaluate(()=>R&&R.S?{ph:R.S.ph,ex:R.S.ex,t:R.S.t,rvAt:R.S.rvAt,over:R.S.over,pl:R.S.path.length,id:R.S.rv&&R.S.rv.id,kind:R.S.rv&&R.S.rv.flip&&R.S.rv.flip.kind,lv:R.S.rv?R.S.rv.leavers.length:0,tu:R.S.tu}:null);}catch(e){}
  if(S){
    if(S.id!==lastStep){if(process.env.V)console.log(JSON.stringify(await party.pages[0].evaluate(()=>{const r=R.S.rv;return{ex:r.ex,ch:r.ch,lv:r.leavers.map(l=>l.id+':'+l.total),flip:r.flip&&(r.flip.kind+':'+(r.flip.card.v||r.flip.card.h)),pile:R.S.pile,pocket:R.S.pocket,bank:R.S.bank,dg:R.S.dg,dn:R.S.dn,t:R.S.t.toFixed(1)}})));lastStep=S.id;steps++;if(S.kind==='collapse')collapses++;}
    lastEx=S.ex;
    if(drop&&!dropped&&S.ex>=2&&n>=3){dropped=true;console.log('dropping page 2 in ex',S.ex);await party.pages[2].evaluate(()=>{hostConn&&hostConn.close();});await party.pages[2].close();}
    if(S.ph==='pick'&&S.pl>=3&&S.t-0>0&&!shots.pick){shots.pick=1;await sleep(300);await party.shot(`test/out/goldrush-pick-${n}.png`,1);}
    if(S.ph==='reveal'&&S.lv>0&&!shots.leave&&S.t-S.rvAt>.9&&S.t-S.rvAt<1.5){shots.leave=1;await party.shot(`test/out/goldrush-leave-${n}.png`,0);}
    if(S.ph==='reveal'&&S.kind==='collapse'&&!shots.col&&S.t-S.rvAt>1.0&&S.t-S.rvAt<2.2){shots.col=1;await party.shot(`test/out/goldrush-collapse-${n}.png`,0);}
    if(S.over&&!shots.over){shots.over=1;await sleep(600);await party.shot(`test/out/goldrush-over-${n}.png`,0);}
  }
  await sleep(100);
}
await party.waitPhase('result',20000);
const st=await party.state();
console.log(`n=${n}${drop?' DROP':''} wall=${((Date.now()-T0)/1000).toFixed(1)}s expeditions=${lastEx} steps=${steps} collapses=${collapses} S.t=${st.S.t.toFixed(1)}`);
console.log('RESULT',JSON.stringify(st.res.rows),'bank',JSON.stringify(st.S.bank));
const bad=Object.keys(st.S).filter(k=>k[0]==='_');if(bad.length)console.log('LEAK!',bad);
if(st.res.rows.every(r=>r.rank!==0))console.log('FAIL no winner');
await party.shot(`test/out/goldrush-result-${n}.png`,0);
console.log('errors:',party.errors);
await party.close();
