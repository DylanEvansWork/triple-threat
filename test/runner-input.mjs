// Item button proof with REAL input (Playwright mouse / touchscreen / CDP multi-touch) on 3 screen sizes.
import {launchParty,sleep} from './harness.mjs';
const sizes=[[320,568],[390,844],[430,932]];
let bad=0;const fail=m=>{console.log('  FAIL:',m);bad++;process.exitCode=1;};
for(const [w,h] of sizes){
  console.log(`== ${w}x${h}`);
  const party=await launchParty({n:3,only:'runner',rounds:5,viewport:{width:w,height:h}});
  await party.start();await party.waitPhase('play');
  const [A,V,W3]=party.pages;
  for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&cur&&cur.dbg&&cur.dbg.track&&cur.dbg.sim.t>.2);
  const centre=p=>p.evaluate(()=>{const b=cur.dbg.item.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2,w:b.width,h:b.height,L:b.left,T:b.top,vw:innerWidth,vh:innerHeight};});
  const prep=async()=>{for(const p of party.pages)await p.evaluate(()=>{cur.dbg.sim.shield=false;cur.dbg.sim.item=null;cur.dbg.walls().length=0;cur.dbg.sim.fog=0;cur.dbg.sim.stun=0;});};
  // (1) hit-testing: the item button must be the topmost element over its whole padded hit zone, with every overlay active
  await A.evaluate(()=>{cur.dbg.give('wall');document.querySelector('.run-ban').style.display='block';});
  await A.evaluate(()=>{const t=document.querySelector('.run-toast');for(let i=0;i<3;i++){const d=document.createElement('div');d.textContent='toast toast toast';t.append(d);}});
  const c0=await centre(A);
  console.log('  button rect',JSON.stringify(c0));
  if(c0.w<110||c0.h<110)fail('hit area smaller than 110px');
  if(c0.L+c0.w>c0.vw+.5||c0.T+c0.h>c0.vh+.5)fail('button off screen');
  for(const [dx,dy] of [[0,0],[-50,-50],[50,50],[-50,50],[50,-50],[0,-55],[55,0]]){
    const ok=await A.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e===cur.dbg.item;},[c0.x+dx,c0.y+dy]);
    if(!ok)fail(`elementFromPoint(${dx},${dy}) is not the item button`);
  }
  await A.evaluate(()=>{document.querySelector('.run-ban').style.display='none';});
  // (a) real touch tap, quick tap-release, wall lands on the victim
  await prep();
  await V.evaluate(()=>{window.__ev=0;const o=cur.event;cur.event=m=>{if(m&&m.e==='it')window.__ev++;return o.call(cur,m);};});
  await W3.evaluate(()=>{window.__ev=0;const o=cur.event;cur.event=m=>{if(m&&m.e==='it')window.__ev++;return o.call(cur,m);};});
  await A.evaluate(()=>cur.dbg.give('wall'));
  const c1=await centre(A);
  await A.touchscreen.tap(c1.x,c1.y);await A.touchscreen.tap(c1.x,c1.y);   // second tap = double-fire attempt on an empty button
  await sleep(500);
  const r1=await A.evaluate(()=>({item:cur.dbg.sim.item,toast:document.querySelector('.run-toast').innerText}));
  const walls=(await V.evaluate(()=>cur.dbg.walls().length))+(await W3.evaluate(()=>cur.dbg.walls().length));
  const evs=(await V.evaluate(()=>window.__ev));
  console.log('  touch tap: item left =',r1.item,'| walls landed =',walls,'| toast:',JSON.stringify(r1.toast.split('\n').pop()));
  if(r1.item!==null)fail('item not consumed by touch tap');
  if(walls!==1)fail('expected exactly 1 wall on a victim, got '+walls);
  if(!/sent to/.test(r1.toast))fail('no "sent to" toast');
  // host really received it
  const hostSaw=await party.host.evaluate(()=>H.S._lastItem[0]!==undefined);
  if(!hostSaw)fail('host never saw the item message');
  // (b) real mouse click, fog
  await prep();await A.evaluate(()=>cur.dbg.give('fog'));
  const c2=await centre(A);await A.mouse.click(c2.x,c2.y);await sleep(400);
  const fogged=(await V.evaluate(()=>cur.dbg.sim.fog>0))||(await W3.evaluate(()=>cur.dbg.sim.fog>0));
  console.log('  mouse click: item left =',await A.evaluate(()=>cur.dbg.sim.item),'| fog landed =',fogged);
  if(!fogged)fail('fog did not land (mouse)');
  // (c) multi-touch: thumb A HOLDS the lane (jump), thumb B taps the item button
  await prep();await A.evaluate(()=>{cur.dbg.give('wall');window.__j0=cur.dbg.sim.jumps;});
  const cdp=await A.context().newCDPSession(A);
  const laneP=await A.evaluate(()=>{const r=cur.dbg.touch.getBoundingClientRect();return{x:r.left+60,y:r.top+r.height*.4};});
  const cb=await centre(A);
  const th=[{x:laneP.x,y:laneP.y,id:1}],tb=[{x:laneP.x,y:laneP.y,id:1},{x:cb.x,y:cb.y,id:2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:th});
  await sleep(120);
  const holdA=await A.evaluate(()=>cur.dbg.sim.hold);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:tb});
  await sleep(60);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:cb.x,y:cb.y,id:2}]});   // thumb B lifts quickly
  await sleep(250);
  const mid=await A.evaluate(()=>({hold:cur.dbg.sim.hold,item:cur.dbg.sim.item,jumps:cur.dbg.sim.jumps-window.__j0}));
  const w2=(await V.evaluate(()=>cur.dbg.walls().length))+(await W3.evaluate(()=>cur.dbg.walls().length));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(150);
  const after=await A.evaluate(()=>({hold:cur.dbg.sim.hold,jumps:cur.dbg.sim.jumps-window.__j0}));
  console.log('  multi-touch: A held before =',holdA,'| while B tapped:',JSON.stringify(mid),'| victim walls =',w2,'| after release:',JSON.stringify(after));
  if(!holdA)fail('finger A did not register a hold');
  if(mid.item!==null)fail('item tap swallowed while another finger was down');
  if(w2!==1)fail('wall did not land during multi-touch (got '+w2+')');
  if(!mid.hold)fail('thumb A hold was cancelled by thumb B tap');
  if(mid.jumps>1)fail('item tap caused an extra jump ('+mid.jumps+')');
  if(after.hold)fail('hold stuck after both fingers released');
  // (d) no-target case does not consume the item: everyone else finished/away
  await prep();
  await party.host.evaluate(()=>{H.S.fin[1]=40;H.S.fin[2]=41;});await sleep(400);
  await A.evaluate(()=>cur.dbg.give('wall'));const c3=await centre(A);await A.touchscreen.tap(c3.x,c3.y);await sleep(300);
  const nt=await A.evaluate(()=>({item:cur.dbg.sim.item,toast:document.querySelector('.run-toast').innerText.split('\n').pop()}));
  console.log('  no valid target:',JSON.stringify(nt));
  if(nt.item!=='wall')fail('item was consumed with no valid target');
  if(!/Nobody/.test(nt.toast))fail('no "nobody to hit" message');
  await party.host.evaluate(()=>{delete H.S.fin[1];delete H.S.fin[2];});
  console.log('  errors:',JSON.stringify(party.errors));
  if(party.errors.length)fail('page errors');
  await party.shot(`test/out/runner-input-${w}x${h}.png`,0);
  await party.close();
}
console.log(bad?`FAILED (${bad})`:'ALL OK');
