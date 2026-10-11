// usage: node test/unique.mjs <n=3> [short|drop]   (Mind Meld: score only if you match someone but not everyone)
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, mode=process.argv[3]||'';
const party=await launchParty({n,only:'unique',rounds:5,viewport:mode==='short'?{width:390,height:480}:undefined});
const H=party.host, fails=[];
const ok=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}else console.log('ok  ',m);};
const S=()=>H.evaluate(()=>JSON.parse(JSON.stringify(H.S)));
const waitS=(fn,arg,t=40000)=>H.waitForFunction(fn,arg,{timeout:t});
const tag=mode?'-'+mode:'';
await party.start();
await party.waitPhase('play');
// answers per round for players 0..3, with the group key each answer should land in (null = no answer)
const plan=[
  {a:['Banana','bananas','apple','pear'],k:['b','b','a','p']},        // plural match, others lone
  {a:['dog','Dog!','the dog','a dog'],k:['d','d','d','d']},            // EVERYONE the same -> too obvious
  {a:['red','blue','green','pink'],k:['r','b','g','p']},               // all different
  {a:['cat','Cats','a cat','dog'],k:['c','c','c','d']},                // group of 3 (n=4) / 3-of-3 -> 'too obvious' for n=3 (cat,Cats,a cat)
  {a:['7','seven',null,'7!'],k:['7','7',null,'7']},                    // number words normalise; one silent player
];
const expPts=(keys)=>{const m=keys.slice(0,n);const np=n-(dropped?1:0);const cnt={};m.forEach(k=>{if(k)cnt[k]=(cnt[k]||0)+1;});return m.map(k=>{if(!k)return 0;const g=cnt[k];return g>=2&&g<np?g:0;});};
const exp=new Array(n).fill(0);
let dropped=false;
for(let r=0;r<5;r++){
  await waitS(r=>H.S.rd===r&&H.S.ph==='write',r);
  const cat=(await S()).cat;console.log('round',r+1,'cat:',cat);
  if(r===0)await party.shot(`test/out/unique${tag}-write.png`,1);
  const keys=plan[r].k.slice();
  for(let i=0;i<n;i++){
    const a=plan[r].a[i];if(a===null)continue;
    if(mode==='drop'&&r===1&&i===n-1&&n>2&&!dropped){dropped=true;await party.pages[i].evaluate(()=>{lostHost=()=>{};hostConn.close();});await sleep(100);await party.pages[i].close();continue;}
    if(dropped&&i===n-1)continue;
    const inp=party.pages[i].locator('.uq input');
    await inp.fill(a);
    if(r===0&&i===1)await party.shot(`test/out/unique${tag}-typed.png`,1);
    await inp.press('Enter');
    await sleep(100);
  }
  if(dropped&&r>=1)keys[n-1]=null;
  if(r===0)await party.shot(`test/out/unique${tag}-locked.png`,1);
  await waitS(()=>H.S.ph==='reveal'&&H.S.shown.length>=2,0,30000);
  if(r===0)await party.shot(`test/out/unique${tag}-reveal.png`,1);
  await waitS(()=>H.S.ph==='settle');
  const s=await S();
  const e=expPts(keys);e.forEach((v,i)=>exp[i]+=v);
  console.log('  out',JSON.stringify(s.out),'rp',JSON.stringify(s.rp),'expected',JSON.stringify(e));
  ok(e.every((v,i)=>(s.rp[i]||0)===v),'round '+(r+1)+' points match the rules');
  if(r===1)ok(Object.values(s.out).filter(x=>x==='a').length===(dropped?n-1:n),'everyone-the-same detected (too obvious)');
  await sleep(700);
  await party.shot(`test/out/unique${tag}-settle${r}.png`,1);
}
await party.waitPhase('result',30000);
const res=await party.state(),fin=await S();
console.log('RESULT',JSON.stringify(res.res.rows),'totals',JSON.stringify(fin.tot),'expected',JSON.stringify(exp));
await party.shot(`test/out/unique${tag}-result.png`,0);
for(let i=0;i<n;i++)ok(fin.tot[i]===exp[i],'total for player '+i+' = '+exp[i]);
ok(res.res.rows.length===n,'rows for everyone');
ok(!Object.keys(res.S).some(k=>k[0]==='_'),'no private keys sent (answers stay hidden until reveal)');
await party.waitPhase('final',40000);
console.log('errors:',party.errors);
ok(party.errors.length===0,'no console errors');
await party.close();
console.log(fails.length?'FAILED '+fails.length:'ALL OK');
process.exit(fails.length?1:0);
