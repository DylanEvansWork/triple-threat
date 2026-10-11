// Simon Steal — competitive memory chain. Repeat the whole pattern, then ADD ONE nasty pad. 2 lives each, last one standing.
(function(){
const CAP=12, LIVES=2, ADD_T=6, LEAD=.7;
const PADC=['#ff4d5e','#3ddc6b','#3d9bff','#ffd23f'], PADS=['▲','●','■','★'], FREQ=[262,330,392,523];
const stepFor=L=>clamp(.62-.03*L,.28,.62);
const limitFor=L=>4+.75*L;

function injectStyle(){
  if(document.getElementById('st-simon'))return;
  const s=document.createElement('style');s.id='st-simon';
  s.textContent=`
.sm{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:8px 10px 12px}
.sm-pl{display:flex;gap:6px;flex:0 0 auto}
.sm-c{flex:1;min-width:0;background:#171734;border-radius:12px;border-bottom:4px solid var(--c);padding:5px 6px;text-align:center;position:relative;transition:transform .15s,box-shadow .15s}
.sm-c .nm{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm-c .hp{font-size:17px;line-height:1.2;letter-spacing:1px}
.sm-c.cur{box-shadow:0 0 0 3px var(--c),0 0 18px var(--c);transform:translateY(-2px)}
.sm-c.out{opacity:.35;filter:grayscale(1)}
.sm-c.hit{animation:smshake .4s}
.sm-info{flex:0 0 auto;text-align:center;display:flex;flex-direction:column;gap:3px;min-height:92px;justify-content:center}
.sm-big{font-size:min(7vw,27px);font-weight:900;line-height:1.1}
.sm-sub{font-size:13px;font-weight:700;color:#aeaed6}
.sm-dots{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;min-height:14px}
.sm-dots i{width:12px;height:12px;border-radius:50%;background:#2a2a58;display:block}
.sm-dots i.on{background:#fff}
.sm-dots i.ok{background:#52ff7a}
.sm-tb{height:8px;border-radius:5px;background:#ffffff14;overflow:hidden;flex:0 0 auto}
.sm-tb i{display:block;height:100%;width:0;background:linear-gradient(90deg,#52ff7a,#ffd23f,#ff3d81)}
.sm-pads{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:10px}
.sm-pad{border:0;border-radius:26px;background:var(--c);opacity:.5;position:relative;display:flex;align-items:center;justify-content:center;font-size:min(22vw,92px);color:#0006;touch-action:none;transition:opacity .06s,transform .06s,filter .06s;box-shadow:inset 0 -8px 0 #0004;padding:0}
.sm-pad.lit{opacity:1;transform:scale(1.04);filter:brightness(1.45) saturate(1.2);box-shadow:0 0 38px 8px var(--c),inset 0 -8px 0 #0002;color:#fff9;z-index:2}
.sm-pad.dim{opacity:.32}
.sm-pad.dim.lit{opacity:1}
.sm-pad.arm{opacity:.85;animation:smarm .5s infinite alternate}
@keyframes smarm{from{box-shadow:0 0 0 0 var(--c)}to{box-shadow:0 0 22px 5px var(--c)}}
.sm-pad.bad{animation:smshake .35s;filter:grayscale(1) brightness(.6)}
@keyframes smshake{0%,100%{transform:none}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
.sm-fl{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:5;background:#ff2a3a}
.sm-fl.go{animation:smfl .6s}
@keyframes smfl{0%{opacity:.5}100%{opacity:0}}
`;
  document.head.append(s);
}

GAMES.simon={
  name:'Simon Steal',emoji:'🧠',tag:'Repeat the chain, then make it nastier for the next person.',
  min:2,max:4,
  rules:[
    ['👀','Four coloured pads. A pattern flashes on everyone\'s phone. Watch it.'],
    ['🔁','On your turn, tap the WHOLE pattern back exactly. Wrong pad or too slow = lose a life (you have 2).'],
    ['➕','Got it right? Now ADD ONE NEW PAD to the end. You choose, so pick the nasty one: repeats, awkward jumps, anything.'],
    ['⏩','The replay gets faster as the chain grows. A failed turn leaves the pattern alone, the next player just takes it.'],
    ['🏆','Out of lives = out. Last player standing wins. If the chain hits '+CAP+' pads or time runs out, most lives wins.']
  ],
  ctrl:'Tap the pads, but only on your turn.',
  win:'Last player with lives wins. Ties on lives share the rank.',
  dur:120,hz:20,better:'high',fmt:v=>v>=10?(v-10)+' ❤️ left':'knocked out',

  init(H){
    const lives={};H.players.forEach(p=>lives[p.id]=LIVES);
    const order=H.players.map(p=>p.id),alive=H.players.filter(p=>!p.aw).map(p=>p.id);
    const S={solo:null,seq:[],cap:CAP,order,cur:alive.length?pick(alive):order[0],mode:'watch',pe:9999,idx:0,lives,out:[],pb:null,ds:0,dd:0,fb:null,turn:0,win:null,lastAdd:-1};
    return S;
  },
  begin(H,S){this.startTurn(H,S);},
  startTurn(H,S){
    S.turn++;S.idx=0;S.fb=null;const L=S.seq.length;
    if(L===0){S.mode='add';S.ds=S.t+LEAD;S.dd=ADD_T;S.pb=null;}
    else{const step=stepFor(L);S.mode='watch';S.pb={t0:S.t+LEAD,step};S.pe=S.t+LEAD+L*step+.35;}
  },
  here(H,id){const p=H.players.find(p=>p.id===id);return !!p&&!p.aw;},
  endTurn(H,S){
    const alive=S.order.filter(id=>S.lives[id]>0);
    if(alive.length<=1){S.win=alive.length?alive[0]:null;S.over=true;S.hold=2.6;return;}
    if(S.seq.length>=S.cap){S.over=true;S.hold=2.6;S.win=-1;return;}
    if(S.t>this.dur-(6+S.seq.length)){S.over=true;S.hold=2.2;S.win=-2;return;}   // not enough time left for another full turn
    const i=S.order.indexOf(S.cur);let nxt=null;
    for(let k=1;k<=S.order.length;k++){const id=S.order[(i+k)%S.order.length];if(S.lives[id]>0&&this.here(H,id)){nxt=id;break;}}
    if(nxt===null){S.over=true;S.hold=1;S.win=-2;return;}   // everyone left is away
    S.cur=nxt;this.startTurn(H,S);
  },
  fail(H,S,kind,pad){
    const id=S.cur;S.lives[id]=Math.max(0,S.lives[id]-1);
    if(S.lives[id]===0&&!S.out.includes(id))S.out.push(id);
    S.fb={id,k:kind,pad:pad==null?-1:pad,lives:S.lives[id],out:S.lives[id]===0};
    S.mode='fb';S.pe=S.t+(S.lives[id]===0?2:1.5);
    H.emit({e:'fail',p:id,k:kind,i:pad==null?-1:pad});
  },
  addPad(H,S,i,auto){
    S.seq.push(i);S.lastAdd=i;S.fb={id:S.cur,k:'added',pad:i,auto:!!auto,n:S.seq.length};S.mode='fb';S.pe=S.t+.95;
    H.emit({e:'added',p:S.cur,i,n:S.seq.length});
  },
  tick(H,S,dt){
    if(S.over)return;
    // away players are skipped (not eliminated: they may rejoin). If only one connected player is left for a while, the game ends.
    const here=S.order.filter(id=>S.lives[id]>0&&this.here(H,id));
    if(here.length<=1){if(S.solo==null)S.solo=S.t;if(here.length===0||S.t-S.solo>=6){S.win=here.length?here[0]:-2;S.over=true;S.hold=1.5;return;}}else S.solo=null;
    if(S.mode!=='fb'&&(S.lives[S.cur]===0||!this.here(H,S.cur))){S.fb={id:S.cur,k:'left',pad:-1,lives:S.lives[S.cur],out:S.lives[S.cur]===0};S.mode='fb';S.pe=S.t+.35;}
    const L=S.seq.length;
    if(S.mode==='watch'){
      if(S.t>=S.pe){S.mode='input';S.ds=S.t;S.dd=limitFor(L)+.5;S.idx=0;}
    }else if(S.mode==='input'){
      if(S.t-S.ds>=S.dd)this.fail(H,S,'time');
    }else if(S.mode==='add'){
      if(S.t-S.ds>=S.dd)this.addPad(H,S,Math.floor(Math.random()*4),true);
    }else if(S.mode==='fb'){
      if(S.t>=S.pe)this.endTurn(H,S);
    }
  },
  act(H,S,pid,m){
    if(S.over||pid!==S.cur)return;
    const i=m.i;if(!Number.isInteger(i)||i<0||i>3)return;
    if(m.k==='tap'&&S.mode==='input'){
      if(S.seq[S.idx]===i){
        S.idx++;H.emit({e:'tap',p:pid,i,ok:1});
        if(S.idx>=S.seq.length){S.mode='add';S.ds=S.t;S.dd=ADD_T;}
      }else{H.emit({e:'tap',p:pid,i,ok:0});this.fail(H,S,'wrong',i);}
    }else if(m.k==='add'&&S.mode==='add'&&S.t-S.ds>=.25){
      this.addPad(H,S,i,false);
    }
  },
  val(S,id){return S.lives[id]>0?10+S.lives[id]:S.out.indexOf(id);},

  mk(c){
    let root,plEl,bigEl,subEl,dotsEl,tbI,padsEl,fl;const pads=[],chips={},litUntil=[0,0,0,0];
    let lastTapAt=0,plKey='',lastMode='',lastTurn=-1,lastK=-1,lastDots='',lastFbKey='',lastLives={};
    const S0=()=>c.R()&&c.R().S;
    const name=id=>(c.pl(id)||{n:'?'}).n;
    function light(i,ms,vol){
      litUntil[i]=performance.now()+ms;beep(FREQ[i],ms/1000+.05,'triangle',vol==null?.2:vol);
    }
    function nextName(S,R){
      const i=S.order.indexOf(S.cur);
      for(let k=1;k<=S.order.length;k++){const id=S.order[(i+k)%S.order.length],p=R.pl.find(p=>p.id===id);if(S.lives[id]>0&&p&&!p.aw)return id===c.me()?'YOU':p.n;}
      return '—';
    }
    function paintDots(S){
      const L=S.seq.length,mode=S.mode;
      if(dotsEl.children.length!==L){dotsEl.innerHTML='';lastDots='';for(let i=0;i<L;i++)dotsEl.append(document.createElement('i'));}
      const on=mode==='watch'?lastK+1:0,ok=mode==='input'?S.idx:(mode==='add'?L:0);
      const dk=on+'|'+ok+'|'+L;if(dk===lastDots)return;lastDots=dk;
      [...dotsEl.children].forEach((d,i)=>d.className=i<ok?'ok':(i<on?'on':''));
    }
    function render(S,R){
      const me=c.me(),mine=S.cur===me,L=S.seq.length,mode=S.mode;
      // chips
      const key=R.pl.map(p=>p.id+p.n).join('|');
      if(key!==plKey){plKey=key;plEl.innerHTML='';R.pl.forEach(p=>{const d=E('div','sm-c','<div class="nm"></div><div class="hp"></div>');d.style.setProperty('--c',COLORS[p.ci]);d.querySelector('.nm').textContent=p.n+(p.id===me?' ★':'');chips[p.id]=d;plEl.append(d);});}
      for(const p of R.pl){const d=chips[p.id];if(!d)continue;const lv=S.lives[p.id];
        d.querySelector('.hp').textContent=lv>0?'❤️'.repeat(lv)+'🖤'.repeat(LIVES-lv):'☠️ OUT';
        d.classList.toggle('out',lv<=0||p.aw);d.classList.toggle('cur',p.id===S.cur&&!S.over&&lv>0);
        if(lastLives[p.id]!==undefined&&lv<lastLives[p.id]){d.classList.remove('hit');void d.offsetWidth;d.classList.add('hit');}
        lastLives[p.id]=lv;}
      // banner
      let big='',sub='',col='#fff';
      const nm=name(S.cur);
      if(S.over){
        if(S.win>=0&&S.win!==null){big='🏆 '+name(S.win)+' wins!';col=c.col(S.win);sub='Last one standing';}
        else if(S.win===-1){big='🏁 Chain complete!';sub='Most lives wins';}
        else{big='⏱️ Time!';sub='Most lives wins';}
      }else if(mode==='watch'){big=mine?'👀 WATCH — then repeat it':'👀 Watch… '+nm+' repeats next';col=c.col(S.cur);sub='Chain: '+L+' pad'+(L===1?'':'s');}
      else if(mode==='input'){big=mine?'👆 YOUR TURN — tap it back':'🔁 '+nm+' is repeating…';col=c.col(S.cur);sub=S.idx+' / '+L+(mine?'':' · hope they choke');}
      else if(mode==='add'){big=mine?(L?'➕ ADD ONE — make it NASTY 😈':'➕ Start the chain — pick a pad'):'😈 '+nm+' is adding a nasty one…';col=c.col(S.cur);sub=mine?'Tap any pad to add it':'Chain: '+L+' → '+(L+1);}
      else if(mode==='fb'){const f=S.fb||{};
        if(f.k==='added'){big=f.id===me?'✅ Added!':'✅ '+name(f.id)+' added a pad';sub='Chain is now '+f.n+' · next: '+nextName(S,R);}
        else if(f.k==='left'){big=name(f.id)+(f.out?' is out':' is away — skipped');sub='';}
        else{const who=f.id===me?'You':name(f.id);big=f.k==='time'?('⏰ '+who+' ran out of time!'):('💥 '+who+(f.id===me?' got it wrong!':' messed up!'));col='#ff6b6b';sub=f.out?'☠️ '+(f.id===me?'You are':name(f.id)+' is')+' OUT':'−1 life · pattern stays · next: '+nextName(S,R);}}
      bigEl.textContent=big;bigEl.style.color=col;
      const spd=S.pb?(.62/S.pb.step):(L?(.62/stepFor(L)):1);
      subEl.textContent=sub+(L>=3&&mode!=='fb'&&!S.over&&spd>1.05?'  ⏩ ×'+spd.toFixed(1):'');
      paintDots(S);
      // pad interactivity look
      const live=!S.over&&mine&&(mode==='input'||mode==='add');
      pads.forEach(p=>{p.classList.toggle('dim',!live);p.classList.toggle('arm',live&&mode==='add'&&c.t()-S.ds>.25);});
      // sound/vibe on mode change
      if(mode!==lastMode||S.turn!==lastTurn){
        if(S.turn!==lastTurn){lastK=-1;}
        if(mode==='input'&&mine){sfx.go();buzz(30);}
        if(mode==='add'&&mine&&L){sfx.good();buzz(30);}
        lastMode=mode;lastTurn=S.turn;
      }
    }
    return{
      mount(rt){
        injectStyle();root=E('div','sm');rt.append(root);
        plEl=E('div','sm-pl');
        const info=E('div','sm-info');bigEl=E('div','sm-big');subEl=E('div','sm-sub');dotsEl=E('div','sm-dots');info.append(bigEl,subEl,dotsEl);
        const tb=E('div','sm-tb','<i></i>');tbI=tb.firstChild;
        padsEl=E('div','sm-pads');
        for(let i=0;i<4;i++){
          const b=E('button','sm-pad dim');b.style.setProperty('--c',PADC[i]);b.dataset.i=i;b.textContent=PADS[i];
          b.addEventListener('pointerdown',e=>{
            e.preventDefault();const S=S0();if(!S||S.over||c.R().ph!=='play'||S.cur!==c.me())return;
            const tn=performance.now();if(tn-lastTapAt<70)return;lastTapAt=tn;
            if(S.mode==='input'){light(i,170);c.act({k:'tap',i});}
            else if(S.mode==='add'&&c.t()-S.ds>=.3){light(i,260,.25);c.act({k:'add',i});}
          });
          pads.push(b);padsEl.append(b);
        }
        fl=E('div','sm-fl');
        root.append(plEl,info,tb,padsEl,fl);
      },
      start(){},
      update(S,R){if(root&&S)render(S,R);},
      event(m){
        const S=S0();
        if(m.e==='tap'){if(m.p!==c.me()){light(m.i,170,.16);}}
        else if(m.e==='added'){light(m.i,300,.22);if(m.p!==c.me())buzz(15);}
        else if(m.e==='fail'){
          sfx.bad();if(m.p===c.me())buzz([80,40,80]);fl.classList.remove('go');void fl.offsetWidth;fl.classList.add('go');
          if(m.i>=0&&pads[m.i]){pads[m.i].classList.remove('bad');void pads[m.i].offsetWidth;pads[m.i].classList.add('bad');}
        }
      },
      frame(){
        const S=S0();if(!S||!root)return;const now=performance.now(),t=c.t(),L=S.seq.length;
        let pbI=-1;
        if(S.mode==='watch'&&S.pb){
          const tt=t-S.pb.t0;
          if(tt>=0){const k=Math.floor(tt/S.pb.step),fr=tt-k*S.pb.step;
            if(k<L){if(k!==lastK){lastK=k;light(S.seq[k],S.pb.step*720,.2);}if(fr<S.pb.step*.72)pbI=S.seq[k];}}
        }else if(S.mode!=='watch')lastK=-1;
        for(let i=0;i<4;i++)pads[i].classList.toggle('lit',pbI===i||now<litUntil[i]);
        // timer bar
        let w=0;
        if(!S.over&&(S.mode==='input'||S.mode==='add'))w=clamp(1-(t-S.ds)/S.dd,0,1);
        tbI.style.width=(w*100)+'%';
        paintDots(S);
      },
      stop(){}
    };
  }
};
})();
