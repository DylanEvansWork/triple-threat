// Defuse Together: (1) brute-force the generator over thousands of seeds, solving ONLY from what the manual pages say,
// (2) browser e2e where bots solve each module from the players' real private data via the real UI.
// usage: node test/defuse.mjs [n=3] [mode: win|strike|boom|leave]
import {launchParty,sleep} from './harness.mjs';
import fs from 'fs';
import assert from 'assert';
const n=+process.argv[2]||3, mode=process.argv[3]||'win';

// ---------- load generator in node ----------
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const GAMES={};new Function('GAMES','mulberry',fs.readFileSync('games/defuse.js','utf8'))(GAMES,mulberry);
const D=GAMES.defuse;

// ---------- a "human" solver: uses ONLY the manual page data + the bomb view ----------
const lastWord=s=>s.trim().split(/\s+/).pop();
function solveFromPages(kind,bomb,pA,pB){
  if(kind==='wires'){
    const live={};for(const [l,r] of pA.secs[0].rows)live[lastWord(l)]=r.split('+').map(lastWord);
    const cnt={};for(const [l,r] of pB.secs[0].rows)cnt[parseInt(l)]=+r.match(/(\d)(?:st|nd|rd)/)[1];
    const dirOf=lab=>pB.secs[1].rows.find(x=>x[0].includes(lab))[1].match(/count from the (TOP|BOTTOM)/)[1];
    const dir=(+bomb.serial.slice(-1))%2?dirOf('ODD'):dirOf('EVEN');
    const lv=[];bomb.cols.forEach((c,i)=>{if(live[bomb.led].includes(c))lv.push(i);});
    const ord=dir==='TOP'?lv:lv.slice().reverse();
    return{i:ord[Math.min(cnt[bomb.cols.length],ord.length)-1],nLive:lv.length};
  }
  if(kind==='button'){
    const st=pA.secs[0].rows,l1=st[0][0].match(/says (\w+)/)[1],m1=lastWord(st[0][1]),l2=st[1][0].match(/says (\w+)/)[1],m2=lastWord(st[1][1]);
    const colm={};for(const [l,r] of pA.secs[1].rows)colm[lastWord(l)]=lastWord(r);
    const mode=bomb.label===l1?m1:bomb.label===l2?m2:colm[bomb.col];
    let Dg;for(const [l,r] of pB.secs[0].rows)if(lastWord(l)===bomb.strip)Dg=+lastWord(r);
    return{mode,D:Dg};
  }
  const cols=pA.secs[0].cols,hits=cols.filter(c=>bomb.pad.filter(s=>c.includes(s)).length>=4);
  const down=pB.secs[0].rows.find(x=>lastWord(x[0])===bomb.badge)[1].includes('TOP first');
  if(hits.length!==1)return{err:'columns with >=4 pad symbols: '+hits.length};
  let seq=hits[0].filter(s=>bomb.pad.includes(s));if(!down)seq.reverse();
  return{seq,nCols:hits.length};
}

