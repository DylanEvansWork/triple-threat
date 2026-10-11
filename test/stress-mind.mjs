// Browser stress test for shotgun / goldrush / liar: human-like sloppy bots (late, idle, double-tap, flip-flop, multi-touch, spam),
// network latency+jitter (one phone worse), mid-round page reload with same ?key, host fuzzing with junk acts, payload size,
// layout checks on small/large screens, several consecutive rounds.
//   node test/stress-mind.mjs <game> <n=3> [--lat] [--reload] [--fuzz] [--rounds=2] [--size=320x568] [--shots]
import {launchParty,sleep} from './harness.mjs';
const [game,nArg]=process.argv.slice(2),n=+nArg||3,flags=process.argv.slice(2).filter(a=>a.startsWith('--'));
const has=f=>flags.includes('--'+f),val=(k,d)=>{const a=flags.find(x=>x.startsWith('--'+k+'='));return a?a.split('=')[1]:d;};
const rounds=+val('rounds',1),size=val('size','390x844').split('x').map(Number);
const lat=has('lat'),reload=has('reload'),fuzz=has('fuzz'),shots=has('shots');
const tag=`${game}-${n}-${size[0]}x${size[1]}${lat?'-lat':''}${reload?'-rl':''}${fuzz?'-fz':''}`;
const party=await launchParty({n,only:game,rounds:5,autoready:false,viewport:{width:size[0],height:size[1]}});
const T0=Date.now(),problems=[];
const bad=m=>{problems.push(m);console.log('PROBLEM:',m);};

// ---- latency: wrap conn.send on host (per player) and clients; one phone (the last) is worse
if(lat){
  for(let i=0;i<party.pages.length;i++){
    await party.pages[i].evaluate(({i,n})=>{
      const wrap=(c,extra)=>{if(!c||c.__w)return;c.__w=1;const o=c.send.bind(c);let last=0;
        c.send=d=>{const now=performance.now(),dl=150+Math.random()*150+extra,at=Math.max(last,now+dl);last=at;const s=JSON.stringify(d);setTimeout(()=>o(JSON.parse(s)),at-now);};};
      setInterval(()=>{
        if(typeof H!=='undefined'&&H&&isHost)H.players.forEach(p=>{if(p.conn)wrap(p.conn,p.id===n-1&&n>2?150:0);});
        if(typeof hostConn!=='undefined'&&hostConn)wrap(hostConn,i===n-1&&n>2?150:0);
      },50);
    },{i,n});
  }
}

