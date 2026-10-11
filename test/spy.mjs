// Spy in the Crowd e2e. Usage: node test/spy.mjs [n=3] [mode=hunt|passive|disc]
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, mode=process.argv[3]||'hunt';
const party=await launchParty({n,only:'spy',rounds:5,viewport:process.env.VP?{width:+process.env.VP.split('x')[0],height:+process.env.VP.split('x')[1]}:undefined});
const CHEAT=+(process.argv[4]||.04),SPRAY=+(process.argv[5]||.1);
const fail=m=>{console.log('FAIL:',m);process.exitCode=1;};
await party.start();
await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&cur&&cur.dbg&&cur.dbg.dots().length>5);
// every phone: wander the joystick like a (clumsy) human
for(const p of party.pages)await p.evaluate(()=>{
  const j=cur.dbg.joy,r=j.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const ev=(t,x,y)=>j.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:77,clientX:x,clientY:y,isPrimary:true}));
  let a=Math.random()*6.28,down=false;
  window.__joyBot=setInterval(()=>{
    if(!down){ev('pointerdown',cx,cy);down=true;}
    a+=(Math.random()-.5)*.9;const m=30+Math.random()*25;
    if(Math.random()<.04){ev('pointerup',cx,cy);down=false;return;}
    ev('pointermove',cx+Math.cos(a)*m,cy+Math.sin(a)*m);
  },120);
});
const shoot=(i,wx,wy,hint)=>party.pages[i].evaluate(([wx,wy])=>{
  const f=cur.dbg.field,p=cur.dbg.w2c(wx,wy);
  const ev=(t)=>f.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:5,clientX:p.x,clientY:p.y,isPrimary:true}));
  ev('pointerdown');ev('pointerup');
},[wx,wy]);
let shots=0,events=[],snapped=false,leakChecked=false;
let gone=-1;
if(mode==='disc'||mode==='gone'){setTimeout(async()=>{try{gone=n-1;if(mode==='disc')await party.pages[n-1].evaluate(()=>leave());else await party.pages[n-1].close();console.log(mode,'player',n-1);}catch(e){console.log('disc err',e.message);}},9000);}
const t0=Date.now();
while(await party.phase()==='play'){
  await sleep(350);
  const info=await party.host.evaluate(()=>{const S=H.S;if(!S||!S._dots)return null;return{t:S.t,over:!!S.over,dots:S._dots.filter(d=>d.alive).map(d=>({id:d.id,x:d.x,y:d.y,pid:d.pid})),pl:S.pl,keys:Object.keys(R&&R.S||{}),pub:JSON.stringify(R.S)};});
  if(!info)continue;
  if(!leakChecked&&info.t>1){leakChecked=true;
    if(info.keys.some(k=>k[0]==='_'))fail('private keys leaked: '+info.keys);
    if(/_dots|"pid"/.test(info.pub))fail('pid leak in public S');
    const rows=JSON.parse(info.pub).d;if(!rows.every(r=>r.length===5))fail('dot rows differ');
    console.log('public keys:',info.keys.join(','),'| dots:',rows.length);}
  if(info.t>6&&!process.__aim&&!info.over&&mode!=='passive'){process.__aim=1;
    await party.pages[1].evaluate(()=>{const d=cur.dbg.dots()[3],f=cur.dbg.field,p=cur.dbg.w2c(d.x+2,d.y+1);f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9,clientX:p.x,clientY:p.y}));});
    await sleep(150);await party.shot(`test/out/spy-aim-n${n}.png`,1);
    await party.pages[1].evaluate(()=>cur.dbg.field.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:9})));}
  if(info.t>12&&!snapped){snapped=true;await party.shot(`test/out/spy-play-n${n}.png`,1);}
  if(info.over&&!process.__rv){process.__rv=1;await sleep(500);await party.shot(`test/out/spy-reveal-n${n}${process.env.VP?'-small':''}.png`,0);}
  if(mode==='passive'||info.over)continue;
  // bots: players hunt. mostly cheaters (real player dots) + some sprayers (random dots)
  for(let i=0;i<n;i++){
    if(i===gone)continue;const me=info.pl[i];if(!me||!me.a)continue;
    const mine=info.dots.find(d=>d.pid===i);if(!mine)continue;
    const others=info.dots.filter(d=>d.id!==mine.id);
    const roll=Math.random();
    let tgt=null;
    if(roll<CHEAT){tgt=others.filter(d=>d.pid>=0&&d.pid!==i)[0];}
    else if(roll<CHEAT+SPRAY){tgt=others[Math.floor(Math.random()*others.length)];}
    if(tgt){shots++;await shoot(i,tgt.x+(Math.random()-.5)*3,tgt.y+(Math.random()-.5)*3);}
  }
  if(info.t>20&&!events.length){events.push(1);await party.shot(`test/out/spy-mid-n${n}.png`,0);try{await party.shot(`test/out/spy-mid2-n${n}.png`,n>2?2:1);}catch(e){}}
}
console.log('play loop ended after',((Date.now()-t0)/1000).toFixed(1),'s real, shots fired',shots);
await party.shot(`test/out/spy-end-n${n}.png`,0);
await party.waitPhase('result',15000);
const st=await party.state();
console.log('RESULT',JSON.stringify(st.res.rows));
const S=await party.host.evaluate(()=>H.S.pl);
console.log('per-player',JSON.stringify(S));
await party.shot(`test/out/spy-result-n${n}.png`,0);
if(!st.res.rows.length||st.res.rows.length!==n)fail('rows');
if(st.res.rows.every(r=>r.pts===0))fail('nobody got points');
if(mode==='hunt'&&!Object.values(S).some(p=>p.k>0||p.w>0))fail('nobody ever hit anything');
console.log('errors:',JSON.stringify(party.errors));
if(party.errors.length)process.exitCode=1;
await party.close();
