// Draw & Guess end-to-end: bots really draw (mouse) and really type guesses; checks replication, chat, scoring, hints, leak, disconnect.
// usage: node test/draw.mjs [n=3] [mode: ''|short|leave]
import {launchParty,sleep} from './harness.mjs';
import assert from 'assert';
const n=+process.argv[2]||3, mode=process.argv[3]||'';
const tag=`draw-${n}${mode?'-'+mode:''}`;
const party=await launchParty({n,only:'draw',rounds:5,viewport:mode==='short'?{width:390,height:520}:undefined});
const {pages,host}=party;
const alive=pages.map(()=>true);
const out=f=>`test/out/${tag}-${f}.png`;
const hs=()=>host.evaluate(()=>H&&H.S&&H.ph==='play'?{st:H.S.st,tn:H.S.tn,dr:H.S.dr,word:H.S._word&&H.S._word.w,alt:H.S._word&&H.S._word.alt,t:H.S.t,pe:H.S.pe,dl:H.S.dl,hint:H.S.hint,rv:H.S.rv,got:H.S.got,pc:H.S.pc,strokes:H.S._strokes.length}:null);
const ev=(i,f,...a)=>alive[i]?pages[i].evaluate(f,...a):null;

// ---------- 1. matcher unit tests (inside the page, real code) ----------
const um=await host.evaluate(()=>{
  const G=GAMES.draw,W=G._words,m=G._match,bad=[];
  if(W.length<140)bad.push('only '+W.length+' words');
  for(const w of W){
    const forms=[w.w,w.w.toUpperCase(),'  '+w.w+' ',w.w.replace(/ /g,''),w.w+'s',...w.alt];
    for(const f of forms)if(!m(w.w,w.alt,f))bad.push('miss '+w.w+' <- '+f);
    for(const x of ['','zzzzzz','hello','   '])if(m(w.w,w.alt,x))bad.push('false+ '+w.w+' <- '+x);
  }
  for(const a of W)for(const b of W){if(a===b)continue;if(m(a.w,a.alt,b.w))bad.push('collision '+a.w+' <- '+b.w);for(const x of b.alt)if(m(a.w,a.alt,x))bad.push('collision '+a.w+' <- alt '+x);}
  // typo tolerance on long words only
  if(!m('giraffe',[],'giraffee')||!m('giraffe',[],'girafe'))bad.push('typo tolerance broken');
  if(m('owl',[],'ow')||m('bee',[],'be'))bad.push('short words too lenient');
  const cats={};W.forEach(w=>cats[w.cat]=(cats[w.cat]||0)+1);
  return {bad,count:W.length,cats};
});
console.log('words:',um.count,JSON.stringify(um.cats));
assert.deepStrictEqual(um.bad,[],'matcher problems: '+um.bad.slice(0,10).join(' | '));

await party.start();
await party.waitPhase('play');
for(const p of pages)await p.waitForFunction(()=>R&&R.ph==='play'&&document.querySelector('.drw'));

const expected={};  // pid -> points we expect from observed reveals
const addExp=(id,v)=>expected[id]=(expected[id]||0)+v;
const done=new Set(),log=[];
let leftClosed=false;

async function drawStrokes(di,tn){
  const r=await pages[di].evaluate(()=>{const r=document.querySelector('.drw-cvw canvas').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});
  const P=pages[di];
  const tool=(sel,k)=>P.evaluate(([s,k])=>document.querySelectorAll(s)[k].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})),[sel,k]);
  const stroke=async pts=>{await P.mouse.move(r.x+pts[0][0]*r.w,r.y+pts[0][1]*r.h);await P.mouse.down();for(const q of pts.slice(1)){await P.mouse.move(r.x+q[0]*r.w,r.y+q[1]*r.h,{steps:4});}await P.mouse.up();};
  const circle=(cx,cy,rad)=>Array.from({length:25},(_,i)=>[cx+Math.cos(i/24*6.283)*rad,cy+Math.sin(i/24*6.283)*rad*.8]);
  await tool('.drw-row.cols button',1);await tool('.drw-row:not(.cols) button',2);
  await stroke(circle(.5,.4,.3));
  await tool('.drw-row.cols button',2);await tool('.drw-row:not(.cols) button',0);
  await stroke([[.2,.8],[.4,.9],[.6,.8],[.8,.9]]);
  await tool('.drw-row.cols button',3);
  await stroke([[.4,.35],[.45,.35]]);await stroke([[.55,.35],[.6,.35]]);
  // undo + clear test: stray stroke -> undo ; stray stroke -> clear would wipe, so only undo here
  await tool('.drw-row.cols button',0);
  await stroke([[.1,.1],[.9,.15]]);
  await sleep(250);
  const before=await P.evaluate(()=>R.S.pc);
  await P.evaluate(()=>document.querySelectorAll('.drw-row:not(.cols) button')[3].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})));   // undo
  await sleep(350);
  const s=await hs();
  assert(s.pc<before,'undo did not shrink host point count');
  await tool('.drw-row.cols button',4);await tool('.drw-row:not(.cols) button',1);
  await stroke([[.3,.55],[.5,.65],[.7,.55]]);
  await sleep(300);
}
const canvasSig=i=>pages[i].evaluate(()=>{const cv=document.querySelector('.drw-cvw canvas'),o=document.createElement('canvas');o.width=40;o.height=50;const g=o.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,40,50);g.drawImage(cv,0,0,40,50);const d=g.getImageData(0,0,40,50).data,a=[];for(let k=0;k<d.length;k+=4)a.push(d[k]+d[k+1]+d[k+2]<690?1:0);return a;});
const guess=async(i,tx)=>{if(!alive[i])return;await pages[i].fill('.drw-form input',tx);await pages[i].press('.drw-form input','Enter');};
const variants=w=>[w.word,' '+w.word.toUpperCase(),w.word+'s',w.alt[0]||w.word];

