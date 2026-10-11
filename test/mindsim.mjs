// Headless host-logic simulator for shotgun / goldrush / liar (no browser). Loads games/*.js in a vm sandbox, runs the host
// (init/begin/tick/act/score) against scripted bots in simulated time. Used for: termination + invariant fuzzing over many games,
// malformed-act fuzzing, and balance statistics (strategy vs strategy).
//   node test/mindsim.mjs [games=shotgun,goldrush,liar] [rounds=200] [balance]
import vm from 'vm'; import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ctx={GAMES:{},console,Math,JSON};
ctx.shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
ctx.clamp=(x,a,b)=>Math.max(a,Math.min(b,x));ctx.mulberry=()=>Math.random;
vm.createContext(ctx);
for(const k of ['shotgun','goldrush','liar'])vm.runInContext(fs.readFileSync(path.join(ROOT,'games',k+'.js'),'utf8'),ctx,{filename:k+'.js'});
export const GAMES=ctx.GAMES;
const rnd=(a,b)=>a+Math.random()*(b-a),pickr=a=>a[Math.floor(Math.random()*a.length)];

// ---------------- generic engine loop ----------------
export function play(key,n,botOf,o={}){
  const G=GAMES[key],H={players:[],emit(){}};
  for(let i=0;i<n;i++)H.players.push({id:i,name:'P'+i,ci:i,aw:false});
  const S=G.init(H);S.t=0;G.begin&&G.begin(H,S);
  const bots=H.players.map(p=>botOf(p.id,n,key));
  const dt=.05;let overAt=null,steps=0,maxPay=0;
  const me=(pid,m)=>{try{G.act(H,S,pid,Object.assign({t:'act'},m));}catch(e){throw new Error('act threw: '+e.stack);}};
  while(true){
    S.t+=dt;steps++;
    try{G.tick(H,S,dt);}catch(e){throw new Error(key+' tick threw: '+e.stack);}
    for(let i=0;i<n;i++){const b=bots[i];if(!H.players[i].aw&&b)b(H,S,i,me);}
    if(o.fuzz&&Math.random()<.5)fuzzAct(key,H,S,me,n);
    if(o.dropAt&&S.t>=o.dropAt&&!H.players[o.dropId].aw)H.players[o.dropId].aw=true;
    if(steps%10===0)maxPay=Math.max(maxPay,JSON.stringify(pub(S)).length);
    if(S.over&&overAt==null)overAt=S.t;
    if(S.over&&S.t-overAt>=(S.hold!=null?S.hold:1.5))break;
    if(S.t>=G.dur)break;
    if(S.t>G.dur+5)throw new Error('ran past dur');
  }
  let rows;
  if(G.score)rows=G.score(H,S);
  else{ // engine default ranking
    const hi=G.better==='high',nn=n;rows=H.players.map(p=>({id:p.id,v:(p.aw)?null:(G.val(S,p.id)??null)}));
    const key=v=>v==null?null:(hi?-v:v);
    rows.sort((a,b)=>{const ka=key(a.v),kb=key(b.v);if(ka==null&&kb==null)return 0;if(ka==null)return 1;if(kb==null)return -1;return ka-kb;});
    rows.forEach((x,i)=>{x.rank=(i>0&&key(rows[i-1].v)===key(x.v))?rows[i-1].rank:i;x.pts=x.v==null?0:Math.max(0,nn-x.rank);});
  }
  return{S,rows,H,t:S.t,maxPay,capped:!S.over};
}
const pub=S=>{const o={};for(const k in S)if(k[0]!=='_')o[k]=S[k];return o;};

// ---------------- fuzz ----------------
const junk=()=>pickr([undefined,null,NaN,-1,0,1,2,3,99,1e9,'1','x','__proto__','constructor',{},[],[1],true,-0.5,2.5,Infinity,'stay','leave','call','bid']);
function fuzzAct(key,H,S,act,n){
  const pid=Math.random()<.9?Math.floor(Math.random()*n):pickr([-1,99,'a',null]);
  const m={};
  const ks=pickr([['a','tg'],['k','q','f'],['c'],['a','tg','k','q','f','c'],[]]);
  ks.forEach(k=>{m[k]=Math.random()<.4?pickr(['reload','shoot','block','shotgun','bid','call','stay','leave']):junk();});
  if(Math.random()<.5&&key==='shotgun'){m.a=pickr(['reload','shoot','block','shotgun']);m.tg=pickr([0,1,2,3,pid,junk()]);}
  if(Math.random()<.5&&key==='liar'){m.k=pickr(['bid','call']);m.q=pickr([1,2,3,4,5,6,9,junk()]);m.f=pickr([1,2,3,4,5,6,7,0,junk()]);}
  if(Math.random()<.5&&key==='goldrush'){m.c=pickr(['stay','leave',junk()]);}
  try{act(pid,m);}catch(e){throw new Error('FUZZ '+key+' threw on '+JSON.stringify(m)+' pid='+pid+': '+e.message);}
}

