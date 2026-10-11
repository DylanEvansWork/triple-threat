// Defuse Together stress test. usage: node test/defuse-stress.mjs <n=3> <mode>
// modes: fuzz (garbage act messages + spam + random/idle/smart defusers) | lat (150-300ms latency, one worse; clocks + hold-release must stay consistent)
//        reload (reload manual holder / defuser / spotter mid-module with the same ?key) | multi (5 consecutive rounds, 4x warp, mixed bots) | screens
import {launchParty,sleep} from './harness.mjs';
import {addLatency,warp,fuzz,sizeSample,rint,chance} from './stressutil.mjs';
import assert from 'assert';
const n=+process.argv[2]||3, mode=process.argv[3]||'fuzz';
const tag=`defusestress-${n}-${mode}`,out=f=>`test/out/${tag}-${f}.png`;
const rounds=mode==='multi'?5:1;
const vp=mode==='screens'?JSON.parse(process.argv[4]||'{"width":390,"height":844}'):undefined;
const party=await launchParty({n,only:Array(rounds).fill('defuse').join(','),rounds:5,viewport:vp});
const {pages,host}=party;
const alive=pages.map(()=>true);

// ---- human-style solver from manual pages only (same logic as test/defuse.mjs) ----
const lastWord=s=>s.trim().split(/\s+/).pop();
function solve(kind,bomb,pA,pB){
  if(kind==='wires'){
    const live={};for(const [l,r] of pA.secs[0].rows)live[lastWord(l)]=r.split('+').map(lastWord);
    const cnt={};for(const [l,r] of pB.secs[0].rows)cnt[parseInt(l)]=+r.match(/(\d)(?:st|nd|rd)/)[1];
    const dirOf=lab=>pB.secs[1].rows.find(x=>x[0].includes(lab))[1].match(/count from the (TOP|BOTTOM)/)[1];
    const dir=(+bomb.serial.slice(-1))%2?dirOf('ODD'):dirOf('EVEN');
    const lv=[];bomb.cols.forEach((c,i)=>{if(live[bomb.led].includes(c))lv.push(i);});
    const ord=dir==='TOP'?lv:lv.slice().reverse();return{i:ord[Math.min(cnt[bomb.cols.length],ord.length)-1]};
  }
  if(kind==='button'){
    const st=pA.secs[0].rows,l1=st[0][0].match(/says (\w+)/)[1],m1=lastWord(st[0][1]),l2=st[1][0].match(/says (\w+)/)[1],m2=lastWord(st[1][1]);
    const colm={};for(const [l,r] of pA.secs[1].rows)colm[lastWord(l)]=lastWord(r);
    const mode=bomb.label===l1?m1:bomb.label===l2?m2:colm[bomb.col];let D;for(const [l,r] of pB.secs[0].rows)if(lastWord(l)===bomb.strip)D=+lastWord(r);return{mode,D};
  }
  const cols=pA.secs[0].cols,hit=cols.find(c=>bomb.pad.filter(s=>c.includes(s)).length>=4);
  const down=pB.secs[0].rows.find(x=>lastWord(x[0])===bomb.badge)[1].includes('TOP first');
  let seq=hit.filter(s=>bomb.pad.includes(s));if(!down)seq.reverse();return{seq};
}

// ---- page toolkit ----
const TOOLKIT=()=>{window.__b={
  pd(sel,k){const e=document.querySelectorAll(sel)[k];if(e)e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));},
  btnEv(type){const b=document.querySelector('.bigb');if(b)b.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1}));},
  secs(){const t=document.querySelector('.tm');if(!t)return -1;const m=t.textContent.split(':');return +m[0]*60+ +m[1];}
};};
for(const p of pages)await p.evaluate(TOOLKIT);
const ev=async(i,f,...a)=>{if(!alive[i])return null;try{return await pages[i].evaluate(f,...a);}catch(e){return null;}};
const snap=()=>host.evaluate(()=>H&&H.S&&H.ph==='play'?{rn:H.rn,st:H.S.st,mi:H.S.mi,ro:H.S.ro,left:H.S.left,k:H.S.k,rv:H.S.rv,t:H.S.t,over:H.S.over,kind:H.S.mods[H.S.mi]&&H.S.mods[H.S.mi].k,ans:H.S._ans,bs:H.S._bs}:null).catch(()=>null);

