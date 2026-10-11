// node test/pong.mjs <n=3> [dc]   (dc = player 2 closes their page mid-round)
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, dc=process.argv.includes('dc');
const party=await launchParty({n,only:'pong',rounds:5});
await party.start();
await party.pages[1].waitForFunction(()=>R&&R.ph!=='lobby',null,{timeout:20000});
await party.shot(`test/out/pong${n}-intro.png`,1);
await party.waitPhase('count',20000).catch(()=>{});
await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&window.__ttPong&&window.__ttPong.ok);
// scripted bots: synthetic pointer drags on the game box, relative like a real thumb. skill differs per seat.
const skills=[{sp:3.2,err:0.3},{sp:2.6,err:0.45},{sp:2.0,err:0.6},{sp:2.4,err:0.5}];
for(let i=0;i<n;i++)await party.pages[i].evaluate(sk=>{
  const box=document.querySelector('#gbox'),ev=(t,x)=>box.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',clientX:x,clientY:500,isPrimary:true}));
  const hist=[];let cx=195,down=false,bias=0,last=performance.now();window.__bot=setInterval(()=>{
    const d=window.__ttPong;if(!d||!d.aim||R.ph!=='play')return;
    const now=performance.now(),dt=(now-last)/1000;last=now;
    if(Math.random()<0.04)bias=(Math.random()*2-1)*sk.err;
    hist.push(d.aim());if(hist.length>5)hist.shift();const tgt=Math.max(-1,Math.min(1,hist[0]+bias)),du=Math.max(-sk.sp*dt,Math.min(sk.sp*dt,tgt-d.u));
    if(!down){ev('pointerdown',cx);down=true;}
    let nx=cx+du*d.pxPerU;
    if(nx<12||nx>378){ev('pointerup',cx);cx=195;ev('pointerdown',cx);nx=cx+du*d.pxPerU;}
    cx=nx;ev('pointermove',cx);
  },30);
},skills[i]);
await sleep(6000);
await party.shot(`test/out/pong${n}-play-a.png`,1);
await party.shot(`test/out/pong${n}-play-host.png`,0);
if(dc&&n>=3){await sleep(4000);console.log('closing page 2');await party.pages[2].close();await party.host.evaluate(()=>{const p=H.players[2];if(p.conn&&p.conn.close)p.conn.close();else onHostClose(p.conn);p.aw=true;bc();});}
await sleep(8000);
await party.shot(`test/out/pong${n}-play-b.png`,1);
const t0=Date.now();
await party.waitPhase('result',110000);
console.log('round took ~',Math.round((Date.now()-t0)/1000)+14,'s');
await party.shot(`test/out/pong${n}-result.png`,0);
const st=await party.state();
console.log('S.lv',JSON.stringify(st.S.lv),'out',JSON.stringify(st.S.out),'win',st.S.win,'t',st.S.t.toFixed(1));
const tot=await party.host.evaluate(()=>({saves:H.S._saves,kills:H.S._kills,conc:H.S._conceded}));console.log('stats',JSON.stringify(tot));
console.log('RESULT',JSON.stringify(st.res.rows));
const rows=st.res.rows;
if(rows.length!==n)throw new Error('rows!=n');
if(!rows.some(r=>r.rank===0))throw new Error('no winner');
console.log('errors:',party.errors);
if(party.errors.length)process.exitCode=1;
await party.close();
