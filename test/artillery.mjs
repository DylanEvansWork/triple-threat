// Artillery (real-time) e2e. Usage: node test/artillery.mjs [n=3] [mode=play|sloppy|idle|spam|gone|disc]
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, mode=process.argv[3]||'play';
const VP=process.env.VP?{width:+process.env.VP.split('x')[0],height:+process.env.VP.split('x')[1]}:undefined;
const party=await launchParty({n,only:'artillery',rounds:5,viewport:VP});
const fail=m=>{console.log('FAIL:',m);process.exitCode=1;};
await party.start();await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&cur&&cur.dbg&&cur.dbg.dT());
const botSrc=(mode,pi)=>{
  const d=cur.dbg,D=GAMES.artillery.dbg,T=d.touch;
  const ev=(t)=>T.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:21,clientX:100,clientY:200,isPrimary:true}));
  let ph='idle',tA=0,tP=0,tmo=0;window.__st={shots:0,presses:0,solveMs:0};
  const solve=()=>{
    const S=R.S,me=myPid,tk=S.tk,mine=tk[me];const foes=Object.keys(tk).filter(k=>+k!==me&&tk[k].a);if(!foes.length)return null;
    const f=tk[foes[Math.floor(Math.random()*foes.length)]],T0=d.dT();
    const tanks=Object.keys(tk).map(k=>({p:+k,x:tk[k].x,y:tk[k].y,a:tk[k].a}));
    let best=null;
    for(let a=14;a<=166;a+=3)for(let pw=14;pw<=100;pw+=4){
      const r=D.flight(T0,S.wind,mine.x,mine.y,a,pw,tanks,me);if(!r)continue;
      const dist=Math.hypot(r.x-f.x,r.y-(f.y+1.5));if(!best||dist<best.d)best={a,pw,d:dist};
    }
    return best;
  };
  window.__bot=setInterval(()=>{
    const S=R&&R.S;if(!S||R.ph!=='play'||S.over)return;const mine=S.tk[myPid];if(!mine||!mine.a)return;
    const now=performance.now();
    if(mode==='idle')return;
    if(mode==='spam'){ // rapid taps, repeated presses during reload, multi-touch ids
      if(Math.random()<.25){ev('pointerdown');window.__st.presses++;if(Math.random()<.7)setTimeout(()=>ev('pointerup'),Math.random()*400);else setTimeout(()=>ev('pointercancel'),Math.random()*300);}
      return;}
    if(ph==='idle'){
      if(d.reloading())return;
      const t0=performance.now();const b=solve();window.__st.solveMs+=performance.now()-t0;if(!b)return;
      const sl=mode==='sloppy'?2.2:.9;
      tA=Math.max(16,Math.min(164,b.a+(Math.random()-.5)*2*10*sl));tP=Math.max(12,Math.min(100,b.pw+(Math.random()-.5)*2*14*sl));ph='wait';tmo=now+4000;
    }else if(ph==='wait'){
      if(Math.abs(d.angle()-tA)<2.6){ev('pointerdown');window.__st.presses++;ph='charge';tmo=now+3000;}
      else if(now>tmo)ph='idle';
    }else if(ph==='charge'){
      if(d.power()>=tP){ev('pointerup');window.__st.shots++;ph='idle';}
      else if(now>tmo){ev('pointerup');ph='idle';}
    }
  },6);
};
for(let i=0;i<n;i++)await party.pages[i].evaluate(`(${botSrc.toString()})('${mode}',${i})`);
let gone=-1;const t0=Date.now();let shot1=false,shot2=false,shot3=false,maxSh=0,lens=[];
if(mode==='disc')setTimeout(async()=>{try{await party.pages[n-1].evaluate(()=>leave());gone=n-1;console.log('left: player',n-1);}catch(e){}},15000);
if(mode==='gone')setTimeout(async()=>{try{await party.pages[n-1].close();gone=n-1;console.log('closed page',n-1);}catch(e){}},15000);
while(await party.phase()==='play'){
  await sleep(300);const t=(Date.now()-t0)/1000;
  const st=await party.host.evaluate(()=>({t:H.S.t,sh:H.S.sh.length,hp:H.players.map(p=>H.S.tk[p.id].hp),wind:H.S.wind,hz:H.S.hz.length,len:JSON.stringify(R.S).length,keys:Object.keys(R.S)})).catch(()=>null);
  if(!st)continue;maxSh=Math.max(maxSh,st.sh);lens.push(st.len);
  if(st.keys.some(k=>k[0]==='_'))fail('private key leaked '+st.keys);
  if(t>8&&!shot1){shot1=true;try{await party.shot(`test/out/artillery-rt-aim-n${n}.png`,0);}catch(e){}}
  if(t>20&&!shot2){shot2=true;try{await party.shot(`test/out/artillery-rt-mid-n${n}.png`,1);}catch(e){}}
  if(st.t>46&&!shot3){shot3=true;try{await party.shot(`test/out/artillery-rt-meteor-n${n}.png`,0);}catch(e){}}
  if(t>110){fail('round never ended');break;}
}
console.log('round ended after',((Date.now()-t0)/1000).toFixed(1),'s; max shells in flight',maxSh,'; avg public S bytes',Math.round(lens.reduce((a,b)=>a+b,0)/Math.max(1,lens.length)));
await party.waitPhase('result',20000);
const res=await party.state();
console.log('RESULT',JSON.stringify(res.res.rows));
console.log('score detail',JSON.stringify(await party.host.evaluate(()=>H.S.sc)),'hp',JSON.stringify(await party.host.evaluate(()=>H.players.map(p=>H.S.tk[p.id].hp))));
for(let i=0;i<n;i++){if(i===gone)continue;console.log('bot',i,JSON.stringify(await party.pages[i].evaluate(()=>window.__st).catch(()=>null)));}
await party.shot(`test/out/artillery-rt-result-n${n}.png`,0);
if(res.res.rows.length!==n)fail('row count');
const sc=await party.host.evaluate(()=>H.S.sc);
if(mode==='play'&&!Object.values(sc).some(c=>c.d>0))fail('nobody ever damaged anyone');
console.log('errors:',JSON.stringify(party.errors));
if(party.errors.length)process.exitCode=1;
await party.close();