async function runDraw(s){
  const di=s.dr,tn=s.tn,gs=pages.map((_,i)=>i).filter(i=>i!==di&&alive[i]);
  const scen=tn%3;
  log.push(`turn ${tn}: drawer ${party.names[di]} word=${s.word} scen=${scen}`);
  if(tn===0){await party.shot(out('pick-or-draw-drawer'),di);await party.shot(out('draw-start-guesser'),gs[0]);}
  await drawStrokes(di,tn);
  // replication check drawer vs viewers
  const sd=await canvasSig(di);
  for(const g of gs){
    const sg=await canvasSig(g);let diff=0;for(let k=0;k<sd.length;k++)if(sd[k]!==sg[k])diff++;
    const ink=sd.reduce((a,b)=>a+b,0);
    assert(ink>60,'drawer canvas looks empty (ink cells '+ink+')');
    assert(diff/sd.length<.06,`viewer ${g} canvas differs from drawer by ${(diff/sd.length*100).toFixed(1)}%`);
  }
  if(tn===0){ // resync: wipe a viewer's local copy as if it missed everything, it must recover from the host
    await ev(gs[0],()=>cur.event({k:'x',tn:R.S.tn}));
    assert((await canvasSig(gs[0])).reduce((a,b)=>a+b,0)===0,'wipe failed');
    await sleep(4200);
    const a1=await canvasSig(gs[0]);let d1=0;for(let k=0;k<sd.length;k++)if(sd[k]!==a1[k])d1++;
    assert(d1/sd.length<.06,'viewer did not resync after losing strokes ('+d1+' cells differ)');log.push('   resync after wipe ok');
  }
  // leak check: word not visible to non-drawers
  for(const g of gs){
    const txt=await ev(g,()=>document.body.innerText.toLowerCase()), rj=await ev(g,()=>JSON.stringify(R).toLowerCase());
    assert(!txt.includes(s.word.toLowerCase()),'word visible in guesser DOM: '+s.word+' :: '+txt.replace(/\n/g,' | ')+' state '+JSON.stringify(await hs()));
    assert(!rj.includes('"'+s.word.toLowerCase()+'"')&&!rj.includes('opts'),'word/opts leaked in guesser R');
  }
  assert(await ev(di,()=>!!R.priv&&R.priv.word),'drawer has no private word');
  if(tn===0){await party.shot(out('draw-mid-drawer'),di);await party.shot(out('draw-mid-guesser'),gs[0]);}
  // everyone can see a wrong guess
  await guess(gs[0],'banana'+tn);await sleep(500);
  for(let i=0;i<n;i++){const t=await ev(i,()=>document.querySelector('.drw-chat').innerText);if(t!==null)assert(t.includes('banana'+tn),`chat missing wrong guess on page ${i}: ${t} state ${JSON.stringify(await hs())}`);}
  // drawer cannot guess (no input)
  assert(await ev(di,()=>getComputedStyle(document.querySelector('.drw-form')).display==='none'),'drawer sees guess box');
  const V=variants(s);
  if(scen===0){
    for(let k=0;k<gs.length;k++){await sleep(700);await guess(gs[k],k?V[(k+tn)%V.length]:V[1]);}
    if(tn===0){await sleep(250);await party.shot(out('got-it-guesser'),gs[0]);}
  }else if(scen===1){
    // hints: fast-forward draw clock
    await host.evaluate(()=>{H.S.ds-=H.S.dl*.55;});await sleep(500);
    const s2=await hs();assert(s2.hint.includes('_')&&s2.hint.replace(/[ _]/g,'')==='','50% hint should be only underscores: '+s2.hint);
    await party.shot(out('hint50'),gs[0]);
    await host.evaluate(()=>{H.S.ds-=H.S.dl*.22;});await sleep(500);
    const s3=await hs();const letters=(s3.hint.match(/[A-Z]/g)||[]).length;assert(letters>=1&&letters<=2,'75% hint should reveal 1-2 letters: '+s3.hint);
    log.push('   hint50/75: '+s2.hint.replace(/ +/g,'')+' -> '+s3.hint.replace(/ +/g,''));
    await party.shot(out('hint75'),gs[0]);
    await guess(gs[0],'definitely wrong');
    await host.evaluate(()=>{H.S.pe=H.S.t+.2;});
  }else{
    await guess(gs[0],V[0]);
    await sleep(400);if(tn===2&&n>2){await party.shot(out('got-it-locked'),gs[0]);await party.shot(out('draw-with-chat-other'),gs[1]??gs[0]);await party.shot(out('draw-drawer-after-guess'),di);}
    if(gs[1]!==undefined){await sleep(300);await guess(gs[1],'nope nope');}
    if(mode==='leave'&&!leftClosed&&gs.length>=2){leftClosed=true;const x=gs[gs.length-1];await pages[x].evaluate(()=>{lostHost=()=>{};peer.destroy();});await sleep(200);await pages[x].close();alive[x]=false;log.push('   closed page '+x+' mid-turn');}
    await sleep(500);
    await host.evaluate(()=>{H.S.pe=H.S.t+.2;});
  }
  // wait for reveal
  let r;for(let k=0;k<60;k++){r=await hs();if(r&&r.st==='reveal'&&r.tn===tn)break;await sleep(100);}
  assert(r&&r.st==='reveal','never reached reveal: '+JSON.stringify(r)+' log '+log.join(' / '));
  const rv=r.rv;
  for(const x of rv.got){addExp(x.id,x.pt);assert(x.pt>=2&&x.pt<=6,'guesser pts out of range '+x.pt);}
  addExp(di,rv.dp);
  if(scen===0&&gs.length>=2){assert(rv.bonus&&rv.got.length===gs.length,'everybody got it -> bonus expected');}
  if(scen===1)assert(rv.got.length===0&&rv.dp===0,'nobody guessed -> no points');
  log.push(`   reveal: got=${JSON.stringify(rv.got)} drawer+${rv.dp}${rv.bonus?' (bonus)':''}`);
  await sleep(600);
  if(tn<=1){await party.shot(out('reveal-t'+tn+'-guesser'),gs[0]);await party.shot(out('reveal-t'+tn+'-drawer'),di);}
  // finished drawing is still on the viewers' canvas during reveal
  const nowS=await hs();if(nowS&&nowS.st==='reveal'&&nowS.tn===tn){const sg=await canvasSig(gs[0]);assert(sg.reduce((a,b)=>a+b,0)>40,'drawing vanished on reveal turn '+tn+' viewer '+gs[0]+' drawer '+di+' st '+JSON.stringify(nowS));}
}