// ---------- 1. brute force the generator ----------
{
  const N=6000;let infoWires=0,holdN=0,tapN=0,stats={live2:0};
  const orders=new Set(),offs=new Set();
  for(let seed=1;seed<=N;seed++){
    const g=D._gen(seed*7919+13);
    assert.deepStrictEqual([...g.order].sort(),['button','symbols','wires']);orders.add(g.order.join());offs.add(g.off);
    const pg=k=>[D._page(g.rules,k,'A'),D._page(g.rules,k,'B')];
    // wires
    {const {b,a}=g.mods.wires,[pA,pB]=pg('wires'),s=solveFromPages('wires',b,pA,pB);
      assert(s.i===a.i,`seed ${seed}: wires solver ${s.i} != gen ${a.i}`);assert(s.nLive>=1&&b.cols[s.i]!==undefined,'wires unsolvable');
      assert(b.cols.length>=4&&b.cols.length<=6);assert(/^[A-Z0-9]{4}[2-9]$/.test(b.serial),'serial '+b.serial);
      // cutting any other wire must be wrong; the answer wire must be live
      assert(g.rules.wires.live[b.led].includes(b.cols[a.i]),'answer wire not live');
      if(s.nLive>=2&&s.nLive<b.cols.length)infoWires++;
    }
    // button
    {const {b,a}=g.mods.button,[pA,pB]=pg('button'),s=solveFromPages('button',b,pA,pB);
      assert(s.mode===a.mode&&s.D===a.D,`seed ${seed}: button solver ${JSON.stringify(s)} != ${JSON.stringify(a)}`);assert(a.D>=1&&a.D<=5);
      a.mode==='HOLD'?holdN++:tapN++;
      const modes=new Set(Object.values(g.rules.button.col));assert(modes.size===2,'colour table should use both modes');
    }
    // symbols
    {const {b,a}=g.mods.symbols,[pA,pB]=pg('symbols'),s=solveFromPages('symbols',b,pA,pB);
      assert(!s.err,`seed ${seed}: ${s.err}`);assert.deepStrictEqual(s.seq,a.seq,`seed ${seed}: symbol seq mismatch`);
      assert(new Set(b.pad).size===9,'pad has duplicates');assert(s.seq.length===4&&s.seq.every(x=>b.pad.includes(x)));
      for(const col of g.rules.symbols.cols)assert(col.length===7&&new Set(col).size===7);
    }
    // determinism
    if(seed%500===0)assert.deepStrictEqual(JSON.stringify(D._gen(seed*7919+13)),JSON.stringify(g),'generator not deterministic');
  }
  console.log(`generator OK over ${N} seeds | informative wire puzzles ${(infoWires/N*100).toFixed(1)}% | button HOLD ${(holdN/N*100).toFixed(0)}% TAP ${(tapN/N*100).toFixed(0)}% | module orders seen ${orders.size}/6, offsets ${[...offs].sort()}`);
  assert(infoWires/N>.9,'too many degenerate wire puzzles');assert(holdN/N>.25&&tapN/N>.25,'button mode imbalance');assert(orders.size===6);
}
if(process.argv[4]==='unit'){process.exit(0);}

