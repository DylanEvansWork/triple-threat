// GOLD RUSH — Incan-Gold style push-your-luck. Host simulates every step; clients animate the reveal from S.rv.
(function(){
const EXP=3,PICK=4,MINPICK=1.4,TU=103,NOEXP_AFTER=99;
const TREASURE=[1,2,3,4,5,5,7,7,9,11,11,13,14,15,17];
const HZ=['spider','snake','fire','rocks','mummy'];
const HE={spider:'🕷️',snake:'🐍',fire:'🔥',rocks:'🪨',mummy:'🧟'};
const HN={spider:'spiders',snake:'snakes',fire:'fire',rocks:'rocks',mummy:'mummies'};
const cp=o=>JSON.parse(JSON.stringify(o));

// reveal timeline (shared by host for duration, by clients for animation)
function grTl(rv){
  const T={};let t=0;
  if(rv.exStart){T.exb=0;t=.8;}
  if(rv.ch){T.ch=t;t+=.5;}
  if(rv.leavers&&rv.leavers.length){T.leave=t;t+=.85;}else if(rv.ch)t+=.12;
  if(rv.flip){T.flip=t;t+=.55;T.res=t;t+=rv.flip.kind==='collapse'?1.7:.75;}
  else if(rv.endEx){T.res=t;t+=.9;}
  T.end=t+.1;return T;
}

function snap(S){return{bank:cp(S.bank),pocket:cp(S.pocket),inside:cp(S.inside),pile:S.pile,seen:cp(S.seen),left:cp(S.left),removed:cp(S.removed),col:S.col,dn:S.dn,dg:S.dg};}
function danger(S){let d=0;HZ.forEach(h=>{if(S.seen[h]===1)d+=S.left[h];});S.dg=d;}
function buildDeck(S){
  const d=TREASURE.map(v=>({k:'t',v}));
  HZ.forEach(h=>{for(let i=0;i<3-S.removed[h];i++)d.push({k:'h',h});});
  S._deck=shuffle(d);S.dn=S._deck.length;
  HZ.forEach(h=>{S.left[h]=3-S.removed[h];S.seen[h]=0;});S.col=null;danger(S);
}
function doFlip(S){
  const ins=S.ids.filter(id=>S.inside[id]);
  if(!S._deck.length){const b={};ins.forEach(id=>{b[id]=S.pocket[id];S.bank[id]+=S.pocket[id];S.pocket[id]=0;S.inside[id]=false;});return{kind:'empty',bank:b};}
  const card=S._deck.pop();S.path.push(card);S.dn=S._deck.length;
  let f;
  if(card.k==='t'){
    const m=ins.length,each=Math.floor(card.v/m),rem=card.v-each*m;
    ins.forEach(id=>S.pocket[id]+=each);S.pile+=rem;f={kind:'treasure',card,each,rem,m};
  }else{
    const h=card.h;S.left[h]--;S.seen[h]++;
    if(S.seen[h]>=2){const lost={};ins.forEach(id=>{lost[id]=S.pocket[id];S.pocket[id]=0;S.inside[id]=false;});S.removed[h]++;S.col=h;f={kind:'collapse',card,lost};}
    else f={kind:'scare',card,h};
  }
  danger(S);return f;
}
function startExp(S){
  S.ids.forEach(id=>{S.pocket[id]=0;S.inside[id]=!S.gone[id];});
  S.path=[];S.pile=0;S.locked={};S._ch={};
  buildDeck(S);
  const before=snap(S);
  const flip=doFlip(S);
  S.step++;
  S.rv={id:S.step,exStart:true,ex:S.ex,ch:null,leavers:[],pileBefore:0,pileAfter:0,flip,endEx:flip.kind==='collapse',reason:flip.kind==='collapse'?'collapse':'',before,ex_:S.ex};
  S.ph='reveal';S.rvAt=S.t;S.rvEnd=S.t+grTl(S.rv).end;
}
function resolve(H,S){
  const ins=S.ids.filter(id=>S.inside[id]);
  const before=snap(S);const ch={},auto={};
  ins.forEach(id=>{
    const pl=H.players.find(p=>p.id===id);
    if(S.tu||(pl&&pl.aw)){ch[id]='leave';auto[id]=1;}
    else if(S._ch[id]){ch[id]=S._ch[id];}
    else{ch[id]='stay';auto[id]=1;}
  });
  const lv=ins.filter(id=>ch[id]==='leave');
  const share=lv.length?Math.floor(S.pile/lv.length):0;
  const pileBefore=S.pile;S.pile-=share*lv.length;
  const leavers=lv.map(id=>({id,pocket:S.pocket[id],share,total:S.pocket[id]+share}));
  leavers.forEach(l=>{S.bank[l.id]+=l.total;S.pocket[l.id]=0;S.inside[l.id]=false;});
  const rem=S.ids.filter(id=>S.inside[id]);
  let flip=null,endEx=false,reason='';
  if(!rem.length){endEx=true;reason=S.tu?'time':'allleft';}
  else{flip=doFlip(S);if(flip.kind==='collapse'){endEx=true;reason='collapse';}else if(flip.kind==='empty'){endEx=true;reason='empty';}}
  S.step++;
  S.rv={id:S.step,exStart:false,ex:S.ex,ch,auto,leavers,pileBefore,pileAfter:pileBefore-share*lv.length,flip,endEx,reason,before};
  S.ph='reveal';S.rvAt=S.t;S.rvEnd=S.t+grTl(S.rv).end;S.locked={};S._ch={};
}

GAMES.goldrush={
  name:'Gold Rush',emoji:'💎',tag:'Stay for treasure. Leave before the temple collapses.',
  min:2,max:4,
  rules:[
    ['🏛️','You’re raiding a cursed temple. Cards flip one by one: 💎 treasure, or hazards (🕷️ 🐍 🔥 🪨 🧟).'],
    ['🤫','Every step, everyone inside secretly picks STAY or LEAVE (4 seconds), then all picks are revealed. No pick = STAY.'],
    ['💎','Treasure is split evenly between those who stayed (leftovers stay on the path). Your share sits in your 🎒 pocket — NOT safe yet.'],
    ['🚪','Leavers split all gems lying on the path, bank their pocket for good, and sit out this expedition.'],
    ['💥','The 2nd copy of the same hazard collapses the temple: everyone still inside loses their whole pocket! Most banked 💎 after 3 expeditions wins.']
  ],
  ctrl:'Tap STAY or LEAVE. Tap the other one to change your mind before time runs out.',
  win:'Most gems banked after 3 expeditions.',
  dur:120,hz:10,better:'high',fmt:v=>v+' 💎',

  init(H){
    const ids=H.players.map(p=>p.id),z=()=>{const o={};ids.forEach(i=>o[i]=0);return o;};
    const S={n:ids.length,ids,ex:1,EXP,ph:'wait',bank:z(),pocket:z(),inside:{},gone:{},path:[],pile:0,seen:{},left:{},removed:{},col:null,dn:0,dg:0,locked:{},pickAt:0,dl:0,rv:null,rvAt:0,rvEnd:0,tu:false,step:0,hold:3,_ch:{},_deck:[]};
    HZ.forEach(h=>{S.removed[h]=0;S.seen[h]=0;S.left[h]=3;});
    ids.forEach(i=>S.inside[i]=true);buildDeck(S);
    return S;
  },
  begin(H,S){startExp(S);},
  act(H,S,pid,m){
    if(S.over||S.ph!=='pick'||!S.inside[pid])return;
    if(m.c!=='stay'&&m.c!=='leave')return;
    S._ch[pid]=m.c;S.locked[pid]=1;
  },
  tick(H,S,dt){
    if(S.over||S.ph==='wait')return;
    H.players.forEach(p=>{if(p.aw)S.gone[p.id]=1;});
    if(S.ph==='pick'){
      const ins=S.ids.filter(id=>S.inside[id]);
      const need=ins.filter(id=>!S.gone[id]);
      const all=need.every(id=>S.locked[id]);
      if(!S.tu&&need.length>1&&need.filter(id=>!S.locked[id]).length===1&&!S.clamp){S.clamp=1;S.dl=Math.min(S.dl,S.t+2);}
      if((all&&S.t>=S.pickAt+MINPICK)||S.t>=S.dl)resolve(H,S);
    }else if(S.ph==='reveal'){
      if(S.t>=S.rvEnd){
        if(S.rv.endEx){
          if(S.ex>=EXP||S.rv.reason==='time'||S.t>=NOEXP_AFTER){S.over=true;S.hold=3;return;}
          S.ex++;startExp(S);
        }else{
          S.ph='pick';S.pickAt=S.t;S.clamp=0;
          if(S.t>=TU){S.tu=true;S.dl=S.t+1.8;}else S.dl=S.t+PICK;
        }
      }
    }
  },
  val(S,id){return S.bank[id]||0;},

  // ---------------- CLIENT ----------------
  mk(c){
    let S=null,root,ui={},pl={},hzc={},mine=null,lastStep=-1,built=false,timers=[],stage={id:-1},lastSec=-1,wasOver=false,bannerT=0,lastEx=0;
    const mkE=(t,cl,tx)=>{const e=document.createElement(t);if(cl)e.className=cl;if(tx!=null)e.textContent=tx;return e;};
    const later=(f,ms)=>{const id=setTimeout(f,ms);timers.push(id);return id;};
    const nowT=()=>(c.R()&&c.R().ph==='play')?c.t():(S?S.t:0);
    const nm=id=>{const p=c.pl(id);return p?p.n:'?';};
    const inRv=()=>S&&S.ph==='reveal'&&S.rv;
    const stg=()=>(inRv()&&stage.id===S.rv.id)?stage:{};

    function css(){
      if(document.getElementById('st-goldrush'))return;
      const s=document.createElement('style');s.id='st-goldrush';
      s.textContent=`
.gr{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;padding:6px 8px 8px;overflow:hidden}
.gr.shk{animation:grshake .6s}
.gr-top{display:flex;align-items:center;gap:8px;min-height:30px}
.gr-ex{font-weight:900;font-size:15px;color:#ffd23f;white-space:nowrap}
.gr-dk{flex:1;text-align:center;font-weight:800;font-size:12px;color:#8d8db8}
.gr-clock{font-weight:900;font-size:24px;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.gr-clock.low{color:#ff4d6d;animation:grpulse .4s infinite alternate}
.gr-bar{height:6px;background:#ffffff14;border-radius:4px;overflow:hidden;flex:0 0 auto}
.gr-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ffd23f,#ff6a3d)}
.gr-hz{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;flex:0 0 auto}
.gr-hc{background:var(--panel);border-radius:12px;padding:5px 2px 4px;text-align:center;border:2px solid transparent;transition:border-color .2s,background .2s}
.gr-hc .e{font-size:24px;line-height:1.1}
.gr-hc .pp{display:flex;justify-content:center;gap:3px;margin:2px 0}
.gr-hc .pp i{display:block;width:11px;height:11px;border-radius:50%;border:2px solid #8d8db8}
.gr-hc .pp i.s{background:#ff4d6d;border-color:#ff4d6d}
.gr-hc .pp i.x{border-color:#44446e;background:#2a2a50;position:relative}
.gr-hc .pp i.x::after{content:'';position:absolute;left:1px;right:1px;top:3px;height:2px;background:#6a6a9a;transform:rotate(45deg)}
.gr-hc .l{font-size:11px;font-weight:800;color:#aeaed6}
.gr-hc.w{border-color:#ffb02e;background:#3a2a14;animation:grpulse .8s infinite alternate}
.gr-hc.w .l{color:#ffd27a}
.gr-hc.hit{animation:grpop .4s}
.gr-dg{flex:0 0 auto;text-align:center;font-weight:900;font-size:14px;border-radius:10px;padding:5px 8px;background:#12381f;color:#7dffa0;line-height:1.2}
.gr-dg.m{background:#3a3010;color:#ffd23f}.gr-dg.h{background:#47121c;color:#ff8fa3}
.gr-path{flex:1 1 auto;min-height:60px;display:flex;flex-direction:column;gap:4px;background:#111127;border-radius:14px;padding:6px 8px;position:relative;overflow:hidden}
.gr-ph{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:12px;color:#8d8db8;letter-spacing:1px}
.gr-pile{font-size:20px;color:#ffd23f;letter-spacing:0;font-variant-numeric:tabular-nums}
.gr-pile.pop{animation:grpop .4s}
.gr-trail{display:flex;flex-wrap:wrap;gap:5px;align-content:flex-start}
.gr-cd{width:46px;height:60px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;background:linear-gradient(160deg,#ffe27a,#e6a21a);color:#4a2c00;box-shadow:0 2px 0 #0007;animation:grin .35s}
.gr-cd .e{font-size:18px;line-height:1}.gr-cd .v{font-size:20px;line-height:1.1}
.gr-cd.h{background:linear-gradient(160deg,#4a2a6e,#2a1646);color:#fff}
.gr-cd.h .e{font-size:28px}
.gr-cd.k{background:linear-gradient(160deg,#ff5a5a,#8f1230);box-shadow:0 0 14px #ff4d6d}
.gr-cd.sm{width:36px;height:48px}.gr-cd.sm .v{font-size:16px}.gr-cd.sm .e{font-size:15px}.gr-cd.sm.h .e{font-size:22px}
.gr-empty{color:#55558a;font-weight:700;font-size:13px;align-self:center;margin:auto}
.gr-pls{display:flex;flex-direction:column;gap:5px;flex:0 0 auto}
.gr-pc{position:relative;display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;background:var(--panel);border-radius:13px;padding:6px 12px 6px 14px;border-left:9px solid var(--c);min-height:50px;transition:opacity .3s}
.gr-pc.me{background:#1f1f46;box-shadow:inset 0 0 0 2px #ffffff30}
.gr-pc.out{opacity:.5}
.gr-pc.pulse{animation:grpop .4s}
.gr-pc.bad{animation:grred .7s}
.gr-nm{font-weight:900;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gr-st{font-weight:800;font-size:12.5px;color:#aeaed6;min-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gr-st.stay{color:#7dffa0}.gr-st.leave{color:#ffb454}
.gr-num{text-align:center;min-width:58px}
.gr-num b{display:block;font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.05}
.gr-num small{font-size:10px;font-weight:800;color:#8d8db8;letter-spacing:.5px}
.gr-num.pk b{color:#ffd23f}.gr-num.bk b{color:#7dffa0}
.gr-num.pop b{animation:grpop .4s}
.gr-fl{position:absolute;right:92px;top:2px;font-weight:900;font-size:19px;pointer-events:none;z-index:3;text-shadow:0 2px 6px #000;animation:grfloat 1.2s ease-out forwards;white-space:nowrap}
.gr-panel{flex:0 0 auto;display:flex;flex-direction:column;gap:6px}
.gr-hint{min-height:20px;text-align:center;font-weight:800;font-size:14px;color:#ffd23f;line-height:1.2}
.gr-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;height:92px}
.gr-b{border:0;border-radius:18px;font-weight:900;font-size:26px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 5px 0 #0008;touch-action:manipulation}
.gr-b small{font-size:12px;font-weight:700;opacity:.9}
.gr-b:active{transform:translateY(3px);box-shadow:0 2px 0 #0008}
.gr-b.stay{background:linear-gradient(180deg,#3fd47a,#1d9a55)}
.gr-b.leave{background:linear-gradient(180deg,#ffa63d,#d9621a)}
.gr-b.sel{outline:4px solid #fff;outline-offset:-1px;animation:grpop .3s}
.gr-off .gr-b{opacity:.3;pointer-events:none}
.gr-ban{position:absolute;left:0;right:0;top:30%;display:none;flex-direction:column;align-items:center;text-align:center;z-index:9;pointer-events:none;padding:0 14px}
.gr-ban.on{display:flex;animation:grslam .45s}
.gr-ban b{font-size:min(13vw,54px);font-weight:900;line-height:1;color:#fff;text-shadow:0 4px 18px #000,0 0 30px currentColor}
.gr-ban span{margin-top:8px;font-size:16px;font-weight:800;color:#fff;background:#000b;border-radius:10px;padding:4px 10px}
.gr-ban.bad b{color:#ff4d6d}.gr-ban.gold b{color:#ffd23f}.gr-ban.warn b{color:#ffb02e}
.gr-big{position:absolute;left:50%;top:36%;width:128px;height:176px;margin:-88px 0 0 -64px;z-index:8;display:none;border-radius:16px;flex-direction:column;align-items:center;justify-content:center;font-weight:900;pointer-events:none;box-shadow:0 10px 40px #000c}
.gr-big.on{display:flex;animation:grflip .6s both}
.gr-big.t{background:linear-gradient(160deg,#ffe27a,#e6a21a);color:#4a2c00;box-shadow:0 0 50px #ffc83a99}
.gr-big.h{background:linear-gradient(160deg,#5a3490,#2a1646);color:#fff;box-shadow:0 0 40px #8a4cff88}
.gr-big.k{background:linear-gradient(160deg,#ff5a5a,#8f1230);color:#fff;box-shadow:0 0 70px #ff2d4f}
.gr-big .e{font-size:64px;line-height:1}.gr-big .v{font-size:56px;line-height:1}.gr-big .n{font-size:14px;letter-spacing:1px;margin-top:6px;opacity:.85}
.gr-red{position:absolute;inset:0;background:#ff2d4f;opacity:0;pointer-events:none;z-index:7}
.gr-red.on{animation:grflash 1s}
@media (max-height:700px){
.gr{gap:4px;padding:4px 8px 6px}
.gr-hc{padding:3px 2px 2px}.gr-hc .e{font-size:19px}.gr-hc .pp{margin:1px 0}.gr-hc .pp i{width:9px;height:9px}.gr-hc .l{font-size:10px}
.gr-dg{font-size:12.5px;padding:3px 6px}
.gr-path{min-height:44px;padding:4px 8px}.gr-cd{width:34px;height:44px}.gr-cd .v{font-size:15px}.gr-cd .e{font-size:13px}.gr-cd.h .e{font-size:20px}
.gr-pls{gap:3px}.gr-pc{min-height:40px;padding:3px 10px 3px 12px}.gr-nm{font-size:15px}.gr-st{font-size:11.5px;min-height:14px}.gr-num b{font-size:17px}.gr-num{min-width:50px}.gr-num small{font-size:9px}
.gr-btns{height:70px}.gr-b{font-size:22px}.gr-b small{font-size:11px}.gr-hint{font-size:12.5px;min-height:16px}
}
@keyframes grpulse{from{opacity:1}to{opacity:.6}}
@keyframes grshake{0%,100%{transform:none}10%{transform:translate(-9px,3px)}25%{transform:translate(9px,-3px)}40%{transform:translate(-7px,4px)}55%{transform:translate(7px,-2px)}70%{transform:translate(-4px,2px)}85%{transform:translate(3px,0)}}
@keyframes grpop{0%{transform:scale(.8)}60%{transform:scale(1.14)}100%{transform:scale(1)}}
@keyframes grin{0%{transform:scale(.3) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes grred{0%{background:#ff2d4f}100%{background:var(--panel)}}
@keyframes grfloat{0%{transform:translateY(10px);opacity:0}15%{opacity:1}100%{transform:translateY(-26px);opacity:0}}
@keyframes grslam{0%{transform:scale(2.2);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes grflip{0%{transform:perspective(500px) rotateY(95deg) scale(.5);opacity:0}55%{transform:perspective(500px) rotateY(-8deg) scale(1.18);opacity:1}100%{transform:perspective(500px) rotateY(0) scale(1);opacity:1}}
@keyframes grflash{0%{opacity:.7}100%{opacity:0}}
`;
      document.head.append(s);
    }

    // ---- display model
    function disp(){
      const o={bank:{},pocket:{},inside:{},pile:S.pile,seen:S.seen,left:S.left,removed:S.removed,col:S.col,dn:S.dn,dg:S.dg,pathN:S.path.length,ch:null};
      if(!inRv()){S.ids.forEach(id=>{o.bank[id]=S.bank[id];o.pocket[id]=S.pocket[id];o.inside[id]=S.inside[id];});return o;}
      const rv=S.rv,b=rv.before,st=stg(),f=rv.flip;
      const lv={};rv.leavers.forEach(l=>lv[l.id]=l);
      o.pile=st.leave?rv.pileAfter:b.pile;
      S.ids.forEach(id=>{
        let bank=b.bank[id],pk=b.pocket[id],ins=b.inside[id];
        if(st.leave&&lv[id]){bank+=lv[id].total;pk=0;ins=false;}
        if(st.res&&f){
          if(f.kind==='treasure'&&ins)pk+=f.each;
          else if(f.kind==='collapse'&&ins){pk=0;ins=false;}
          else if(f.kind==='empty'&&ins){bank+=pk;pk=0;ins=false;}
        }
        o.bank[id]=bank;o.pocket[id]=pk;o.inside[id]=ins;
      });
      if(st.res&&f&&f.kind==='treasure')o.pile+=f.rem;
      if(!st.res){o.seen=b.seen;o.left=b.left;o.removed=b.removed;o.col=b.col;o.dn=b.dn;o.dg=b.dg;}
      o.pathN=(f&&f.card&&!st.res)?S.path.length-1:S.path.length;
      if(rv.ch&&st.ch)o.ch=rv.ch;
      return o;
    }

    function build(){
      built=true;
      S.ids.forEach(id=>{
        const card=mkE('div','gr-pc');card.style.setProperty('--c',c.col(id));
        const mid=mkE('div'),n=mkE('div','gr-nm'),st=mkE('div','gr-st');mid.append(n,st);
        const pk=mkE('div','gr-num pk'),pb=mkE('b'),ps=mkE('small','','🎒 POCKET');pk.append(pb,ps);
        const bk=mkE('div','gr-num bk'),bb=mkE('b'),bs=mkE('small','','💰 BANKED');bk.append(bb,bs);
        card.append(mid,pk,bk);ui.pls.append(card);
        pl[id]={card,n,st,pk,pb,bk,bb,pv:0,bv:0};
      });
      HZ.forEach(h=>{
        const d=mkE('div','gr-hc'),e=mkE('div','e',HE[h]),pp=mkE('div','pp'),l=mkE('div','l');
        for(let i=0;i<3;i++)pp.append(mkE('i'));
        d.append(e,pp,l);ui.hz.append(d);hzc[h]={d,pp,l};
      });
    }

    function render(){
      if(!S)return;if(!built)build();
      const d=disp(),rv=inRv()?S.rv:null,st=stg();
      ui.ex.textContent='EXPEDITION '+(rv?rv.ex:S.ex)+'/'+S.EXP;
      ui.dk.textContent='🃏 '+d.dn+' cards left';
      // hazards
      HZ.forEach(h=>{
        const z=hzc[h],r=d.removed[h],sn=d.seen[h],col=d.col===h?1:0;
        const red=Math.max(0,sn-col);
        [...z.pp.children].forEach((i,k)=>{i.className=k<r?'x':(k<r+red)?'s':'';});
        z.l.textContent=d.left[h]+' left';
        z.d.classList.toggle('w',sn===1&&d.col!==h);
      });
      const dn=d.dn,dg=d.dg;
      if(d.col){ui.dg.className='gr-dg h';ui.dg.textContent='💥 THE TEMPLE COLLAPSED';}
      else if(dg===0){ui.dg.className='gr-dg';ui.dg.textContent='✅ No collapse possible on the next card';}
      else{const pc=Math.round(100*dg/Math.max(1,dn));ui.dg.className='gr-dg '+(pc>=20?'h':'m');ui.dg.textContent='💥 Next card collapses the temple: '+dg+' in '+dn+' ('+pc+'%)';}
      // path
      ui.pile.textContent='💎 '+d.pile;
      const path=S.path.slice(0,d.pathN);ui.trail.innerHTML='';
      ui.trail.parentNode.classList.toggle('empty',!path.length);
      if(!path.length)ui.trail.append(mkE('div','gr-empty','The temple is dark…'));
      path.forEach((cd,i)=>{
        const last=i===path.length-1&&S.rv&&S.rv.flip&&S.rv.flip.card===cd&&S.rv.flip.kind==='collapse';
        const e=mkE('div','gr-cd'+(cd.k==='h'?' h':'')+(last?' k':'')+(path.length>12?' sm':''));
        if(cd.k==='t'){e.append(mkE('span','e','💎'),mkE('span','v',cd.v));}else e.append(mkE('span','e',HE[cd.h]));
        if(i<path.length-1||(rv&&rv.id===lastRender.rvid))e.style.animation='none';
        ui.trail.append(e);
      });
      lastRender.rvid=rv?rv.id:-1;
      // players
      S.ids.forEach(id=>{
        const p=pl[id],me=id===c.me();
        p.n.textContent=nm(id)+(me?' (you)':'');
        p.card.classList.toggle('me',me);
        p.card.classList.toggle('out',!d.inside[id]);
        if(p.pv!==d.pocket[id]){p.pb.textContent=d.pocket[id];p.pk.classList.remove('pop');void p.pk.offsetWidth;p.pk.classList.add('pop');p.pv=d.pocket[id];}else p.pb.textContent=d.pocket[id];
        if(p.bv!==d.bank[id]){p.bb.textContent=d.bank[id];p.bk.classList.remove('pop');void p.bk.offsetWidth;p.bk.classList.add('pop');p.bv=d.bank[id];}else p.bb.textContent=d.bank[id];
        let t='',cls='gr-st';
        if(d.ch&&d.ch[id]){t=d.ch[id]==='stay'?'⛺ STAYS':'🚪 LEAVES';cls+=' '+d.ch[id];if(rv.auto&&rv.auto[id])t+=' ⏱️';}
        else if(S.gone[id])t='📵 left the game';
        else if(!d.inside[id])t=S.inside[id]||rv?'🚪 out of the temple':'🚪 out of the temple';
        else if(S.ph==='pick')t=S.locked[id]?'🔒 decided':'🤔 deciding…';
        else if(S.ph==='reveal'&&!d.ch)t='⛺ inside';
        else t='⛺ inside';
        p.st.textContent=t;p.st.className=cls;
      });
      renderPanel(d);
    }
    const lastRender={rvid:-1};

    function renderPanel(d){
      const id=c.me(),inside=S.inside[id],canPick=S.ph==='pick'&&inside&&!S.over&&!S.gone[id];
      ui.panel.classList.toggle('gr-off',!canPick);
      const me=S.ids.includes(id);
      if(!me){ui.hint.textContent='👀 Spectating';return;}
      if(!inside&&!(inRv()&&d.inside[id])){
        ui.btns.style.display='none';
        ui.hint.textContent=S.over?'':'🚪 You’re out of the temple with '+d.bank[id]+' 💎 banked — sweat with the others';
        if(!S.over&&S.ph==='reveal'&&S.rv.endEx&&S.rv.reason==='collapse')ui.hint.textContent='💎 '+d.bank[id]+' banked · next expedition soon';
        return;
      }
      ui.btns.style.display='grid';
      const pk=d.pocket[id];
      ui.bl.lastChild.textContent=pk>0?'bank 🎒'+pk+(d.pile>0?' + pile share':''):(d.pile>0?'grab a pile share':'go home safe');
      ui.bs.lastChild.textContent='risk it for more';
      ui.bl.classList.toggle('sel',!!mine&&mine==='leave'&&!!S.locked[id]);
      ui.bs.classList.toggle('sel',!!mine&&mine==='stay'&&!!S.locked[id]);
      if(S.tu&&S.ph==='pick')ui.hint.textContent='⏰ TIME’S UP — everyone grabs their loot!';
      else if(canPick)ui.hint.textContent=(mine&&S.locked[id])?'🔒 '+mine.toUpperCase()+' locked — tap the other to change':'STAY or LEAVE? (no pick = STAY)';
      else ui.hint.textContent=S.ph==='reveal'?'👀 Revealing…':'';
    }

    function pick(ch){
      if(!S||S.ph!=='pick'||S.over||!S.inside[c.me()])return;
      mine=ch;c.act({c:ch});sfx.tap();buzz(15);S.locked[c.me()]=1;render();
    }

    function ban(txt,sub,cls,ms){
      const b=ui.ban;b.className='gr-ban on '+(cls||'');b.firstChild.textContent=txt;b.lastChild.textContent=sub||'';b.lastChild.style.display=sub?'':'none';
      clearTimeout(bannerT);bannerT=later(()=>{b.className='gr-ban';},ms||1500);
    }
    function floatT(id,txt,col){const p=pl[id];if(!p)return;const f=mkE('div','gr-fl',txt);f.style.color=col||'#fff';p.card.append(f);later(()=>f.remove(),1200);}
    function big(card,kind){
      const b=ui.big;b.className='gr-big on '+(kind==='collapse'?'k':card.k==='t'?'t':'h');b.innerHTML='';
      if(card.k==='t'){b.append(mkE('span','e','💎'),mkE('span','v',card.v),mkE('span','n','TREASURE'));}
      else{b.append(mkE('span','e',HE[card.h]),mkE('span','n',HN[card.h].toUpperCase()));}
      later(()=>{b.className='gr-big';},kind==='collapse'?1500:1000);
    }
    function pcPop(id,cls){const p=pl[id];if(!p)return;p.card.classList.remove(cls);void p.card.offsetWidth;p.card.classList.add(cls);later(()=>p.card.classList.remove(cls),700);}

    function tickReveal(){
      if(!inRv())return;
      const rv=S.rv,T=grTl(rv),el=nowT()-S.rvAt;
      if(stage.id!==rv.id){stage={id:rv.id};mine=null;}
      let ch=false;
      const go=(k,fn)=>{if(T[k]!==undefined&&!stage[k]&&el>=T[k]){stage[k]=1;fn();ch=true;}};
      go('exb',()=>{ban('EXPEDITION '+rv.ex,rv.ex===S.EXP?'final run!':'of '+S.EXP,'gold',1000);sfx.go();buzz(30);});
      go('ch',()=>{sfx.tap();buzz(15);});
      go('leave',()=>{
        rv.leavers.forEach(l=>{floatT(l.id,'🚪 +'+l.total+' 💰','#7dffa0');pcPop(l.id,'pulse');});
        [660,880,1100].forEach((f,i)=>setTimeout(()=>beep(f,.1,'triangle',.12),i*70));
        if(rv.leavers.some(l=>l.id===c.me()))buzz([30,30,60]);
      });
      go('flip',()=>{if(rv.flip.kind!=='empty'){big(rv.flip.card,rv.flip.kind);beep(400,.12,'square',.08,200);}});
      go('res',()=>{
        const f=rv.flip;
        if(f){
          if(f.kind==='treasure'){
            S.ids.forEach(id=>{if(rv.before.inside[id]&&!rv.leavers.some(l=>l.id===id))floatT(id,'+'+f.each+' 🎒','#ffd23f');});
            sfx.good();buzz(20);
          }else if(f.kind==='scare'){
            ban('😨 '+HE[f.h]+' '+HN[f.h].toUpperCase(),'1st '+HE[f.h]+' — another one collapses the temple','warn',1300);
            beep(160,.25,'sawtooth',.12,-40);buzz([40,40,40]);
            const z=hzc[f.h];if(z){z.d.classList.add('hit');later(()=>z.d.classList.remove('hit'),500);}
          }else if(f.kind==='collapse'){
            ban('💥 COLLAPSE!','2nd '+HE[f.card.h]+' — everyone inside loses their pocket','bad',1800);
            sfx.boom();buzz([120,50,200,50,300]);
            ui.root.classList.remove('shk');void ui.root.offsetWidth;ui.root.classList.add('shk');later(()=>ui.root.classList.remove('shk'),700);
            ui.red.classList.remove('on');void ui.red.offsetWidth;ui.red.classList.add('on');
            for(const id in f.lost){if(f.lost[id]>0)floatT(id,'−'+f.lost[id]+' 💥','#ff4d6d');pcPop(id,'bad');}
          }else if(f.kind==='empty'){
            ban('THE TEMPLE IS EMPTY','everyone left inside banks their pocket','gold',1500);sfx.win();
          }
        }else if(rv.endEx){
          ban(rv.reason==='time'?'⏰ TIME!':'EVERYONE’S OUT',rv.reason==='time'?'everyone banks their loot':'expedition over','gold',1000);
        }
      });
      if(ch)render();
    }

    function setClock(){
      if(!S)return;
      if(S.ph==='pick'&&!S.over){
        const rem=Math.max(0,S.dl-nowT()),sec=Math.ceil(rem-.001),tot=S.dl-S.pickAt;
        ui.clock.textContent=S.inside[c.me()]||true?sec:'';ui.clock.classList.toggle('low',sec<=2&&!!S.inside[c.me()]&&!S.locked[c.me()]);
        ui.bar.style.width=(100*clamp(rem/tot,0,1))+'%';
        if(sec!==lastSec){lastSec=sec;if(sec<=2&&sec>0&&c.R().ph==='play'&&S.inside[c.me()]&&!S.locked[c.me()])sfx.tick();}
      }else{ui.clock.textContent=S.ph==='reveal'?'👀':'';ui.clock.classList.remove('low');ui.bar.style.width='0%';}
    }

    return{
      mount(r){
        css();root=r;
        const g=ui.root=mkE('div','gr');
        const top=mkE('div','gr-top');ui.ex=mkE('div','gr-ex','EXPEDITION 1');ui.dk=mkE('div','gr-dk');ui.clock=mkE('div','gr-clock');top.append(ui.ex,ui.dk,ui.clock);
        const bw=mkE('div','gr-bar');ui.bar=mkE('i');bw.append(ui.bar);
        ui.hz=mkE('div','gr-hz');ui.dg=mkE('div','gr-dg');
        const pathbox=mkE('div','gr-path'),ph=mkE('div','gr-ph');ph.append(mkE('span','','THE PATH'),(ui.pile=mkE('span','gr-pile','💎 0')),mkE('span','','leavers split the pile'));
        ui.trail=mkE('div','gr-trail');pathbox.append(ph,ui.trail);
        ui.pls=mkE('div','gr-pls');
        ui.panel=mkE('div','gr-panel');ui.hint=mkE('div','gr-hint');ui.btns=mkE('div','gr-btns');
        ui.bs=mkE('button','gr-b stay');ui.bs.append(mkE('b','','⛺ STAY'),mkE('small','','risk it for more'));
        ui.bl=mkE('button','gr-b leave');ui.bl.append(mkE('b','','🚪 LEAVE'),mkE('small','','go home safe'));
        ui.bs.addEventListener('pointerdown',e=>{e.preventDefault();pick('stay');});
        ui.bl.addEventListener('pointerdown',e=>{e.preventDefault();pick('leave');});
        ui.btns.append(ui.bs,ui.bl);ui.panel.append(ui.hint,ui.btns);
        ui.ban=mkE('div','gr-ban');ui.ban.append(mkE('b'),mkE('span'));
        ui.big=mkE('div','gr-big');ui.red=mkE('div','gr-red');
        g.append(top,bw,ui.hz,ui.dg,pathbox,ui.pls,ui.panel,ui.ban,ui.big,ui.red);root.append(g);
      },
      start(){},
      stop(){timers.forEach(clearTimeout);timers=[];},
      update(Sn,R){
        S=Sn;if(!S||!S.ids)return;
        if(S.ph==='pick'&&S.pickAt!==lastStep){lastStep=S.pickAt;mine=null;}
        tickReveal();render();setClock();
        if(S.over&&!wasOver){wasOver=true;
          const best=Math.max(...S.ids.map(i=>S.bank[i])),w=S.ids.filter(i=>S.bank[i]===best);
          ban(w.length>1?'TIE!':'🏆 '+nm(w[0])+' WINS','💎 '+best+' banked','gold',2600);sfx.win();buzz([60,40,60,40,200]);
        }
      },
      frame(){tickReveal();setClock();},
      event(m){}
    };
  }
};
})();
