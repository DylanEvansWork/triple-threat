// Draw & Guess stress test. usage: node test/draw-stress.mjs <n=3> <mode>
// modes: fuzz (garbage + HTML + spam + flood + multitouch while random bots play) | lat (150-300ms latency, one player worse)
//        reload (page reload mid-turn with same ?key) | drop (connection drop + auto rejoin) | multi (5 full rounds, random bots, 4x time warp)
//        screens (320x568, 430x932, 390x520 keyboard-short) | size (broadcast payload sizes)
import {launchParty,sleep} from './harness.mjs';
import {addLatency,warp,fuzz,sizeSample,rint,chance} from './stressutil.mjs';
import assert from 'assert';
const n=+process.argv[2]||3, mode=process.argv[3]||'fuzz';
const tag=`drawstress-${n}-${mode}`,out=f=>`test/out/${tag}-${f}.png`;
const rounds=mode==='multi'?5:1;
const vp=mode==='screens'?JSON.parse(process.argv[4]||'{"width":390,"height":844}'):undefined;
const party=await launchParty({n,only:Array(rounds).fill('draw').join(','),rounds:5,viewport:vp});
const {pages,host}=party;
const alive=pages.map(()=>true);
const FUZZKEYS=['pick','pts','undo','clear','sync','g','nope',undefined,'__proto__'];

// ---- page-side bot toolkit ----
const TOOLKIT=()=>{
  window.__bot={
    cv(){return document.querySelector('.drw-cvw canvas');},
    ev(type,id,x,y){const cv=this.cv();if(cv)cv.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,clientX:x,clientY:y,isPrimary:id===1}));},
    stroke(len,second){const cv=this.cv();if(!cv)return;const r=cv.getBoundingClientRect();let x=r.x+Math.random()*r.width,y=r.y+Math.random()*r.height;
      this.ev('pointerdown',1,x,y);for(let k=0;k<len;k++){x=Math.max(r.x,Math.min(r.right,x+(Math.random()-.5)*60));y=Math.max(r.y,Math.min(r.bottom,y+(Math.random()-.5)*60));this.ev('pointermove',1,x,y);
        if(second&&k===3){this.ev('pointerdown',2,x+20,y+20);this.ev('pointermove',2,x+40,y+40);}if(second&&k===6)this.ev('pointerup',2,x,y);}
      this.ev('pointerup',1,x,y);},
    dbl(){const cv=this.cv();if(!cv)return;const r=cv.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;for(let i=0;i<4;i++){this.ev('pointerdown',1,x,y);this.ev('pointerup',1,x,y);}},
    btn(sel,k){const b=document.querySelectorAll(sel)[k];if(b)b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));},
    flood(){for(let i=0;i<600;i++)this.stroke(20);},
    guess(t){const f=document.querySelector('.drw-form'),i=document.querySelector('.drw-form input');if(!f||f.style.display==='none')return false;i.value=t;f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));return true;},
    pick(){const b=document.querySelectorAll('.drw-pk button');if(b.length)b[Math.floor(Math.random()*b.length)].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));},
    sig(){const cv=this.cv(),o=document.createElement('canvas');o.width=40;o.height=50;const g=o.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,40,50);g.drawImage(cv,0,0,40,50);const d=g.getImageData(0,0,40,50).data,a=[];for(let k=0;k<d.length;k+=4)a.push(d[k]+d[k+1]+d[k+2]<690?1:0);return a;}
  };
};
for(const p of pages)await p.evaluate(TOOLKIT);
const ev=async(i,f,...a)=>{if(!alive[i])return null;try{return await pages[i].evaluate(f,...a);}catch(e){return null;}};
const hs=()=>host.evaluate(()=>H&&H.S&&H.ph==='play'?{rn:H.rn,st:H.S.st,tn:H.S.tn,dr:H.S.dr,word:H.S._word&&H.S._word.w,t:H.S.t,pe:H.S.pe,ds:H.S.ds,dl:H.S.dl,rv:H.S.rv,pc:H.S.pc,ns:H.S._strokes.length,over:H.S.over,got:H.S.got}:null).catch(()=>null);
const sig=async i=>ev(i,()=>__bot.sig());
const diff=(a,b)=>{let d=0;for(let k=0;k<a.length;k++)if(a[k]!==b[k])d++;return d/a.length;};