async function smartSolve(s){
  const d=s.ro.d,get=i=>ev(i,()=>R.priv);
  const pd=await get(d),pa=await get(s.ro.a),pb=s.ro.b===d?pd:await get(s.ro.b);
  if(!pd||!pd.bomb||!pa||!pa.man||!(pb&&pb.man))return false;
  const sol=solve(s.kind,pd.bomb,pa.man,pb.man);
  if(s.kind==='wires'){await ev(d,i=>{__b.pd('.dfs .wire',i);},sol.i);await sleep(60);await ev(d,()=>__b.pd('.cutb',0));}
  else if(s.kind==='symbols'){for(const sym of sol.seq){await ev(d,i=>__b.pd('.dfs .sym',i),pd.bomb.pad.indexOf(sym));await sleep(120);}}
  else if(sol.mode==='TAP'){for(let k=0;k<sol.D;k++){await ev(d,()=>__b.btnEv('pointerdown'));await sleep(60);await ev(d,()=>__b.btnEv('pointerup'));await sleep(140);}}
  else{
    await ev(d,()=>__b.btnEv('pointerdown'));await sleep(700);const t0=Date.now();
    for(;;){const sec=await ev(d,()=>__b.secs());if(sec>=0&&sec%10===sol.D)break;if(Date.now()-t0>14000)break;await sleep(25);}   // release on the digit the DEFUSER'S OWN SCREEN shows
    await ev(d,()=>__b.btnEv('pointerup'));console.log('  HOLD D='+sol.D+' waited '+((Date.now()-t0)/1000).toFixed(1)+'s');
  }
  return true;
}
async function dumbAct(s){
  const d=s.ro.d,r=Math.random();
  if(s.kind==='wires'){await ev(d,i=>{__b.pd('.dfs .wire',i);__b.pd('.cutb',0);},rint(0,5));}
  else if(s.kind==='symbols'){await ev(d,i=>__b.pd('.dfs .sym',i),rint(0,8));}
  else{await ev(d,()=>__b.btnEv('pointerdown'));await sleep(r<.5?60:rint(300,1500));await ev(d,()=>__b.btnEv('pointerup'));}
}

