// Stress / robustness run for pong, sumo, tag.
//   node test/ptb-stress.mjs <pong|sumo|tag> <n> [rounds=3] [lat] [reload] [fuzz] [mix] [equal] [size=320x568]
//   lat: 150-300 ms one-way latency + jitter (last player worst) | reload: player 1 reloads page mid-round and rejoins
//   fuzz: malformed/out-of-phase act() at the host | mix: one seat plays like a clown | equal: identical bot skill
import {launchParty,sleep} from './harness.mjs';
import {installBots} from './ptb-bots.mjs';
import {installLag} from './ptb-netlag.mjs';
const key=process.argv[2],n=+process.argv[3]||3,args=process.argv.slice(4);
const flag=f=>args.includes(f),val=(k,d)=>{const a=args.find(x=>x.startsWith(k+'='));return a?a.split('=')[1]:d;};
const rounds=+val('rounds',3),size=val('size','390x844').split('x').map(Number);
const tag=`${key}${n}${flag('lat')?'-lat':''}${flag('reload')?'-rl':''}${flag('equal')?'-eq':''}${size[0]!==390?'-'+size[0]:''}`;
const party=await launchParty({n,only:Array(rounds).fill(key).join(','),rounds:5,viewport:{width:size[0],height:size[1]}});
const host=party.host,hookName={pong:'__ttPong',sumo:'__ttSumo',tag:'__ttTag'}[key];
const log=(...a)=>console.log(`[${tag}]`,...a);
const K_=+(process.env.LATK||1),LAT=[[150,60],[220,80],[300,120]].slice(0,n-1).map(([a,b])=>[a*K_,b*K_]);
await party.start();
if(flag('lat')){await installLag(party,LAT);log('latency installed');}
const finiteCheck=()=>host.evaluate(()=>{const bad=[];(function w(o,p){if(typeof o==='number'){if(!isFinite(o))bad.push(p);}else if(o&&typeof o==='object')for(const k in o)w(o[k],p+'.'+k);})(H.S,'S');return bad;});
const skills=flag('equal')?[0.6,0.6,0.6,0.6]:[0.8,0.5,0.35,0.6],stats={payload:[],frame:[],rounds:[],wins:{}};
let fail=0;const bad=m=>{fail++;console.log('FAIL:',m);};
const DUR={pong:100,sumo:120,tag:60}[key];
for(let r=1;r<=rounds;r++){
  await host.waitForFunction(r=>R&&R.rn===r&&(R.ph==='count'||R.ph==='play'),r,{timeout:60000});
  if(r===1&&flag('fuzz'))await party.pages[n-1].evaluate(()=>{for(let i=0;i<20;i++)send({t:'act',k:['p','L','A','K','i'][i%5],u:5,x:9,y:9,dx:1,dy:1,p:1,s:1});send({t:'act'});send({t:'done',v:3});send({t:'prog',v:3});});
  await host.waitForFunction(r=>R&&R.rn===r&&R.ph==='play',r,{timeout:30000});
  for(const p of party.pages)await p.waitForFunction(h=>window[h]&&window[h].ok,hookName,{timeout:15000});
  const modes=party.pages.map(()=>'normal');
  if(flag('mix'))modes[1+Math.floor(Math.random()*(n-1))]=['idle','spam','jitter'][r%3];
  for(let i=0;i<n;i++)await installBots(party.pages[i],key,{skill:skills[i],mode:modes[i]});
  log(`round ${r} bots`,modes.join(','));
  const t0=Date.now(),did={};
  for(;;){
    const ph=await host.evaluate(r=>R.rn===r?R.ph:'next',r).catch(()=>'?');
    if(ph==='result'||ph==='next'||ph==='final')break;
    const el=(Date.now()-t0)/1000;
    const nan=await finiteCheck();if(nan.length)bad('non-finite state '+nan.slice(0,3));
    if(!did.size&&el>8){did.size=1;await party.shot(`test/out/ptb-${tag}-r${r}-host.png`,0);await party.shot(`test/out/ptb-${tag}-r${r}-c1.png`,1);}
    if(!did.pay&&el>6){did.pay=1;
      for(let i=0;i<15;i++){stats.payload.push(await host.evaluate(()=>JSON.stringify({t:'st',st:Object.assign({},pub(),{priv:privFor(1),mybet:null})}).length));await sleep(100);}
      stats.frame.push(await party.pages[1].evaluate(()=>{const t0=performance.now();for(let i=0;i<200;i++)cur.frame(0);return (performance.now()-t0)/200;}));}
    if(flag('reload')&&r===1&&!did.rl&&el>10){
      did.rl=1;log('reloading player 1');
      await party.pages[1].reload({waitUntil:'load'});
      await party.pages[1].fill('#name',party.names[1]);await party.pages[1].fill('#code',party.code);await party.pages[1].click('#join');
      try{await party.pages[1].waitForFunction(h=>R&&R.ph==='play'&&window[h]&&window[h].ok&&document.querySelector('#gbox canvas'),hookName,{timeout:15000});log('player 1 recovered UI');}
      catch(e){bad('player 1 did not recover after reload');}
      if(flag('lat'))await installLag(party,LAT).catch(()=>{});
      await installBots(party.pages[1],key,{skill:skills[1],mode:'normal'});
      await sleep(1500);await party.shot(`test/out/ptb-${tag}-reloaded.png`,1);
    }
    if(flag('fuzz')&&r===Math.min(2,rounds)&&!did.fz&&el>5){
      did.fz=1;
      const out=await host.evaluate(k=>{
        const G=GAMES[k],thrown=[],J=[null,undefined,NaN,Infinity,-Infinity,'x','',{},[],true,false,1e308,-1e308,'1e999',{a:1},[1,2],0,-1,1,0.5,99,-99,'__proto__'];
        const KS=['k','u','x','y','dx','dy','p','s','t','i','id','v'],KV=['p','L','A','K','i','x','ping',null,1,{},[]],pids=[0,1,2,3,-1,99,'0',null,undefined,NaN];
        const rj=a=>a[Math.floor(Math.random()*a.length)];
        for(let i=0;i<4000;i++){const m={t:'act'};const c=Math.floor(Math.random()*6);for(let j=0;j<c;j++)m[rj(KS)]=Math.random()<.4?rj(J):(Math.random()<.5?rj(KV):(Math.random()*4-2));
          if(Math.random()<.3)m.k=rj(['p','L','A','K','i','ping']);
          try{G.act(H,H.S,rj(pids),m);}catch(e){thrown.push(String(e&&e.message||e));}}
        for(let i=0;i<300;i++){try{hostHandle(rj([0,1,2,99,-1]),Object.assign({t:rj(['act','done','prog','ready','bet','skip','act'])},{k:rj(['p','A','K','i','L']),u:rj(J),x:rj(J),dx:rj(J),p:rj(J)}));}catch(e){thrown.push('hostHandle '+e.message);}}
        return [...new Set(thrown)].slice(0,5);},key);
      if(out.length)bad('act() threw: '+JSON.stringify(out));else log('fuzz: no throws');
      const nan=await finiteCheck();if(nan.length)bad('fuzz produced non-finite state '+nan.slice(0,3));
    }
    await sleep(700);
  }
  await party.waitPhase('result',20000).catch(()=>{});
  const st=await party.state(),rows=(st.res&&st.res.rows)||[],dur=st.S.t;
  stats.rounds.push(+dur.toFixed(1));const w=rows.filter(x=>x.rank===0).map(x=>x.id).join('+');stats.wins[w]=(stats.wins[w]||0)+1;
  log(`round ${r} ended t=${dur.toFixed(1)}s rows=${JSON.stringify(rows.map(x=>[x.id,x.rank,x.pts,x.label]))}`);
  if(rows.length!==n)bad('rows!=n');
  if(!rows.some(x=>x.rank===0))bad('no rank 0');
  if(rows.some(x=>x.pts<0||x.pts>n||!isFinite(x.pts)))bad('bad points');
  if(dur>DUR+3)bad('round overran dur '+dur);
  if(Object.keys(st.S).some(k=>k[0]==='_'))bad('private leak');
}
const ps=stats.payload.sort((a,b)=>a-b);
log('payload bytes/broadcast min/med/max',ps[0],ps[Math.floor(ps.length/2)],ps[ps.length-1],'| frame ms',(stats.frame.reduce((a,b)=>a+b,0)/stats.frame.length).toFixed(2),'| rounds',JSON.stringify(stats.rounds),'| winners',JSON.stringify(stats.wins));
log('errors:',party.errors);
if(party.errors.length)fail++;
await party.close();
console.log(fail?`[${tag}] FAILED (${fail})`:`[${tag}] OK`);
process.exitCode=fail?1:0;
