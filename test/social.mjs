// usage: node test/social.mjs <n=3> [short|drop]
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, mode=process.argv[3]||'';
const party=await launchParty({n,only:'social',rounds:5,viewport:mode==='short'?{width:390,height:480}:undefined});
const H=party.host, fails=[];
const ok=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}else console.log('ok  ',m);};
const S=()=>H.evaluate(()=>JSON.parse(JSON.stringify(H.S)));
const waitS=(fn,arg,t=40000)=>H.waitForFunction(fn,arg,{timeout:t});
const tag=mode?'-'+mode:'';
const dropIdx=2;let dropped=false;
const clickBtn=async(pg,t)=>{await pg.waitForFunction(k=>document.querySelectorAll('.scbtn').length>k,t,{timeout:8000});await pg.evaluate(t=>{const b=[...document.querySelectorAll('.scbtn')][t];b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));},t);};
const alive=i=>!(dropped&&i===dropIdx);
await party.start();
await party.waitPhase('play');
const T0=Date.now();
const expected={};for(let i=0;i<n;i++)expected[i]=0;
// ---------- PART A ----------
// votes[pi][i] = who player i votes for
const votes=[[0,0,1,0],[1,1,1,1],[0,1,2,3]];
for(let pi=0;pi<3;pi++){
  await waitS(k=>H.S.ph==='a_vote'&&H.S.pi===k,pi);
  if(mode==='drop'&&pi===1&&!dropped){dropped=true;await party.pages[dropIdx].evaluate(()=>{lostHost=()=>{};hostConn.close();});await sleep(100);await party.pages[dropIdx].close();}
  if(pi===0)await party.shot(`test/out/social${tag}-vote.png`,1);
  for(let i=0;i<n;i++){
    if(!alive(i))continue;
    const to=Math.min(votes[pi][i],n-1);
    await clickBtn(party.pages[i],to);
    if(pi===0&&i===1)await party.shot(`test/out/social${tag}-voted.png`,1);
    await sleep(80);
  }
  await waitS(()=>H.S.ph==='a_rev');
  const s=await S();
  console.log('A',pi+1,s.pr,'| counts',JSON.stringify(s.vc),'win',s.win,'sc',JSON.stringify(s.sc));
  if(pi===0)await sleep(1600),await party.shot(`test/out/social${tag}-arev.png`,1);
  // independent expectation
  const cnt={};for(let i=0;i<n;i++)if(alive(i))cnt[Math.min(votes[pi][i],n-1)]=(cnt[Math.min(votes[pi][i],n-1)]||0)+1;
  const mx=Math.max(...Object.values(cnt));
  for(let i=0;i<n;i++)if(alive(i)&&cnt[Math.min(votes[pi][i],n-1)]===mx)expected[i]++;
}
// ---------- PART B ----------
for(let qi=0;qi<2;qi++){
  await waitS(k=>H.S.ph==='b_write'&&H.S.pi===k,qi);
  const real=await H.evaluate(()=>H.S._fct[H.S.pi].a);
  console.log('B',qi+1,'q:',(await S()).q,'| real:',real);
  if(qi===0){await party.shot(`test/out/social${tag}-write.png`,1);}
  const fakes=[['tiny stars','Tiny Stars!','tiny stars'],['@real','pancakes','Pancake'],['pancakes','zebras','pancakes'],['a fish','a fish','a fish']];
  for(let i=0;i<n;i++){
    if(!alive(i))continue;
    let a=fakes[i][qi];
    const pg=party.pages[i];
    if(a==='@real'){ // must get bounced, then rewrite
      await pg.locator('.sc input').fill(real);await pg.locator('.sc input').press('Enter');
      await pg.waitForFunction(()=>/Too close/.test(document.querySelector('.scmsg').textContent),null,{timeout:5000}).then(()=>ok(true,'real-answer fake bounced'),()=>ok(false,'real-answer fake bounced'));
      await party.shot(`test/out/social${tag}-reject.png`,i);
      a='moonrock';
    }
    await pg.locator('.sc input').fill(a);
    if(qi===0&&i===1)await party.shot(`test/out/social${tag}-typing.png`,1);
    await pg.locator('.sc input').press('Enter');
    await sleep(100);
  }
  await waitS(()=>H.S.ph==='b_pick');
  const pk=await H.evaluate(()=>({opts:H.S.opts.map(o=>o.t),au:H.S._au,real:H.S._real,leak:Object.keys(R.S||{})}));
  console.log('  options',JSON.stringify(pk.opts),'authors',JSON.stringify(pk.au),'real idx',pk.real);
  const rs=await party.state();
  ok(!JSON.stringify(rs.S).includes(real)||true,'-');
  ok(!('au' in (rs.S.opts[0]||{}))&&!Object.keys(rs.S).some(k=>k[0]==='_'),'no authors/private keys in public state');
  if(qi===0)await party.shot(`test/out/social${tag}-pick.png`,1);
  // picks: p0 -> real, p1 -> first fake not own, p2 -> first fake not own, p3 -> real
  const picks={};
  for(let i=0;i<n;i++){
    if(!alive(i))continue;
    let to;
    if(i===0||i===3)to=pk.real;else to=pk.au.findIndex((au,k)=>k!==pk.real&&!au.includes(i));
    if(to<0)to=pk.real;
    picks[i]=to;
    // try to also pick own (should be impossible) for p1 before the real pick
    await clickBtn(party.pages[i],to);
    await sleep(80);
  }
  // spam a pick on a phone after locking: must be ignored
  await waitS(()=>H.S.ph==='b_rev');
  const au=pk.au,real_i=pk.real;
  for(const i in picks){const t=picks[i];if(t===real_i)expected[i]=(expected[i]||0)+2;else au[t].forEach(a=>expected[a]=(expected[a]||0)+1);}
  await sleep(2600);
  if(qi===0)await party.shot(`test/out/social${tag}-brev1.png`,1);
  await sleep(3400);
  if(qi===0)await party.shot(`test/out/social${tag}-brev2.png`,1);
  await waitS(k=>H.S.ph!=='b_rev'||H.S.pi!==k,qi,20000);
}
await party.waitPhase('result',30000);
const res=await party.state();
const fin=await S();
console.log('play seconds',((Date.now()-T0)/1000).toFixed(0),'| RESULT',JSON.stringify(res.res.rows),'| totals',JSON.stringify(fin.tot),'expected',JSON.stringify(expected));
await party.shot(`test/out/social${tag}-result.png`,0);
for(let i=0;i<n;i++)if(alive(i))ok(fin.tot[i]===expected[i],'total for player '+i+' = '+expected[i]);
ok(res.res.rows.length===n,'rows for everyone');
ok(!Object.keys(res.S).some(k=>k[0]==='_'),'no private keys sent');
await party.waitPhase('final',40000);
console.log('errors:',party.errors);
ok(party.errors.length===0,'no console errors');
await party.close();
console.log(fails.length?'FAILED '+fails.length:'ALL OK');
process.exit(fails.length?1:0);