// ---------------- bots ----------------
// every bot: (H,S,i,act)=>void, called each 50ms of sim time.
function thinker(minD,maxD,decide){ // calls decide once per decision key after random delay
  let key=null,at=0;
  return (H,S,i,act)=>{const k=decide.key(S,i);if(k==null)return;if(k!==key){key=k;at=S.t+rnd(minD,maxD);}if(S.t>=at&&key!=='done:'+k){key='done:'+k;const m=decide.fn(S,i);if(m)(Array.isArray(m)?m:[m]).forEach(x=>act(i,x));}};
}
const alive=(S,i)=>S.p[i]&&S.p[i].l>0;
export const SG={
  reloadShotgun:()=>({fn(S,i){const q=S.p[i],foes=S.ids.filter(x=>x!==i&&S.p[x].l>0);const tg=foes.sort((a,b)=>S.p[b].a-S.p[a].a)[0];if(q.a>=3)return{a:'shotgun',tg:pickr(foes)};return{a:'reload'};}}),
  aggro:()=>({fn(S,i){const q=S.p[i],foes=S.ids.filter(x=>x!==i&&S.p[x].l>0);if(q.a>=3&&Math.random()<.5)return{a:'shotgun',tg:pickr(foes)};if(q.a>=1)return{a:'shoot',tg:pickr(foes)};return{a:'reload'};}}),
  turtle:()=>({fn(S,i){const q=S.p[i],foes=S.ids.filter(x=>x!==i&&S.p[x].l>0);if(q.a>=3)return{a:'shotgun',tg:pickr(foes)};if(!q.blk&&S.turn<S.storm&&Math.random()<.65)return{a:'block'};if(q.a>=2&&Math.random()<.4)return{a:'shoot',tg:pickr(foes)};return{a:'reload'};}}),
  random:()=>({fn(S,i){const q=S.p[i],foes=S.ids.filter(x=>x!==i&&S.p[x].l>0),o=['reload'];if(q.a>=1)o.push('shoot','shoot');if(q.a>=3)o.push('shotgun');if(!q.blk&&S.turn<S.storm)o.push('block');const a=pickr(o);return a==='shoot'||a==='shotgun'?{a,tg:pickr(foes)}:{a};}}),
  // reads the table: blocks when a foe could shoot (ammo>=1) and rolls dice on bluffs, shotguns at 3, shoots when foes look tapped out
  smart:()=>({fn(S,i){const q=S.p[i],foes=S.ids.filter(x=>x!==i&&S.p[x].l>0);
    const threat=foes.filter(x=>S.p[x].a>=1).length,ammoFoes=foes.filter(x=>S.p[x].a>=1);
    if(q.a>=3)return{a:'shotgun',tg:foes.sort((a,b)=>S.p[a].l-S.p[b].l)[0]};
    const canB=!q.blk&&S.turn<S.storm;
    if(S.turn>=S.storm){const mx=Math.max(...S.ids.filter(x=>S.p[x].l>0).map(x=>S.p[x].a));if(q.a>=1&&q.a>=mx-0)return{a:'shoot',tg:pickr(foes)};return q.a>=1&&Math.random()<.7?{a:'shoot',tg:pickr(foes)}:{a:'reload'};}
    if(q.a>=1&&Math.random()<.5)return{a:'shoot',tg:(ammoFoes.length?pickr(ammoFoes):pickr(foes))};
    if(canB&&threat>0&&Math.random()<.55)return{a:'block'};
    return{a:'reload'};}}),
  counter:()=>({fn(S,i){const q=S.p[i],foes=S.ids.filter(x=>x!==i&&S.p[x].l>0),canB=!q.blk&&S.turn<S.storm,threat=foes.some(x=>S.p[x].a>=1);
    if(q.a>=3)return{a:'shotgun',tg:pickr(foes)};
    if(threat&&canB&&Math.random()<.85)return{a:'block'};
    if(q.a>=1&&(!threat||!canB||Math.random()<.5))return{a:'shoot',tg:pickr(foes.filter(x=>S.p[x].a<1).concat(foes))};
    return{a:'reload'};}}),
  idle:()=>({fn(){return null;}}),
};
export function sgBot(name){const d=SG[name]();return thinker(.3,2.6,{key:(S,i)=>S.ph==='pick'&&alive(S,i)&&!S.over?'t'+S.turn:null,fn:d.fn});}

