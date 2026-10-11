// node test/sumo.mjs <n=3> [dc] [idle]   (dc = player 2 leaves mid-round; idle = nobody ever aims -> the floor must finish it)
import {launchParty,sleep} from './harness.mjs';
import {installBots} from './ptb-bots.mjs';
const n=+process.argv[2]||3, dc=process.argv.includes('dc'), idle=process.argv.includes('idle');
const party=await launchParty({n,only:'sumo',rounds:5});
await party.start();
await party.pages[1].waitForFunction(()=>R&&R.ph!=='lobby',null,{timeout:20000});
await party.shot(`test/out/sumo${n}-intro.png`,1);
await party.waitPhase('play',30000);
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&window.__ttSumo&&window.__ttSumo.ok);
const sk=[0.8,0.6,0.4,0.5];
for(let i=0;i<n;i++)await installBots(party.pages[i],'sumo',{skill:sk[i],mode:idle?'idle':'normal',delay:2500});
// shot during planning with a held drag on phone 1 (band + power meter, no landing preview)
await party.pages[1].waitForFunction(()=>window.__ttSumo.ph==='plan'&&window.__ttSumo.turn===1);
await sleep(600);
await party.pages[1].evaluate(()=>{window.__ev=(t,x,y)=>document.querySelector('#gbox').dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:9,pointerType:'touch',clientX:x,clientY:y,isPrimary:false}));
  const m=__ttSumo.pucks.find(p=>p.id===__ttSumo.me);window.__ev('pointerdown',m.x,m.y);window.__ev('pointermove',m.x+50,m.y+45);window.__ev('pointermove',m.x+70,m.y+62);});
await sleep(250);
await party.shot(`test/out/sumo${n}-aim.png`,1);
await party.pages[1].evaluate(()=>window.__ev('pointercancel',0,0));
await party.waitPhase('play',1000);
// watch the resolve
await party.pages[1].waitForFunction(()=>window.__ttSumo.ph==='go',null,{timeout:20000});
await sleep(900);
await party.shot(`test/out/sumo${n}-go.png`,1);
if(dc&&n>=3){await sleep(1500);console.log('player 2 leaves');await party.pages[2].close();await party.host.evaluate(()=>{const p=H.players[2];if(p.conn&&p.conn.close)p.conn.close();p.aw=true;bc();});}
await sleep(6000);
await party.shot(`test/out/sumo${n}-play-b.png`,1);
await party.waitPhase('result',130000);
await party.shot(`test/out/sumo${n}-result.png`,0);
const st=await party.state();
console.log('t',st.S.t.toFixed(1),'turn',st.S.turn,'R',st.S.R,'win',st.S.win,'alive',JSON.stringify(st.S.pk.map(p=>[p.id,p.a])));
console.log('RESULT',JSON.stringify(st.res.rows));
const rows=st.res.rows;
if(rows.length!==n)throw new Error('rows!=n');
if(!rows.some(r=>r.rank===0))throw new Error('no winner');
if(Object.keys(st.S).some(k=>k[0]==='_'))throw new Error('private leak');
console.log('errors:',party.errors);
if(party.errors.length)process.exitCode=1;
await party.close();
