import {launchParty,sleep} from './harness.mjs';
const party=await launchParty({n:3,only:'example',rounds:5});
await party.start();
for(let k=0;k<12;k++){await sleep(1000);console.log(k,await Promise.all(party.pages.map(p=>p.evaluate(()=>R&&[R.ph,R.g,!!document.querySelector('.mash'),Math.round(R.rem)]))));}
console.log(party.errors);
await party.close();