export const GRS={
  leaveNow:()=>({fn(S,i){return{c:'leave'};}}),
  t6:()=>({fn(S,i){return{c:S.pocket[i]>=6?'leave':'stay'};}}),
  t12:()=>({fn(S,i){return{c:S.pocket[i]>=12?'leave':'stay'};}}),
  t20:()=>({fn(S,i){return{c:S.pocket[i]>=20?'leave':'stay'};}}),
  risk:()=>({fn(S,i){const r=S.dg/Math.max(1,S.dn);return{c:(r>.12||S.pocket[i]>=25)?'leave':'stay'};}}),
  riskB:()=>({fn(S,i){const r=S.dg/Math.max(1,S.dn);return{c:(r>.07&&S.pocket[i]>=5)||r>.2?'leave':'stay'};}}),
  stayAll:()=>({fn(){return{c:'stay'};}}),
  random:()=>({fn(){return{c:Math.random()<.3?'leave':'stay'};}}),
  idle:()=>({fn(){return null;}}),
};
export function grBot(name){const d=GRS[name]();return thinker(.3,2.4,{key:(S,i)=>S.ph==='pick'&&S.inside[i]&&!S.over?'s'+S.step+'-'+S.pickAt:null,fn:d.fn});}

export const LDS={
  honest:()=>({fn:(S,i)=>ldMove(S,i,.5,1.1,2.6)}),
  bluffer:()=>({fn:(S,i)=>ldMove(S,i,1.8,2.4,3.6)}),
  caller:()=>({fn:(S,i)=>ldMove(S,i,0,.2,9)}),
  random:()=>({fn:(S,i)=>Math.random()<.2&&S.bid?{k:'call'}:ldRandom(S,i)}),
  idle:()=>({fn(){return null;}}),
};
function ldRandom(S,i){const prev=S.bid;const c=[];for(let q=1;q<=S.total;q++)for(let f=1;f<=6;f++)if(!prev||q>prev.q||(q===prev.q&&f>prev.f))c.push([q,f]);if(!c.length)return{k:'call'};const [q,f]=pickr(c.slice(0,8));return{k:'bid',q,f};}
function ldMove(S,i,slack,callOver,callCap){
  const mine=S._dice[i]||[],own={};mine.forEach(v=>own[v]=(own[v]||0)+1);const others=S.total-mine.length,est=f=>(own[f]||0)+others/6,prev=S.bid;
  if(prev){const e=est(prev.f);if(prev.q>e+callOver&&Math.random()<.9)return{k:'call'};if(prev.q>=e+callCap)return{k:'call'};}
  const c=[];for(let q=1;q<=S.total;q++)for(let f=1;f<=6;f++)if(!prev||q>prev.q||(q===prev.q&&f>prev.f))c.push([q,f]);
  if(!c.length)return{k:'call'};
  const pk=c.find(([q,f])=>est(f)+slack>=q)||c[0];return{k:'bid',q:pk[0],f:pk[1]};
}
export function ldBot(name){const d=LDS[name]();return thinker(.4,3,{key:(S,i)=>S.ph==='bid'&&S.turn===i&&S.dc[i]>0&&!S.over?'r'+S.rd+'-'+(S.bid?S.bid.q+'.'+S.bid.f:'x'):null,fn:d.fn});}

const BOTF={shotgun:sgBot,goldrush:grBot,liar:ldBot},NAMES={shotgun:Object.keys(SG),goldrush:Object.keys(GRS),liar:Object.keys(LDS)};