await host.evaluate(()=>{window.__res={};setInterval(()=>{if(R&&R.ph==='result'&&R.res&&!window.__res[R.rn])window.__res[R.rn]={rn:R.rn,rows:R.res.rows,st:R.S.st,k:R.S.k,fin:R.S.fin,left:R.S.left,t:R.S.t,over:R.S.over,ev:R.S.ev.map(e=>e.tx)};},40);});
if(mode==='lat'){const base=[0,150,220,300].slice(0,n);await addLatency(party,base);console.log('latency one-way ms',base);}
if(mode==='multi')await warp(party,4);
await party.start();await party.waitPhase('play');
for(const p of pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dfs'));

const plan={},solvedKey=new Set();let lastFuzz=0,payload={max:0,sum:0,cnt:0},skewMax=0;
const planFor=rn=>plan[rn]||(plan[rn]=mode==='multi'?['smart','dumb','idle','smart','smart'][rn-1]??'smart':(mode==='fuzz'?'dumb':'smart'));
async function step(){
  const s=await snap();if(!s)return;
  const sz=await sizeSample(party);if(sz)for(const k in sz){payload.max=Math.max(payload.max,sz[k]);payload.sum+=sz[k];payload.cnt++;}
  if(s.st==='play'){
    const pl=planFor(s.rn),key=s.rn+'/'+s.mi+'/'+s.rv+'/'+s.k;
    // non-defusers spam pings
    for(let i=0;i<n;i++)if(i!==s.ro.d&&chance(.15))await ev(i,()=>__b.pd('.ping',0));
    if(pl==='smart'&&!solvedKey.has(key)){solvedKey.add(key);await sleep(250);const q=await snap();if(q&&q.st==='play'&&q.mi===s.mi)await smartSolve(q);}
    else if(pl==='dumb'&&chance(.25))await dumbAct(s);
    if(mode==='lat'&&chance(.3)){const secs=await Promise.all(pages.map((_,i)=>ev(i,()=>__b.secs())));const v=secs.filter(x=>x!=null&&x>=0);if(v.length>1){skewMax=Math.max(skewMax,Math.max(...v)-Math.min(...v));}}
  }
  if((mode==='fuzz'||mode==='multi')&&Date.now()-lastFuzz>1200){lastFuzz=Date.now();await fuzz(party,200,['cut','sym','bd','bu','ping','nope',undefined]);}
}
async function loop(until){
  const t0=Date.now();
  for(;;){const ph=await host.evaluate(()=>R&&R.ph);if(ph===until||ph==='final')break;await step();
    if(Date.now()-t0>280000)throw new Error('stress loop timeout '+JSON.stringify(await snap(),(k,v)=>k==='bs'||k==='ans'?undefined:v));await sleep(100);}
}
async function rejoin(i){
  await pages[i].reload({waitUntil:'load'});await pages[i].fill('#name',party.names[i]);await pages[i].fill('#code',party.code);await pages[i].click('#join');
  await pages[i].waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.dfs'),null,{timeout:15000});await pages[i].evaluate(TOOLKIT);
}

if(mode==='reload'){
  assert(n>=3);
  let s;for(;;){s=await snap();if(s&&s.st==='play')break;await sleep(100);}
  const roleOf=async i=>ev(i,()=>R.priv&&{role:R.priv.role,man:!!R.priv.man,bomb:!!R.priv.bomb,mi:R.priv.mi});
  const targets=[s.ro.a,s.ro.b,s.ro.s,s.ro.d].filter(x=>x!=null&&x!==0);
  for(const t of [...new Set(targets)]){
    const before=await roleOf(t);console.log('reloading',party.names[t],JSON.stringify(before));await rejoin(t);await sleep(800);
    const after=await roleOf(t);assert.deepStrictEqual(after,before,'private role state not restored after reload');
    const dom=await ev(t,()=>({man:!!document.querySelector('.dfs-man'),bomb:!!document.querySelector('.dfs-bomb'),tm:document.querySelector('.tm').textContent}));
    if(before.man)assert(dom.man,'manual not rendered after reload');if(before.bomb)assert(dom.bomb,'bomb not rendered after reload');
    console.log('  restored:',JSON.stringify(after),dom.tm);
    await party.shot(out('after-reload-'+party.names[t]),t);
  }
  assert.strictEqual((await snap()).ro.d,s.ro.d,'roles must not change just because someone reloaded');
  planFor(1);plan[1]='smart';
}
if(mode==='screens'){
  let s;for(;;){s=await snap();if(s&&s.st==='play')break;await sleep(100);}
  for(let i=0;i<n;i++){
    const m=await ev(i,()=>{const w=innerWidth,h=innerHeight,bad=[];document.querySelectorAll('.dfs > *').forEach(e=>{const r=e.getBoundingClientRect();if(getComputedStyle(e).display==='none'||e.classList.contains('dfs-ov')||e.classList.contains('dfs-flash')||e.classList.contains('dfs-ping'))return;if(r.right>w+1||r.left<-1||r.bottom>h+1)bad.push(e.className+JSON.stringify([r.left,r.right,r.bottom].map(Math.round)));});
      const man=document.querySelector('.dfs-man'),b=document.querySelector('.dfs-bomb'),bb=b&&b.getBoundingClientRect();
      return{w,h,bad,sx:document.documentElement.scrollWidth>w,sy:document.documentElement.scrollHeight>h,manScroll:man?man.scrollHeight>man.clientHeight:null,bombH:bb&&Math.round(bb.height),bombOverflow:b?b.scrollHeight>b.clientHeight+2:null};});
    console.log(`viewport ${m.w}x${m.h} page ${i}: ${JSON.stringify(m)}`);
    assert.deepStrictEqual(m.bad,[],'layout overflow');assert(!m.sx&&!m.sy,'page scrolls');assert(!m.bombOverflow,'bomb panel content clipped');
    await party.shot(out('play-'+party.names[i]),i);
  }
}

await loop(mode==='multi'?'final':'result');
await party.waitPhase(mode==='multi'?'final':'result',60000).catch(()=>{});await sleep(300);
const res=Object.values(await host.evaluate(()=>window.__res));
for(const r of res){
  const won=r.st==='won';
  assert(r.rows.length===n);
  if(won)assert(r.rows.every(x=>x.pts===n&&x.rank===0&&/^Defused in \d+s! 🎉$/.test(x.label)),'win rows');
  else assert(r.rows.every(x=>x.pts===0&&x.rank===1&&x.label==='BOOM 💥'),'boom rows '+JSON.stringify(r));
  assert(r.over&&r.t<=125+4,'round too long '+r.t);
  console.log(`round ${r.rn}: plan=${plan[r.rn]} ${won?'DEFUSED in '+r.fin+'s':'BOOM'} strikes=${r.k} ${r.k?JSON.stringify(r.ev.filter(x=>/WRONG|wrong|Too|Only|Held|Tapped/.test(x))):''} play-time ${r.t.toFixed(0)}s`);
}
if(mode==='multi')assert.strictEqual(res.length,5,'5 consecutive rounds expected');
if(mode==='lat'){console.log('max clock skew between phones (s):',skewMax);assert(skewMax<=2,'clocks drifted apart');assert(res[0].st==='won'&&res[0].k===0,'with latency a perfect team should still win without strikes (hold-release comp.), got strikes '+res[0].k);}
if(mode==='reload')assert(res[0].st==='won','should still win after reloads');
console.log(`broadcast payload bytes per player: max ${payload.max}, avg ${(payload.sum/Math.max(1,payload.cnt)).toFixed(0)}`);
console.log('errors:',party.errors);assert.strictEqual(party.errors.length,0);
await party.close();console.log('PASS',tag);
