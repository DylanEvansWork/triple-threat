import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3;
const party=await launchParty({n,only:'simon',rounds:5});
const OUT='test/out/simon-'+n+'-';
let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok:',m);};
await party.start();
await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.sm-pad'));
const snap=p=>p.evaluate(()=>{const S=R.S;return{me:myPid,ph:R.ph,mode:S.mode,cur:S.cur,idx:S.idx,seq:S.seq,ds:S.ds,t:cur.t?cur.t():0,over:S.over,turn:S.turn,lives:S.lives,out:S.out,n:R.pl.length,t0:S.t};}).catch(()=>null);
const tap=(p,i)=>p.evaluate(i=>{document.querySelectorAll('.sm-pad')[i].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));},i);
const state={shots:{},lastTap:[0,0,0,0],plan:{},closed:false,wrongDone:{}};
const t0=Date.now();
let maxSeq=0,sawFail=false,sawAdd=false;
while(Date.now()-t0<150000){
  const alive=party.pages.filter(p=>!p.isClosed());
  const host=await snap(party.host);if(!host)break;
  if(host.ph!=='play')break;
  maxSeq=Math.max(maxSeq,host.seq.length);
  // disconnect test
  if(!state.closed&&n>=3&&host.turn>=5){state.closed=true;await party.pages[n-1].evaluate(()=>{hostConn.close();});await party.pages[n-1].close();await sleep(400);
    const s2=await snap(party.host);ok(s2.lives[n-1]>=0,'disconnected player skipped, not crashing (lives '+JSON.stringify(s2.lives)+')');}
  for(let i=0;i<party.pages.length;i++){
    const p=party.pages[i];if(p.isClosed())continue;
    const s=await snap(p);if(!s)continue;
    const now=Date.now();
    // screenshots at key moments
    if(s.mode==='watch'&&s.seq.length>=4&&s.cur!==s.me&&!state.shots.watch&&i===1){state.shots.watch=1;await sleep(150);await party.shot(OUT+'watch-spectator.png',i);}
    if(s.cur!==s.me)continue;
    if(s.mode==='input'){
      const key='in'+s.turn;
      if(!(key in state.plan)){
        // personality
        const r=Math.random();
        state.plan[key]=i===1?(r<.5?'wrong':'ok'):i===2?(r<.3?'sleep':'ok'):'ok';
        state.wrongAt=Math.floor(Math.random()*s.seq.length);
      }
      const plan=state.plan[key];
      if(plan==='sleep')continue;
      if(now-state.lastTap[i]<190)continue;
      let pad=s.seq[s.idx];
      if(plan==='wrong'&&s.idx===Math.min(state.wrongAt,s.seq.length-1))pad=(pad+1)%4;
      if(!state.shots.input&&s.seq.length>=5&&s.idx===2){state.shots.input=1;await party.shot(OUT+'input-me.png',i);}
      state.lastTap[i]=now;await tap(p,pad);
    }else if(s.mode==='add'){
      if(s.t-s.ds<.9)continue;                     // human-ish think time
      if(now-(state.addTry||0)<700)continue;
      if(!state.shots.add&&s.seq.length>=3){state.shots.add=1;await party.shot(OUT+'add-me.png',i);}
      sawAdd=true;state.addTry=now;
      const last=s.seq[s.seq.length-1];
      await tap(p,s.seq.length&&Math.random()<.5?last:Math.floor(Math.random()*4));
    }
  }
  const hs=await snap(party.host);
  if(hs.mode==='fb'&&!state.shots.fail&&hs.lives&&Object.values(hs.lives).some(v=>v<2)){state.shots.fail=1;await sleep(200);await party.shot(OUT+'fail.png',1);sawFail=true;}
  await sleep(40);
}
await party.waitPhase('result',30000);
const fin=await party.host.evaluate(()=>({seq:H.S.seq.length,lives:H.S.lives,out:H.S.out,turn:H.S.turn,t:H.S.t,win:H.S.win}));
console.log('final',JSON.stringify(fin));
await party.shot(OUT+'result.png',0);
const st=await party.state();
console.log('RESULT',JSON.stringify(st.res.rows));
ok(st.res.rows.length===n,'ranking row per player');
ok(maxSeq>=3,'chain grew to '+maxSeq);
ok(sawFail,'saw a failed turn / life loss');
ok(fin.t<=121.5,'ended within dur ('+fin.t.toFixed(1)+'s)');
const lg=Object.values(fin.lives);
// ranking consistency: more lives => better or equal rank; eliminated by earlier => worse
const byId={};st.res.rows.forEach(r=>byId[r.id]=r);
for(const a of st.res.rows)for(const b of st.res.rows){
  if(fin.lives[a.id]>0&&fin.lives[b.id]>0&&fin.lives[a.id]>fin.lives[b.id])ok(a.rank<b.rank,'more lives ranks higher');
  if(fin.lives[a.id]>0&&fin.lives[b.id]===0)ok(a.rank<b.rank,'survivor ranks above eliminated');
  if(fin.lives[a.id]===0&&fin.lives[b.id]===0&&fin.out.indexOf(a.id)>fin.out.indexOf(b.id)&&!(party.pages[a.id].isClosed()||party.pages[b.id].isClosed()))ok(a.rank<=b.rank,'later elimination ranks higher');
}
await party.waitPhase('final',30000);
console.log('errors:',party.errors);
ok(party.errors.length===0,'no console errors');
await party.close();
console.log(fail?('FAILED '+fail):'PASS n='+n);
process.exit(fail?1:0);