// ---------- 2. e2e ----------
const tag=`defuse-${n}-${mode}`,out=f=>`test/out/${tag}-${f}.png`;
const party=await launchParty({n,only:'defuse',rounds:5});
const {pages,host}=party;
const alive=pages.map(()=>true);
const snap=()=>host.evaluate(()=>H&&H.S&&H.ph==='play'?{st:H.S.st,mi:H.S.mi,ro:H.S.ro,left:H.S.left,k:H.S.k,fl:H.S.fl,mods:H.S.mods,rv:H.S.rv,t:H.S.t,over:H.S.over,kind:H.S.mods[H.S.mi]&&H.S.mods[H.S.mi].k,bs:H.S._bs,ans:H.S._ans}:null);
await party.start();await party.waitPhase('play');
for(const p of pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dfs'));

// public-state leak check
{const st=await party.state();assert(!Object.keys(st.S).some(k=>k[0]==='_'),'private keys in public state');
 const js=JSON.stringify(st.S);assert(!/"ans"|serial|"pad"|"cols"/.test(js),'bomb data in public S');}

let s=await snap();
while(!s||s.st!=='brief'){await sleep(100);s=await snap();}
await sleep(500);
// role cards
for(let i=0;i<n;i++)await party.shot(out('brief-'+party.names[i]),i);
const roles=await Promise.all(pages.map(p=>p.evaluate(()=>R.priv&&R.priv.role)));
console.log('module 1 roles',JSON.stringify(roles));
assert.strictEqual(roles.filter(r=>r==='D').length,1);
if(n>=3){assert(roles.includes('A')&&roles.includes('B'));}
if(n===2){assert(roles.includes('A'));}
if(n===4)assert(roles.includes('S'));
// secrecy: only the defuser has the bomb, only manual holders have manuals
for(let i=0;i<n;i++){const r=await pages[i].evaluate(()=>({bomb:!!(R.priv&&R.priv.bomb),man:!!(R.priv&&R.priv.man),role:R.priv.role}));
  if(r.role==='A'||r.role==='B')assert(r.man&&!r.bomb,'manual holder must not see bomb');
  if(r.role==='D')assert(r.bomb,'defuser needs bomb');
  if(n>2&&r.role==='D')assert(!r.man,'defuser must not hold manual with 3+ players');}

const doneMods=new Set(),shots={};
async function privs(sn){
  const d=sn.ro.d,get=i=>pages[i].evaluate(()=>R.priv);
  const pd=await get(d),pa=await get(sn.ro.a),pb=sn.ro.b===d?pd:await get(sn.ro.b);
  return{bomb:pd.bomb,pA:pa.man,pB:pb.man,pd};
}
const clickEl=async(i,sel,idx)=>pages[i].evaluate(([s,k])=>document.querySelectorAll(s)[k].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})),[sel,idx]);
const clickCut=i=>pages[i].evaluate(()=>document.querySelector('.cutb').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})));
async function strikeOnce(sn,pv,sol){
  const d=sn.ro.d,before=await snap();
  if(sn.kind==='wires'){const bad=pv.bomb.cols.map((_,i)=>i).find(i=>i!==sol.i);await clickEl(d,'.dfs .wire',bad);await clickCut(d);}
  else if(sn.kind==='symbols'){const bad=pv.bomb.pad.findIndex(x=>!sol.seq.includes(x));await clickEl(d,'.dfs .sym',bad);}
  else{const bb=await pages[d].locator('.bigb').boundingBox(),cx=bb.x+bb.width/2,cy=bb.y+bb.height/2;
    await pages[d].mouse.move(cx,cy);await pages[d].mouse.down();await sleep(sol.mode==='TAP'?1300:150);await pages[d].mouse.up();}
  await sleep(120);
  await party.shot(out('strike-flash-defuser'),d);
  const after=await snap();
  assert.strictEqual(after.k,before.k+1,'strike not counted');assert(before.left-after.left>=11.5,'strike did not cost ~12s: '+before.left+' -> '+after.left);
  console.log(`  strike OK: clock ${before.left.toFixed(1)} -> ${after.left.toFixed(1)}`);
}
async function solveModule(sn){
  const pv=await privs(sn),kind=sn.kind,d=sn.ro.d;
  const sol=solveFromPages(kind,pv.bomb,pv.pA,pv.pB);
  assert(!sol.err,sol.err);
  // the host's truth must agree with what humans derive from the manuals
  if(kind==='wires')assert.strictEqual(sol.i,sn.ans.i);
  if(kind==='button')assert.deepStrictEqual({mode:sol.mode,D:sol.D},{mode:sn.ans.mode,D:sn.ans.D});
  if(kind==='symbols')assert.deepStrictEqual(sol.seq,sn.ans.seq);
  console.log(`module ${sn.mi+1} ${kind}: defuser ${party.names[d]} A=${party.names[sn.ro.a]} B=${party.names[sn.ro.b]}${sn.ro.s!=null?' S='+party.names[sn.ro.s]:''} solution ${JSON.stringify(sol)}`);
  // screenshots of each role this module (first module in detail)
  if(!shots[kind]){shots[kind]=1;
    await sleep(300);
    await party.shot(out(kind+'-defuser'),d);await party.shot(out(kind+'-manA'),sn.ro.a);
    if(sn.ro.b!==d)await party.shot(out(kind+'-manB'),sn.ro.b);
    if(sn.ro.s!=null)await party.shot(out(kind+'-spotter'),sn.ro.s);
  }
  if(mode==='strike'&&sn.mi===0)await strikeOnce(sn,pv,sol);
  const P=pages[d];
  if(kind==='wires'){await clickEl(d,'.dfs .wire',sol.i);await sleep(150);if(sn.mi===0)await party.shot(out('wires-selected'),d);await clickCut(d);}
  else if(kind==='symbols'){for(const sym of sol.seq){const idx=pv.bomb.pad.indexOf(sym);await clickEl(d,'.dfs .sym',idx);await sleep(250);}}
  else{
    const bb=await P.locator('.bigb').boundingBox(),cx=bb.x+bb.width/2,cy=bb.y+bb.height/2;
    await P.mouse.move(cx,cy);
    if(sol.mode==='TAP'){for(let k=0;k<sol.D;k++){await P.mouse.down();await sleep(70);await P.mouse.up();await sleep(160);}}
    else{
      await P.mouse.down();await sleep(700);
      const t0=Date.now();if(sn.mi===0||!shots.hold){shots.hold=1;await party.shot(out('button-holding'),d);}
      for(;;){const l=await host.evaluate(()=>H.S.left);if(Math.ceil(l)%10===sol.D)break;if(Date.now()-t0>13000)throw new Error('never saw digit');await sleep(30);}
      await P.mouse.up();
    }
  }
}
const t0=Date.now();
let closed=false;
for(;;){
  const ph=await host.evaluate(()=>R&&R.ph);if(ph!=='play')break;
  s=await snap();if(!s){await sleep(100);continue;}
  if(mode==='boom'&&s.st==='play'){await party.shot(out('before-boom'),0);await host.evaluate(()=>{H.S.left=2.2;});await sleep(2600);await party.shot(out('boom'),1);await party.shot(out('boom-host'),0);break;}
  if(s.st==='won'){await sleep(700);await party.shot(out('won-defuser'),s.ro.d>=0&&alive[s.ro.d]?s.ro.d:0);await party.shot(out('won-other'),alive[1]?1:0);break;}
  if(s.st==='play'&&!doneMods.has(s.mi)){
    if(mode==='leave'&&!closed&&s.mi===0){
      closed=true;const x=[...Array(n).keys()].find(i=>i>0&&i!==s.ro.d);
      await pages[x].evaluate(()=>{lostHost=()=>{};peer.destroy();});await sleep(100);await pages[x].close();alive[x]=false;
      console.log('  closed page of',party.names[x],'(not the host, not the defuser) mid-module');
      await sleep(1500);s=await snap();
      if(n===2){console.log('  n=2: expecting boom/end after player left');break;}
      assert(s.rv>=1,'roles should have been reshuffled');
      await party.shot(out('after-leave-card'),s.ro.d);
    }
    doneMods.add(s.mi);
    const mi=s.mi;await solveModule(s);
    // wait for the module to register as solved
    for(let k=0;k<60;k++){const q=await snap();if(!q||q.mi!==mi||q.st==='won')break;await sleep(100);}
  }
  if(Date.now()-t0>110000)throw new Error('timeout '+JSON.stringify(s,(k,v)=>k==='bs'||k==='ans'?undefined:v));
  await sleep(100);
}
// final screens (still in play during the hold)
await party.waitPhase('result',30000);
await sleep(200);
const st=await party.state();
await party.shot(out('result'),0);
const rows=st.res.rows;
console.log('RESULT',JSON.stringify(rows),'elapsed',((Date.now()-t0)/1000).toFixed(0)+'s');
assert.strictEqual(rows.length,n);
if(mode==='boom'||(mode==='leave'&&n===2)){
  assert(rows.every(r=>r.pts===0&&r.rank===1&&r.label==='BOOM 💥'),'boom rows wrong');
}else{
  assert(rows.every(r=>r.pts===n&&r.rank===0&&/^Defused in \d+s! 🎉$/.test(r.label)),'win rows wrong: everybody should get '+n);
  if(mode==='strike')assert.strictEqual(st.S.k,1);
}
assert(st.S.over,'round should end through S.over');
console.log('final S:',JSON.stringify({st:st.S.st,left:st.S.left,k:st.S.k,fin:st.S.fin}));
console.log('errors:',party.errors);
assert.strictEqual(party.errors.length,0);
await party.close();
console.log('PASS',tag);
