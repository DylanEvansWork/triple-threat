// Item Runner e2e. Usage: node test/runner.mjs [n=3] [mode=race|gone|disc] [skill=0.9]
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, mode=process.argv[3]||'race', skill=+(process.argv[4]||.9);
const party=await launchParty({n,only:'runner',rounds:5,viewport:process.env.VP?{width:+process.env.VP.split('x')[0],height:+process.env.VP.split('x')[1]}:undefined});
const fail=m=>{console.log('FAIL:',m);process.exitCode=1;};
await party.start();
await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&cur&&cur.dbg&&cur.dbg.track);
// bots: real pointer events on the lane. skill = chance to attempt each obstacle properly.
const botSrc=(skill,pi)=>{
  const d=cur.dbg,T=d.touch;let plan=new Map(),holdUntil=0,downAt=0;
  const ev=(t,el)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:11,clientX:50,clientY:50,isPrimary:true}));
  window.__stats={jumps:0,itemsUsed:0,sel:0};
  window.__bot=setInterval(()=>{
    const s=d.sim,tr=d.track;if(!tr||s.fin)return;
    const now=performance.now();
    if(downAt&&now>=holdUntil){ev('pointerup',T);downAt=0;}
    if(s.item&&Math.random()<.04){
      if(pi===0&&!window.__stats.sel&&(s.item==='wall'||s.item==='fog')&&d.strips().length>1){window.__stats.sel=1;const st=d.strips()[1],r=document.querySelector('.run-strips').getBoundingClientRect();
        document.querySelector('.run-strips').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+50,clientY:r.top+st.y+10}));}
      d.item.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));window.__stats.itemsUsed++;}
    if(downAt)return;
    const spd=13*(s.stun>0?.25:1)*(s.boost>0?1.55:1);
    const list=[...tr.obs.filter(o=>!o.hit&&o.x+o.w>s.x-1),...d.walls().filter(o=>!o.hit&&o.x+o.w>s.x-1)].sort((a,b)=>a.x-b.x);
    const o=list[0];if(!o)return;
    if(!plan.has(o)){plan.set(o,{ok:Math.random()<skill,jit:(Math.random()-.5)*.07});}
    const pl=plan.get(o);if(!pl.ok)return;
    const tf=(o.x-1-s.x)/spd,tg=(o.x-s.x)/spd;
    let go=false,hold=70;
    if(o.k==='gap'){const hi=o.w>7;const air=hi?.96:.69;go=tg<=(air-o.w/13)/2+pl.jit;hold=hi?330:60;}
    else if(o.k==='tall'){go=tf<=.3+pl.jit;hold=330;}
    else go=tf<=.15+pl.jit;
    if(go&&s.air===false||(go&&s.coy>0)){ev('pointerdown',T);downAt=now;holdUntil=now+hold;window.__stats.jumps++;}
  },16);
};
for(let i=0;i<n;i++)await party.pages[i].evaluate(`(${botSrc.toString()})(${skill},${i})`);
const t0=Date.now();let shotN=0,fogShot=false,gone=-1;
if(mode==='disc')setTimeout(async()=>{try{await party.pages[n-1].evaluate(()=>leave());gone=n-1;console.log('left: player',n-1);}catch(e){console.log(e.message);}},15000);
if(mode==='gone')setTimeout(async()=>{try{await party.pages[n-1].close();gone=n-1;console.log('closed page',n-1);}catch(e){console.log(e.message);}},15000);
while(await party.phase()==='play'){
  await sleep(500);
  const t=(Date.now()-t0)/1000;
  if(t>12&&shotN===0){shotN=1;await party.shot(`test/out/runner-play-n${n}.png`,0);}
  if(t>26&&shotN===1){shotN=2;try{await party.shot(`test/out/runner-play2-n${n}.png`,1);}catch(e){}}
  if(t>9&&!process.__forced){process.__forced=1;
    for(const p of party.pages)await p.evaluate(()=>{cur.dbg.sim.shield=false;cur.dbg.sim.item=null;});
    const tapItem=async(i,it)=>{await party.pages[i].evaluate(it=>cur.dbg.give(it),it);const r=await party.pages[i].evaluate(()=>{const b=cur.dbg.item.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2};});await party.pages[i].touchscreen.tap(r.x,r.y);};
    await tapItem(0,'wall');await tapItem(1,'fog');
    await sleep(700);
    for(let i=0;i<n;i++)await party.shot(`test/out/runner-sab-n${n}-${i}.png`,i);
    const got=await Promise.all(party.pages.map(p=>p.evaluate(()=>({fog:cur.dbg.sim.fog,walls:cur.dbg.walls().length}))));
    console.log('forced sabotage effects',JSON.stringify(got));
    if(!got.some(g=>g.fog>0)||!got.some(g=>g.walls>0))fail('sabotage did not land');
  }
  if(!fogShot){
    for(let i=0;i<n&&!fogShot;i++){if(i===gone)continue;const f=await party.pages[i].evaluate(()=>cur.dbg.sim.fog>0||cur.dbg.walls().length>0).catch(()=>false);if(f){fogShot=true;await party.shot(`test/out/runner-sabotage-n${n}.png`,i);}}
  }
  if(t>90){fail('round did not end');break;}
}
console.log('race phase ended after',((Date.now()-t0)/1000).toFixed(1),'s');
const S=await party.host.evaluate(()=>({fin:H.S.fin,pos:H.S.pos,keys:Object.keys(R.S)}));
console.log('fin',JSON.stringify(S.fin),'pos',JSON.stringify(Object.fromEntries(Object.entries(S.pos).map(([k,v])=>[k,v.x]))));
for(let i=0;i<n;i++){if(i===gone)continue;console.log('bot',i,JSON.stringify(await party.pages[i].evaluate(()=>({...window.__stats,hits:cur?cur.dbg.sim.hits:null,jumps:cur?cur.dbg.sim.jumps:null})).catch(()=>null)));}
await party.waitPhase('result',20000);
const res=await party.state();
console.log('RESULT',JSON.stringify(res.res.rows));
await party.shot(`test/out/runner-result-n${n}.png`,0);
if(res.res.rows.length!==n)fail('row count');
if(!Object.keys(S.fin).length&&mode==='race')fail('nobody finished');
if(S.keys.some(k=>k[0]==='_'))fail('private keys');
console.log('errors:',JSON.stringify(party.errors));
if(party.errors.length)process.exitCode=1;
await party.close();