// ---- in-page human-like bot
const install=async(page,i)=>page.evaluate(({game,i})=>{
  const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
  const ev=(el,o={})=>el.dispatchEvent(new PointerEvent('pointerdown',Object.assign({bubbles:true,cancelable:true,pointerId:1,isPrimary:true},o)));
  const click=(el,o)=>{if(!el||el.disabled)return false;ev(el,o);window.__st.clicks++;return true;};
  const st=window.__st={clicks:0,dbl:0,flip:0,multi:0,spam:0,late:0,never:0,acts:0};
  const later=(ms,f)=>setTimeout(f,ms);
  let plan=null;
  const visible=el=>el&&getComputedStyle(el).display!=='none'&&!el.disabled;
  const decide=(key,deadlineLeft,dMin,dMax,neverP)=>{
    if(plan&&plan.key===key)return plan;
    const r=Math.random();plan={key,delay:0,never:false,done:false};
    if(r<neverP){plan.never=true;st.never++;}
    else if(r<neverP+.2){plan.delay=Math.max(0,deadlineLeft-rnd(.05,.35));st.late++;}
    else plan.delay=rnd(dMin,dMax);
    plan.t0=performance.now();return plan;
  };
  const sloppy=(btn,others)=>{ // double-tap / flip-flop / multitouch / spam variants on top of the first click
    click(btn);st.acts++;
    const r=Math.random();
    if(r<.2){later(30,()=>click(btn));st.dbl++;}
    else if(r<.4&&others.length){later(110,()=>click(pick(others)));st.flip++;}
    else if(r<.5&&others.length){click(pick(others),{pointerId:2,isPrimary:false});st.multi++;}
    else if(r<.6){for(let k=0;k<6;k++)later(k*25,()=>click(btn));st.spam++;}
  };
  setInterval(()=>{
    try{
      if(!R||R.ph!=='play'||!R.S){plan=null;return;}
      const S=R.S,me=myPid;
      if(game==='shotgun'){
        if(S.over||S.ph!=='pick'){plan=null;return;}
        const q=S.p[me];if(!q||q.l<=0)return;
        const p=decide(S.turn,S.dl-ctx.t(),.4,4.5,.08);
        if(p.never||p.done||performance.now()-p.t0<p.delay*1000)return;p.done=true;
        const acts=[...document.querySelectorAll('.sg-act')].filter(b=>!b.disabled);
        if(!acts.length)return;const b=pick(acts);
        sloppy(b,acts.filter(x=>x!==b));
        later(380,()=>{const tg=[...document.querySelectorAll('.sg-tg')].filter(visible);if(tg.length)click(pick(tg));});
        later(900,()=>{const tg=[...document.querySelectorAll('.sg-tg')].filter(visible);if(tg.length)click(pick(tg));});
      }else if(game==='goldrush'){
        if(S.over||S.ph!=='pick'||!S.inside[me]){plan=null;return;}
        const p=decide(S.step+'-'+S.pickAt,S.dl-ctx.t(),.3,3.5,.08);
        if(p.never||p.done||performance.now()-p.t0<p.delay*1000)return;p.done=true;
        const stay=document.querySelector('.gr-b.stay'),lv=document.querySelector('.gr-b.leave');
        const b=Math.random()<.3?lv:stay;sloppy(b,[b===lv?stay:lv]);
      }else if(game==='liar'){
        if(S.over||S.ph!=='bid'||S.turn!==me||S.dc[me]<=0){plan=null;return;}
        const p=decide(S.rd+'-'+S.bids.length,S.dl-ctx.t(),.6,7,.04);
        if(p.never||p.done||performance.now()-p.t0<p.delay*1000)return;p.done=true;
        if(S.bid&&Math.random()<.3){const b=document.querySelector('.ld-call');sloppy(b,[]);return;}
        // random stepper/face fiddling then bid (spam the bid button)
        const qp=document.querySelector('.ld-qp'),qm=document.querySelector('.ld-qm');
        for(let k=0,m=Math.floor(rnd(0,4));k<m;k++)click(Math.random()<.7?qp:qm);
        const fs=[...document.querySelectorAll('.ld-fb')].filter(b=>!b.disabled);if(fs.length)click(pick(fs));
        later(60,()=>sloppy(document.querySelector('.ld-bid'),[]));
      }
    }catch(e){console.error('botfail '+e.message);}
  },60);
},{game,i});

// ---- helpers
const stateOf=(page)=>page.evaluate(()=>R&&R.S?{ph:R.S.ph,turn:R.S.turn,step:R.S.step,rd:R.S.rd,nb:R.S.bids?R.S.bids.length:0,over:R.S.over,t:R.S.t,dl:R.S.dl,rvid:R.S.rv?(R.S.rv.id||R.S.rv.turn||R.S.rv.rd):null,rph:R.ph}:null).catch(()=>null);
const progress=(g,s)=>!s?0:g==='shotgun'?s.turn*2+(s.ph==='reveal'?1:0):g==='goldrush'?s.step*2+(s.ph==='pick'?1:0):s.rd*1000+s.nb*2+(s.ph==='reveal'?1:0);
const layoutCheck=async(page,name)=>{
  const r=await page.evaluate(()=>{
    const root=document.querySelector('#gbox'),W=innerWidth,out=[],small=[];
    root.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return;
      if(e.classList.contains('sel')||e.closest('.sg-fl,.sg-bul,.sg-ban,.gr-fl,.gr-ban,.gr-big,.ld-ban,.ld-rev,.gr-red'))return;
      if(r.right>W+2||r.left<-2)out.push((e.className||e.tagName)+':'+Math.round(r.left)+'-'+Math.round(r.right));
      if(e.tagName==='BUTTON'&&r.height<44&&r.height>0)small.push((e.className||'')+':'+Math.round(r.height));});
    return{out:out.slice(0,6),small:small.slice(0,6),sw:document.documentElement.scrollWidth,W,sh:document.documentElement.scrollHeight,H:innerHeight};
  }).catch(()=>null);
  if(!r)return;
  if(r.out.length)bad(`${name}: elements outside viewport: ${r.out.join(', ')}`);
  if(r.small.length)bad(`${name}: small touch targets: ${r.small.join(', ')}`);
  if(r.sw>r.W+1)bad(`${name}: horizontal scroll ${r.sw}>${r.W}`);
};