// ---------------- invariants ----------------
function check(key,n,r,tag){
  const {S,rows}=r,G=GAMES[key];
  const bad=m=>{throw new Error(`[${key} n=${n} ${tag}] ${m}`);};
  if(r.t>G.dur+.11)bad('past dur '+r.t);
  if(!rows||rows.length!==n)bad('rows length');
  const ids=new Set(rows.map(x=>x.id));if(ids.size!==n)bad('rows ids');
  if(Math.min(...rows.map(x=>x.rank))!==0)bad('nobody rank 0');
  rows.forEach(x=>{if(!(x.pts>=0&&x.pts<=n))bad('pts '+x.pts);if(x.pts!==Math.max(0,n-x.rank)&&!(S.gone&&S.gone[x.id]&&x.pts===0))bad('pts/rank mismatch');});
  if(key==='shotgun'){for(const id in S.p){if(S.p[id].l<0||S.p[id].l>2||S.p[id].a<0||S.p[id].a>3)bad('bad p '+JSON.stringify(S.p[id]));}}
  if(key==='goldrush'){for(const id of S.ids){if(S.bank[id]<0||S.pocket[id]<0)bad('neg gems');if(!Number.isInteger(S.bank[id]))bad('non-int bank');}if(S.pile<0)bad('neg pile');}
  if(key==='liar'){for(const id of S.ids)if(S.dc[id]<0||S.dc[id]>S.sd)bad('bad dc');}
  if(JSON.stringify(pub(S)).includes('_dice'))bad('leak');
}

// ---------------- main ----------------
const args=process.argv.slice(2);
const games=(args[0]&&!/^\d+$/.test(args[0])&&args[0]!=='balance'?args[0]:'shotgun,goldrush,liar').split(',');
const rounds=+(args.find(a=>/^\d+$/.test(a))||200),balance=args.includes('balance');
const mixed=(key)=>(pid)=>BOTF[key](pickr(NAMES[key].filter(x=>x!=='idle'||Math.random()<.15)));
if(import.meta.url===('file://'+process.argv[1])||process.argv[1].endsWith('mindsim.mjs')){
  for(const key of games){
    const st={games:0,len:[],capped:0,draws:0,maxPay:0};
    for(let n=2;n<=4;n++)for(let g=0;g<rounds;g++){
      const fuzz=g%3===0,drop=g%7===0&&n>2;
      const r=play(key,n,()=>BOTF[key](pickr(NAMES[key].filter(x=>x!=='idle'||Math.random()<.2))),{fuzz,dropAt:drop?rnd(5,40):0,dropId:n-1});
      check(key,n,r,`g${g}${fuzz?' fuzz':''}${drop?' drop':''}`);
      st.games++;st.len.push(r.t);st.maxPay=Math.max(st.maxPay,r.maxPay);if(r.capped)st.capped++;
      if(r.rows.filter(x=>x.rank===0).length>1)st.draws++;
    }
    st.len.sort((a,b)=>a-b);
    console.log(`${key}: ${st.games} games OK | len p50=${st.len[st.len.length>>1].toFixed(0)}s p90=${st.len[Math.floor(st.len.length*.9)].toFixed(0)}s max=${st.len[st.len.length-1].toFixed(0)}s | hit-dur-cap=${st.capped} | shared-win=${st.draws} | max payload=${st.maxPay}B`);
  }
  if(balance){
    for(const key of games){
      const names=NAMES[key].filter(x=>x!=='idle');
      console.log('\n=== balance: '+key+' (win share = rank-0 share, 1 point per win split on ties; avg pts) ===');
      for(const n of [2,3,4]){
        const res={};names.forEach(nm=>res[nm]={w:0,g:0,pts:0});
        const N=key==='shotgun'?1500:800;
        for(let g=0;g<N;g++){
          const pool=[];for(let i=0;i<n;i++)pool.push(pickr(names));
          const r=play(key,n,pid=>BOTF[key](pool[pid]));
          const win=r.rows.filter(x=>x.rank===0);
          r.rows.forEach(x=>{const b=res[pool[x.id]];b.g++;b.pts+=x.pts;if(x.rank===0)b.w+=1/win.length;});
        }
        console.log(' n='+n+': '+names.map(nm=>`${nm} ${(100*res[nm].w/Math.max(1,res[nm].g)).toFixed(0)}%/${(res[nm].pts/Math.max(1,res[nm].g)).toFixed(2)}pts`).join(' | '));
      }
    }
  }
}
if(args.includes('matrix')){
  for(const key of games){
    const names=NAMES[key].filter(x=>x!=='idle');
    console.log('\n=== 2-player head-to-head win% (row beats column), '+key+' ===');
    console.log('            '+names.map(x=>x.slice(0,8).padEnd(9)).join(''));
    for(const a of names){let line=a.padEnd(12);for(const b of names){let w=0,N=300;for(let g=0;g<N;g++){const sw=g%2;const r=play(key,2,pid=>BOTF[key]((pid===sw)?a:b));const me=r.rows.find(x=>x.id===sw);const rk=r.rows.filter(x=>x.rank===0);if(me.rank===0)w+=1/rk.length;}line+=(100*w/300).toFixed(0).padEnd(9);}console.log(line);}
  }
}
