import {launchParty,sleep} from './harness.mjs';
for(const key of ['unique','draw','bombparty']){
  const party=await launchParty({n:3,only:key,rounds:5});
  await party.start();await party.waitPhase('play');await sleep(key==='draw'?9000:2500);
  const out=[];
  for(let i=0;i<3;i++){const p=party.pages[i];
    const has=await p.evaluate(()=>!!gameInput());
    if(has){await p.evaluate(()=>{document.activeElement.blur();gameInput().value='';});await p.keyboard.type('hello',{delay:30});await sleep(100);}
    out.push({has,typed:has?await p.evaluate(()=>gameInput().value):null});}
  console.log(key,JSON.stringify(out),'errors',party.errors.length);
  await party.close();
}