let maxPay=0,payAt='',lagViol=0,clockViol=0,backwards=0,reloads=0,fuzzed=0,shotsTaken=0;
for(let rd=1;rd<=rounds;rd++){
  if(rd>1){await party.host.click('#again');await party.waitPhase('lobby',10000);}
  await party.start();
  await party.waitPhase('intro',20000);await sleep(300);
  if(rd===1)await party.shot(`test/out/stress-${tag}-intro.png`,1);
  for(const p of party.pages)await p.click('#iready').catch(()=>{});
  await party.waitPhase('play',30000);
  if(rd===1)for(let i=0;i<n;i++)await install(party.pages[i],i);
  const last=new Array(n).fill(0);let reloadDone=false,fuzzDone=0,nextShot=3,tStart=Date.now();
  const rt0=Date.now();
  while(true){
    const ph=await party.phase();
    if(ph==='result'||ph==='final')break;
    if(Date.now()-rt0>200000){bad('round exceeded 200s wall');break;}
    const host=await stateOf(party.pages[0]);
    // payload size on host (largest per-player broadcast)
    const pay=await party.pages[0].evaluate(()=>{let m=0;for(const p of H.players){const s=JSON.stringify(Object.assign({},pub(),{priv:privFor(p.id),mybet:null}));m=Math.max(m,s.length);}return m;}).catch(()=>0);
    if(pay>maxPay){maxPay=pay;payAt=host?(host.turn||host.step||host.rd)+'/'+host.ph:'';}
    for(let i=0;i<n;i++){
      if(party.pages[i].isClosed())continue;
      const s=i===0?host:await stateOf(party.pages[i]);if(!s||s.rph!=='play')continue;
      const pr=progress(game,s);if(pr<last[i]&&pr!==0){backwards++;bad(`phone ${i} went backwards ${last[i]} -> ${pr}`);}last[i]=Math.max(last[i],pr);
      // client clock vs host deadline
      if(s.ph==='pick'||s.ph==='bid'){
        const c=await party.pages[i].evaluate(()=>{const e=document.querySelector('.sg-clock,.gr-clock,.ld-clock');return{txt:e?e.textContent:null,exp:R.S.dl-ctx.t()};}).catch(()=>null);
        if(c&&c.txt&&/^\d+$/.test(c.txt)&&Math.abs(+c.txt-Math.ceil(c.exp))>2)clockViol++;
      }
    }
    const el=(Date.now()-rt0)/1000;
    if(reload&&!reloadDone&&el>14&&n>=2){
      reloadDone=true;reloads++;const vi=1;
      const before=await party.pages[vi].evaluate(()=>({priv:JSON.stringify(R.priv),ph:R.ph}));
      await party.pages[vi].reload({waitUntil:'load'});
      await party.pages[vi].fill('#name',party.names[vi]);await party.pages[vi].fill('#code',party.code);await party.pages[vi].click('#join');
      try{await party.pages[vi].waitForFunction(()=>R&&R.ph&&R.ph!=='lobby'&&document.querySelector('#gbox>*'),null,{timeout:15000});}catch(e){bad('reloaded phone did not recover UI');}
      await sleep(700);
      const after=await party.pages[vi].evaluate(()=>({priv:JSON.stringify(R&&R.priv),ph:R&&R.ph,gbox:document.querySelector('#gbox').children.length,me:myPid,intro:document.querySelector('#intro').classList.contains('on')}));
      console.log('reload: before',JSON.stringify(before),'after',JSON.stringify(after));
      if(after.me<0)bad('reloaded phone has no pid');
      if(game==='liar'&&(before.priv!==after.priv&&after.ph==='play'&&JSON.stringify(JSON.parse(before.priv))!==after.priv)){
        // dice may legitimately change if a new round began while reloading: only flag if empty
        if(!after.priv||after.priv==='null')bad('reloaded phone lost its private dice');
      }
      await install(party.pages[vi],vi);
    }
    if(fuzz&&el>5&&fuzzDone<6&&Math.random()<.5){
      fuzzDone++;fuzzed++;
      await party.pages[0].evaluate((game)=>{
        const J=()=>[undefined,null,NaN,-1,0,1,2,3,99,1e9,'1','x','__proto__',{},[],true,2.5,Infinity,'stay','leave','call','bid','shoot','reload','block','shotgun'];
        const p=a=>a[Math.floor(Math.random()*a.length)];
        for(let k=0;k<300;k++){
          const m={t:'act'};['a','tg','k','q','f','c'].forEach(f=>{if(Math.random()<.5)m[f]=p(J());});
          if(game==='shotgun'&&Math.random()<.5){m.a=p(['reload','shoot','block','shotgun']);m.tg=p([0,1,2,3,4,'1',null]);}
          if(game==='liar'&&Math.random()<.5){m.k=p(['bid','call']);m.q=p([1,2,3,4,50,-2,'3']);m.f=p([0,1,2,3,4,5,6,7,'2']);}
          if(game==='goldrush'&&Math.random()<.5)m.c=p(['stay','leave',1,null]);
          hostHandle(p([0,1,2,3,7,-1,'a']),m);
        }
      },game);
    }
    if(shots&&rd===1&&el>nextShot&&shotsTaken<6){nextShot+=9;shotsTaken++;for(const i of [0,1]){await party.shot(`test/out/stress-${tag}-${shotsTaken}-p${i}.png`,i);}await layoutCheck(party.pages[1],'p1@'+Math.round(el));await layoutCheck(party.pages[0],'p0@'+Math.round(el));}
    await sleep(250);
  }
  await party.waitPhase('result',25000).catch(()=>{});
  const st=await party.state();
  console.log(`round ${rd}: phase=${st.ph} wall=${((Date.now()-rt0)/1000).toFixed(0)}s S.t=${st.S&&st.S.t.toFixed(1)} rows=${JSON.stringify(st.res&&st.res.rows)}`);
  if(!st.res||!st.res.rows||st.res.rows.length!==n)bad('result rows missing');
  else{const rk=st.res.rows.map(r=>r.rank);if(Math.min(...rk)!==0)bad('no rank 0');if(!st.res.rows.every(r=>r.pts>=0&&r.pts<=n))bad('pts out of range');}
  // clients agree with host on the final public state
  const hostFinal=await party.pages[0].evaluate(()=>JSON.stringify(R.S&&{over:R.S.over,t:null,dc:R.S.dc,p:R.S.p,bank:R.S.bank}));
  for(let i=1;i<n;i++){if(party.pages[i].isClosed())continue;const f=await party.pages[i].evaluate(()=>JSON.stringify(R.S&&{over:R.S.over,t:null,dc:R.S.dc,p:R.S.p,bank:R.S.bank})).catch(()=>null);if(f&&f!==hostFinal)bad(`phone ${i} final state differs from host`);}
  if(rd<rounds){await party.waitPhase('final',20000).catch(()=>bad('never reached final'));}
}
const stats=await Promise.all(party.pages.map(p=>p.evaluate(()=>window.__st).catch(()=>null)));
console.log(`[${tag}] done in ${((Date.now()-T0)/1000).toFixed(0)}s | max broadcast payload=${maxPay}B (${payAt}) | clock-violations=${clockViol} backwards=${backwards} reloads=${reloads} fuzz-batches=${fuzzed}`);
console.log('bot stats',JSON.stringify(stats.map(s=>s&&{acts:s.acts,dbl:s.dbl,flip:s.flip,multi:s.multi,spam:s.spam,late:s.late,never:s.never})));
console.log('page errors:',party.errors.length?party.errors:'none');
if(party.errors.length)problems.push('page errors');
console.log(problems.length?'PROBLEMS: '+problems.length:'OK');
await party.close();
process.exit(problems.length?1:0);
