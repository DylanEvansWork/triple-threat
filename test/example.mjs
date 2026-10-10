import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3;
const party=await launchParty({n,only:'example',rounds:5});
await party.start();
await party.waitPhase('intro');
await party.shot('test/out/example-intro.png',1);
await party.waitPhase('count');
await party.waitPhase('play');
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.mash'));
for(let i=0;i<30;i++){for(const p of party.pages)await p.evaluate(()=>document.querySelector('.mash').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})));await sleep(100);}
await party.shot('test/out/example-play.png',1);
await party.waitPhase('result');
await party.shot('test/out/example-result.png',0);
const st=await party.state();
console.log('RESULT',JSON.stringify(st.res.rows),'| priv leak check:',JSON.stringify(Object.keys(st.S)));
await party.waitPhase('final',30000);
await party.shot('test/out/example-final.png',0);
console.log('errors:',party.errors);
await party.close();
