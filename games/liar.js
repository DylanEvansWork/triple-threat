// LIAR'S DICE — bluffing with secret dice. Host rolls/validates; clients animate the reveal from S.rv.
(function(){
const FACES=[1,2,3,4,5,6];
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const TIMER=20,TIMER2=12,TIMER3=8,T_SLOW=70,T_OT=95;

function ldTl(rv){
  const n=rv.order.length,T={flip:[]};
  for(let i=0;i<n;i++)T.flip.push(.75+.55*i);
  T.count=.75+.55*n+.3;
  T.step=.3;
  T.verdict=T.count+.3*rv.cnt+(rv.cnt?.45:.6);
  T.end=T.verdict+(rv.out?2.1:1.7);
  return T;
}
const raiseLo=(prev)=>prev?(prev.f===6?prev.q+1:prev.q):1;
function legal(prev,q,f,total){
  if(!Number.isInteger(q)||!Number.isInteger(f)||f<1||f>6||q<1||q>total)return false;
  if(!prev)return true;
  return q>prev.q||(q===prev.q&&f>prev.f);
}
function nextAlive(S,id){
  const k=S.ids.indexOf(id);
  for(let i=1;i<=S.ids.length;i++){const x=S.ids[(k+i)%S.ids.length];if(S.dc[x]>0)return x;}
  return id;
}
function tot(S){return S.ids.reduce((a,i)=>a+S.dc[i],0);}
function timerFor(S){return S.t>=T_OT?TIMER3:S.t>=T_SLOW?TIMER2:TIMER;}
function roll(S){
  S._dice={};S._priv={};
  S.ids.forEach(id=>{const d=[];for(let i=0;i<S.dc[id];i++)d.push(1+Math.floor(Math.random()*6));S._dice[id]=d;S._priv[id]={dice:d.slice()};});
  S.total=tot(S);
}
function startTurn(S,id){S.turn=id;S.ph='bid';S.pickAt=S.t;S.dl=S.t+timerFor(S);}
function doBid(S,id,q,f,auto){
  S.bid={q,f,by:id};S.bids.push({id,q,f,auto:auto?1:0});
  startTurn(S,nextAlive(S,id));
}
function doCall(S,caller){
  const bid=S.bid,bidder=bid.by;
  let cnt=0;const dice={};
  S.ids.forEach(id=>{if(S.dc[id]>0){dice[id]=S._dice[id].slice();dice[id].forEach(v=>{if(v===bid.f)cnt++;});}});
  const ok=cnt>=bid.q,loser=ok?caller:bidder;
  const dmg=Math.min(S.dc[loser],S.ot?2:1);
  const order=S.ids.filter(id=>S.dc[id]>0);
  const before={};order.forEach(id=>before[id]=S.dc[id]);
  S.dc[loser]-=dmg;S.total=tot(S);
  const out=S.dc[loser]<=0;if(out&&!S.out.includes(loser))S.out.push(loser);
  S.rv={rd:S.rd,caller,bidder,bid:{q:bid.q,f:bid.f},dice,order,cnt,ok,loser,dmg,out,before};
  S.ph='reveal';S.rvAt=S.t;S.rvEnd=S.t+ldTl(S.rv).end;
  S.fin=S.ids.filter(i=>S.dc[i]>0).length<=1;
}
function autoMove(S){
  const id=S.turn;
  if(!S.bid){
    const d=S._dice[id]||[],cn={};d.forEach(v=>cn[v]=(cn[v]||0)+1);
    let bf=1,bc=0;for(let f=1;f<=6;f++)if((cn[f]||0)>bc){bc=cn[f]||0;bf=f;}
    doBid(S,id,Math.max(1,bc),bf,true);return;
  }
  const p=S.bid;let q=p.q,f=p.f+1;if(f>6){q++;f=1;}
  if(legal(S.bid,q,f,S.total))doBid(S,id,q,f,true);else doCall(S,id);
}
function purgeAway(H,S){
  let changed=false;
  H.players.forEach(pl=>{
    if(pl.aw&&S.dc[pl.id]>0){S.dc[pl.id]=0;S.gone[pl.id]=1;if(!S.out.includes(pl.id))S.out.push(pl.id);changed=true;}
  });
  if(changed){
    S.total=tot(S);
    const alive=S.ids.filter(i=>S.dc[i]>0);
    if(alive.length<=1){S.over=true;S.hold=2.6;S.fin=true;return;}
    if(S.dc[S.turn]<=0)startTurn(S,nextAlive(S,S.turn));
  }
}

GAMES.liar={
  name:'Liar’s Dice',emoji:'🎲',tag:'Bid on dice you can’t see. Call out the liar.',
  min:2,max:4,
  rules:[
    ['🎲','Everyone secretly rolls 3 dice (4 if it’s 1v1). You only see YOUR dice — your friends’ cups stay hidden.'],
    ['📣','On your turn, BID how many dice of one number are on the table in total (ALL players). Example: “four 5s”.'],
    ['⬆️','Each bid must beat the last: a higher count (five 2s beats four 5s) or the same count with a higher number (four 6s beats four 5s).'],
    ['🚨','Or call LIAR! Everyone shows their dice. If at least that many exist, the CALLER loses a die; if not, the BIDDER does. The loser starts the next round.'],
    ['💀','Lose all your dice and you’re out. Last one with dice wins. 20 seconds per turn — don’t hesitate, they’ll smell it.']
  ],
  ctrl:'Pick a quantity (− / +) and a number, tap BID — or tap the red LIAR! button. Only legal raises are allowed.',
  win:'Last player with dice wins. The earlier you’re out, the lower you rank.',
  dur:150,hz:10,

  init(H){
    const ids=H.players.map(p=>p.id),sd=ids.length===2?4:3,dc={};
    ids.forEach(i=>dc[i]=sd);
    const S={n:ids.length,ids,sd,dc,rd:1,turn:ids[0],bid:null,bids:[],ph:'bid',pickAt:0,dl:TIMER,rv:null,rvAt:0,rvEnd:0,out:[],gone:{},total:0,ot:false,fin:false};
    roll(S);return S;
  },
  begin(H,S){startTurn(S,S.ids[0]);},
  act(H,S,pid,m){
    if(S.over||S.ph!=='bid'||S.turn!==pid||S.dc[pid]<=0)return;
    if(m.k==='call'){if(S.bid)doCall(S,pid);}
    else if(m.k==='bid'){const q=+m.q,f=+m.f;if(legal(S.bid,q,f,S.total))doBid(S,pid,q,f,false);}
  },
  tick(H,S,dt){
    if(S.over)return;
    if(S.t>=T_OT)S.ot=true;
    if(S.ph==='bid'){
      purgeAway(H,S);if(S.over)return;
      if(S.t>=S.dl)autoMove(S);
    }else if(S.ph==='reveal'&&S.t>=S.rvEnd){
      if(S.fin){S.over=true;S.hold=2.6;return;}
      purgeAway(H,S);if(S.over)return;
      const lo=S.rv.loser,start=S.dc[lo]>0?lo:nextAlive(S,lo);
      S.rd++;S.bid=null;S.bids=[];roll(S);startTurn(S,start);
    }
  },
  score(H,S){
    const ids=H.players.map(p=>p.id),n=ids.length;
    const key=id=>{if((S.dc[id]||0)>0)return[1e6,S.dc[id]];return[S.out.indexOf(id),0];};
    const cmp=(a,b)=>{const x=key(a),y=key(b);return(y[0]-x[0])||(y[1]-x[1]);};
    const s=ids.slice().sort(cmp),rows=[];
    const alive=ids.filter(i=>(S.dc[i]||0)>0);
    s.forEach((id,i)=>{const rank=(i>0&&cmp(s[i-1],id)===0)?rows[i-1].rank:i;
      rows.push({id,rank,pts:Math.max(0,n-rank),label:S.dc[id]>0?(alive.length===1?'🏆 last with dice':S.dc[id]+' 🎲 left'):(S.gone[id]?'left the party':'out')});});
    return rows;
  },

  // ---------------- CLIENT ----------------
  mk(c){
    let S=null,root,ui={},built=false,timers=[],sel={q:1,f:1},selKey='',stage={rd:-1},lastSec=-1,wasOver=false,bannerT=0,revRd=-1,lastTurn=null;
    const mkE=(t,cl,tx)=>{const e=document.createElement(t);if(cl)e.className=cl;if(tx!=null)e.textContent=tx;return e;};
    const later=(f,ms)=>{const id=setTimeout(f,ms);timers.push(id);return id;};
    const nowT=()=>(c.R()&&c.R().ph==='play')?c.t():(S?S.t:0);
    const nm=id=>{const p=c.pl(id);return p?p.n:'?';};
    const me=()=>c.me();
    const myDice=()=>{const p=c.priv();return p&&p.dice?p.dice:[];};
    function die(v,sz,back){
      const d=mkE('div','ld-die'+(back?' back':''));d.style.setProperty('--s',sz+'px');
      for(let i=0;i<9;i++)d.append(mkE('i'));
      if(back){d.dataset.v=v;}else setFace(d,v);
      return d;
    }
    function setFace(d,v){d.classList.remove('back');[...d.children].forEach((e,i)=>e.className=(PIPS[v]||[]).includes(i)?'on':'');d.dataset.v=v;}

    function css(){
      if(document.getElementById('st-liar'))return;
      const s=document.createElement('style');s.id='st-liar';
      s.textContent=`
.ld{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;padding:6px 8px 8px;overflow:hidden}
.ld-top{display:flex;align-items:center;gap:8px;min-height:28px}
.ld-rd{font-weight:900;font-size:14px;color:#cfcff0;white-space:nowrap}
.ld-ot{flex:1;text-align:center;font-weight:900;font-size:12px;color:#8d8db8}
.ld-ot.on{color:#fff;background:#a01d3c;border-radius:9px;padding:3px 6px;animation:ldpulse .8s infinite alternate}
.ld-clock{font-weight:900;font-size:24px;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.ld-clock.low{color:#ff4d6d;animation:ldpulse .4s infinite alternate}
.ld-bar{height:6px;background:#ffffff14;border-radius:4px;overflow:hidden;flex:0 0 auto}
.ld-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#19d3ff,#ff3d81)}
.ld-pls{display:flex;gap:5px;flex:0 0 auto}
.ld-pc{flex:1;min-width:0;background:var(--panel);border-radius:12px;padding:6px 7px 6px;border-bottom:5px solid var(--c);text-align:center;position:relative;transition:opacity .3s,transform .2s,background .2s}
.ld-pc.turn{background:#2a2a5a;transform:translateY(-2px);box-shadow:0 0 0 2px var(--c),0 0 16px var(--c)}
.ld-pc.out{opacity:.35;filter:grayscale(1)}
.ld-pc .n{font-weight:900;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ld-pc .dd{display:flex;justify-content:center;gap:3px;margin-top:4px;min-height:16px;flex-wrap:wrap}
.ld-pc .dd i{display:block;width:15px;height:15px;border-radius:4px;background:var(--c)}
.ld-pc .dd i.x{background:transparent;border:2px dashed #44446e}
.ld-pc .lb{font-size:11px;font-weight:800;color:#c6c6e8;margin-top:3px;min-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ld-turn{flex:0 0 auto;text-align:center;font-weight:900;font-size:16px;border-radius:12px;padding:6px 8px;background:#1d1d40;color:#cfcff0;min-height:34px;display:flex;align-items:center;justify-content:center;gap:6px}
.ld-turn.me{background:linear-gradient(90deg,#1d8f4f,#35c46f);color:#fff;animation:ldpulse .7s infinite alternate}
.ld-turn .dot{width:12px;height:12px;border-radius:50%;background:var(--c);display:inline-block}
.ld-bidbox{flex:1 1 auto;min-height:92px;background:#111127;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px 8px;overflow:hidden}
.ld-bl{font-size:12px;font-weight:900;letter-spacing:1px;color:#8d8db8}
.ld-bb{display:flex;align-items:center;gap:12px}
.ld-bq{font-size:min(17vw,70px);font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.ld-bx{font-size:28px;font-weight:900;color:#8d8db8}
.ld-bw{font-size:14px;font-weight:800;color:#cfcff0}
.ld-bb.pop{animation:ldpop .4s}
.ld-hist{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;max-height:52px;overflow:hidden}
.ld-hc{display:inline-flex;align-items:center;gap:3px;background:#ffffff12;border-radius:8px;padding:2px 7px 2px 3px;font-size:12px;font-weight:800;color:#e0e0ff;white-space:nowrap}
.ld-hc b{display:inline-block;color:#111;border-radius:6px;padding:0 5px;font-size:11px}
.ld-hc.cur{background:#ffffff30}
.ld-mine{display:flex;align-items:center;justify-content:center;gap:8px;flex:0 0 auto;min-height:56px}
.ld-mine .t{font-size:11px;font-weight:900;color:#8d8db8;letter-spacing:1px;margin-right:2px;text-align:right;line-height:1.2}
.ld-die{--s:44px;width:var(--s);height:var(--s);border-radius:20%;background:linear-gradient(160deg,#fff,#d8d8ee);display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:calc(var(--s)*.15);gap:calc(var(--s)*.03);box-shadow:0 3px 0 #0009;flex:0 0 auto}
.ld-die i{border-radius:50%;background:transparent;display:block}
.ld-die i.on{background:#14142a}
.ld-die.red i.on{background:#d11f3d}
.ld-die.back{background:linear-gradient(160deg,#4a4a8a,#2a2a58)}
.ld-die.back i{display:none}
.ld-die.back::after{content:'?';grid-area:1/1/4/4;display:flex;align-items:center;justify-content:center;font-weight:900;color:#aab;font-size:calc(var(--s)*.5)}
.ld-die.hit{background:linear-gradient(160deg,#ffe27a,#ffb020);box-shadow:0 0 16px #ffc83a,0 3px 0 #0009;animation:ldpop .35s}
.ld-die.dim{opacity:.3}
.ld-ctl{flex:0 0 auto;display:flex;flex-direction:column;gap:6px}
.ld-row{display:flex;gap:6px;align-items:stretch}
.ld-q{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--panel);border-radius:14px;padding:4px 6px}
.ld-q .lab{font-size:11px;font-weight:900;color:#8d8db8;letter-spacing:1px;line-height:1.1;text-align:center}
.ld-q .v{font-size:36px;font-weight:900;min-width:40px;text-align:center;font-variant-numeric:tabular-nums}
.ld-st{width:56px;height:52px;border:0;border-radius:14px;background:#34346d;color:#fff;font-size:30px;font-weight:900;box-shadow:0 3px 0 #14142f;touch-action:manipulation}
.ld-st:active{transform:translateY(2px)}
.ld-st[disabled]{opacity:.25}
.ld-fs{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
.ld-fb{border:0;border-radius:12px;background:var(--panel);padding:5px 0;display:flex;align-items:center;justify-content:center;touch-action:manipulation;min-height:50px;border:3px solid transparent}
.ld-fb .ld-die{--s:36px}
.ld-fb.sel{border-color:#ffd23f;background:#3a3216}
.ld-fb[disabled]{opacity:.22}
.ld-btns{display:flex;gap:8px}
.ld-bid{flex:2;border:0;border-radius:16px;min-height:58px;background:linear-gradient(180deg,#3fd47a,#1d9a55);color:#fff;font-weight:900;font-size:20px;box-shadow:0 4px 0 #0a5a2e;touch-action:manipulation}
.ld-call{flex:1.1;border:0;border-radius:16px;min-height:58px;background:linear-gradient(180deg,#ff5a5a,#c92a3e);color:#fff;font-weight:900;font-size:20px;box-shadow:0 4px 0 #6d0f1d;touch-action:manipulation}
.ld-bid:active,.ld-call:active{transform:translateY(3px);box-shadow:none}
.ld-bid[disabled],.ld-call[disabled]{opacity:.28;filter:grayscale(.6);pointer-events:none}
.ld-off .ld-st,.ld-off .ld-fb{opacity:.35;pointer-events:none}
.ld-rev{position:absolute;inset:0;background:#0b0b17;z-index:6;display:none;flex-direction:column;align-items:center;gap:8px;padding:12px 10px;overflow:hidden}
.ld-rev.on{display:flex}
.ld-rt{font-weight:900;font-size:21px;text-align:center;animation:ldslam .45s;line-height:1.15}
.ld-rt b{color:#ff4d6d}
.ld-rb{display:flex;align-items:center;gap:10px;background:#1d1d40;border-radius:14px;padding:6px 14px}
.ld-rb .q{font-size:44px;font-weight:900;line-height:1}
.ld-rrows{display:flex;flex-direction:column;gap:8px;width:100%;max-width:400px;margin-top:2px}
.ld-rr{display:flex;align-items:center;gap:10px;background:var(--panel);border-radius:14px;padding:8px 10px;border-left:8px solid var(--c);transition:background .2s}
.ld-rr .n{font-weight:900;font-size:16px;width:74px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ld-rr .ds{display:flex;gap:7px;flex-wrap:wrap}
.ld-rr.lose{animation:ldshake .5s,ldred .9s}
.ld-found{font-weight:900;font-size:16px;color:#8d8db8;letter-spacing:1px;margin-top:2px}
.ld-found b{font-size:50px;color:#ffd23f;font-variant-numeric:tabular-nums;line-height:1;display:inline-block;margin:0 4px}
.ld-found b.pop{animation:ldpop .3s}
.ld-vd{font-weight:900;font-size:26px;text-align:center;line-height:1.1;display:none;animation:ldslam .45s}
.ld-vd.on{display:block}
.ld-vd small{display:block;font-size:17px;font-weight:800;color:#fff;margin-top:6px}
.ld-vd.lie{color:#ff4d6d}.ld-vd.tru{color:#7dffa0}
.ld-ban{position:absolute;left:0;right:0;top:34%;display:none;flex-direction:column;align-items:center;text-align:center;z-index:9;pointer-events:none;padding:0 14px}
.ld-ban.on{display:flex;animation:ldslam .45s}
.ld-ban b{font-size:min(13vw,54px);font-weight:900;line-height:1;color:#ffd23f;text-shadow:0 4px 18px #000,0 0 30px currentColor}
.ld-ban span{margin-top:8px;font-size:16px;font-weight:800;color:#fff;background:#000b;border-radius:10px;padding:4px 10px}
.ld.shk{animation:ldshake .5s}
@keyframes ldpulse{from{opacity:1}to{opacity:.65}}
@keyframes ldpop{0%{transform:scale(.7)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes ldslam{0%{transform:scale(2);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes ldshake{0%,100%{transform:none}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes ldred{0%{background:#c0203f}100%{background:var(--panel)}}
`;
      document.head.append(s);
    }

    function build(){
      built=true;
      S.ids.forEach(id=>{
        const pc=mkE('div','ld-pc');pc.style.setProperty('--c',c.col(id));
        const n=mkE('div','n'),dd=mkE('div','dd'),lb=mkE('div','lb');pc.append(n,dd,lb);ui.pls.append(pc);
        ui.pc[id]={pc,n,dd,lb,dc:-1};
      });
      FACES.forEach(f=>{
        const b=mkE('button','ld-fb');b.dataset.f=f;b.append(die(f,36));
        b.addEventListener('pointerdown',e=>{e.preventDefault();if(b.disabled)return;sel.f=f;sfx.tap();renderCtl();});
        ui.fs.append(b);ui.fb[f]=b;
      });
    }

    function myTurn(){return S&&S.ph==='bid'&&!S.over&&S.turn===me()&&S.dc[me()]>0;}

    function resetSel(){
      const prev=S.bid;
      if(prev){const f=prev.f<6?prev.f+1:1,q=prev.f<6?prev.q:prev.q+1;sel={q:Math.min(q,S.total),f};}
      else{const d=myDice(),cn={};d.forEach(v=>cn[v]=(cn[v]||0)+1);let bf=1,bc=0;for(let f=1;f<=6;f++)if((cn[f]||0)>bc){bc=cn[f];bf=f;}sel={q:Math.max(1,bc),f:bf};}
    }
    function clampSel(){
      const prev=S.bid,lo=raiseLo(prev),hi=S.total;
      sel.q=Math.max(lo,Math.min(hi,sel.q));
      if(prev&&sel.q===prev.q&&sel.f<=prev.f)sel.f=Math.min(6,prev.f+1);
      if(prev&&sel.q===prev.q&&prev.f===6)sel.q=prev.q+1;
    }
    function canRaise(){const lo=raiseLo(S.bid);return lo<=S.total;}

    function renderCtl(){
      if(!S)return;
      const mt=myTurn(),prev=S.bid,alive=S.dc[me()]>0;
      ui.ctl.classList.toggle('ld-off',!mt);
      if(!S.ids.includes(me())){ui.ctl.style.display='none';return;}
      if(!alive){ui.ctl.style.display='none';return;}
      ui.ctl.style.display='flex';
      if(mt)clampSel();
      const lo=raiseLo(prev),hi=S.total;
      ui.qv.textContent=mt?sel.q:(prev?prev.q:'-');
      ui.qm.disabled=!mt||sel.q<=lo;ui.qp.disabled=!mt||sel.q>=hi;
      FACES.forEach(f=>{const b=ui.fb[f];b.classList.toggle('sel',mt&&sel.f===f);b.disabled=!mt||(prev&&sel.q===prev.q&&f<=prev.f);});
      const ok=mt&&legal(prev,sel.q,sel.f,S.total);
      ui.bid.disabled=!ok;
      ui.bid.textContent=mt?(canRaise()?'BID  '+sel.q+' × '+sel.f+(sel.q>1?'s':''):'no raise left'):'BID';
      ui.call.disabled=!(mt&&prev);
    }

    function renderTop(){
      ui.rd.textContent='ROUND '+S.rd;
      const ot=S.ot||nowT()>=T_OT;
      ui.ot.className='ld-ot'+(ot?' on':'');
      ui.ot.textContent=ot?'⚡ OVERTIME: a lost call costs 2 dice':(nowT()>=T_SLOW?'⏱️ faster turns now':'Total dice on table: '+S.total);
      S.ids.forEach(id=>{
        const e=ui.pc[id],d=S.dc[id],isTurn=S.ph==='bid'&&S.turn===id&&d>0&&!S.over;
        e.n.textContent=nm(id)+(id===me()?' (you)':'');
        e.pc.classList.toggle('turn',isTurn);e.pc.classList.toggle('out',d<=0);
        if(e.dc!==d){e.dd.innerHTML='';for(let i=0;i<S.sd;i++){e.dd.append(mkE('i',i<d?'':'x'));}e.dc=d;}
        const last=[...S.bids].reverse().find(b=>b.id===id);
        e.lb.textContent=d<=0?(S.gone[id]?'📵 left':'💀 out'):(S.bid&&S.bid.by===id?'📣 '+S.bid.q+' × '+S.bid.f:'');
      });
      const t=ui.turn;
      if(S.over){t.className='ld-turn';t.textContent='';}
      else if(S.ph==='reveal'){t.className='ld-turn';t.textContent='🚨 '+nm(S.rv.caller)+' called LIAR!';}
      else if(S.dc[S.turn]>0){
        if(S.turn===me()){t.className='ld-turn me';t.textContent=S.bid?'👉 YOUR TURN — raise or call LIAR':'👉 YOUR TURN — make the opening bid';}
        else{t.className='ld-turn';t.innerHTML='';const d=mkE('span','dot');d.style.setProperty('--c',c.col(S.turn));t.append(d,document.createTextNode(nm(S.turn)+' is deciding…'));}
      }
    }
    let lastBidKey='';
    function renderBid(){
      const b=S.bid,key=b?b.q+'-'+b.f+'-'+b.by:'none';
      ui.bq.textContent=b?b.q:'?';
      ui.bd.innerHTML='';
      if(b){ui.bd.append(die(b.f,56));ui.bw.textContent='bid by '+nm(b.by)+(S.bids.length&&S.bids[S.bids.length-1].auto?' ⏱️':'');ui.bw.style.color=c.col(b.by);ui.bl.textContent='CURRENT BID — how many in total?';}
      else{ui.bd.append(mkE('span','ld-bx','of ?'));ui.bw.textContent=S.turn===me()?'You open the bidding':nm(S.turn)+' opens the bidding';ui.bw.style.color='';ui.bl.textContent='NO BID YET';}
      if(key!==lastBidKey){lastBidKey=key;ui.bb.classList.remove('pop');void ui.bb.offsetWidth;ui.bb.classList.add('pop');}
      ui.hist.innerHTML='';
      S.bids.slice(-6).forEach((h,i,a)=>{
        const e=mkE('span','ld-hc'+(i===a.length-1?' cur':''));const n=mkE('b','',nm(h.id).slice(0,5));n.style.background=c.col(h.id);e.append(n,document.createTextNode(h.q+'×'+h.f+(h.auto?'⏱️':'')));ui.hist.append(e);
      });
      ui.mine.querySelectorAll('.ld-die').forEach(e=>e.remove());
      const d=myDice(),alive=S.dc[me()]>0;
      ui.mt.textContent=alive?'YOUR\nDICE':'';
      if(alive)d.forEach(v=>ui.mine.append(die(v,Math.min(52,Math.floor(250/Math.max(3,d.length))))));
      else ui.mine.append(mkE('span','ld-bw','💀 You’re out — enjoy the show'));
    }

    // ---- reveal
    function buildReveal(rv){
      const o=ui.rev;o.innerHTML='';ui.rdie={};ui.rrow={};
      const t=mkE('div','ld-rt');t.innerHTML='<b></b>';t.firstChild.textContent=nm(rv.caller)+' calls LIAR!';
      const sub=mkE('div','ld-bw','on '+nm(rv.bidder)+'’s bid:');sub.style.color=c.col(rv.bidder);
      const bb=mkE('div','ld-rb');bb.append(mkE('span','q',rv.bid.q),mkE('span','ld-bx','×'),die(rv.bid.f,50));
      const rows=mkE('div','ld-rrows');
      rv.order.forEach(id=>{
        const r=mkE('div','ld-rr');r.style.setProperty('--c',c.col(id));
        const n=mkE('div','n',nm(id)),ds=mkE('div','ds');
        ui.rdie[id]=rv.dice[id].map(v=>{const d=die(v,rv.order.length>3?38:44,true);ds.append(d);return d;});
        r.append(n,ds);rows.append(r);ui.rrow[id]=r;
      });
      ui.found=mkE('div','ld-found');ui.found.innerHTML='FOUND<b>0</b>of '+rv.bid.q+' needed';
      ui.vd=mkE('div','ld-vd');ui.vd.append(document.createTextNode(''),mkE('small'));
      o.append(t,sub,bb,rows,ui.found,ui.vd);
      sfx.bad();buzz([60,40,60]);
    }
    function tickReveal(){
      if(!S||S.ph!=='reveal'||!S.rv||S.over){ui.rev.classList.remove('on');return;}
      const rv=S.rv;
      if(stage.rd!==rv.rd){stage={rd:rv.rd,fl:0,k:0,v:false,cs:false};buildReveal(rv);}
      ui.rev.classList.add('on');
      const T=ldTl(rv),el=nowT()-S.rvAt;
      while(stage.fl<rv.order.length&&el>=T.flip[stage.fl]){
        const id=rv.order[stage.fl];ui.rdie[id].forEach((d,i)=>later(()=>{setFace(d,rv.dice[id][i]);beep(500+i*60,.05,'square',.06);},i*110));stage.fl++;
      }
      if(stage.fl>=rv.order.length&&!stage.cs&&el>=T.count){
        stage.cs=true;
        rv.order.forEach(id=>ui.rdie[id].forEach(d=>{if(+d.dataset.v!==rv.bid.f)d.classList.add('dim');}));
        // collect matches
        stage.m=[];rv.order.forEach(id=>rv.dice[id].forEach((v,i)=>{if(v===rv.bid.f)stage.m.push(ui.rdie[id][i]);}));
      }
      if(stage.cs){
        while(stage.k<rv.cnt&&el>=T.count+T.step*stage.k){
          const d=stage.m[stage.k];if(d)d.classList.add('hit');stage.k++;
          const b=ui.found.querySelector('b');b.textContent=stage.k;b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');
          beep(420+stage.k*90,.1,'triangle',.12);buzz(12);
        }
      }
      if(!stage.v&&el>=T.verdict){
        stage.v=true;
        const lo=rv.loser,ml=lo===me();
        ui.vd.className='ld-vd on '+(rv.ok?'tru':'lie');
        ui.vd.firstChild.textContent=rv.ok?('TRUE! '+rv.cnt+' found'):('LIE! only '+rv.cnt+' found');
        ui.vd.lastChild.textContent=nm(lo)+(ml?' (you)':'')+' loses '+(rv.dmg>1?rv.dmg+' dice':'a die')+(rv.out?' — and is OUT 💀':'');
        const row=ui.rrow[lo];if(row){row.classList.add('lose');}
        ui.root.classList.remove('shk');void ui.root.offsetWidth;ui.root.classList.add('shk');later(()=>ui.root.classList.remove('shk'),500);
        if(ml){sfx.boom();buzz([150,60,200]);}else{sfx.good();buzz(30);}
        if(rv.out)later(()=>beep(140,.6,'sawtooth',.16,-100),250);
      }
    }

    function ban(txt,sub,ms){const b=ui.ban;b.className='ld-ban on';b.firstChild.textContent=txt;b.lastChild.textContent=sub||'';b.lastChild.style.display=sub?'':'none';clearTimeout(bannerT);bannerT=later(()=>{b.className='ld-ban';},ms||1500);}

    function setClock(){
      if(!S)return;
      if(S.ph==='bid'&&!S.over){
        const rem=Math.max(0,S.dl-nowT()),sec=Math.ceil(rem-.001),tot=S.dl-S.pickAt;
        ui.clock.textContent=sec;ui.clock.classList.toggle('low',sec<=5&&myTurn());
        ui.bar.style.width=(100*clamp(rem/tot,0,1))+'%';
        if(sec!==lastSec){lastSec=sec;if(sec<=5&&sec>0&&myTurn()&&c.R().ph==='play')sfx.tick();}
      }else{ui.clock.textContent=S.ph==='reveal'?'🎲':'';ui.clock.classList.remove('low');ui.bar.style.width='0%';}
    }

    function sendBid(){
      if(!myTurn()||!legal(S.bid,sel.q,sel.f,S.total))return;
      c.act({k:'bid',q:sel.q,f:sel.f});sfx.go();buzz(25);
    }
    function sendCall(){if(!myTurn()||!S.bid)return;c.act({k:'call'});buzz([40,30,40]);}

    return{
      mount(r){
        css();root=r;ui.root=mkE('div','ld');ui.pc={};ui.fb={};
        const top=mkE('div','ld-top');ui.rd=mkE('div','ld-rd');ui.ot=mkE('div','ld-ot');ui.clock=mkE('div','ld-clock');top.append(ui.rd,ui.ot,ui.clock);
        const bw=mkE('div','ld-bar');ui.bar=mkE('i');bw.append(ui.bar);
        ui.pls=mkE('div','ld-pls');ui.turn=mkE('div','ld-turn');
        ui.bidbox=mkE('div','ld-bidbox');ui.bl=mkE('div','ld-bl');ui.bb=mkE('div','ld-bb');ui.bq=mkE('div','ld-bq');ui.bd=mkE('div');ui.bb.append(ui.bq,mkE('div','ld-bx','×'),ui.bd);ui.bw=mkE('div','ld-bw');ui.hist=mkE('div','ld-hist');
        ui.bidbox.append(ui.bl,ui.bb,ui.bw,ui.hist);
        ui.mine=mkE('div','ld-mine');ui.mt=mkE('div','t');ui.mt.style.whiteSpace='pre';ui.mine.append(ui.mt);
        ui.ctl=mkE('div','ld-ctl');
        const qr=mkE('div','ld-row'),q=mkE('div','ld-q');
        ui.qm=mkE('button','ld-st ld-qm','−');ui.qp=mkE('button','ld-st ld-qp','+');ui.qv=mkE('div','v','1');
        q.append(mkE('div','lab','HOW\nMANY'),ui.qm,ui.qv,ui.qp);q.firstChild.style.whiteSpace='pre';qr.append(q);
        ui.qm.addEventListener('pointerdown',e=>{e.preventDefault();if(ui.qm.disabled)return;sel.q--;sfx.tap();renderCtl();});
        ui.qp.addEventListener('pointerdown',e=>{e.preventDefault();if(ui.qp.disabled)return;sel.q++;sfx.tap();renderCtl();});
        ui.fs=mkE('div','ld-fs');
        const br=mkE('div','ld-btns');ui.bid=mkE('button','ld-bid','BID');ui.call=mkE('button','ld-call','LIAR!');
        ui.bid.addEventListener('pointerdown',e=>{e.preventDefault();sendBid();});
        ui.call.addEventListener('pointerdown',e=>{e.preventDefault();sendCall();});
        br.append(ui.bid,ui.call);ui.ctl.append(qr,ui.fs,br);
        ui.rev=mkE('div','ld-rev');ui.ban=mkE('div','ld-ban');ui.ban.append(mkE('b'),mkE('span'));
        ui.root.append(top,bw,ui.pls,ui.turn,ui.bidbox,ui.mine,ui.ctl,ui.rev,ui.ban);root.append(ui.root);
      },
      start(){},
      stop(){timers.forEach(clearTimeout);timers=[];},
      update(Sn,R){
        S=Sn;if(!S||!S.ids)return;
        if(!built)build();
        const key=S.rd+'|'+(S.bid?S.bid.q+'-'+S.bid.f:'')+'|'+S.turn;
        if(key!==selKey){selKey=key;if(myTurn())resetSel();
          if(S.ph==='bid'&&S.turn===me()&&R.ph==='play'){beep(880,.08,'triangle',.12);buzz([30,30,30]);}}
        tickReveal();renderTop();renderBid();renderCtl();setClock();
        if(S.over&&!wasOver){wasOver=true;
          const al=S.ids.filter(i=>S.dc[i]>0);
          ui.rev.classList.remove('on');
          if(al.length===1){ban('🏆 '+nm(al[0])+' WINS','last one with dice',2500);sfx.win();buzz([60,40,60,40,200]);}else ban('TIME!','ranked by dice left',2500);
        }
      },
      frame(){tickReveal();setClock();},
      event(m){}
    };
  }
};
})();
