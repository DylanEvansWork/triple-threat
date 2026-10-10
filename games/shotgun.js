// SHOTGUN — simultaneous secret-choice duel to the last survivor. Host resolves each turn; clients play a sequenced reveal from S.rv.
(function(){
const MAXL=2,MAXA=3,PICK=7,PICK_STORM=5,MINPICK=2.2,STORM=7;
const IC={reload:'🔄',shoot:'🔫',block:'🛡️',shotgun:'💥'};
const NM={reload:'RELOAD',shoot:'SHOOT',block:'BLOCK',shotgun:'SHOTGUN'};
const SUB={reload:'+1 ammo (max 3)',shoot:'1 ammo · 1 dmg',block:'stops normal shots',shotgun:'3 ammo · 2 dmg · pierces'};

// reveal timeline (seconds after the reveal starts). Shared by host (duration) and clients (animation).
function tlFor(rv){
  const n=rv.acts.length,ne=rv.ev.length;
  const cards=[];for(let i=0;i<n;i++)cards.push(.3+.42*i);
  const res=.3+.42*n+.45;
  const gap=ne>0?Math.min(.62,2.4/ne):0;
  const ev=[];for(let j=0;j<ne;j++)ev.push(res+.55+gap*j);
  const last=ne?ev[ne-1]:res;
  return{cards,res,ev,end:last+.85};
}

function resolve(S){
  const P=S.p,alive=S.ids.filter(id=>P[id].l>0),storm=S.turn>=S.storm;
  const before={};S.ids.forEach(id=>before[id]={l:P[id].l,a:P[id].a,b:P[id].blk});
  const acts=alive.map(id=>{
    const ch=S._ch[id];let x=ch?{id,a:ch.a,tg:ch.tg,auto:0}:{id,a:'reload',tg:null,auto:1};
    const q=P[id];
    // re-validate (target may have left, etc.)
    if((x.a==='shoot'||x.a==='shotgun')&&(!P[x.tg]||P[x.tg].l<=0||(x.a==='shoot'&&q.a<1)||(x.a==='shotgun'&&q.a<MAXA)))x={id,a:'reload',tg:null,auto:1};
    if(x.a==='block'&&(q.blk||storm))x={id,a:'reload',tg:null,auto:1};
    if(x.a!=='shoot'&&x.a!=='shotgun')x.tg=null;
    return x;
  });
  const blk=new Set(acts.filter(x=>x.a==='block').map(x=>x.id));
  const ev=[],dmg={};
  acts.forEach(x=>{
    if(x.a==='shoot'){if(blk.has(x.tg))ev.push({k:'block',from:x.id,to:x.tg});else{ev.push({k:'hit',from:x.id,to:x.tg,d:1});dmg[x.tg]=(dmg[x.tg]||0)+1;}}
    else if(x.a==='shotgun'){ev.push({k:'shotgun',from:x.id,to:x.tg,d:2});dmg[x.tg]=(dmg[x.tg]||0)+2;}
  });
  acts.forEach(x=>{const q=P[x.id];
    if(x.a==='reload')q.a=Math.min(MAXA,q.a+1);else if(x.a==='shoot')q.a-=1;else if(x.a==='shotgun')q.a=0;
    q.blk=x.a==='block'?1:0;});
  for(const id in dmg)P[id].l=Math.max(0,P[id].l-dmg[id]);
  if(storm){
    const liv=alive.filter(id=>P[id].l>0),mx=Math.max(0,...liv.map(id=>P[id].a));
    if(mx>0)liv.filter(id=>P[id].a===mx).forEach(id=>{P[id].l-=1;ev.push({k:'storm',to:id,d:1});});
  }
  const hev=ev.slice();
  alive.filter(id=>P[id].l<=0).forEach(id=>{S.elim.push({id,turn:S.turn,lb:before[id].l});ev.push({k:'out',to:id});});
  S.rv={turn:S.turn,acts,ev,before,storm};
  S.hist.push({turn:S.turn,acts:acts.map(x=>({id:x.id,a:x.a,tg:x.tg})),ev:hev});
  if(S.hist.length>6)S.hist.shift();
  S.ph='reveal';S.rvAt=S.t;S.rvEnd=S.t+tlFor(S.rv).end;S.locked={};S._ch={};
  S.fin=S.ids.filter(id=>P[id].l>0).length<=1;
}

GAMES.shotgun={
  name:'Shotgun',emoji:'🔫',tag:'Secret moves. Bluffs. Last one standing.',
  min:2,max:4,
  rules:[
    ['🔄','Every turn ALL players secretly pick a move at the same time (7 seconds). RELOAD gives +1 ammo (max 3).'],
    ['🔫','SHOOT costs 1 ammo and takes 1 ❤️ from the player you aim at. Everyone starts with 2 ❤️.'],
    ['🛡️','BLOCK stops every normal shot aimed at you that turn. You can’t block two turns in a row.'],
    ['💥','SHOTGUN costs all 3 ammo, ignores blocks and takes 2 ❤️ — one blast can kill. Then all moves are revealed together!'],
    ['⛈️','From turn 7 a STORM hits: no blocking, and whoever holds the MOST ammo loses 1 ❤️ every turn. Talk. Bluff. Trust nobody.']
  ],
  ctrl:'Tap a move (then tap who to shoot). Tap again to change your mind until time runs out. No pick = RELOAD.',
  win:'Last survivor wins. The earlier you die, the lower you rank.',
  dur:110,hz:10,

  // ---------------- HOST ----------------
  init(H){
    const ids=H.players.map(p=>p.id),p={};
    ids.forEach(id=>p[id]={l:MAXL,a:0,blk:0});
    return{n:ids.length,ids,p,turn:1,ph:'pick',pickAt:0,dl:PICK,locked:{},rv:null,rvAt:0,rvEnd:0,hist:[],elim:[],gone:{},fin:false,storm:STORM,_ch:{}};
  },
  begin(H,S){S.pickAt=0;S.dl=PICK;},
  act(H,S,pid,m){
    if(S.over||S.ph!=='pick')return;
    const me=S.p[pid];if(!me||me.l<=0)return;
    const a=m.a;let tg=null;
    if(a==='shoot'||a==='shotgun'){
      tg=+m.tg;const t=S.p[tg];
      if(!t||t.l<=0||tg===pid)return;
      if(a==='shoot'&&me.a<1)return;
      if(a==='shotgun'&&me.a<MAXA)return;
    }else if(a==='block'){if(me.blk||S.turn>=S.storm)return;}
    else if(a!=='reload')return;
    S._ch[pid]={a,tg};S.locked[pid]=1;
  },
  tick(H,S,dt){
    if(S.over)return;
    // players who left the party are eliminated
    if(S.ph==='pick'){
      for(const pl of H.players){const q=S.p[pl.id];if(pl.aw&&q&&q.l>0){q.l=0;S.gone[pl.id]=1;S.elim.push({id:pl.id,turn:S.turn,lb:0});delete S.locked[pl.id];delete S._ch[pl.id];}}
      const alive=S.ids.filter(id=>S.p[id].l>0);
      if(alive.length<=1){S.over=true;S.hold=2.6;S.fin=true;return;}
      const all=alive.every(id=>S.locked[id]);
      if((all&&S.t>=S.pickAt+MINPICK)||S.t>=S.dl)resolve(S);
    }else if(S.ph==='reveal'){
      if(S.t>=S.rvEnd){
        if(S.fin){S.over=true;S.hold=2.6;return;}
        S.turn++;S.ph='pick';S.pickAt=S.t;S.dl=S.t+(S.turn>=S.storm?PICK_STORM:PICK);S.locked={};S._ch={};
      }
    }
  },
  score(H,S){
    const ids=H.players.map(p=>p.id),n=ids.length;
    const key=id=>{const q=S.p[id];if(!q)return[-1,0,0];if(q.l>0)return[1e6,q.l,q.a];const e=S.elim.find(x=>x.id===id);return[e?e.turn:0,e?e.lb:0,0];};
    const cmp=(a,b)=>{const x=key(a),y=key(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return y[i]-x[i];return 0;};
    const s=ids.slice().sort(cmp);const rows=[];
    s.forEach((id,i)=>{const rank=(i>0&&cmp(s[i-1],id)===0)?rows[i-1].rank:i;const q=S.p[id];
      rows.push({id,rank,pts:Math.max(0,n-rank),label:q&&q.l>0?(rank===0&&S.ids.filter(x=>S.p[x].l>0).length===1?'🏆 last standing':q.l+'❤️ left'):(S.gone[id]?'left the party':'out turn '+((S.elim.find(x=>x.id===id)||{}).turn||'?'))});});
    return rows;
  },

  // ---------------- CLIENT ----------------
  mk(c){
    let root,S=null,ui={cards:{}},mine=null,mode='grid',pendA=null,lastTurn=-1,built=false,stage={id:-1,cards:0,res:false,ev:0,fin:false};
    let timers=[],lastSec=-1,bannerT=0,stormAnn=false,wasOver=false;
    const mkE=(t,cl,tx)=>{const e=document.createElement(t);if(cl)e.className=cl;if(tx!=null)e.textContent=tx;return e;};
    const later=(f,ms)=>{const id=setTimeout(f,ms);timers.push(id);return id;};
    const myId=()=>c.me();
    const nowT=()=>(c.R()&&c.R().ph==='play')?c.t():(S?S.t:0);
    const nm=id=>{const p=c.pl(id);return p?p.n:'?';};
    const inReveal=()=>S&&S.ph==='reveal'&&S.rv;
    const stg=()=>(inReveal()&&stage.id===S.rv.turn)?stage:{cards:0,res:false,ev:0};

    function css(){
      if(document.getElementById('st-shotgun'))return;
      const s=document.createElement('style');s.id='st-shotgun';
      s.textContent=`
.sg{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;padding:6px 8px 8px;overflow:hidden}
.sg-top{display:flex;align-items:center;gap:8px;min-height:30px}
.sg-turn{font-weight:900;font-size:15px;color:#cfcff0;white-space:nowrap}
.sg-storm{flex:1;text-align:center;font-weight:800;font-size:11.5px;line-height:1.15;color:#8d8db8}
.sg-storm.warn{color:#ffd23f}.sg-storm.on{color:#fff;background:#6b1d8f;border-radius:9px;padding:3px 6px;animation:sgpulse .9s infinite alternate}
.sg-clock{font-weight:900;font-size:24px;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.sg-clock.low{color:#ff4d6d;animation:sgpulse .4s infinite alternate}
.sg-bar{height:6px;background:#ffffff14;border-radius:4px;overflow:hidden;flex:0 0 auto}
.sg-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#19d3ff,#ff3d81)}
.sg-cardsbox{position:relative;display:flex;flex-direction:column;gap:6px;flex:1 1 auto;min-height:0}
.sg-card{position:relative;display:flex;align-items:center;gap:8px;background:var(--panel);border-radius:14px;padding:6px 12px 6px 14px;border-left:10px solid var(--c);min-height:54px;flex:1 1 0;max-height:150px;transition:background .15s,opacity .3s}
.sg-card.me{background:#1f1f46;box-shadow:inset 0 0 0 2px #ffffff30}
.sg-card.dead{opacity:.42;filter:grayscale(1)}
.sg-card.hit{animation:sgshake .42s,sgred .5s}
.sg-card.blk{animation:sgblue .5s}
.sg-card.pulse{animation:sgpop .35s}
.sg-mid{flex:1;min-width:0}
.sg-nm{font-weight:900;font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sg-st{font-weight:700;font-size:14.5px;color:#aeaed6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:17px}
.sg-st.act{color:#fff;animation:sgpop .3s}
.sg-hp{display:flex;gap:2px;font-size:36px;line-height:1}
.sg-h{color:#ff3d5a;text-shadow:0 0 10px #ff3d5a88;transition:color .2s}
.sg-h.off{color:#3a3a66;text-shadow:none}
.sg-h.brk{animation:sgbreak .5s}
.sg-am{display:flex;gap:4px;align-items:flex-end;min-width:54px;justify-content:flex-end}
.sg-p{display:block;width:14px;height:34px;border-radius:5px 5px 2px 2px;background:#3a3a66;transition:background .15s}
.sg-p.on{background:linear-gradient(180deg,#ffe27a,#ff9f1c);box-shadow:0 0 8px #ffb53a88}
.sg-p.pop{animation:sgpop .35s}
.sg-fl{position:absolute;left:44%;top:calc(50% - 14px);font-weight:900;font-size:22px;pointer-events:none;z-index:3;text-shadow:0 2px 6px #000;animation:sgfloat 1s ease-out forwards;white-space:nowrap}
.sg-bul{position:absolute;left:0;top:-9px;font-size:22px;z-index:4;pointer-events:none;margin-left:calc(100% - 30px)}
.sg-rec{flex:0 1 auto;max-height:104px;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;overflow:hidden;mask-image:linear-gradient(to bottom,transparent,#000 28%)}
.sg-rl{display:flex;flex-wrap:wrap;align-items:center;gap:4px;font-size:11.5px;color:#9a9ac4;font-weight:700;line-height:1.2}
.sg-rl .t{color:#6c6c9a;font-weight:900;min-width:22px}
.sg-ch{display:inline-flex;align-items:center;gap:2px;border-radius:8px;padding:1px 6px;background:#ffffff12;color:#e8e8ff;white-space:nowrap}
.sg-ch b{display:inline-block;min-width:10px;font-size:11px;color:#111;border-radius:6px;padding:0 4px}
.sg-res{flex-basis:100%;padding-left:26px;color:#ffb3b3;font-weight:700}
.sg-panel{flex:0 0 auto;display:flex;flex-direction:column;gap:6px}
.sg-hint{min-height:20px;text-align:center;font-weight:800;font-size:14.5px;color:#ffd23f;line-height:1.2}
.sg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;height:136px}
.sg-act{position:relative;border:0;border-radius:16px;min-height:62px;padding:6px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-weight:900;font-size:18px;color:#fff;touch-action:manipulation;box-shadow:0 4px 0 #0008}
.sg-act small{font-size:11px;font-weight:700;opacity:.85;line-height:1.1}
.sg-act:active{transform:translateY(3px);box-shadow:0 1px 0 #0008}
.sg-act.reload{background:linear-gradient(180deg,#3d8bff,#2a5fd0)}
.sg-act.shoot{background:linear-gradient(180deg,#ff5a5a,#c92a3e)}
.sg-act.block{background:linear-gradient(180deg,#2fc7a4,#17917a)}
.sg-act.shotgun{background:linear-gradient(180deg,#ffa63d,#d9621a)}
.sg-act[disabled]{opacity:.28;pointer-events:none;filter:grayscale(.6)}
.sg-act.sel{outline:4px solid #fff;outline-offset:-1px;animation:sgpop .3s}
.sg-off .sg-act{opacity:.35;pointer-events:none}
.sg-tgs{display:none;gap:8px;height:136px}
.sg-tg{border:0;border-radius:16px;min-height:62px;background:var(--c);color:#111;font-weight:900;font-size:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 0 #0008;touch-action:manipulation;min-width:0;padding:4px}
.sg-tg:active{transform:translateY(3px)}
.sg-tg span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sg-tg small{font-size:14px;font-weight:800;margin-top:2px}
.sg-back{border:0;border-radius:16px;min-height:62px;background:#2a2a58;color:#fff;font-weight:900;font-size:22px;box-shadow:0 4px 0 #0008}
.sg-ban{position:absolute;left:0;right:0;top:34%;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:9;pointer-events:none;padding:0 14px}
.sg-ban.on{display:flex;animation:sgslam .45s}
.sg-ban b{font-size:min(14vw,58px);font-weight:900;line-height:1;text-shadow:0 4px 18px #000,0 0 30px currentColor;color:#fff;letter-spacing:1px}
.sg-ban span{margin-top:6px;font-size:16px;font-weight:800;color:#fff;background:#000a;border-radius:10px;padding:4px 10px}
.sg-ban.bad b{color:#ff4d6d}.sg-ban.gold b{color:#ffd23f}.sg-ban.storm b{color:#c58bff}
.sg.shk{animation:sgshake .45s}
@keyframes sgpulse{from{opacity:1}to{opacity:.55}}
@keyframes sgshake{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes sgred{0%{background:#ff2d4f}100%{background:var(--panel)}}
@keyframes sgblue{0%{background:#2fa5ff}100%{background:var(--panel)}}
@keyframes sgpop{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes sgbreak{0%{transform:scale(1.6)}100%{transform:scale(1)}}
@keyframes sgfloat{0%{transform:translateY(8px);opacity:0}15%{opacity:1}100%{transform:translateY(-22px);opacity:0}}
@keyframes sgslam{0%{transform:scale(2.2);opacity:0}100%{transform:scale(1);opacity:1}}
`;
      document.head.append(s);
    }

    function ban(txt,sub,cls,ms){
      const b=ui.ban;b.className='sg-ban on '+(cls||'');b.firstChild.textContent=txt;b.lastChild.textContent=sub||'';b.lastChild.style.display=sub?'':'none';
      clearTimeout(bannerT);bannerT=later(()=>{b.className='sg-ban';},ms||1400);
    }
    function flash(id,cls,ms){const e=ui.cards[id];if(!e)return;e.card.classList.remove(cls);void e.card.offsetWidth;e.card.classList.add(cls);later(()=>e.card.classList.remove(cls),ms||500);}
    function floatT(id,txt,col){const e=ui.cards[id];if(!e)return;const f=mkE('div','sg-fl',txt);f.style.color=col||'#fff';e.card.append(f);later(()=>f.remove(),1000);}
    function bullet(from,to,ch){
      const f=ui.cards[from],t=ui.cards[to];if(!f||!t)return;
      const y1=f.card.offsetTop+f.card.offsetHeight/2-11,y2=t.card.offsetTop+t.card.offsetHeight/2-11;
      const b=mkE('div','sg-bul',ch||'🔸');ui.box.append(b);
      try{b.animate([{transform:'translateY('+y1+'px)'},{transform:'translateY('+y2+'px)'}],{duration:230,easing:'ease-in',fill:'forwards'});}catch(e){b.style.transform='translateY('+y2+'px)';}
      later(()=>b.remove(),300);
    }

    // ---- display model (before/after depending on reveal progress)
    function disp(id){
      const q=S.p[id];if(!q)return{l:0,a:0};
      if(!inReveal())return{l:q.l,a:q.a};
      const st=stg(),rv=S.rv,b=rv.before[id];let l=b.l;
      for(let j=0;j<st.ev;j++){const e=rv.ev[j];if(e.to===id&&e.d)l-=e.d;}
      return{l:Math.max(0,l),a:st.res?q.a:b.a};
    }

    function build(){
      built=true;ui.cards={};
      S.ids.forEach(id=>{
        const card=mkE('div','sg-card'),mid=mkE('div','sg-mid'),n=mkE('div','sg-nm'),st=mkE('div','sg-st'),hp=mkE('div','sg-hp'),am=mkE('div','sg-am');
        card.style.setProperty('--c',c.col(id));
        mid.append(n,st);const hs=[],ps=[];
        for(let i=0;i<MAXL;i++){const h=mkE('span','sg-h','♥');hp.append(h);hs.push(h);}
        for(let i=0;i<MAXA;i++){const p=mkE('i','sg-p');am.append(p);ps.push(p);}
        card.append(mid,hp,am);ui.box.append(card);
        ui.cards[id]={card,n,st,hs,ps,l:MAXL,a:0};
      });
    }

    function renderCards(){
      if(!S)return;if(!built)build();
      const st=stg();
      S.ids.forEach((id,i)=>{
        const e=ui.cards[id],d=disp(id),me=id===myId();
        e.n.textContent=nm(id)+(me?' (you)':'');
        e.card.classList.toggle('me',me);
        e.card.classList.toggle('dead',d.l<=0);
        e.hs.forEach((h,k)=>{const off=k>=d.l;h.classList.toggle('off',off);});
        e.ps.forEach((p,k)=>{const on=k<d.a;if(on&&!p.classList.contains('on')&&e.a<d.a){p.classList.remove('pop');void p.offsetWidth;p.classList.add('pop');}p.classList.toggle('on',on);});
        e.l=d.l;e.a=d.a;
        let txt='',cls='sg-st';
        if(d.l<=0){const el=S.elim.find(x=>x.id===id);txt=S.gone[id]?'📵 left the game':'💀 out'+(el?' (turn '+el.turn+')':'');}
        else if(inReveal()){
          if(i<st.cards||true){const k=S.rv.acts.findIndex(x=>x.id===id);
            if(k>=0&&k<st.cards){txt=actText(S.rv.acts[k]);cls='sg-st act';}else txt='❓ …';}
        }else{
          if(me&&mine&&S.locked[id])txt='🔒 '+actText(mine);
          else txt=S.locked[id]?'🔒 locked in':'🤔 thinking…';
        }
        e.st.textContent=txt;e.st.className=cls;
      });
    }
    function actText(x){let s=IC[x.a]+' '+NM[x.a];if(x.tg!=null&&x.tg!==undefined&&(x.a==='shoot'||x.a==='shotgun'))s+=' → '+nm(x.tg);if(x.auto)s+=' ⏱️';return s;}

    function renderRecap(){
      const h=S.hist.slice(inReveal()?0:0);let list=S.hist.slice();
      if(inReveal()&&!S.over&&list.length&&list[list.length-1].turn===S.rv.turn)list.pop();
      list=list.slice(-3);ui.rec.innerHTML='';
      list.forEach(en=>{
        const r=mkE('div','sg-rl');r.append(mkE('span','t','T'+en.turn));
        en.acts.forEach(x=>{
          const ch=mkE('span','sg-ch'),a=mkE('b','',nm(x.id).slice(0,5));a.style.background=c.col(x.id);ch.append(a,document.createTextNode(IC[x.a]));
          if(x.tg!=null&&(x.a==='shoot'||x.a==='shotgun')){const b=mkE('b','',nm(x.tg).slice(0,5));b.style.background=c.col(x.tg);ch.append(document.createTextNode('→'),b);}
          r.append(ch);
        });
        const res=en.ev.map(e=>e.k==='block'?nm(e.to)+' 🛡️ blocked':e.k==='storm'?'⛈ '+nm(e.to)+' −1❤️':nm(e.to)+' −'+e.d+'❤️').join(' · ');
        if(res)r.append(mkE('span','sg-res',res));
        ui.rec.append(r);
      });
    }

    function renderTop(){
      ui.turn.textContent='TURN '+S.turn;
      const t=S.turn;
      if(t>=S.storm){ui.storm.textContent='⛈ STORM: no blocks · most ammo loses ❤️';ui.storm.className='sg-storm on';}
      else if(t>=S.storm-2){ui.storm.textContent='⛈ storm in '+(S.storm-t)+' turn'+(S.storm-t>1?'s':'')+' (no blocks, most ammo loses ❤️)';ui.storm.className='sg-storm warn';}
      else{ui.storm.textContent='Storm hits on turn '+S.storm;ui.storm.className='sg-storm';}
    }

    function renderPanel(){
      const id=myId(),q=S.p[id],d=q?disp(id):{l:0,a:0},p=ui.panel;
      const alive=q&&d.l>0;
      const canPick=alive&&S.ph==='pick'&&!S.over;
      p.classList.toggle('sg-off',!canPick);
      if(!q){ui.hint.textContent='👀 Spectating';ui.grid.style.display='none';ui.tgs.style.display='none';return;}
      if(!alive){ui.hint.textContent='💀 You’re out — watch & heckle';ui.hint.style.color='#ff8fa3';ui.grid.style.display='none';ui.tgs.style.display='none';return;}
      ui.hint.style.color='';
      const storm=S.turn>=S.storm,tg=S.ids.filter(x=>x!==id&&S.p[x].l>0&&disp(x).l>0);
      const dis={reload:false,shoot:d.a<1||!tg.length,block:!!q.blk||storm,shotgun:d.a<MAXA||!tg.length};
      const sub={reload:d.a>=MAXA?'ammo full':SUB.reload,shoot:d.a<1?'needs 1 ammo':SUB.shoot,block:storm?'no blocks in storm':q.blk?'used last turn':SUB.block,shotgun:d.a<MAXA?'needs 3 ammo':SUB.shotgun};
      for(const a in ui.btn){const b=ui.btn[a];b.disabled=!!dis[a];b.lastChild.textContent=sub[a];b.classList.toggle('sel',!!mine&&mine.a===a&&!!S.locked[id]);}
      if(mode==='target'&&canPick){
        ui.grid.style.display='none';ui.tgs.style.display='grid';
        [...ui.tgs.querySelectorAll('.sg-tg')].forEach(b=>{const t=+b.dataset.id;b.style.display=tg.includes(t)?'flex':'none';});
        ui.hint.textContent=(pendA==='shotgun'?'💥 SHOTGUN':'🔫 SHOOT')+' — who?';
      }else{
        ui.grid.style.display='grid';ui.tgs.style.display='none';
        if(!canPick)ui.hint.textContent=S.over?'':'👀 Reveal…';
        else if(mine&&S.locked[id])ui.hint.textContent='🔒 Locked: '+actText(mine)+' — tap to change';
        else ui.hint.textContent=d.a>=MAXA?'🔥 Full ammo! SHOTGUN is ready…':'Pick your move — everybody picks at once';
      }
    }
    function buildTargets(){
      ui.tgs.innerHTML='';
      const back=mkE('button','sg-back','◀');back.addEventListener('pointerdown',e=>{e.preventDefault();mode='grid';pendA=null;renderPanel();});ui.tgs.append(back);
      S.ids.forEach(id=>{
        if(id===myId())return;
        const b=mkE('button','sg-tg');b.dataset.id=id;b.style.setProperty('--c',c.col(id));
        b.append(mkE('span','',nm(id)),mkE('small','','tap to aim'));
        b.addEventListener('pointerdown',e=>{e.preventDefault();send(pendA,id);});
        ui.tgs.append(b);
      });
      ui.tgs.style.gridTemplateColumns='62px '+'1fr '.repeat(S.ids.length-1);
    }
    function send(a,tg){
      if(!S||S.ph!=='pick'||S.over)return;
      mine={a,tg:tg==null?null:tg};mode='grid';pendA=null;
      c.act({a,tg:tg==null?-1:tg});sfx.tap();buzz(15);S.locked[myId()]=1;renderPanel();renderCards();
    }
    function onBtn(a){
      if(!S||S.ph!=='pick'||S.over)return;const id=myId(),q=S.p[id];if(!q||q.l<=0)return;
      if(a==='shoot'||a==='shotgun'){
        const tg=S.ids.filter(x=>x!==id&&S.p[x].l>0);if(!tg.length)return;
        if(tg.length===1){send(a,tg[0]);return;}
        pendA=a;mode='target';sfx.tap();renderPanel();return;
      }
      send(a,null);
    }

    // ---- reveal sequencing
    function tickReveal(){
      if(!S)return;
      if(!inReveal()){return;}
      const rv=S.rv,tl=tlFor(rv),el=nowT()-S.rvAt;
      if(stage.id!==rv.turn){stage={id:rv.turn,cards:0,res:false,ev:0,fin:false};mode='grid';pendA=null;}
      let ch=false;
      while(stage.cards<rv.acts.length&&el>=tl.cards[stage.cards]){revealCard(stage.cards);stage.cards++;ch=true;}
      if(!stage.res&&el>=tl.res){stage.res=true;ch=true;applyRes();}
      while(stage.ev<rv.ev.length&&el>=tl.ev[stage.ev]){applyEv(rv.ev[stage.ev]);stage.ev++;ch=true;}
      if(ch)renderCards();
      if(ch)renderPanel();
    }
    function revealCard(i){
      const x=S.rv.acts[i];
      if(x.a==='reload'){beep(520,.05,'square',.07);}
      else if(x.a==='block'){beep(700,.09,'triangle',.1);}
      else if(x.a==='shoot'){beep(300,.12,'sawtooth',.09,-120);}
      else{beep(110,.3,'sawtooth',.14,-50);}
      const e=ui.cards[x.id];if(e){e.st.classList.remove('act');}
    }
    function applyRes(){
      S.rv.acts.forEach(x=>{
        const b=S.rv.before[x.id],q=S.p[x.id];if(!b||!q)return;
        const da=q.a-b.a;
        if(x.a==='reload'&&da>0)floatT(x.id,'+1 ammo','#ffd23f');
        else if(x.a==='shoot')floatT(x.id,'−1 ammo','#ff9f1c');
        else if(x.a==='shotgun')floatT(x.id,'−3 ammo','#ff9f1c');
        else if(x.a==='block')floatT(x.id,'🛡️','#7fe3ff');
      });
    }
    function applyEv(e){
      const me=myId();
      if(e.k==='hit'){bullet(e.from,e.to);later(()=>{flash(e.to,'hit',500);floatT(e.to,'−1 ♥','#ff4d6d');sfx.bad();if(e.to===me)buzz([60,30,60]);else buzz(15);const t=ui.cards[e.to];if(t){const hs=t.hs;const k=disp(e.to).l;if(hs[k])hs[k].classList.add('brk');later(()=>hs.forEach(h=>h.classList.remove('brk')),500);}},200);}
      else if(e.k==='block'){bullet(e.from,e.to);later(()=>{flash(e.to,'blk',500);floatT(e.to,'🛡️ CLANG!','#7fe3ff');beep(1300,.12,'square',.12);beep(900,.2,'triangle',.08);buzz(25);},200);}
      else if(e.k==='shotgun'){bullet(e.from,e.to,'💥');later(()=>{flash(e.to,'hit',600);floatT(e.to,'💥 −2 ♥','#ff9f1c');sfx.boom();buzz(e.to===me?[120,40,160]:40);ui.root.classList.remove('shk');void ui.root.offsetWidth;ui.root.classList.add('shk');later(()=>ui.root.classList.remove('shk'),500);},200);}
      else if(e.k==='storm'){flash(e.to,'hit',500);floatT(e.to,'⛈ −1 ♥','#c58bff');beep(90,.4,'sawtooth',.16,-30);buzz(e.to===me?[80,40,80]:20);}
      else if(e.k==='out'){floatT(e.to,'💀','#fff');beep(160,.5,'sawtooth',.14,-110);if(e.to===me){ban('YOU’RE OUT','💀 spectator mode','bad',1800);buzz([200,60,200]);}}
    }

    function setClock(){
      if(!S)return;
      let rem=0,tot=PICK;
      if(S.ph==='pick'){rem=Math.max(0,S.dl-nowT());tot=S.dl-S.pickAt;}
      const sec=Math.ceil(rem-.001);
      if(S.ph==='pick'&&!S.over){
        ui.clock.textContent=sec;ui.clock.classList.toggle('low',sec<=2&&!S.locked[myId()]);
        ui.bar.style.width=(100*clamp(rem/tot,0,1))+'%';
        if(sec!==lastSec){lastSec=sec;if(sec<=3&&sec>0&&c.R().ph==='play'&&!S.locked[myId()]){sfx.tick();}}
      }else{ui.clock.textContent=S.ph==='reveal'?'👀':'';ui.clock.classList.remove('low');ui.bar.style.width='0%';}
    }

    return{
      mount(r){
        css();root=r;
        ui.root=mkE('div','sg');
        const top=mkE('div','sg-top');ui.turn=mkE('div','sg-turn','TURN 1');ui.storm=mkE('div','sg-storm');ui.clock=mkE('div','sg-clock','');top.append(ui.turn,ui.storm,ui.clock);
        const bw=mkE('div','sg-bar');ui.bar=mkE('i');bw.append(ui.bar);
        ui.box=mkE('div','sg-cardsbox');ui.rec=mkE('div','sg-rec');
        ui.panel=mkE('div','sg-panel');ui.hint=mkE('div','sg-hint');ui.grid=mkE('div','sg-grid');ui.tgs=mkE('div','sg-tgs');
        ui.btn={};
        ['reload','shoot','block','shotgun'].forEach(a=>{
          const b=mkE('button','sg-act '+a);b.dataset.a=a;b.append(mkE('b','',IC[a]+' '+NM[a]),mkE('small','',SUB[a]));
          b.addEventListener('pointerdown',e=>{e.preventDefault();onBtn(a);});ui.grid.append(b);ui.btn[a]=b;
        });
        ui.panel.append(ui.hint,ui.grid,ui.tgs);
        ui.ban=mkE('div','sg-ban');ui.ban.append(mkE('b'),mkE('span'));
        ui.root.append(top,bw,ui.box,ui.rec,ui.panel,ui.ban);root.append(ui.root);
      },
      start(){},
      stop(){timers.forEach(clearTimeout);timers=[];},
      update(Sn,R){
        S=Sn;if(!S||!S.ids)return;
        if(!built){build();buildTargets();}
        if(S.turn!==lastTurn){lastTurn=S.turn;mine=null;mode='grid';pendA=null;
          if(S.turn===S.storm&&R.ph==='play'){ban('⛈ STORM!','No blocking · most ammo loses ❤️ each turn','storm',2200);beep(80,.7,'sawtooth',.2,-30);buzz([60,40,60,40,120]);}}
        // forget local choice if the host doesn't have it
        if(S.ph==='pick'&&mine&&!S.locked[myId()])mine=mine;
        tickReveal();
        renderTop();renderCards();renderRecap();renderPanel();setClock();
        if(S.over&&!wasOver){wasOver=true;
          const al=S.ids.filter(id=>S.p[id].l>0);
          if(al.length===1){ban('🏆 '+nm(al[0])+' WINS','last one standing','gold',2400);sfx.win();buzz([60,40,60,40,200]);}
          else ban(al.length?'TIME!':'💀 DRAW','everyone went down together','bad',2400);
        }
      },
      frame(){tickReveal();setClock();},
      event(m){}
    };
  }
};
})();