const t0=Date.now();
while(true){
  const ph=await host.evaluate(()=>R&&R.ph);if(ph!=='play')break;
  const s=await hs();if(!s){await sleep(100);continue;}
  if(s.st==='pick'&&!done.has('p'+s.tn)){
    done.add('p'+s.tn);
    if(s.tn===0){
      await pages[s.dr].waitForFunction(()=>document.querySelectorAll('.drw-pk button').length===3,null,{timeout:3000}).catch(()=>{});
      assert(await ev(s.dr,()=>document.querySelectorAll('.drw-pk button').length===3),'drawer should see 3 words');
      assert(await ev(s.dr,()=>R.priv.opts.length===3),'priv opts');
      const other=[...Array(n).keys()].find(i=>i!==s.dr&&alive[i]);
      assert(await ev(other,()=>!R.priv&&document.querySelectorAll('.drw-pk button').length===0),'guesser sees words');
      await party.shot(out('pick-drawer'),s.dr);await party.shot(out('pick-guesser'),other);
    }
    await pages[s.dr].waitForFunction(()=>document.querySelectorAll('.drw-pk button').length===3,null,{timeout:3000});
    await ev(s.dr,()=>{const b=document.querySelectorAll('.drw-pk button');b[Math.floor(Math.random()*b.length)].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));});
  }
  if(s.st==='draw'&&!done.has('d'+s.tn)){done.add('d'+s.tn);await runDraw(s);}
  if(Date.now()-t0>170000)throw new Error('test timeout');
  await sleep(120);
}
await party.waitPhase('result',20000);
const st=await party.state();
await party.shot(out('result'),0);
const rows=st.res.rows;
console.log(log.join('\n'));
console.log('RESULT',JSON.stringify(rows),'pts',JSON.stringify(st.S.pts),'expected',JSON.stringify(expected));
for(const p of st.pl)assert.strictEqual(st.S.pts[p.id]||0,expected[p.id]||0,'points mismatch for '+p.n);
assert.strictEqual(rows.length,n);
const sorted=[...rows].sort((a,b)=>a.rank-b.rank);
for(let i=1;i<sorted.length;i++)assert((st.S.pts[sorted[i-1].id]||0)>=(st.S.pts[sorted[i].id]||0),'rank order wrong');
const turnsPlayed=done.size/2;
console.log('turns played:',turnsPlayed,'elapsed s:',((Date.now()-t0)/1000).toFixed(0));
assert(turnsPlayed===(n===2?4:n)||mode==='leave','unexpected turn count '+turnsPlayed);
console.log('errors:',party.errors);
assert.strictEqual(party.errors.length,0,'console errors');
await party.waitPhase('final',30000).catch(()=>{});
await party.close();
console.log('PASS',tag);