if(mode==='lat'){const base=[0,150,220,300].slice(0,n);await addLatency(party,base);console.log('latency one-way ms per player',base);}
await warpMaybe();
async function warpMaybe(){if(mode==='multi')await warp(party,4);}

await party.start();await party.waitPhase('play');
for(const p of pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.drw'));

await host.evaluate(()=>{window.__res={};window.__rv={};setInterval(()=>{if(R&&R.ph==='result'&&R.res&&!window.__res[R.rn])window.__res[R.rn]={rn:R.rn,rows:R.res.rows,pts:Object.assign({},R.S.pts),t:R.S.t,nt:R.S.nt};
  if(H&&H.S&&H.ph==='play'&&H.S.st==='reveal'&&H.S.rv)window.__rv[H.rn+'/'+H.S.tn]={rn:H.rn,dr:H.S.dr,rv:JSON.parse(JSON.stringify(H.S.rv))};},40);});
// ---- random-bot engine ----
const expected={},results=[],seenReveal=new Set(),plan={};
let stop=false,pwnChecks=0,lastFuzz=0,sizes=[],payload={max:0,sum:0,cnt:0},evBytes=0;
const turnPlan=(rn,tn,s)=>{const k=rn+'/'+tn;if(!plan[k])plan[k]={idleDrawer:chance(.15),idleAll:chance(.1),flooded:false,guessAt:{}};return plan[k];};
async function botStep(){
  const s=await hs();if(!s)return;
  if(s.st==='reveal')return;
  const P=turnPlan(s.rn,s.tn,s);
  if(s.st==='pick'){if(!P.idleDrawer&&chance(.12))await ev(s.dr,()=>__bot.pick());return;}
  if(s.st!=='draw')return;
  const el=s.t-s.ds;
  if(!P.idleDrawer){
    if(chance(.45))await ev(s.dr,()=>__bot.stroke(8+Math.floor(Math.random()*25),Math.random()<.15));
    if(chance(.04))await ev(s.dr,()=>__bot.dbl());
    if(chance(.05))await ev(s.dr,()=>__bot.btn('.drw-row:not(.cols) button',3));          // undo
    if(chance(.015))await ev(s.dr,()=>__bot.btn('.drw-row:not(.cols) button',4));         // clear
    if(chance(.12))await ev(s.dr,([a,b])=>{__bot.btn('.drw-row.cols button',a);__bot.btn('.drw-row:not(.cols) button',b);},[rint(0,4),rint(0,2)]);
    if(!P.flooded&&(mode==='fuzz'||mode==='multi')&&chance(.03)){P.flooded=true;await ev(s.dr,()=>__bot.flood());}
  }
  for(let i=0;i<n;i++){
    if(i===s.dr||!alive[i]||P.idleAll)continue;
    const r=Math.random();
    if(r<.1)await ev(i,t=>__bot.guess(t),['banana','zzz','ab','x'.repeat(rint(1,60)),'<img src=x onerror=window.__pwn=1>','<b>'+'q'.repeat(300)+'</b>','"; drop table--','🐱🍕🔥','  ','a\nb','__proto__','{{7*7}}','é à ü ñ'][rint(0,12)]);
    else if(r<.14)await ev(i,()=>{for(let k=0;k<20;k++)__bot.guess('spam'+k);});
    else if(s.word){const at=(P.guessAt[i]??=chance(.75)?rint(3,28):9999);if(el>at){P.guessAt[i]=9999;const w=s.word,forms=[w,w.toUpperCase(),w+'s',' '+w+' ',w.slice(0,-1)+'x'];await ev(i,t=>__bot.guess(t),forms[rint(0,2)]);}}
  }
  if(mode==='fuzz'||mode==='multi'){if(Date.now()-lastFuzz>1500){lastFuzz=Date.now();await fuzz(party,200,FUZZKEYS);}}
}
async function checkPwn(){for(let i=0;i<n;i++){const r=await ev(i,()=>[window.__pwn,document.querySelectorAll('.drw img').length,document.querySelectorAll('.drw-chat b').length>=0]);if(r){assert(r[0]===undefined,'XSS executed on page '+i);assert.strictEqual(r[1],0,'injected <img> found on page '+i);}}}
let rnSeen=-1;
async function loop(untilPhase){
  const t0=Date.now();
  for(;;){
    const ph=await host.evaluate(()=>R&&R.ph);
    if(ph===untilPhase||ph==='final')break;
    await botStep();
    const sz=await sizeSample(party);if(sz){for(const k in sz){payload.max=Math.max(payload.max,sz[k]);payload.sum+=sz[k];payload.cnt++;}}
    if(Math.random()<.1)await checkPwn();
    if(Date.now()-t0>300000)throw new Error('stress loop timeout; state '+JSON.stringify(await hs()));
    await sleep(120);
  }
}

// ---- scripted helpers ----
async function rejoin(i){
  await pages[i].reload({waitUntil:'load'});
  await pages[i].fill('#name',party.names[i]);await pages[i].fill('#code',party.code);await pages[i].click('#join');
  await pages[i].waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.drw'),null,{timeout:15000});
  await pages[i].evaluate(TOOLKIT);
}
async function waitSt(st,rn=1,timeout=30000){const t0=Date.now();for(;;){const s=await hs();if(s&&s.st===st)return s;if(Date.now()-t0>timeout)throw new Error('no '+st);await sleep(100);}}

if(mode==='reload'||mode==='drop'){
  assert(n>=3,'needs 3+ players');
  let s=await waitSt('pick');const dr=s.dr,vw=[...Array(n).keys()].find(i=>i!==dr&&i!==0)??1,vw2=[...Array(n).keys()].find(i=>i!==dr&&i!==vw);
  await ev(dr,()=>__bot.pick());s=await waitSt('draw');
  for(let k=0;k<6;k++){await ev(dr,()=>__bot.stroke(15));await sleep(80);}
  await sleep(600);
  let a=await sig(dr),b=await sig(vw);assert(diff(a,b)<.06,'baseline mismatch');
  const ink0=a.reduce((x,y)=>x+y,0);
  if(mode==='reload'){
    console.log('reloading viewer',party.names[vw]);
    if(vw===0)throw new Error('cannot reload host');
    await rejoin(vw);await sleep(2600);
    b=await sig(vw);console.log(' viewer canvas diff after reload',diff(a,b).toFixed(3));assert(diff(a,b)<.06,'viewer did not resync strokes after reload');
    assert(await ev(vw,()=>!!document.querySelector('.drw-form')),'form missing');
    await ev(dr,()=>__bot.stroke(10));await sleep(500);
    // drawer reload: private word + tools + previous strokes must come back, new strokes must not collide with old
    if(dr!==0){
      console.log('reloading drawer',party.names[dr]);const word=(await hs()).word;
      await rejoin(dr);await sleep(2600);
      const pv=await ev(dr,()=>R.priv&&R.priv.word);assert.strictEqual(pv,word,'drawer lost private word after reload');
      assert(await ev(dr,()=>getComputedStyle(document.querySelector('.drw-tools')).display!=='none'),'tools missing after reload');
      a=await sig(dr);const h=await sig(0);console.log(' drawer canvas diff vs host-view after reload',diff(a,h).toFixed(3));assert(diff(a,h)<.06,'drawer canvas did not resync after reload');
      const before=(await hs()).ns;await ev(dr,()=>__bot.stroke(12));await ev(dr,()=>__bot.stroke(12));await sleep(600);
      const after=(await hs()).ns;assert(after===before+2,`new strokes after reload should append (sid collision?) ${before} -> ${after}`);
      a=await sig(dr);b=await sig(vw);assert(diff(a,b)<.06,'canvases differ after drawer reload+drawing');
    }
  }else{
    console.log('dropping connection of',party.names[vw]);
    await ev(vw,()=>{hostConn.close();});
    for(let k=0;k<3;k++){await ev(dr,()=>__bot.stroke(15));await sleep(200);}
    await sleep(500);
    const awNow=await host.evaluate(i=>H.players[i].aw,vw);console.log(' host sees away:',awNow);
    await pages[vw].waitForFunction(()=>!document.querySelector('#toast')||getComputedStyle(document.querySelector('#toast')).display==='none',null,{timeout:20000}).catch(()=>{});
    await sleep(4500);
    assert.strictEqual(await host.evaluate(i=>H.players[i].aw,vw),false,'player should be back');
    a=await sig(dr);b=await sig(vw);console.log(' viewer canvas diff after drop+rejoin',diff(a,b).toFixed(3));assert(diff(a,b)<.06,'viewer did not resync after rejoin');
  }
  // 2nd viewer got a wrong guess through while the other was reloading
  if(vw2!==undefined)assert(await ev(vw2,()=>__bot.guess('hello world')),'other viewer cannot guess');
  await sleep(400);
  await host.evaluate(()=>{H.S.pe=H.S.t+.2;});
  await loop('result');
}else if(mode==='lat'){
  let s=await waitSt('pick');await ev(s.dr,()=>__bot.pick());s=await waitSt('draw');await sleep(1500);
  // replication lag probe
  const viewers=[...Array(n).keys()].filter(i=>i!==s.dr);const lags=[];
  for(const v of viewers){const before=(await sig(v)).reduce((a,b)=>a+b,0);const t0=Date.now();await ev(s.dr,()=>__bot.stroke(25));
    for(;;){const now=(await sig(v)).reduce((a,b)=>a+b,0);if(now>before+8)break;if(Date.now()-t0>4000)throw new Error('stroke never arrived at '+v);await sleep(20);}
    lags.push(Date.now()-t0);}
  console.log('stroke replication lag (ms) to viewers',viewers.join(','),lags.join(','));assert(Math.max(...lags)<1500,'drawing too laggy');
  for(let k=0;k<10;k++){await ev(s.dr,()=>__bot.stroke(18));await sleep(100);}
  await sleep(2500);const a=await sig(s.dr);for(const v of viewers){const d=diff(a,await sig(v));console.log(' viewer',v,'diff',d.toFixed(3));assert(d<.06,'viewer out of sync under latency');}
  // guess round-trip: time from submit until chat shows it on another phone
  const g=viewers[0],o=viewers[1]??s.dr;const t0=Date.now();await ev(g,()=>__bot.guess('latencyprobe'));
  for(;;){const txt=await ev(o,()=>document.querySelector('.drw-chat').innerText);if(txt&&txt.includes('latencyprobe'))break;if(Date.now()-t0>4000)throw new Error('chat lag too big');await sleep(30);}
  console.log('guess -> other phone chat lag ms',Date.now()-t0);
  await loop('result');
}else if(mode==='screens'||mode==='size'||mode==='fuzz'||mode==='multi'){
  if(mode==='screens'){
    let s=await waitSt('pick');await sleep(300);const gu=[...Array(n).keys()].find(i=>i!==s.dr);
    await party.shot(out('pick-drawer'),s.dr);await party.shot(out('pick-guesser'),gu);
    await ev(s.dr,()=>__bot.pick());s=await waitSt('draw');
    for(let k=0;k<5;k++){await ev(s.dr,()=>__bot.stroke(20));await sleep(60);}
    await ev(gu,()=>__bot.guess('wrong guess one'));await ev(gu,()=>document.querySelector('.drw-form input').focus());await sleep(900);
    await party.shot(out('draw-drawer'),s.dr);await party.shot(out('draw-guesser'),gu);
    for(let i=0;i<n;i++){
      const m=await ev(i,()=>{const w=innerWidth,h=innerHeight,bad=[];document.querySelectorAll('.drw > *').forEach(e=>{const r=e.getBoundingClientRect();if(e.offsetParent===null&&getComputedStyle(e).display==='none')return;if(r.right>w+1||r.left<-1||r.bottom>h+1)bad.push(e.className+' '+JSON.stringify([r.left,r.right,r.bottom].map(Math.round)));});
        const c=document.querySelector('.drw-cvw canvas').getBoundingClientRect();return{w,h,bad,cv:[Math.round(c.width),Math.round(c.height)],sx:document.documentElement.scrollWidth>w,sy:document.documentElement.scrollHeight>h};});
      console.log(`viewport ${m.w}x${m.h} page ${i}: canvas ${m.cv} overflow:${JSON.stringify(m.bad)} scrollX:${m.sx} scrollY:${m.sy}`);
      assert.deepStrictEqual(m.bad,[],'layout overflow');assert(!m.sx&&!m.sy,'page scrolls');assert(m.cv[1]>=80,'canvas too small');
    }
    await ev(s.dr,()=>__bot.flood());
    await host.evaluate(()=>{H.S.pe=H.S.t+.2;});await waitSt('reveal');await sleep(500);await party.shot(out('reveal-guesser'),gu);
    await loop('result');
  }else{
    if(mode==='size'||mode==='fuzz'){await ev(1,()=>{window.__evBytes=0;const o=cur.event;cur.event=m=>{window.__evBytes+=JSON.stringify(m).length;return o(m);};});}
    await loop(mode==='multi'?'final':'result');
    if(mode!=='multi'){evBytes=(await ev(1,()=>window.__evBytes))||0;}
  }
}else throw new Error('unknown mode '+mode);

// ---- final assertions ----
await party.waitPhase(mode==='multi'?'final':'result',60000).catch(()=>{});await sleep(300);
{const cap=await host.evaluate(()=>({res:window.__res,rv:window.__rv}));for(const k in cap.res)results.push(cap.res[k]);
 for(const k in cap.rv){const {rn,dr,rv}=cap.rv[k];expected[rn]=expected[rn]||{};for(const x of rv.got)expected[rn][x.id]=(expected[rn][x.id]||0)+x.pt;expected[rn][dr]=(expected[rn][dr]||0)+rv.dp;}}
let totalTurns=0;
for(const r of results){
  const exp=expected[r.rn]||{};
  for(const p of Object.keys(r.pts)){assert(Number.isInteger(r.pts[p])&&r.pts[p]>=0&&r.pts[p]<=60,'insane pts '+r.pts[p]);
    if(mode!=='reload'&&mode!=='drop')assert.strictEqual(r.pts[p],exp[p]||0,`round ${r.rn} player ${p}: pts ${r.pts[p]} vs observed reveals ${exp[p]||0}`);}
  const byPts=[...r.rows].sort((a,b)=>a.rank-b.rank);
  assert.strictEqual(r.rows.length,n);
  for(let i=1;i<byPts.length;i++){const pa=r.pts[byPts[i-1].id],pb=r.pts[byPts[i].id];assert(pa>=pb,'ranking order wrong');assert((pa===pb)===(byPts[i-1].rank===byPts[i].rank),'tie handling wrong');}
  assert(r.t<=170+3.5,'round exceeded dur: '+r.t);totalTurns++;
  console.log(`round ${r.rn}: ${JSON.stringify(r.rows.map(x=>[party.names[x.id],r.pts[x.id],'+'+x.pts]))} play-time ${r.t.toFixed(0)}s`);
}
if(mode==='multi')assert.strictEqual(results.length,5,'expected 5 consecutive rounds, got '+results.length);
await checkPwn();
if(payload.cnt)console.log(`broadcast payload bytes per player: max ${payload.max}, avg ${(payload.sum/payload.cnt).toFixed(0)} | stroke-event bytes seen by one viewer: ${evBytes}`);
console.log('errors:',party.errors);
assert.strictEqual(party.errors.length,0,'console errors');
await party.close();
console.log('PASS',tag);
