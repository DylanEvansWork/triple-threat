// Stress / soak tester for the word games (unique, social, bombparty).
// usage: node test/wg-stress.mjs <unique|social|bombparty> <n=3> [--games=3] [--vp=390x844|320x568|430x932|390x480] [--lat] [--reload] [--drop] [--fuzz] [--shots] [--idle=0.12] [--slow=2200] [--dpr=1] [--v]
import {launchStress,sleep} from './wg-lib.mjs';
import fs from 'fs';
const game=process.argv[2]||'unique',n=+process.argv[3]||3;
const A=Object.fromEntries(process.argv.slice(4).map(a=>{const m=a.replace(/^--/,'').split('=');return [m[0],m[1]==null?true:m[1]];}));
const GAMESN=+(A.games||1),idleP=+(A.idle||0.12),slow=+(A.slow||2200);
const [vw,vh]=(A.vp||'390x844').split('x').map(Number);
const tag=`${game}-${n}-${vw}x${vh}`;
const WORDS=fs.readFileSync('games/words.txt','utf8').split('\n').filter(w=>/^[a-z]{4,9}$/.test(w));
const rndI=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const WEIRD=['','   ','<b>bold</b>','<img src=x onerror="window.__xss=1">','"><script>window.__xss=1</script>','اللغة العربية','🍕🍕🍕','a'.repeat(300),'x‮y‬','\u0000zero','😀','Ünïcödé','&amp;&lt;','__proto__','constructor','a b c d e f g h i j k l m n o p q r s t u v w x y z','!!!???','1e9','null'];
const ANS=['banana','Banana','bananas','apple','7','seven','dog','cat','Dogs','red','pizza','Pizza!','the pizza','a cat','grey','gray','pancakes','tiny stars','moon rock','cubes'];
const FUZZ=[{},{k:null},{k:'ans'},{k:'ans',a:null},{k:'ans',a:{}},{k:'ans',a:[1,2]},{k:'ans',a:123},{k:'ans',a:'x'.repeat(100000)},{k:'vote'},{k:'vote',to:'abc'},{k:'vote',to:-1},{k:'vote',to:{}},{k:'vote',to:[0]},
 {k:'fake'},{k:'fake',a:{toString:1}},{k:'fake',a:'x'.repeat(50000)},{k:'pick'},{k:'pick',i:'1e9'},{k:'pick',i:null},{k:'pick',i:-0.5},{k:'pick',i:[1]},{k:'pick',i:99},{k:'typ',w:{}},{k:'typ',w:'x'.repeat(100000)},{k:'typ',w:5},
 {k:'w',w:null},{k:'w',w:'__proto__'},{k:'w',w:['a','b']},{k:'w',w:{}},{k:'w',w:'x'.repeat(100000)},{k:'w',w:'ÄÖ'},{k:'__proto__',x:1},{k:'constructor'},{k:'hasOwnProperty'},{k:'toString'},{k:'ans',a:'ok',extra:{deep:[1,2,3]}},{k:undefined}];
