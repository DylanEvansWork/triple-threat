// DEFUSE TOGETHER — co-op bomb disposal with split information (Keep-Talking style).
// One team vs one bomb. 3 modules (wires / big button / symbol pad), order + rules + instances are procedurally generated
// from a seed on the host. Each module: one DEFUSER sees the bomb (no manual), the others each hold ONE half of the manual
// (A = field guide "what", B = procedures "how/when"), 4th player = SPOTTER (read-only bomb mirror). Roles rotate per module.
// Host holds all truth (S._ans); the bomb view / manual pages reach players only through S._priv.
(function(){
const TOTAL=105,PENALTY=12,BRIEF1=4,BRIEF=3.5;
const COL={red:['🟥','red','#e5352b'],blue:['🟦','blue','#1f7ae0'],yellow:['🟨','yellow','#ffc400'],green:['🟩','green','#2fa84f'],white:['⬜','white','#f2f2f7'],black:['⬛','black','#2a2a38']};
const WIRE_COLS=['red','blue','yellow','green','white','black'];
const LED_COLS=['red','blue','yellow','green'];
const BTN_COLS=['red','blue','yellow','green','white'];
const LABELS=['ABORT','HOLD','PUSH','NOPE','FIRE','OOPS'];
const SYMS=['🐱','🍕','👻','🚀','🌵','🎸','🦆','🍄','⚡','🔑','🐙','🍩','🌙','⭐','🎈','🦄','🐢','🔔','🍎','🧲','🍌','🐸','🎩','🔥'];
const KINDS=['wires','button','symbols'];
const KNAME={wires:'✂️ WIRES',button:'🔘 BIG BUTTON',symbols:'🔣 SYMBOL PAD'};
const ORD=['','1st','2nd','3rd','4th'];
const cn=k=>COL[k][0]+' '+COL[k][1];

// ====================== GENERATOR (pure; seeded) ======================
function gen(seed){
  const rng=mulberry(seed>>>0),r=()=>rng(),ri=n=>Math.floor(r()*n),pk=a=>a[ri(a.length)];
  const sh=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
  // ---- rule tables (what the manuals say) ----
  const rules={wires:{live:{},cnt:{},oddTop:r()<.5},button:{},symbols:{}};
  for(const l of LED_COLS)rules.wires.live[l]=sh(WIRE_COLS).slice(0,2);
  {const kp=sh([1,2,3]);[4,5,6].forEach((n,i)=>rules.wires.cnt[n]=kp[i]);}
  const bt=rules.button;
  const ls=sh(LABELS);bt.l1=ls[0];bt.l2=ls[1];bt.m1=r()<.5?'TAP':'HOLD';bt.m2=bt.m1==='TAP'?'HOLD':'TAP';
  const ms=sh(['TAP','TAP','HOLD','HOLD',r()<.5?'TAP':'HOLD']);bt.col={};BTN_COLS.forEach((c,i)=>bt.col[c]=ms[i]);
  const dg=sh([1,2,3,4,5]);bt.strip={};BTN_COLS.forEach((c,i)=>bt.strip[c]=dg[i]);
  const sy=rules.symbols;sy.cols=[];for(let i=0;i<5;i++)sy.cols.push(sh(SYMS).slice(0,7));
  const dd=sh(['DOWN','DOWN','UP','UP']);sy.dir={};LED_COLS.forEach((c,i)=>sy.dir[c]=dd[i]);
  // ---- bomb instances ----
  const serial=()=>{const L='ABCDEFGHJKLMNPQRSTUVWXYZ',D='23456789';let s='';for(let i=0;i<4;i++)s+=r()<.5?pk(L.split('')):pk(D.split(''));return s+pk(D.split(''));};
  const wiresAns=(b)=>{const live=[];b.cols.forEach((c,i)=>{if(rules.wires.live[b.led].includes(c))live.push(i);});
    const odd=(+b.serial.slice(-1))%2===1,top=odd===rules.wires.oddTop;const ord=top?live:live.slice().reverse();
    const k=rules.wires.cnt[b.cols.length];return{i:ord[Math.min(k,ord.length)-1],live:live.length,k,top};};
  let wires=null,tries=0;
  for(;tries<300;tries++){
    const n=4+ri(3),b={k:'wires',cols:Array.from({length:n},()=>pk(WIRE_COLS)),led:pk(LED_COLS),serial:serial(),cut:[]};
    const a=wiresAns(b);if(a.live<1)continue;
    // prefer instances where the counting direction really matters and there are decoys
    if(a.live>=2&&a.live<n){const b2=Object.assign({},b,{serial:b.serial.slice(0,4)+(((+b.serial.slice(-1))%2)?'2':'3')});if(wiresAns(b2).i!==a.i){wires={b,a};break;}}
    if(!wires||tries>250)wires={b,a};
  }
  const mkBtn=()=>{const b={k:'button',col:pk(BTN_COLS),label:pk(LABELS),strip:pk(BTN_COLS),taps:0,holding:false};
    const mode=b.label===bt.l1?bt.m1:b.label===bt.l2?bt.m2:bt.col[b.col];return{b,a:{mode,D:bt.strip[b.strip]}};};
  const button=mkBtn();
  const mkSym=()=>{
    for(let t=0;t<500;t++){
      const ti=ri(5),col=sy.cols[ti],four=sh(col).slice(0,4);
      const decoys=sh(SYMS.filter(s=>!col.includes(s))).slice(0,5);
      const pad=sh(four.concat(decoys));
      if(sy.cols.some((cc,j)=>j!==ti&&pad.filter(s=>cc.includes(s)).length>=4))continue;
      const badge=pk(LED_COLS);let seq=col.filter(s=>four.includes(s));if(sy.dir[badge]==='UP')seq.reverse();
      return{b:{k:'symbols',pad,badge,prog:0,pressed:[]},a:{seq,col:ti}};
    }
    throw new Error('symbol gen failed');};
  const symbols=mkSym();
  const order=sh(KINDS),off=ri(4);
  return{seed,rules,order,off,mods:{wires,button,symbols}};
}

// ====================== MANUAL PAGES (derived purely from rules) ======================
function wiresExample(R){
  const n=5,live=[2,4,5],serialDigit=7,top=(serialDigit%2===1)===R.wires.oddTop,ord=top?live:live.slice().reverse(),k=R.wires.cnt[n];
  return `Example: 5 wires, serial ends in 7, live wires are #2, #4 and #5 → count from the ${top?'TOP':'BOTTOM'}, ${ORD[k]} live wire → cut wire #${ord[Math.min(k,ord.length)-1]}.`;
}
function page(R,kind,which){
  if(which==='A'){
    if(kind==='wires')return{t:'📘 FIELD GUIDE · ✂️ WIRES',intro:'A wire is LIVE only if its colour is on the list for the LED colour on the bomb. Dead wires are decoration (and also explode).',
      secs:[{h:'LED colour → LIVE wire colours',rows:LED_COLS.map(l=>['LED '+cn(l),R.wires.live[l].map(cn).join('  +  ')])}],
      note:'Ask the Defuser: LED colour + every wire colour, top to bottom. Work out which are LIVE, then ask Procedures (Manual B) which live wire to cut.'};
    if(kind==='button')return{t:'📘 FIELD GUIDE · 🔘 BIG BUTTON',intro:'Decide TAP or HOLD. Check the steps IN ORDER — the first one that matches wins.',
      secs:[{h:'Steps',rows:[['1. Label says '+R.button.l1,'→ '+R.button.m1],['2. Label says '+R.button.l2,'→ '+R.button.m2],['3. Anything else','→ use button colour ↓']]},
            {h:'Button colour (step 3)',rows:BTN_COLS.map(c=>[cn(c),'→ '+R.button.col[c]])}],
      note:'TAP = press and let go quickly. HOLD = press and keep holding. Tell the Defuser which, then ask Procedures (Manual B) for the number.'};
    return{t:'📘 FIELD GUIDE · 🔣 SYMBOL PAD',intro:'The pad shows 9 symbols. Exactly ONE column below contains 4 of them — those 4 are the ones to press. Ignore the other 5.',
      secs:[{h:'Symbol columns (top → bottom)',cols:R.symbols.cols}],
      note:'Have the Defuser read all 9 symbols out loud. Find the column, tell them the 4 symbols — then ask Procedures (Manual B) for the ORDER.'};
  }
  if(kind==='wires')return{t:'📙 PROCEDURES · ✂️ WIRES',intro:'Count the wires. Look at the LAST character of the serial number (always a digit).',
    secs:[{h:'Wire count → which LIVE wire',rows:[4,5,6].map(n=>[n+' wires','cut the '+ORD[R.wires.cnt[n]]+' live wire'])},
          {h:'Counting direction',rows:[['Serial ends ODD (3 5 7 9)',R.wires.oddTop?'count from the TOP (wire 1 is top)':'count from the BOTTOM'],['Serial ends EVEN (2 4 6 8)',R.wires.oddTop?'count from the BOTTOM':'count from the TOP (wire 1 is top)']]}],
    note:'Fewer live wires than the number? Take the furthest live wire in your counting direction. '+wiresExample(R)};
  if(kind==='button')return{t:'📙 PROCEDURES · 🔘 BIG BUTTON',intro:'The little strip next to the button gives you a number N.',
    secs:[{h:'Strip colour → N',rows:BTN_COLS.map(c=>['Strip '+cn(c),'N = '+R.button.strip[c]])}],
    note:'TAP: tap exactly N times, then wait a moment. HOLD: keep holding, then let go when the LAST digit of the bomb clock\'s seconds is N. Example: N=4 → let go at 1:24, 1:14, 1:04, 0:54, 0:44…'};
  return{t:'📙 PROCEDURES · 🔣 SYMBOL PAD',intro:'Order matters! The badge colour on the pad says which way to read the column.',
    secs:[{h:'Badge colour → press order',rows:LED_COLS.map(c=>['Badge '+cn(c),R.symbols.dir[c]==='DOWN'?'⬇️ column order, TOP first':'⬆️ column order, BOTTOM first'])}],
    note:'Example: a column reads 🐱 🍕 👻 🚀 🍩 and the pad has 🍕 🚀 🍩 🐱 from it (👻 isn\'t on the pad) → ⬇️ press 🐱 🍕 🚀 🍩, or ⬆️ press 🍩 🚀 🍕 🐱. Read the order out one symbol at a time.'};
}

// ====================== GAME ======================
const fmtT=t=>{const s=Math.max(0,Math.ceil(t));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const ROLEI={D:['🧨','DEFUSER','#ff5a3d'],A:['📘','MANUAL A','#19d3ff'],B:['📙','MANUAL B','#ffb02e'],S:['🔭','SPOTTER','#b06bff']};

GAMES.defuse={
  name:'Defuse Together',emoji:'🔧',tag:'One bomb. One team. Nobody can do it alone.',
  min:2,max:4,nobet:true,
  rules:[
    ['💣','One bomb, 3 modules, about 105 seconds. You all win together or blow up together — no betting, no rivals.'],
    ['👀','Each module ONE of you is the DEFUSER: you see the bomb but have NO manual. Everyone else holds a manual page and CAN\'T see the bomb.'],
    ['🗣️','TALK OUT LOUD! Defuser: describe everything ("LED blue, 5 wires: red, white…"). Manual people: read your rules until you know exactly what to press.'],
    ['❌','A wrong move is a STRIKE: −12 seconds and a red flash. Roles rotate every module so everyone gets the hot seat.'],
    ['🧠','Example: Defuser says "LED is blue". Guide says "blue → red or white wires are live". Procedures says "5 wires, serial ends 7 → 2nd live from the top".']
  ],
  ctrl:'Defuser: tap wires / button / symbols. Everyone else: read your manual, ask questions, shout.',
  win:'Defuse all 3 modules before the clock hits 0: everyone gets full points. BOOM = everyone gets 0.',
  dur:125,hz:10,better:'high',fmt:v=>v?'Defused':'BOOM',

  // ---------------- HOST ----------------
  init(H){
    const seed=Math.floor(Math.random()*2147483647),G=gen(seed);
    return{st:'wait',mi:0,mods:G.order.map(k=>({k,done:0})),ro:{d:-1,a:-1,b:-1,s:null},left:TOTAL,total:TOTAL,run:false,k:0,fl:0,rv:0,pg:{n:0,from:-1},ev:[],es:0,pe:0,hd:0,fin:0,
      _G:G,_bs:null,_ans:null,_priv:{},_pgT:{},_bdAt:0,_tapT:0};
  },
  begin(H,S){startModule(H,S,0);},
  tick(H,S,dt){
    if(S.st==='wait'||S.st==='won'||S.st==='boom')return;
    const act=H.players.filter(p=>!p.aw);
    if(act.length<2){boom(S);return;}
    // a role-holder left or came back? reshuffle roles but keep the bomb state
    const key=roleKey(H,S);if(key!==S._rk){assignRoles(H,S);if(S.st==='play')S.rv++;}
    if(S.st==='brief'){if(S.t>=S.pe){S.st='play';S.run=true;}return;}
    S.left=Math.max(0,+(S.left-dt).toFixed(3));
    const bs=S._bs;
    if(bs.k==='button'&&bs.taps>0&&!bs.holding&&S.t-S._tapT>1.25){
      if(bs.taps===S._ans.D)solved(H,S,'🔘 Tapped '+bs.taps+'×');else strike(H,S,'🔘 Only '+bs.taps+' tap'+(bs.taps>1?'s':'')+' — wrong number');
    }
    if(S.left<=0)boom(S);
  },
  act(H,S,pid,m){
    if(m.k==='ping'){
      if((S.st!=='play'&&S.st!=='brief')||pid===S.ro.d)return;
      if(S.t-(S._pgT[pid]==null?-9:S._pgT[pid])<1.5)return;S._pgT[pid]=S.t;S.pg={n:S.pg.n+1,from:pid};return;
    }
    if(S.st!=='play'||pid!==S.ro.d)return;
    const bs=S._bs,A=S._ans,nm=plName(H,pid);
    if(bs.k==='wires'&&m.k==='cut'){
      const i=m.i|0;if(i<0||i>=bs.cols.length||bs.cut.includes(i))return;bs.cut.push(i);
      if(i===A.i)solved(H,S,'✂️ Wire '+(i+1)+' ('+COL[bs.cols[i]][1]+') cut',pid);else strike(H,S,'✂️ Wire '+(i+1)+' ('+COL[bs.cols[i]][1]+') — WRONG',pid);
    }else if(bs.k==='symbols'&&m.k==='sym'){
      const i=m.i|0;if(i<0||i>8||bs.pressed.includes(i))return;
      if(bs.pad[i]===A.seq[bs.prog]){bs.pressed.push(i);bs.prog++;if(bs.prog>=4)solved(H,S,bs.pad[i]+' pressed — pad complete',pid);else pushEv(S,pid,bs.pad[i]+' pressed ✓',1);}
      else strike(H,S,bs.pad[i]+' pressed — wrong one',pid);
    }else if(bs.k==='button'){
      if(m.k==='bd'){if(bs.holding)return;bs.holding=true;S._bdAt=S.t;S.hd=1;}
      else if(m.k==='bu'){
        if(!bs.holding)return;let held=S.t-S._bdAt;bs.holding=false;S.hd=0;
          // latency compensation: trust the phone's own hold time + the clock it was looking at (if plausible)
          if(typeof m.h==='number'&&isFinite(m.h)&&m.h>=0&&Math.abs(m.h-held)<2.5)held=m.h;
          let lft=S.left;if(typeof m.l==='number'&&isFinite(m.l)&&Math.abs(m.l-S.left)<2.5)lft=m.l;
        if(A.mode==='TAP'){
          if(held>.9)strike(H,S,'🔘 Held it — this one wanted TAPS',pid);
          else{bs.taps++;S._tapT=S.t;if(bs.taps>A.D)strike(H,S,'🔘 Too many taps',pid);}
        }else{
          if(held<.5)strike(H,S,'🔘 Tapped — this one wanted a HOLD',pid);
          else{const u1=Math.ceil(lft)%10,u2=Math.ceil(lft+.4)%10;
            if(u1===A.D||u2===A.D)solved(H,S,'🔘 Released at '+fmtT(lft),pid);else strike(H,S,'🔘 Released at '+fmtT(lft)+' — wrong moment',pid);}
        }
      }
    }
  },
  val(S,id){return S.st==='won'?1:0;},
  score(H,S){
    const won=S.st==='won',n=H.players.length;
    return H.players.map(p=>({id:p.id,rank:won?0:1,pts:won?n:0,label:won?'Defused in '+S.fin+'s! 🎉':'BOOM 💥'}));
  },

  // ---------------- CLIENT ----------------
  mk(c){
    if(!document.getElementById('st-defuse')){const s=document.createElement('style');s.id='st-defuse';s.textContent=CSS;document.head.append(s);}
    let wrap,tm,pips,stk,roleEl,bodyEl,feed,pingBtn,ovBrief,ovFlash,ovPing,ovEnd;
    let S0=null,view=null,bodyKey='',lastFl=0,lastPg=0,lastSt='',lastRv=0,lastTick=0,cardUntil=0,pingUntil=0,ended='';
    const nm=id=>{const p=c.pl(id);return p?p.n:'?';};
    function pv(){return c.priv();}
    function curLeft(){const S=S0;if(!S)return 0;return S.run?Math.max(0,S.left-(c.t()-S.t)):S.left;}
    function setText(el,t){if(el.textContent!==t)el.textContent=t;}
    // ---------- manual ----------
    function renderPage(pg){
      const box=E('div','dfs-man');
      const h=E('h2');h.textContent=pg.t;box.append(h);
      const p=E('p','in');p.textContent=pg.intro;box.append(p);
      for(const s of pg.secs){
        const h3=E('h3');h3.textContent=s.h;box.append(h3);
        if(s.rows){const t=E('div','tb');for(const r of s.rows){const row=E('div','rw');const a=E('span','a'),b=E('span','b');a.textContent=r[0];b.textContent=r[1];row.append(a,b);t.append(row);}box.append(t);}
        if(s.cols){const g=E('div','cg');for(const col of s.cols){const d=E('div','cc');for(const sy of col){const x=E('span');x.textContent=sy;d.append(x);}g.append(d);}box.append(g);}
      }
      const n=E('p','nt');n.textContent=pg.note;box.append(n);
      return box;
    }
    // ---------- bomb views ----------
    function bombView(b,live){
      const box=E('div','dfs-bomb');let upd=()=>{};
      if(b.k==='wires'){
        const top=E('div','bt'),led=E('div','led'),ser=E('div','ser');
        led.innerHTML='<i></i><span></span>';led.firstChild.style.background=COL[b.led][2];led.lastChild.textContent='LED '+COL[b.led][1].toUpperCase();
        ser.innerHTML='<small>SERIAL</small><b></b>';ser.lastChild.textContent=b.serial;
        top.append(led,ser);box.append(top);
        const ws=E('div','wires'),els=[];let sel=-1;
        const cutB=E('button','cutb','✂️ Tap a wire first');cutB.disabled=true;
        b.cols.forEach((col,i)=>{
          const w=E('div','wire');w.innerHTML='<b></b><div class="ln"><i></i></div><span></span>';
          w.firstChild.textContent=i+1;w.querySelector('i').style.background=COL[col][2];w.lastChild.textContent=COL[col][1];
          if(live)w.addEventListener('pointerdown',e=>{e.preventDefault();if(w.classList.contains('cut'))return;sel=i;sfx.tap();refresh();});
          ws.append(w);els.push(w);
        });
        const refresh=()=>{els.forEach((w,i)=>w.classList.toggle('sel',i===sel));cutB.disabled=sel<0;cutB.textContent=sel<0?'✂️ Tap a wire first':'✂️ CUT WIRE '+(sel+1);};
        cutB.addEventListener('pointerdown',e=>{e.preventDefault();if(sel<0)return;c.act({k:'cut',i:sel});sel=-1;refresh();});
        box.append(ws);if(live)box.append(cutB);
        upd=nb=>{els.forEach((w,i)=>w.classList.toggle('cut',nb.cut.includes(i)));if(nb.cut.includes(sel)){sel=-1;refresh();}};
      }else if(b.k==='button'){
        const st=E('div','strip');st.innerHTML='<i></i><span></span>';st.firstChild.style.background=COL[b.strip][2];st.lastChild.textContent='STRIP · '+COL[b.strip][1].toUpperCase();
        const bw=E('div','bbw'),btn=E('div','bigb');btn.style.background=COL[b.col][2];btn.style.color=(b.col==='white'||b.col==='yellow')?'#111':'#fff';
        btn.innerHTML='<span></span><small></small>';btn.firstChild.textContent=b.label;btn.lastChild.textContent=COL[b.col][1].toUpperCase()+' BUTTON';
        const info=E('div','binfo');const taps=E('div','taps'),clk=E('div','bclk');info.append(taps,clk);
        let holding=false,downAt=0;
        if(live){
          btn.addEventListener('pointerdown',e=>{e.preventDefault();if(holding)return;holding=true;downAt=performance.now();try{btn.setPointerCapture(e.pointerId);}catch(x){}btn.classList.add('dn');sfx.tap();buzz(15);c.act({k:'bd'});});
          const up=e=>{if(!holding)return;holding=false;btn.classList.remove('dn');c.act({k:'bu',h:+((performance.now()-downAt)/1000).toFixed(2),l:+curLeft().toFixed(2)});};
          btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);
        }
        bw.append(btn);box.append(st,bw,info);
        box._clk=clk;
        upd=nb=>{setText(taps,nb.taps>0?'Taps so far: '+nb.taps:(live?'Tap · or press & hold':'')); btn.classList.toggle('hold',!!nb.holding&&!live);};
      }else{
        const bd=E('div','badge');bd.innerHTML='<i></i><span></span>';bd.firstChild.style.background=COL[b.badge][2];bd.lastChild.textContent='BADGE · '+COL[b.badge][1].toUpperCase();
        const grid=E('div','pad'),els=[];
        b.pad.forEach((s,i)=>{const t=E('div','sym');t.textContent=s;if(live)t.addEventListener('pointerdown',e=>{e.preventDefault();c.act({k:'sym',i});sfx.tap();});grid.append(t);els.push(t);});
        const pr=E('div','prog');box.append(bd,grid,pr);
        upd=nb=>{els.forEach((t,i)=>t.classList.toggle('on',nb.pressed.includes(i)));pr.textContent='●'.repeat(nb.prog)+'○'.repeat(4-nb.prog)+'  pressed '+nb.prog+'/4';};
      }
      box._upd=upd;return box;
    }
    function buildBody(p,S){
      bodyEl.innerHTML='';view=null;
      if(!p){bodyEl.innerHTML='<div class="dfs-wait">🔧 Get ready…</div>';return;}
      if(p.role==='D'){
        const bomb=bombView(p.bomb,true);let man=null;
        if(p.man){
          man=renderPage(p.man);man.style.display='none';
          const tabs=E('div','tabs'),t1=E('button','on','💣 BOMB'),t2=E('button','','📙 MANUAL B');
          const sw=m=>{t1.classList.toggle('on',m===0);t2.classList.toggle('on',m===1);bomb.style.display=m?'none':'';man.style.display=m?'':'none';};
          t1.addEventListener('pointerdown',e=>{e.preventDefault();sw(0);});t2.addEventListener('pointerdown',e=>{e.preventDefault();sw(1);});
          tabs.append(t1,t2);bodyEl.append(tabs);
        }
        bodyEl.append(bomb);if(man)bodyEl.append(man);
        view={bomb,upd:()=>{const q=pv();if(q&&q.bomb)bomb._upd(q.bomb);}};
      }else if(p.role==='S'){
        const note=E('div','dfs-note','🔭 Read-only copy of the bomb — help the Defuser talk!');
        const bomb=bombView(p.bomb,false);bodyEl.append(note,bomb);
        view={bomb,upd:()=>{const q=pv();if(q&&q.bomb)bomb._upd(q.bomb);}};
      }else{
        const note=E('div','dfs-note','🙈 You can\'t see the bomb. Ask the Defuser what\'s on it!');
        bodyEl.append(note,renderPage(p.man));
      }
    }
    function roleCard(S,p,big){
      const R=c.R();const ri=p?ROLEI[p.role]:null;if(!ri)return;
      const two=S.ro.a!==-1&&S.ro.b===S.ro.d;
      const who=[ 'Defuser: '+nm(S.ro.d),'Manual A: '+nm(S.ro.a)].concat(S.ro.b===S.ro.d?['Manual B: '+nm(S.ro.d)+' (too)']:['Manual B: '+nm(S.ro.b)]);
      if(S.ro.s!=null)who.push('Spotter: '+nm(S.ro.s));
      const sub={D:two?'You see the bomb AND hold Manual B (tab 📙). Your friend holds Manual A. Describe the bomb!':'You see the bomb. You have NO manual. Describe EVERYTHING out loud!',
        A:'FIELD GUIDE. You can\'t see the bomb — ask the Defuser what\'s on it.',B:'PROCEDURES. You can\'t see the bomb — ask the Defuser and team up with Manual A.',S:'You can see the bomb (read-only). Help everyone talk, and tap 📣 to get the Defuser\'s attention.'}[p.role];
      ovBrief.innerHTML='<div class="e"></div><h2></h2><h3></h3><p></p><div class="who"></div>';
      ovBrief.children[0].textContent=ri[0];ovBrief.children[1].textContent='YOU ARE '+(p.role==='D'?'THE ':'')+ri[1].replace('MANUAL ','HOLDING MANUAL ');
      ovBrief.children[1].style.color=ri[2];
      ovBrief.children[2].textContent='Module '+(S.mi+1)+'/3 · '+KNAME[S.mods[S.mi].k];ovBrief.children[3].textContent=sub;ovBrief.children[4].textContent=who.join('  ·  ');
      ovBrief.style.borderColor=ri[2];
    }
    return{
      mount(root){
        wrap=E('div','dfs');
        const hd=E('div','dfs-hd');
        tm=E('div','tm','1:45');pips=E('div','pips');stk=E('div','stk');hd.append(tm,pips,stk);
        roleEl=E('div','dfs-role','🔧 Get ready…');
        bodyEl=E('div','dfs-body','<div class="dfs-wait">🔧 Get ready…</div>');
        const fr=E('div','dfs-fr');feed=E('div','dfs-feed');pingBtn=E('button','ping','📣 LOOK!');
        pingBtn.addEventListener('pointerdown',e=>{e.preventDefault();sfx.tap();c.act({k:'ping'});pingBtn.classList.add('cd');setTimeout(()=>pingBtn.classList.remove('cd'),1500);});
        fr.append(feed,pingBtn);
        ovBrief=E('div','dfs-ov brief');ovFlash=E('div','dfs-flash');ovPing=E('div','dfs-ping');ovEnd=E('div','dfs-ov end');
        wrap.append(hd,roleEl,bodyEl,fr,ovBrief,ovFlash,ovPing,ovEnd);root.append(wrap);
      },
      start(){},
      stop(){},
      update(S,R){
        S0=S;
        // header
        const strikes=S.k;stk.textContent='';for(let i=0;i<3;i++){const x=E('i',i<strikes?'x on':'x');x.textContent='✖';stk.append(x);}
        if(pips.childElementCount!==S.mods.length){pips.innerHTML='';S.mods.forEach(()=>pips.append(E('i')));}
        S.mods.forEach((m,i)=>{pips.children[i].className=(m.done?'ok':i===S.mi?'cur':'');pips.children[i].textContent=m.done?'✓':(i+1);});
        const p=S.st==='wait'?null:pv();
        const key=[S.mi,S.rv,p?p.role:'-',S.st==='wait'].join('|');
        if(key!==bodyKey){bodyKey=key;buildBody(p,S);if(S.st!=='wait'&&p){roleCard(S,p);}}
        if(view)view.upd();
        if(p){const ri=ROLEI[p.role];roleEl.style.background=ri[2];setText(roleEl,ri[0]+' '+ri[1]+(p.role==='D'&&p.man?' + MANUAL B':'')+' · '+KNAME[S.mods[S.mi].k]+' ('+(S.mi+1)+'/3)');}
        else setText(roleEl,'🔧 Get ready…');
        // brief card (module start or mid-play role change)
        if(S.rv!==lastRv){lastRv=S.rv;if(S.st==='play'&&p){roleCard(S,p);cardUntil=performance.now()+2600;}}
        ovBrief.classList.toggle('on',S.st==='brief'||performance.now()<cardUntil);ovBrief.classList.toggle('soft',S.st!=='brief');
        if(S.st==='brief'&&lastSt!=='brief'&&p){sfx.go();buzz([40,30,40]);}
        // feed + ping button
        feed.innerHTML='';S.ev.slice(-3).forEach(e=>{const d=E('div',e.ok?'g':'b');d.textContent=nm(e.id)+': '+e.tx;feed.append(d);});
        pingBtn.style.display=(p&&p.role!=='D'&&S.st!=='wait'&&S.st!=='won'&&S.st!=='boom')?'':'none';
        // strike flash
        if(S.fl!==lastFl){if(lastFl!==0||S.fl>0){ovFlash.classList.remove('go');void ovFlash.offsetWidth;ovFlash.classList.add('go');wrap.classList.remove('shk');void wrap.offsetWidth;wrap.classList.add('shk');sfx.bad();buzz([90,40,90]);}lastFl=S.fl;}
        // ping
        if(S.pg.n!==lastPg){lastPg=S.pg.n;if(p&&p.role==='D'&&S.pg.n>0){ovPing.textContent='📣 '+nm(S.pg.from)+': LOOK HERE!';ovPing.classList.add('on');pingUntil=performance.now()+1500;sfx.go();buzz([60,40,60]);}}
        // endings
        if(S.st==='won'&&ended!=='won'){ended='won';ovEnd.className='dfs-ov end on won';ovEnd.innerHTML='<div class="e">🎉</div><h2>DEFUSED!</h2><p></p><div class="cf"></div>';ovEnd.querySelector('p').textContent='Team time: '+S.fin+'s · '+S.k+' strike'+(S.k===1?'':'s');
          const cf=ovEnd.querySelector('.cf');for(let i=0;i<24;i++){const x=E('i');x.style.left=(Math.random()*100)+'%';x.style.background=COLORS[i%4];x.style.animationDelay=(Math.random()*1.2)+'s';cf.append(x);}sfx.win();buzz([60,40,60,40,120]);}
        if(S.st==='boom'&&ended!=='boom'){ended='boom';ovEnd.className='dfs-ov end on boom';ovEnd.innerHTML='<div class="e">💥</div><h2>BOOM</h2><p>The bomb went off. Everyone is in tiny pieces.</p>';sfx.boom();buzz([300,60,200]);wrap.classList.add('shk');}
        lastSt=S.st;
      },
      frame(rem){
        const S=S0;if(!S)return;
        let left=S.left;if(S.run)left=Math.max(0,left-(c.t()-S.t));
        setText(tm,fmtT(left));tm.classList.toggle('urg',left<20&&S.run);wrap.classList.toggle('red',left<10&&S.run);
        if(view&&view.bomb&&view.bomb._clk)setText(view.bomb._clk,'⏱ '+fmtT(left));
        if(S.st==='brief'||performance.now()<cardUntil){const t=Math.max(0,S.pe-c.t());const sec=S.st==='brief'?'Clock starts in '+Math.ceil(t)+'…':'';let el=ovBrief.querySelector('.cd');if(!el&&S.st==='brief'){el=E('div','cd');ovBrief.append(el);}if(el)el.textContent=sec;}
        if(pingUntil&&performance.now()>pingUntil){pingUntil=0;ovPing.classList.remove('on');}
        if(S.run){const iv=left>45?1:left>25?.7:left>12?.45:.25,now=performance.now();if(now-lastTick>iv*1000){lastTick=now;sfx.tick();if(left<12)buzz(12);}}
      }
    };
  }
};
const CSS=`
.dfs{position:absolute;inset:0;display:flex;flex-direction:column;gap:5px;padding:6px 8px 6px}
.dfs.shk{animation:dfsshk .4s}
.dfs.red::after{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 40px 6px #ff1a1a;animation:dfsr .5s infinite alternate;z-index:4}
@keyframes dfsr{from{opacity:1}to{opacity:.25}}
@keyframes dfsshk{20%{transform:translate(-9px,4px)}40%{transform:translate(8px,-5px)}60%{transform:translate(-6px,3px)}80%{transform:translate(4px,-2px)}}
.dfs-hd{flex:0 0 auto;display:flex;align-items:center;gap:8px;height:50px}
.dfs .tm{font-size:38px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1;background:#000;border:2px solid #333;border-radius:12px;padding:3px 12px;color:#ff4b4b;font-family:ui-monospace,Menlo,monospace;text-shadow:0 0 10px #f00a}
.dfs .tm.urg{animation:dfsp .5s infinite alternate}
@keyframes dfsp{to{background:#4a0000;color:#fff}}
.dfs .pips{display:flex;gap:5px;flex:1;justify-content:center}
.dfs .pips i{width:30px;height:30px;border-radius:50%;background:var(--panel);display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:900;font-size:14px;color:var(--dim)}
.dfs .pips i.cur{background:#ffd23f;color:#000}.dfs .pips i.ok{background:#52ff7a;color:#000}
.dfs .stk{display:flex;gap:3px}.dfs .stk .x{font-style:normal;font-size:20px;opacity:.25}.dfs .stk .x.on{opacity:1;color:#ff4b4b}
.dfs-role{flex:0 0 auto;border-radius:10px;padding:5px 10px;font-weight:900;font-size:14px;color:#111;text-align:center;background:var(--panel2)}
.dfs-body{flex:1 1 0;min-height:0;display:flex;flex-direction:column;gap:6px;position:relative}
.dfs-wait{margin:auto;font-size:24px;font-weight:900}
.dfs-note{font-size:13px;color:#cfcff0;text-align:center;font-weight:700}
.dfs-man{flex:1 1 0;min-height:0;overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;background:#f4ecd6;color:#2b2112;border-radius:12px;padding:10px 12px 14px;font-size:15.5px;line-height:1.3}
.dfs-man h2{margin:0 0 4px;font-size:18px}.dfs-man h3{margin:10px 0 4px;font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:#7a5a1a}
.dfs-man p{margin:4px 0}.dfs-man .nt{font-size:14px;color:#5a4420;border-top:2px dashed #b9a56a;margin-top:10px;padding-top:6px}
.dfs-man .tb{display:flex;flex-direction:column;gap:3px}
.dfs-man .rw{display:flex;gap:8px;justify-content:space-between;background:#e8dcb8;border-radius:8px;padding:6px 9px;font-weight:700}
.dfs-man .rw .b{text-align:right;font-weight:900}
.dfs-man .cg{display:flex;gap:5px}.dfs-man .cc{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;background:#e8dcb8;border-radius:8px;padding:5px 0;font-size:25px;line-height:1.15}
.dfs-bomb{flex:1 1 0;min-height:0;display:flex;flex-direction:column;gap:8px;background:#20203d;border:3px solid #3a3a6a;border-radius:16px;padding:10px;overflow:hidden}
.dfs-bomb .bt{display:flex;gap:8px}
.dfs-bomb .led,.dfs-bomb .ser,.dfs-bomb .strip,.dfs-bomb .badge{display:flex;align-items:center;gap:8px;background:#11112a;border-radius:10px;padding:7px 10px;font-weight:900;font-size:15px}
.dfs-bomb .led{flex:1}.dfs-bomb .ser{flex:1;flex-direction:column;gap:0;align-items:flex-start}.dfs-bomb .ser small{font-size:10px;color:var(--dim)}.dfs-bomb .ser b{font-family:ui-monospace,Menlo,monospace;font-size:22px;letter-spacing:3px}
.dfs-bomb .led i,.dfs-bomb .strip i,.dfs-bomb .badge i{width:24px;height:24px;border-radius:50%;display:block;box-shadow:0 0 10px currentColor;border:2px solid #fff6}
.dfs-bomb .strip i{width:60px;height:14px;border-radius:7px}
.dfs-bomb .wires{display:flex;flex-direction:column;gap:6px;flex:1;justify-content:center}
.dfs .wire{display:flex;align-items:center;gap:8px;min-height:44px;flex:1 1 0;max-height:56px;border-radius:10px;padding:0 6px;border:2px solid transparent}
.dfs .wire b{width:24px;text-align:center;font-size:18px;color:var(--dim)}
.dfs .wire .ln{flex:1;height:18px;display:flex;align-items:center}.dfs .wire .ln i{display:block;width:100%;height:100%;border-radius:9px;border:2px solid #fff6;box-shadow:0 3px 0 #0006}
.dfs .wire span{width:62px;font-size:14px;font-weight:800;text-transform:uppercase;text-align:left}
.dfs .wire.sel{border-color:#ffd23f;background:#33335f}
.dfs .wire.cut{opacity:.35}.dfs .wire.cut .ln i{width:38%;box-shadow:none}.dfs .wire.cut .ln::after{content:'✂️';margin-left:6px}
.dfs .cutb{flex:0 0 auto;min-height:54px;border:0;border-radius:14px;background:linear-gradient(180deg,#ff6498,#ff3d81);color:#fff;font-weight:900;font-size:19px;box-shadow:0 4px 0 #a91d51}
.dfs .cutb:disabled{opacity:.4;background:#3a3a6a;box-shadow:none}
.dfs .bbw{flex:1;display:flex;align-items:center;justify-content:center}
.dfs .bigb{width:min(62vw,220px);height:min(62vw,220px);max-height:100%;aspect-ratio:1;border-radius:50%;border:8px solid #0007;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:30px;box-shadow:0 8px 0 #0008;touch-action:none;transition:transform .05s}
.dfs .bigb small{font-size:11px;opacity:.7;letter-spacing:1px}
.dfs .bigb.dn{transform:translateY(6px);box-shadow:0 2px 0 #0008;filter:brightness(1.25)}
.dfs .bigb.hold{filter:brightness(1.3)}
.dfs .binfo{text-align:center;font-weight:800;color:#cfcff0;min-height:46px}.dfs .bclk{font-size:26px;font-family:ui-monospace,Menlo,monospace;color:#ff6b6b}
.dfs .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex:1;min-height:0}
.dfs .sym{display:flex;align-items:center;justify-content:center;background:#11112a;border-radius:14px;font-size:min(13vw,52px);min-height:56px;border:3px solid transparent}
.dfs .sym.on{background:#12351f;border-color:#52ff7a;opacity:.7}
.dfs .prog{text-align:center;font-weight:900;letter-spacing:2px;font-size:15px;color:#cfcff0}
.dfs .tabs{display:flex;gap:6px;flex:0 0 auto}.dfs .tabs button{flex:1;height:44px;border:0;border-radius:12px;background:var(--panel);font-weight:900;font-size:15px}.dfs .tabs button.on{background:#3b3b78;box-shadow:inset 0 0 0 3px #fff}
.dfs-fr{flex:0 0 auto;display:flex;gap:6px;min-height:50px;align-items:stretch}
.dfs-feed{flex:1;min-width:0;background:var(--panel);border-radius:12px;padding:4px 9px;font-size:13px;line-height:16px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
.dfs-feed div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dfs-feed .g{color:#52ff7a}.dfs-feed .b{color:#ff7b7b}
.dfs .ping{flex:0 0 96px;border:0;border-radius:12px;background:#33335f;font-weight:900;font-size:15px;color:#fff}.dfs .ping:active{transform:scale(.95)}.dfs .ping.cd{opacity:.4}
.dfs-ov{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:20px;background:rgba(11,11,23,.96);z-index:5;border:6px solid transparent}
.dfs-ov.on{display:flex}
.dfs-ov.soft{pointer-events:none;background:rgba(11,11,23,.82)}
.dfs-ov .e{font-size:84px;line-height:1}.dfs-ov h2{margin:0;font-size:28px;font-weight:900}.dfs-ov h3{margin:0;font-size:19px;color:#ffd23f}.dfs-ov p{margin:0;color:#d4d4f4;font-size:16px;max-width:310px;line-height:1.35}
.dfs-ov .who{font-size:12px;color:var(--dim);max-width:320px;margin-top:6px}.dfs-ov .cd{font-weight:900;font-size:18px;color:#52ff7a;margin-top:8px}
.dfs-ov.end.won{background:radial-gradient(circle,#124a2a,#0b0b17)}.dfs-ov.end.boom{background:radial-gradient(circle,#ff8a1a,#6a0000 70%);}
.dfs-ov.boom .e{font-size:150px;animation:dfsb .6s ease-out}
@keyframes dfsb{0%{transform:scale(.1) rotate(-30deg)}60%{transform:scale(1.5)}100%{transform:scale(1)}}
.dfs-ov.won .e{animation:dfsb .6s}
.dfs-ov .cf{position:absolute;inset:0;overflow:hidden;pointer-events:none}.dfs-ov .cf i{position:absolute;top:-20px;width:10px;height:16px;animation:fall 2.6s linear infinite}
.dfs-flash{position:absolute;inset:0;background:#ff1a1a;opacity:0;pointer-events:none;z-index:6}.dfs-flash.go{animation:dfsf .6s}
@keyframes dfsf{0%{opacity:.75}100%{opacity:0}}
.dfs-ping{position:absolute;left:10px;right:10px;top:60px;z-index:7;background:#ffd23f;color:#000;font-weight:900;font-size:22px;text-align:center;padding:14px;border-radius:16px;display:none;animation:dfsp2 .3s infinite alternate}
.dfs-ping.on{display:block}
@keyframes dfsp2{to{transform:scale(1.04)}}
`;

// ---------- host helpers ----------
function plName(H,id){const p=H.players.find(p=>p.id===id);return p?p.name:'?';}
function pushEv(S,id,tx,ok){S.ev.push({i:++S.es,id,tx,ok:ok?1:0});if(S.ev.length>6)S.ev.shift();}
function roleKey(H,S){return H.players.filter(p=>!p.aw).map(p=>p.id).join(',')+'|'+S.mi;}
function assignRoles(H,S){
  const act=H.players.filter(p=>!p.aw),n=act.length,G=S._G;
  const L=act.map((_,i)=>act[(S.mi+G.off+i)%n]);
  S.ro={d:L[0].id,a:L[1].id,b:n>=3?L[2].id:L[0].id,s:n>=4?L[3].id:null};
  S._rk=roleKey(H,S);
  const kind=S.mods[S.mi].k,pr={};
  for(const p of H.players){
    const base={mi:S.mi,mk:kind};
    if(p.id===S.ro.d)pr[p.id]=Object.assign(base,{role:'D',bomb:S._bs,man:S.ro.b===S.ro.d?page(S._G.rules,kind,'B'):null});
    else if(p.id===S.ro.a)pr[p.id]=Object.assign(base,{role:'A',man:page(S._G.rules,kind,'A')});
    else if(p.id===S.ro.b)pr[p.id]=Object.assign(base,{role:'B',man:page(S._G.rules,kind,'B')});
    else if(p.id===S.ro.s)pr[p.id]=Object.assign(base,{role:'S',bomb:S._bs});
    else pr[p.id]=Object.assign(base,{role:'S',bomb:S._bs});     // away players coming back mid-module just spectate
  }
  S._priv=pr;
}
function startModule(H,S,mi){
  S.mi=mi;S.st='brief';S.run=false;S.hd=0;S.pe=S.t+(mi===0?BRIEF1:BRIEF);
  const kind=S.mods[mi].k,m=S._G.mods[kind];
  S._bs=JSON.parse(JSON.stringify(m.b));S._ans=m.a;S._tapT=0;
  assignRoles(H,S);
}
function strike(H,S,tx,pid){
  S.k++;S.fl++;S.left=Math.max(0,S.left-PENALTY);pushEv(S,pid==null?S.ro.d:pid,tx,0);
  const bs=S._bs;if(bs.k==='button'){bs.holding=false;bs.taps=0;S.hd=0;}
  if(S.left<=0)boom(S);
}
function solved(H,S,tx,pid){
  pushEv(S,pid==null?S.ro.d:pid,tx+' ✓ MODULE DONE',1);S.mods[S.mi].done=1;
  if(S.mi>=S.mods.length-1){S.st='won';S.run=false;S.over=true;S.hold=4;S.fin=Math.round(S.total-S.left);S._priv={};}
  else startModule(H,S,S.mi+1);
}
function boom(S){if(S.st==='boom'||S.st==='won')return;S.st='boom';S.run=false;S.over=true;S.hold=3.5;S.left=0;}

GAMES.defuse._gen=gen;GAMES.defuse._page=page;GAMES.defuse._consts={WIRE_COLS,LED_COLS,BTN_COLS,SYMS,TOTAL,PENALTY};
})();
