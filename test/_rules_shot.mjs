import {launchParty,sleep} from './harness.mjs';
const key=process.argv[2]||'bomber';
const party=await launchParty({n:3,only:key,rounds:5,autoready:false});
await party.start();await party.waitPhase('intro');await sleep(400);
await party.shot('test/out/'+key+'-rules.png',1);
// scroll down shot
await party.pages[1].evaluate(()=>{document.querySelector('#intro').scrollTop=9999});await sleep(200);
await party.shot('test/out/'+key+'-rules2.png',1);
console.log(party.errors);await party.close();