const party=await launchStress({n,only:game,viewport:{width:vw,height:vh},dpr:+(A.dpr||1)});
const H=party.host,fails=[];
const ok=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}else if(A.v)console.log('ok  ',m);};
const st=pg=>pg.evaluate(()=>R?{ph:R.ph,g:R.g,rn:R.rn,S:R.S,me:myPid}:null).catch(()=>null);
const tap=(pg,sel,idx)=>pg.evaluate(([s,k])=>{const els=[...document.querySelectorAll(s)];const e=k==null?els[Math.floor(Math.random()*els.length)]:els[k];if(e)e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return !!e;},[sel,idx]).catch(()=>false);
async function typeSend(pg,sel,txt,dbl){
  const l=pg.locator(sel);
  try{await l.fill(txt,{timeout:1200});await l.press('Enter',{timeout:1200});if(dbl){await l.press('Enter',{timeout:600});}}catch(e){}
}
const ctl={stop:false};
const alive=new Set(party.pages.map((_,i)=>i));
// ---------------- bots ----------------
async function botUnique(pg,i){
  const acted=new Set();
  while(!ctl.stop&&alive.has(i)){
    await sleep(150+Math.random()*250);
    const s=await st(pg);if(!s||s.ph!=='play'||s.g!=='unique'||!s.S)continue;const S=s.S;
    if(S.ph==='write'&&!acted.has(S.rd)){
      acted.add(S.rd);if(Math.random()<idleP)continue;
      await sleep(rndI(200,slow));
      await typeSend(pg,'.uq input',Math.random()<.25?pick(WEIRD):pick(ANS),Math.random()<.3);
      if(Math.random()<.3)await tap(pg,'.uqin button');
    }
  }
}
async function botSocial(pg,i){
  const acted=new Set();
  while(!ctl.stop&&alive.has(i)){
    await sleep(150+Math.random()*250);
    const s=await st(pg);if(!s||s.ph!=='play'||s.g!=='social'||!s.S)continue;const S=s.S;
    const key=S.ph+':'+S.pi;
    if(acted.has(key))continue;
    if(S.ph==='a_vote'){acted.add(key);if(Math.random()<idleP)continue;await sleep(rndI(200,slow));await tap(pg,'.scbtn');if(Math.random()<.4)await tap(pg,'.scbtn');}
    else if(S.ph==='b_write'){
      acted.add(key);if(Math.random()<idleP)continue;await sleep(rndI(400,slow*2));
      let t=Math.random()<.2?pick(WEIRD):pick(ANS);
      if(Math.random()<.15)t=await H.evaluate(()=>H.S._fct&&H.S._fct[H.S.pi]?H.S._fct[H.S.pi].a:'x').catch(()=>'x');
      await typeSend(pg,'.sc input',t,Math.random()<.3);
      // if bounced, try again like a human would
      await sleep(500);const s2=await st(pg);
      if(s2&&s2.S&&s2.S.ph==='b_write'&&!s2.S.sub[s2.me])await typeSend(pg,'.sc input',pick(['moonrock','tiny stars','pancakes','a fish']),false);
    }else if(S.ph==='b_pick'){
      acted.add(key);if(Math.random()<idleP)continue;await sleep(rndI(300,slow));
      await tap(pg,'.scbtn:not(.off)');if(Math.random()<.4)await tap(pg,'.scbtn');
    }
  }
}
async function botBomb(pg,i){
  const acted=new Set();
  while(!ctl.stop&&alive.has(i)){
    await sleep(120+Math.random()*120);
    const s=await st(pg);if(!s||s.ph!=='play'||s.g!=='bombparty'||!s.S)continue;const S=s.S;
    if(S.ph==='turn'&&S.cur===s.me&&!acted.has(S.tn)){
      acted.add(S.tn);
      if(Math.random()<idleP)continue;
      await sleep(rndI(400,slow));
      const now=await st(pg);if(!now||!now.S||now.S.tn!==S.tn||now.S.ph!=='turn')continue;
      const r=Math.random(),syl=S.syl;
      const good=()=>{const c=WORDS.filter(w=>w.includes(syl)&&!S.used.includes(w));return c.length?pick(c):syl+'ing';};
      const inp='.bp input';
      if(r<.12)await typeSend(pg,inp,'zzqxj'+syl,Math.random()<.5);
      else if(r<.2)await typeSend(pg,inp,'',false);
      else if(r<.26)await typeSend(pg,inp,pick(WEIRD),true);
      else if(r<.3)await typeSend(pg,inp,'a'.repeat(200),false);
      else if(r<.4&&S.used.length)await typeSend(pg,inp,pick(S.used),false); // reuse
      else if(r<.5){ // human-style streaming typing
        const w=good();try{await pg.locator(inp).fill('',{timeout:800});await pg.locator(inp).pressSequentially(w,{delay:60,timeout:3000});await pg.locator(inp).press('Enter',{timeout:800});}catch(e){}
      }else await typeSend(pg,inp,good(),Math.random()<.4);
      // retry once if still my turn after a fumble
      await sleep(700);
      const n2=await st(pg);
      if(n2&&n2.S&&n2.S.ph==='turn'&&n2.S.tn===S.tn&&n2.S.cur===n2.me&&Math.random()<.8)await typeSend(pg,inp,good(),false);
    }
  }
}
const BOT={unique:botUnique,social:botSocial,bombparty:botBomb}[game];
// ---------------- fuzzer ----------------
async function fuzzer(){
  while(!ctl.stop){
    await sleep(60+Math.random()*100);
    const m=Object.assign({},pick(FUZZ));if(Math.random()<.3)m[pick(['k','a','w','i','to'])]=pick([null,undefined,0,-1,1e9,'',{},[],'ans','vote','w','fake','pick','typ',NaN,true,'x'.repeat(2000)]);
    const i=rndI(0,n-1);
    if(!alive.has(i))continue;
    try{
      if(Math.random()<.5)await party.pages[i].evaluate(m=>send(Object.assign({t:'act'},m)),m);
      else await H.evaluate(([m,pid])=>hostHandle(pid,Object.assign({t:'act'},m)),[m,rndI(0,n+1)]);
    }catch(e){}
  }
}
// ---------------- run ----------------
let maxPay=0,payN=0;
const phSeen=new Set();
async function monitor(){
  let lastX=0;
  while(!ctl.stop){
    await sleep(100);
    try{
      const d=await H.evaluate(()=>{try{return{len:JSON.stringify(pub()).length,ph:R&&R.ph,gph:R&&R.S&&R.S.ph}}catch(e){return null}});
      if(d){maxPay=Math.max(maxPay,d.len);payN++;
        if(A.shots&&d.ph==='play'&&d.gph){const k=`${tag}-${d.gph}`;if(!phSeen.has(k)){phSeen.add(k);await sleep(450);party.shot(`test/out/wg-${k}.png`,1).catch(()=>{});}}}
      if(Date.now()-lastX>1500){lastX=Date.now();
        for(let i=0;i<n;i++){if(!alive.has(i))continue;
          const x=await party.pages[i].evaluate(()=>({x:window.__xss,bad:!!document.querySelector('#gbox img,#gbox script,#gbox iframe'),ov:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1})).catch(()=>null);
          if(x){if(x.x)ok(false,'XSS executed on page '+i);if(x.bad)ok(false,'injected element in game DOM on page '+i);if(x.ov)ok(false,'page overflows viewport on page '+i);}}}
    }catch(e){}
  }
}
const summaries=[];
for(let g=0;g<GAMESN;g++){
  ctl.stop=false;
  if(A.lat){for(let i=0;i<n;i++)if(alive.has(i))await party.latency(i,i===n-1?300:150,i===n-1?150:100);}
  await party.start();
  await party.waitPhase('play',40000);
  const dur=await H.evaluate(()=>GAMES[R.g].dur);
  const T0=Date.now();
  const tasks=[monitor()];
  for(let i=0;i<n;i++)tasks.push(BOT(party.pages[i],i));
  if(A.fuzz)tasks.push(fuzzer());
  if(A.blip&&n>1){tasks.push((async()=>{
    await sleep(rndI(5000,14000));const i=rndI(1,n-1);if(!alive.has(i))return;
    await party.blip(i);if(A.lat)await party.latency(i,150,100);
    await sleep(4500);
    const aw=await H.evaluate(k=>R.pl.find(p=>p.id===k).aw,i);
    const back=await st(party.pages[i]);
    console.log('blip page',i,'aw after 4.5s:',aw,'client phase',back&&back.ph);
    ok(aw===false,'blipped player is back in the game');
  })());}
  if(A.reload&&n>1){tasks.push((async()=>{
    await sleep(rndI(6000,16000));const i=rndI(1,n-1);if(!alive.has(i))return;
    const before=await st(party.pages[i]);
    try{await party.reload(i);}catch(e){ok(false,'reload/rejoin failed: '+e.message);return;}
    if(A.lat)await party.latency(i,150,100);
    await sleep(1500);
    const after=await st(party.pages[i]);
    const mounted=await party.pages[i].evaluate(()=>!!document.querySelector('#gbox > *')&&document.querySelector('#game').classList.contains('on')).catch(()=>false);
    console.log('reload page',i,'before',before&&before.ph,'after',after&&after.ph,'ui mounted',mounted);
    ok(after&&(after.ph==='play'||after.ph==='result'||after.ph==='final'||after.ph==='intro'||after.ph==='count'),'rejoined into the running game');
    if(after&&after.ph==='play')ok(mounted,'game UI mounted after rejoin');
  })());}
  if(A.drop&&n>2){tasks.push((async()=>{await sleep(rndI(10000,20000));const i=n-1;alive.delete(i);await party.drop(i);console.log('dropped page',i);})());}
  let res;
  try{await party.waitPhase('result',(dur+25)*1000);res=await party.state();}
  catch(e){ok(false,'round never ended within dur+25s');console.log(JSON.stringify(await st(H)));break;}
  const secs=(Date.now()-T0)/1000;
  ctl.stop=true;await Promise.allSettled(tasks);
  const rows=res.res.rows;
  ok(rows.length===n,'rows for every player');
  ok(rows.every(r=>r.pts>=0&&r.pts<=n),'points in range');
  ok(rows.every((r,i)=>i===0||r.rank>=rows[i-1].rank),'rows sorted by rank');
  ok(rows[0].rank===0,'someone wins');
  ok(secs<=dur+10,`round length ${secs.toFixed(0)}s <= dur ${dur}+10`);
  const extra=await H.evaluate(()=>{const S=H.S;return{tot:S.tot,lives:S.lives,out:S.out,used:S.used&&S.used.length}});
  console.log(`game ${g+1}/${GAMESN}: ${secs.toFixed(0)}s rows=${JSON.stringify(rows.map(r=>r.id+':'+r.pts+':'+r.label))} extra=${JSON.stringify(extra)}`);
  summaries.push(secs);
  if(g<GAMESN-1){
    await party.waitPhase('final',20000).catch(()=>ok(false,'no final phase'));
    await H.click('#again');await party.waitPhase('lobby',10000).catch(()=>ok(false,'no lobby after again'));
    const left=await H.evaluate(()=>R.pl.length);if(left<n)break;
  }
}
ctl.stop=true;
console.log(`max broadcast payload ${maxPay} bytes over ${payN} samples`);
ok(maxPay<4500,'broadcast payload small (<4.5KB)');
ok(party.errors.length===0,'no console/page errors: '+party.errors.slice(0,5).join(' | '));
await party.close();
console.log(`[${tag}${A.lat?' lat':''}${A.reload?' reload':''}${A.drop?' drop':''}${A.fuzz?' fuzz':''}] `+(fails.length?'FAILED '+fails.length+': '+fails.slice(0,6).join(' | '):'ALL OK'));
process.exit(fails.length?1:0);
