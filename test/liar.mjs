// node test/liar.mjs <n=3> [drop]  — bots with different styles play Liar's Dice through the real UI.
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, drop=process.argv[3]==='drop';
const party=await launchParty({n,only:'liar',rounds:5,autoready:false});
const T0=Date.now();
await party.start();
await party.waitPhase('intro');
await sleep(400);await party.shot(`test/out/liar-intro-${n}.png`,1);
for(const p of party.pages)await p.click('#iready');
await party.waitPhase('play',30000);
const strats=['honest','bluffer','caller','random'];
const bot=(strat)=>{
  if(!R||R.ph!=='play'||!R.S||R.S.ph!=='bid'||R.S.over)return 'x';
  const S=R.S,me=myPid;if(S.turn!==me||S.dc[me]<=0)return 'wait';
  const key='r'+S.rd+'b'+(S.bid?S.bid.q+'-'+S.bid.f:'-');
  if(window.__k!==key){window.__k=key;window.__thr=.4+Math.random()*1.3;}
  if(S.t-S.pickAt<window.__thr)return 'think';
  const mine=(R.priv&&R.priv.dice)||[];const own={};mine.forEach(v=>own[v]=(own[v]||0)+1);
  const others=S.total-mine.length;
  const est=f=>(own[f]||0)+others/6;
  const click=sel=>{const e=document.querySelector(sel);if(!e||e.disabled)return false;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return true;};
  const prev=S.bid;
  const call=()=>click('.ld-call');
  // candidate raises ordered by (q,f)
  const cands=[];for(let q=1;q<=S.total;q++)for(let f=1;f<=6;f++){if(!prev||q>prev.q||(q===prev.q&&f>prev.f))cands.push([q,f]);}
  if(prev){
    const e=est(prev.f);
    if(strat==='caller'&&prev.q>e+.2)return call()?'call':'callfail';
    if(strat==='honest'&&prev.q>e+1.1&&Math.random()<.9)return call()?'call':'callfail';
    if(strat==='bluffer'&&prev.q>e+2.2)return call()?'call':'callfail';
    if(strat==='random'&&Math.random()<.2)return call()?'call':'callfail';
  }
  if(!cands.length)return call()?'call':'stuck';
  let pick;
  const slack=strat==='bluffer'?1.8:strat==='caller'?0:.6;
  pick=cands.find(([q,f])=>est(f)+slack>=q)||cands[0];
  if(strat==='random')pick=cands[Math.floor(Math.random()*Math.min(cands.length,6))];
  const [q,f]=pick;
  // drive the steppers: face buttons depend on q, so set q first
  let guard=0;while(+document.querySelector('.ld-q .v').textContent<q&&guard++<20)click('.ld-qp');
  while(+document.querySelector('.ld-q .v').textContent>q&&guard++<40)click('.ld-qm');
  if(!click('.ld-fb[data-f="'+f+'"]'))return 'facefail '+q+'-'+f;
  if(!click('.ld-bid'))return 'bidfail '+q+'-'+f+' shown '+document.querySelector('.ld-bid').textContent;
  return 'bid';
};
const shots={};let dropped=false,lastRd=0,seenPhases=0,log={};
while(true){
  if((await party.phase())!=='play')break;
  if(Date.now()-T0>175000){console.log('TIMEOUT');break;}
  for(let i=0;i<party.pages.length;i++){if(party.pages[i].isClosed())continue;try{const r=await party.pages[i].evaluate(bot,strats[i%4]);if(/fail|stuck/.test(r))console.log('BOT',i,r);}catch(e){}}
  let S=null;try{S=await party.pages[0].evaluate(()=>R&&R.S?{ph:R.S.ph,rd:R.S.rd,t:R.S.t,rvAt:R.S.rvAt,over:R.S.over,nb:R.S.bids.length,turn:R.S.turn,dc:R.S.dc,cnt:R.S.rv?R.S.rv.cnt:0,rvn:R.S.rv?R.S.rv.order.length:0,ot:R.S.ot}:null);}catch(e){}
  if(S){
    lastRd=S.rd;
    if(drop&&!dropped&&S.rd>=2&&n>=3&&S.ph==='bid'){dropped=true;console.log('dropping page 2 in round',S.rd,'turn',S.turn);await party.pages[2].evaluate(()=>{hostConn&&hostConn.close();});await party.pages[2].close();}
    if(S.ph==='bid'&&S.nb>=2&&!shots.bid){shots.bid=1;await sleep(250);await party.shot(`test/out/liar-bid-${n}.png`,S.turn&&!party.pages[S.turn].isClosed()?S.turn:1);await party.shot(`test/out/liar-bid-other-${n}.png`,0);}
    if(S.ph==='reveal'&&!shots.rev1&&S.t-S.rvAt>1.3&&S.t-S.rvAt<1.9){shots.rev1=1;await party.shot(`test/out/liar-reveal1-${n}.png`,0);}
    if(S.ph==='reveal'&&!shots.rev2&&S.cnt>0&&S.t-S.rvAt>(.75+.55*S.rvn+.3+.3*S.cnt-.1)&&S.t-S.rvAt<(.75+.55*S.rvn+.3+.3*S.cnt+.3)){shots.rev2=1;await party.shot(`test/out/liar-reveal2-${n}.png`,0);}
    if(S.ph==='reveal'&&!shots.rev3&&S.t-S.rvAt>(.75+.55*S.rvn+.3+.3*S.cnt+.9)){shots.rev3=1;await party.shot(`test/out/liar-reveal3-${n}.png`,0);}
    if(S.over&&!shots.over){shots.over=1;await sleep(500);await party.shot(`test/out/liar-over-${n}.png`,0);}
  }
  await sleep(120);
}
await party.waitPhase('result',20000);
const st=await party.state();
console.log(`n=${n}${drop?' DROP':''} wall=${((Date.now()-T0)/1000).toFixed(1)}s rounds=${lastRd} S.t=${st.S.t.toFixed(1)} ot=${st.S.ot}`);
console.log('RESULT',JSON.stringify(st.res.rows),'dc',JSON.stringify(st.S.dc),'out',JSON.stringify(st.S.out));
const bad=Object.keys(st.S).filter(k=>k[0]==='_');if(bad.length)console.log('LEAK!',bad);
if(st.res.rows.every(r=>r.rank!==0))console.log('FAIL no winner');
await party.shot(`test/out/liar-result-${n}.png`,0);
console.log('errors:',party.errors);
await party.close();
