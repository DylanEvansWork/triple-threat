// Split or Steal — Golden-Balls-style betrayal. 3 rounds: negotiate (talk + quick chat) -> secretly lock SPLIT/STEAL -> dramatic reveal.
(function(){
const POTS=[12,12,24], NEG=22, DEC=8, T0=1.3, GAP=1.25, PAYHOLD=2.6;
const PRE=[['🤝',"I'm splitting, promise"],['😈',"Don't trust {o}"],['💀','Whoever steals is dead to me'],['🗡️',"I'll steal if you steal"],['🙏','Everyone splits, everyone eats']];
const EMO=['😂','🔥','💀','🤡','😭','👀'];

function injectStyle(){
  if(document.getElementById('st-splitsteal'))return;
  const s=document.createElement('style');s.id='st-splitsteal';
  s.textContent=`
.ss{position:absolute;inset:0;display:flex;flex-direction:column;gap:7px;padding:8px 10px 10px;overflow:hidden}
.ss-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto}
.ss-rd{font-size:12px;font-weight:900;color:#8d8db8;letter-spacing:1px;line-height:1.25;text-align:left;min-width:74px}
.ss-rd b{display:block;color:#ffd23f;font-size:12px}
.ss-pot{font-size:min(15vw,58px);font-weight:900;line-height:1;background:linear-gradient(180deg,#ffe27a,#ffb300);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #7a4a00);display:flex;align-items:center;gap:6px}
.ss-pot.pop{animation:sspop .5s}
@keyframes sspop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:none}}
.ss-ph{min-width:74px;text-align:right;font-size:12px;font-weight:900;color:#cfcff0;line-height:1.25}
.ss-ph b{display:block;font-size:26px;color:#fff;font-variant-numeric:tabular-nums}
.ss-tb{height:6px;border-radius:4px;background:#ffffff14;overflow:hidden;flex:0 0 auto}
.ss-tb i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#52ff7a,#ffd23f,#ff3d81)}
.ss-pl{display:flex;gap:6px;flex:0 0 auto}
.ss-c{flex:1;min-width:0;background:#171734;border-radius:12px;border-bottom:4px solid var(--c);padding:5px 6px;text-align:center;position:relative}
.ss-c .nm{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-c .co{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.15}
.ss-c .sh{font-size:11px;font-weight:900;color:#ff6b6b;min-height:14px}
.ss-c.aw{opacity:.4}
.ss-c .lk{position:absolute;top:-6px;right:-3px;font-size:16px}
.ss-feed{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:5px;overflow:hidden;padding:2px 0}
.ss-b{max-width:88%;background:#1d1d40;border-left:5px solid var(--c);border-radius:12px;padding:5px 10px;font-size:14.5px;font-weight:700;line-height:1.25;animation:sspop .3s;word-break:break-word;text-align:left}
.ss-b small{display:block;font-size:11px;font-weight:900;color:var(--c)}
.ss-b.me{align-self:flex-end;background:#25255a;border-left:0;border-right:5px solid var(--c)}
.ss-b.me small{text-align:right}
.ss-b.em{font-size:26px;padding:2px 10px;line-height:1.1}.ss-b.em small{font-size:10px}
.ss-hint{text-align:center;color:#8d8db8;font-size:13px;font-weight:700;align-self:center;margin:auto 0}
.ss-pan{display:none;flex:0 0 auto;flex-direction:column;gap:6px}
.ss-pan.on{display:flex}
.ss-pre{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.ss-pre button{min-height:48px;border:0;border-radius:13px;background:#26265a;color:#fff;font-weight:800;font-size:13.5px;line-height:1.15;padding:6px 8px;box-shadow:0 3px 0 #11112b;display:flex;align-items:center;justify-content:center;gap:5px;text-align:left}
.ss-pre button:active{transform:translateY(2px);box-shadow:0 1px 0 #11112b}
.ss-pre button.cd{opacity:.45}
.ss-emo{display:flex;gap:5px}
.ss-emo button{flex:1;min-height:46px;border:0;border-radius:12px;background:#171734;font-size:24px;padding:0}
.ss-emo button:active{transform:scale(.9)}
.ss-tbl{background:#12122b;border-radius:12px;padding:7px 10px;font-size:12.5px;font-weight:700;line-height:1.3;color:#d8d8f4;display:flex;flex-direction:column;gap:2px;text-align:left}
.ss-tbl div{display:flex;gap:6px}.ss-tbl div span:first-child{flex:0 0 auto}
.ss-tbl b{color:#ffd23f}
.ss-ch{display:flex;gap:8px}
.ss-ch button{flex:1;height:min(17vh,112px);min-height:84px;border:0;border-radius:20px;font-weight:900;font-size:24px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:4px solid transparent;opacity:.92}
.ss-ch button i{font-style:normal;font-size:38px;line-height:1}
.ss-ch .ss-s{background:linear-gradient(180deg,#2fbf71,#1a8d4f);box-shadow:0 5px 0 #0c4d2a}
.ss-ch .ss-t{background:linear-gradient(180deg,#e8483f,#a8231d);box-shadow:0 5px 0 #5c0f0c}
.ss-ch button.on{border-color:#fff;transform:translateY(-3px) scale(1.03);opacity:1}
.ss-ch button.off{opacity:.3}
.ss-lockb{min-height:52px;border:0;border-radius:16px;background:linear-gradient(180deg,#ffd23f,#ff9f1c);color:#3a2300;font-weight:900;font-size:19px;box-shadow:0 4px 0 #a86300}
.ss-lockb[disabled]{opacity:.35}
.ss-lockb.done,.ss-lockb.done[disabled]{background:#23234a;color:#cfcff0;box-shadow:none;opacity:1}
.ss-cards{display:flex;gap:8px;justify-content:center;align-items:center;flex:1;min-height:0;padding:4px 0}
.ss-card{flex:1;min-width:0;max-width:130px;max-height:330px;align-self:center;border-radius:18px;background:#171734;border:3px solid var(--c);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px 4px;perspective:600px;position:relative}
.ss-card .nm{font-size:13px;font-weight:900;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-card .fc{font-size:min(14vw,56px);line-height:1}
.ss-card .lb{font-size:12px;font-weight:900;letter-spacing:1px;min-height:16px}
.ss-card .py{font-size:24px;font-weight:900;min-height:30px;font-variant-numeric:tabular-nums}
.ss-card.ss-s{background:#12381f;border-color:#52ff7a}.ss-card.ss-s .lb{color:#52ff7a}
.ss-card.ss-t{background:#3d1219;border-color:#ff4d5e}.ss-card.ss-t .lb{color:#ff6b6b}
.ss-card.flip .fc{animation:ssflip .55s}
@keyframes ssflip{0%{transform:rotateY(90deg) scale(.5)}70%{transform:rotateY(0) scale(1.4)}100%{transform:none}}
.ss-card .py.win{color:#52ff7a}.ss-card .py.zero{color:#6d6d96}
.ss-msg{text-align:center;font-size:20px;font-weight:900;line-height:1.2;min-height:50px;display:flex;align-items:center;justify-content:center;padding:0 6px}
.ss-flash{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:3}
.ss-flash.go{animation:ssfl .5s}
@keyframes ssfl{0%{opacity:.55}100%{opacity:0}}
`;
  document.head.append(s);
}

GAMES.splitsteal={
  name:'Split or Steal',emoji:'🤝',tag:'Trust your friends. Then watch them lie to your face.',
  min:2,max:4,
  rules:[
    ['🪙','3 rounds, each with a pot of coins: 12, 12, then a DOUBLE pot of 24.'],
    ['🗣️','TALK! Argue, promise, bluff, beg. Out loud or with the quick-chat buttons.'],
    ['🔒','Then everyone secretly locks in 🤝 SPLIT or 🗡️ STEAL. No take-backs. Then the big reveal.'],
    ['🧮','All split: share the pot. ONE steals: they grab the WHOLE pot, others get 0. TWO+ steal: stealers get 0 and the splitters share it. All steal: nobody gets anything.'],
    ['🏆','Most coins after 3 rounds wins. Every steal earns a 🗡️ shame badge.']
  ],
  ctrl:'Tap quick-chat buttons while talking. Then tap SPLIT or STEAL and press LOCK IN.',
  win:'Total coins after 3 rounds.',
  dur:130,hz:10,better:'high',fmt:v=>v+' 🪙',

  init(H){
    const tot={},bet={};H.players.forEach(p=>{tot[p.id]=0;bet[p.id]=0;});
    return{rd:0,pot:POTS[0],stage:'neg',sa:0,sd:NEG,tot,bet,lock:{},part:H.players.filter(p=>!p.aw).map(p=>p.id),chat:[],cq:0,
      rev:{},revN:0,lastRev:-1,pay:null,msg:'',pa:0,au:{},_dec:{},_sel:{},_ch:{},_pay:{},_ord:[],_chatT:{}};
  },
  tick(H,S,dt){
    if(S.over)return;
    const alive=id=>{const p=H.players.find(p=>p.id===id);return !!p&&!p.aw;};
    const el=S.t-S.sa;
    if(S.stage==='neg'){
      if(el>=S.sd){S.stage='dec';S.sa=S.t;S.sd=DEC;S.part=H.players.filter(p=>!p.aw).map(p=>p.id);S.lock={};S.au={};S._dec={};S._sel={};}
    }else if(S.stage==='dec'){
      S.part=S.part.filter(alive);
      if(S.part.every(id=>S._dec[id])||el>=S.sd){
        const m=S.part.length,ch={};
        S.part.forEach(id=>{ch[id]=S._dec[id]||S._sel[id]||'S';if(!S._dec[id])S.au[id]=true;});
        const st=S.part.filter(id=>ch[id]==='T'),sp=S.part.filter(id=>ch[id]==='S'),pay={};
        S.part.forEach(id=>pay[id]=0);
        if(st.length===0)sp.forEach(id=>pay[id]=Math.floor(S.pot/m));
        else if(st.length===1)pay[st[0]]=S.pot;
        else if(sp.length)sp.forEach(id=>pay[id]=Math.floor(S.pot/sp.length));
        S._ch=ch;S._pay=pay;S._ord=shuffle(S.part);
        S.stage='rev';S.sa=S.t;S.sd=0;S.rev={};S.revN=0;S.lastRev=-1;S.pay=null;S.msg='';
      }
    }else if(S.stage==='rev'){
      while(S.revN<S._ord.length&&el>=T0+S.revN*GAP){
        const id=S._ord[S.revN];S.rev[id]=S._ch[id];S.lastRev=id;if(S._ch[id]==='T')S.bet[id]++;S.revN++;
      }
      if(!S.pay&&S.revN>=S._ord.length&&el>=T0+S._ord.length*GAP+.5){
        S.pay=S._pay;S.pa=S.t;
        const nm=id=>(H.players.find(p=>p.id===id)||{name:'?'}).name;
        for(const id in S._pay)S.tot[id]=(S.tot[id]||0)+S._pay[id];
        const st=S._ord.filter(id=>S._ch[id]==='T'),sp=S._ord.filter(id=>S._ch[id]==='S'),m=S._ord.length;
        if(m===0)S.msg='Nobody showed up. 💤';
        else if(st.length===0)S.msg='Everyone split! 🤝 Warm fuzzy feelings. +'+Math.floor(S.pot/m)+' each';
        else if(st.length===m)S.msg='EVERYONE STOLE. 💀 Nobody gets a thing.';
        else if(st.length===1)S.msg=nm(st[0])+' stole the whole pot! 🗡️💰 +'+S.pot;
        else S.msg=st.map(nm).join(' & ')+' both stole, so they get NOTHING. 😂 Splitters share the pot.';
      }
      if(S.pay&&S.t-S.pa>=PAYHOLD){
        if(S.rd>=POTS.length-1){S.over=true;S.hold=.4;}
        else{S.rd++;S.pot=POTS[S.rd];S.stage='neg';S.sa=S.t;S.sd=NEG;S.lock={};S.rev={};S.revN=0;S.pay=null;S.msg='';S.chat=[];S.part=H.players.filter(p=>!p.aw).map(p=>p.id);}
      }
    }
  },
  act(H,S,pid,m){
    const pl=H.players.find(p=>p.id===pid);if(!pl)return;
    if(m.k==='chat'){
      if(S.stage!=='neg'&&S.stage!=='dec')return;
      if(S.t-(S._chatT[pid]||-9)<.45)return;
      let tx=null,em=0;
      if(typeof m.e==='string'&&EMO.includes(m.e)){tx=m.e;em=1;}
      else if(Number.isInteger(m.i)&&PRE[m.i]){
        const pr=PRE[m.i];tx=pr[0]+' '+pr[1];
        if(pr[1].includes('{o}')){
          const o=H.players.find(p=>p.id===m.o&&p.id!==pid);if(!o)return;
          tx=tx.replace('{o}',o.name);
        }
      }
      if(tx==null)return;
      S._chatT[pid]=S.t;S.chat.push({q:++S.cq,id:pid,tx,em});if(S.chat.length>8)S.chat.shift();
    }else if(m.k==='pick'||m.k==='lock'){
      if(S.stage!=='dec'||!S.part.includes(pid)||S._dec[pid])return;
      if(m.c!=='S'&&m.c!=='T')return;
      if(m.k==='pick')S._sel[pid]=m.c;
      else{S._dec[pid]=m.c;S._sel[pid]=m.c;S.lock[pid]=true;}
    }
  },
  val(S,id){return S.tot[id]||0;},

  mk(c){
    let root,top,potEl,rdEl,phEl,tbI,plEl,feed,pans={},tblEl,btnS,btnT,lockB,cardsEl,msgEl,flash,hintEl;
    let paint=()=>{},sel=null,locked=false,lastQ=0,lastRd=-1,lastStage='',plKey='',chips={},seen={},lastSec=-1,payShown=false;
    const S0=()=>c.R()&&c.R().S;
    const bubble=(m)=>{
      const b=E('div','ss-b'+(m.id===c.me()?' me':'')+(m.em?' em':''));b.style.setProperty('--c',c.col(m.id));
      {const s=document.createElement('small');s.textContent=(c.pl(m.id)||{n:'?'}).n;b.append(s);}
      b.append(document.createTextNode(m.tx));return b;
    };
    function buildPre(R){
      const g=pans.neg.querySelector('.ss-pre');g.innerHTML='';
      const add=(i,o,txt,emo)=>{const b=document.createElement('button');b.textContent=(emo?emo+' ':'')+txt;b.addEventListener('pointerdown',e=>{e.preventDefault();sfx.tap();c.act({k:'chat',i,o});});g.append(b);};
      PRE.forEach((p,i)=>{
        if(p[1].includes('{o}')){R.pl.filter(x=>x.id!==c.me()&&!x.aw).forEach(x=>add(i,x.id,p[1].replace('{o}',x.n),p[0]));}
        else add(i,null,p[1],p[0]);
      });
    }
    function table(S){
      const m=Math.max(1,S.part.length),pot=S.pot,L=[];
      L.push(['🤝','All '+m+' split: <b>'+Math.floor(pot/m)+'</b> each']);
      if(m>=2)L.push(['🗡️','1 steals: thief takes <b>'+pot+'</b>, the rest get 0']);
      for(let k=2;k<m;k++)L.push(['⚔️',k+' steal: they get 0. '+(m-k>1?('The '+(m-k)+' splitters get <b>'+Math.floor(pot/(m-k))+'</b> each'):'The splitter gets <b>'+pot+'</b>')]);
      if(m>=2)L.push(['💀','All steal: nobody gets anything']);
      tblEl.innerHTML='';
      L.forEach(r=>{const d=document.createElement('div');d.innerHTML='<span>'+r[0]+'</span><span>'+r[1]+'</span>';tblEl.append(d);});
      tblEl.dataset.k=m+'-'+pot;
    }
    function setStage(S){
      pans.neg.classList.toggle('on',S.stage==='neg');
      pans.dec.classList.toggle('on',S.stage==='dec');
      feed.style.display=S.stage==='rev'?'none':'flex';
      cardsEl.parentNode.style.display=S.stage==='rev'?'flex':'none';
      if(S.stage==='dec'){sel=null;locked=false;table(S);paint();}
      if(S.stage==='rev'){seen={};payShown=false;cardsEl.innerHTML='';}
      lastSec=-1;
    }
    function renderCards(S){
      if(cardsEl.dataset.k!==S.part.join(',')){
        cardsEl.dataset.k=S.part.join(',');cardsEl.innerHTML='';
        S.part.forEach(id=>{
          const d=E('div','ss-card','<div class="nm"></div><div class="fc">❔</div><div class="lb">&nbsp;</div><div class="py">&nbsp;</div>');
          d.style.setProperty('--c',c.col(id));d.dataset.id=id;d.querySelector('.nm').textContent=(c.pl(id)||{n:'?'}).n;cardsEl.append(d);
        });
      }
      cardsEl.querySelectorAll('.ss-card').forEach(d=>{
        const id=+d.dataset.id,r=S.rev[id];
        if(r&&!seen[id]){
          seen[id]=1;d.classList.add(r==='S'?'ss-s':'ss-t','flip');d.querySelector('.fc').textContent=r==='S'?'🤝':'🗡️';
          d.querySelector('.lb').textContent=r==='S'?'SPLIT':'STEAL'+(S.au[id]?'':'');
          if(r==='S'){sfx.good();buzz(30);}else{sfx.bad();buzz([60,30,60]);root.classList.remove('shake');void root.offsetWidth;root.classList.add('shake');flash.style.background='#ff2a3a';flash.classList.remove('go');void flash.offsetWidth;flash.classList.add('go');}
        }
        const py=d.querySelector('.py');
        if(S.pay&&S.pay[id]!==undefined){const v=S.pay[id];py.textContent=v>0?'+'+v:'0';py.className='py '+(v>0?'win':'zero');}
        else if(!S.pay){py.innerHTML='&nbsp;';py.className='py';}
      });
      if(S.pay&&!payShown){payShown=true;const mine=S.pay[c.me()];if(mine>0){sfx.win();buzz([40,30,40]);}else sfx.bad();}
      msgEl.textContent=S.pay?S.msg:(S.revN===0?'🥁 Locks are in…':'');
    }
    return{
      mount(rt){
        injectStyle();root=E('div','ss');rt.append(root);
        flash=E('div','ss-flash');root.append(flash);
        top=E('div','ss-top');
        rdEl=E('div','ss-rd');potEl=E('div','ss-pot');phEl=E('div','ss-ph');top.append(rdEl,potEl,phEl);
        const tb=E('div','ss-tb','<i></i>');tbI=tb.firstChild;
        plEl=E('div','ss-pl');
        feed=E('div','ss-feed');hintEl=E('div','ss-hint','Talk it out loud 🗣️ — or tap a quick-chat below');feed.append(hintEl);
        // reveal area
        const rv=E('div','ss-rv');rv.style.cssText='display:none;flex:1;min-height:0;flex-direction:column;gap:6px';
        cardsEl=E('div','ss-cards');msgEl=E('div','ss-msg');rv.append(cardsEl,msgEl);
        // negotiate panel
        pans.neg=E('div','ss-pan');pans.neg.append(E('div','ss-pre'));
        const em=E('div','ss-emo');EMO.forEach(e=>{const b=document.createElement('button');b.textContent=e;b.addEventListener('pointerdown',ev=>{ev.preventDefault();sfx.tap();c.act({k:'chat',e});});em.append(b);});
        pans.neg.append(em);
        // decide panel
        pans.dec=E('div','ss-pan');tblEl=E('div','ss-tbl');
        const ch=E('div','ss-ch');btnS=E('button','ss-s','<i>🤝</i>SPLIT');btnT=E('button','ss-t','<i>🗡️</i>STEAL');ch.append(btnS,btnT);
        lockB=E('button','ss-lockb','🔒 LOCK IT IN');lockB.disabled=true;
        const em2=em.cloneNode(true);
        em2.querySelectorAll('button').forEach(b=>b.addEventListener('pointerdown',ev=>{ev.preventDefault();sfx.tap();c.act({k:'chat',e:b.textContent});}));
        pans.dec.append(tblEl,ch,lockB,em2);
        const choose=k=>e=>{e.preventDefault();const S=S0();if(!S||S.stage!=='dec'||locked)return;sel=k;sfx.tap();c.act({k:'pick',c:k});paint();};
        btnS.addEventListener('pointerdown',choose('S'));btnT.addEventListener('pointerdown',choose('T'));
        lockB.addEventListener('pointerdown',e=>{e.preventDefault();const S=S0();if(!S||S.stage!=='dec'||locked||!sel)return;locked=true;sfx.good();buzz(40);c.act({k:'lock',c:sel});paint();});
        root.append(top,tb,plEl,feed,rv,pans.neg,pans.dec);
        paint=()=>{
          btnS.classList.toggle('on',sel==='S');btnT.classList.toggle('on',sel==='T');
          btnS.classList.toggle('off',locked&&sel!=='S');btnT.classList.toggle('off',locked&&sel!=='T');
          lockB.disabled=!sel||locked;lockB.classList.toggle('done',locked);
          lockB.textContent=locked?'🔒 LOCKED: '+(sel==='S'?'SPLIT 🤝':'STEAL 🗡️'):(sel?'🔒 LOCK IT IN':'Pick one…');
        };
        paint();
      },
      start(){},
      update(S,R){
        if(!root||!S)return;
        const rd=S.rd;
        if(rd!==lastRd){lastRd=rd;lastQ=0;feed.querySelectorAll('.ss-b').forEach(b=>b.remove());lastStage='';
          rdEl.innerHTML='ROUND<b></b>';rdEl.querySelector('b').textContent=(rd+1)+' / '+POTS.length;
          potEl.textContent='🪙 '+S.pot;potEl.classList.remove('pop');void potEl.offsetWidth;potEl.classList.add('pop');
          if(rd===POTS.length-1)rdEl.innerHTML='ROUND '+(rd+1)+'/'+POTS.length+'<b>DOUBLE POT 🔥</b>';}
        const key=R.pl.map(p=>p.id+p.n+p.aw).join('|');
        if(key!==plKey){plKey=key;buildPre(R);plEl.innerHTML='';chips={};
          R.pl.forEach(p=>{const d=E('div','ss-c','<div class="nm"></div><div class="co"></div><div class="sh">&nbsp;</div><span class="lk"></span>');d.style.setProperty('--c',COLORS[p.ci]);d.querySelector('.nm').textContent=p.n+(p.id===c.me()?' ★':'');d.classList.toggle('aw',!!p.aw);chips[p.id]=d;plEl.append(d);});}
        for(const p of R.pl){const d=chips[p.id];if(!d)continue;
          d.querySelector('.co').textContent='🪙 '+(S.tot[p.id]||0);
          const b=S.bet[p.id]||0;d.querySelector('.sh').textContent=b?'🗡️ ×'+b+' betrayal'+(b>1?'s':''):' ';
          d.querySelector('.lk').textContent=(S.stage==='dec'&&S.lock[p.id])?'🔒':'';}
        if(S.stage!==lastStage){lastStage=S.stage;setStage(S);if(S.stage==='dec'){sfx.go();buzz(50);}}
        if(S.stage==='dec'&&tblEl.dataset.k!==S.part.length+'-'+S.pot)table(S);
        // chat
        for(const m of S.chat){if(m.q>lastQ){lastQ=m.q;feed.append(bubble(m));if(m.id!==c.me())sfx.tap();}}
        const bs=feed.querySelectorAll('.ss-b');for(let i=0;i<bs.length-(S.stage==='dec'?3:6);i++)bs[i].remove();
        hintEl.style.display=feed.querySelector('.ss-b')?'none':'block';
        if(S.stage==='rev')renderCards(S);
      },
      frame(){
        const S=S0();if(!S||!root)return;
        const el=c.t()-S.sa;let left=0;
        if(S.stage==='neg'||S.stage==='dec'){left=Math.max(0,S.sd-el);tbI.style.width=(100*clamp(left/S.sd,0,1))+'%';
          const sc=Math.ceil(left);phEl.innerHTML=(S.stage==='neg'?'🗣️ TALK':'🔒 DECIDE')+'<b>'+sc+'</b>';
          if(sc!==lastSec){lastSec=sc;if(sc<=5&&sc>0)beep(S.stage==='dec'?520:880,.05,'square',.06);}}
        else{tbI.style.width='100%';phEl.innerHTML='🥁 REVEAL<b>&nbsp;</b>';}
      },
      stop(){}
    };
  }
};
})();
