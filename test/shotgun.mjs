// node test/shotgun.mjs <n=3> [drop]   — bots with different strategies play a full Shotgun round through the real UI.
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, drop=process.argv[3]==='drop';
const party=await launchParty({n,only:'shotgun',rounds:5,autoready:false});
const T0=Date.now();
await party.start();
await party.waitPhase('intro');
await sleep(400);await party.shot(`test/out/shotgun-intro-${n}.png`,1);
for(const p of party.pages)await p.click('#iready');
await party.waitPhase('play',30000);
const strats=['aggro','turtle','random','aggro'];
if(drop===false&&n===4)strats[3]='idle';           // one idler in 4p to test timeouts
const shots={};let turnsSeen=0,lastTurn=0,sawStorm=false,dropped=false;
const bot=(strat)=>{
  if(!R||R.ph!=='play'||!R.S||R.S.ph!=='pick'||R.S.over)return 'x';
  const S=R.S,me=myPid,q=S.p[me];if(!q||q.l<=0)return 'dead';
  if(S.locked[me])return 'locked';
  const key='t'+S.turn;if(window.__k!==key){window.__k=key;window.__thr=0.3+Math.random()*(strat==='idle'?9:1.8);}
  if(S.t-S.pickAt<window.__thr)return 'wait';
  const click=sel=>{const e=document.querySelector(sel);if(!e||e.disabled)return false;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return true;};
  const foes=S.ids.filter(i=>i!==me&&S.p[i].l>0);if(!foes.length)return 'nofoe';
  const rp=a=>a[Math.floor(Math.random()*a.length)];
  const canB=!q.blk&&S.turn<S.storm;
  let a,tg=null;
  if(strat==='idle')return 'idle';
  if(strat==='aggro'){if(q.a>=3){a='shotgun';}else if(q.a>=1&&Math.random()<.8){a='shoot';}else a='reload';}
  else if(strat==='turtle'){if(q.a>=3&&Math.random()<.6)a='shotgun';else if(canB&&Math.random()<.6)a='block';else if(q.a>=1&&Math.random()<.35)a='shoot';else a='reload';}
  else{const opts=['reload'];if(q.a>=1)opts.push('shoot','shoot');if(q.a>=3)opts.push('shotgun');if(canB)opts.push('block');a=rp(opts);}
  if(a==='shoot'||a==='shotgun'){tg=rp(foes);}
  if(!click('.sg-act.'+a))return 'cantclick';
  if(tg!=null){if(!click('.sg-tg[data-id="'+tg+'"]'))return 'notarget';}
  return a;
};
let pickedShot=false,targetShot=false;
while(true){
  const ph=await party.phase();
  if(ph!=='play')break;
  if((Date.now()-T0)>150000){console.log('TIMEOUT');break;}
  for(let i=0;i<party.pages.length;i++){
    if(party.pages[i].isClosed())continue;
    try{await party.pages[i].evaluate(bot,strats[i]);}catch(e){}
  }
  let S=null;try{S=await party.pages[0].evaluate(()=>R&&R.S?{ph:R.S.ph,turn:R.S.turn,t:R.S.t,rvAt:R.S.rvAt,rvev:R.S.rv?R.S.rv.ev.filter(e=>e.k!=='out').length:0,rvn:R.S.rv?R.S.rv.acts.length:0,over:R.S.over,ids:R.S.ids,p:R.S.p,locked:R.S.locked}:null);}catch(e){}
  if(S){
    if(S.turn!==lastTurn){lastTurn=S.turn;turnsSeen++;}
    if(S.turn>=7)sawStorm=true;
    if(drop&&!dropped&&S.turn>=3&&n>=3){dropped=true;console.log('closing page 2 at turn',S.turn);await party.pages[2].evaluate(()=>{hostConn&&hostConn.close();});await party.pages[2].close();}
    if(S.ph==='pick'&&S.turn>=3&&!pickedShot&&S.t-0>0){pickedShot=true;await party.shot(`test/out/shotgun-pick-${n}.png`,1);}
    if(n>=3&&S.turn>=2&&S.ph==='pick'&&!targetShot&&!S.locked[1]&&S.p[1]&&S.p[1].a>=1){
      // open the target picker on the second client for a screenshot
      targetShot=await party.pages[1].evaluate(()=>{if(window.__k&&0)return 0;const e=document.querySelector('.sg-act.shoot');if(!e||e.disabled)return false;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return !!document.querySelector('.sg-tgs')&&getComputedStyle(document.querySelector('.sg-tgs')).display!=='none';});
      if(targetShot){await party.shot(`test/out/shotgun-target-${n}.png`,1);await party.pages[1].evaluate(()=>{const b=document.querySelector('.sg-back');b&&b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));});}
    }
    if(S.ph==='reveal'&&S.rvev>0&&!shots.hit&&S.t-S.rvAt>(.3+.42*S.rvn+.45+.55+.15)&&S.t-S.rvAt<(.3+.42*S.rvn+.45+.55+.45)){shots.hit=1;await party.shot(`test/out/shotgun-hit-${n}.png`,0);}
    if(S.ph==='reveal'&&S.turn>=2&&!shots.rev&&S.t-S.rvAt>1.9&&S.t-S.rvAt<2.6){shots.rev=1;await party.shot(`test/out/shotgun-reveal-${n}.png`,0);}
    if(S.ph==='pick'&&S.turn>=7&&!shots.storm&&S.t-0>0){shots.storm=1;await party.shot(`test/out/shotgun-storm-${n}.png`,0);}
    if(S.over&&!shots.over){shots.over=1;await sleep(500);await party.shot(`test/out/shotgun-over-${n}.png`,0);}
  }
  await sleep(110);
}
await party.waitPhase('result',20000);
const secs=((Date.now()-T0)/1000).toFixed(1);
const st=await party.state();
const keys=Object.keys(st.S);
console.log(`n=${n}${drop?' DROP':''} wall=${secs}s turns=${lastTurn} storm=${sawStorm}`);
console.log('RESULT',JSON.stringify(st.res.rows));
console.log('state keys (no _priv/_ch expected):',keys.join(','));
const bad=keys.filter(k=>k[0]==='_');
if(bad.length)console.log('LEAK!',bad);
const ranks=st.res.rows.map(r=>r.rank);
if(Math.min(...ranks)!==0)console.log('FAIL: nobody rank 0');
if(!st.res.rows.every(r=>typeof r.pts==='number'))console.log('FAIL pts');
await party.shot(`test/out/shotgun-result-${n}.png`,0);
console.log('final S.t=',st.S.t.toFixed(1),' errors:',party.errors);
await party.close();
