// MIND MELD (key: unique) — coordination category blitz. Everyone secretly types ONE answer. You score only if you MATCH at least one other player, but NOT everyone.
// 5 rounds: write (14s) -> one-by-one reveal (matches light up) -> settle (points) -> next.
(function(){
const CATS=[
"Name a fruit","Pick a number from 1 to 10","A colour","Something in a fridge","A pet","A famous cartoon character","A Disney movie","A day of the week",
"A vegetable","An animal at the zoo","A farm animal","A pizza topping","A fast food place","A superhero","A country","A shape",
"A drink","A sport","A planet","A season","A month","A boy's name","A girl's name","A school subject",
"Something in a kitchen","Something at the beach","A letter of the alphabet","A type of weather","An ice cream flavour","A board game","A video game","A musical instrument",
"A cereal","A crisp flavour","A city in the UK","Something that's yellow","Something that's red","Something that's blue","Something that's green","Something that's round",
"Cats or dogs?","Pizza or burgers?","Summer or winter?","Sweet or savoury?","Day or night?","Tea or coffee?","Beach or mountains?","Heads or tails?",
"Pick a number from 1 to 100","Pick a letter","Pick a card from a deck","Pick a Mario Kart character","Something you take camping","Something in a school bag","Something in a bathroom","Something in a bedroom",
"A Harry Potter character","A Pixar movie","A famous footballer","A famous singer","A dinosaur","A type of tree","A type of dog","A type of shoe",
"A reason to be late","Something that's hot","Something that's cold","Something that's sticky","Something that's loud","Something you do on holiday","A holiday destination","Something you'd find in a pocket",
"A famous landmark","A candy or sweet","A type of bread","A breakfast food","A snack","A type of transport","A thing with wheels","Something in space",
"A word that goes with 'ice'","A word that goes with 'fire'","A word that goes with 'sun'","A word that goes with 'water'","A bird","A sea creature","A type of pasta","A famous duo"
];
function stem(x){
  if(x.length>3){
    if(x.length>4&&/ies$/.test(x))return x.slice(0,-3)+'y';
    if(/(ches|shes|sses|xes|zes)$/.test(x))return x.slice(0,-2);
    if(/s$/.test(x)&&!/(ss|us|is)$/.test(x))return x.slice(0,-1);
  }
  return x;
}
const NUM={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20'};
function nrm(s){
  s=String(s==null?'':s).toLowerCase();
  try{s=s.normalize('NFD').replace(/[̀-ͯ]/g,'');}catch(e){}
  // strip ASCII punctuation only, so emoji / non-latin answers still count
  s=s.replace(/&/g,' and ').replace(/[!-\/:-@\[-`{-~]+/g,' ').replace(/\s+/g,' ').trim();
  let w=s.split(' ').filter(Boolean);
  while(w.length>1&&(w[0]==='a'||w[0]==='an'||w[0]==='the'))w.shift();
  return w.map(x=>NUM[x]||(x==='grey'?'gray':x==='colour'?'color':stem(x))).join('');
}
function lev1(a,b){ // edit distance <= 1
  if(a===b)return true;const la=a.length,lb=b.length;if(Math.abs(la-lb)>1)return false;
  let i=0,j=0,d=0;
  while(i<la&&j<lb){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++d>1)return false;
    if(la>lb)i++;else if(lb>la)j++;else{i++;j++;}
  }
  return d+(la-i)+(lb-j)<=1;
}
const same=(a,b)=>a===b||(a.length>=5&&b.length>=5&&lev1(a,b));
const GC=['#ff9f1c','#a78bfa','#2dd4bf'];   // shared colours for matching groups
const WRITE=14,NR=5;

GAMES.unique={
  name:'Mind Meld',emoji:'🤝',tag:'Read your friends. Match someone, but not everyone.',
  min:3,max:4,
  rules:[
    ['✍️','A category appears. Everyone secretly types ONE short answer (14 seconds).'],
    ['🤝','You score if your answer MATCHES at least one other player. The bigger the matching group, the more points each person gets (2 players = 2 pts, 3 players = 3 pts).'],
    ['😵','But if EVERYONE matches it\'s too obvious and nobody scores. A lone wolf 🐺 scores 0 too.'],
    ['📖','Example, "A fruit": Dyl writes banana, Sam writes Bananas, Jo writes apple. Dyl and Sam match and get 2 each. Jo gets 0. If Jo had written banana as well: 0 for all three!']
  ],
  ctrl:'Type your answer, press Enter or LOCK IT IN.',
  win:'Most points after 5 rounds. Aim for the obvious-but-not-TOO-obvious answer.',
  dur:130,hz:10,better:'high',fmt:v=>v+' pts',

  // ---------------- host ----------------
  init(H){
    const tot={};H.players.forEach(p=>tot[p.id]=0);
    return{rd:0,nr:NR,cat:'',ph:'wait',pd:0,pe:0,sub:{},ord:[],shown:[],out:{},rp:{},tot,
      _cats:shuffle(CATS).slice(0,NR),_ans:{},_items:[],_nx:0};
  },
  begin(H,S){startRound(H,S);},
  tick(H,S,dt){
    if(S.ph==='write'){
      const act=H.players.filter(p=>!p.aw);
      const all=act.length>0&&act.every(p=>S.sub[p.id]);
      if(S.t>=S.pe+1.3||(all&&S.t>S.pe-S.pd+1.0)||!act.length)beginReveal(H,S);
    }else if(S.ph==='reveal'){
      if(S.shown.length<S.ord.length){
        if(S.t>=S._nx){
          const id=S.ord[S.shown.length],it=S._items.find(x=>x.id===id);
          S.shown.push({id,a:it.a,g:it.g,x:it.st==='n'?'n':''});
          S._nx=S.t+(S.ord.length>3?1.25:1.45);
        }
      }else if(S.t>=S._nx+0.5)settle(H,S);
    }else if(S.ph==='settle'){
      if(S.t>=S.pe)nextRound(H,S);
    }
  },
  act(H,S,pid,m){
    if(!m||m.k!=='ans')return;
    if(S.ph!=='write'||S.t>S.pe+1.2||S.sub[pid])return;
    if(typeof m.a!=='string')return;
    let a=Array.from(m.a.replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g,' ').replace(/\s+/g,' ').trim()).slice(0,26).join('');
    if(!a)return;
    S._ans[pid]=a;S.sub[pid]=true;
  },
  val(S,id){return S.tot[id]||0;},

  // ---------------- client ----------------
  mk(c){
    let root,rdEl,tmEl,barI,catEl,inRow,inp,btn,main,msg;
    let started=false,submitted=false,lastRd=-1,lastSig='',lastShown=0,lastPh='',S0=null;
    const st=()=>{
      if(document.getElementById('st-unique'))return;
      const s=document.createElement('style');s.id='st-unique';
      s.textContent=`
.uq{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:8px 14px 10px;overflow:hidden}
.uqh{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:13px;color:var(--dim);letter-spacing:1px}
.uqh b{font-size:17px;color:#fff;font-variant-numeric:tabular-nums}
.uqbar{height:6px;border-radius:4px;background:#ffffff14;overflow:hidden;flex:0 0 6px}
.uqbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#19d3ff,#ff3d81)}
.uqcat{background:linear-gradient(135deg,#2a2a5e,#1d1d44);border-radius:18px;padding:12px 16px;font-weight:900;font-size:clamp(19px,6.4vw,27px);line-height:1.18;text-align:center;min-height:clamp(64px,11vh,104px);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 #0f0f26;word-break:break-word}
.uqin{display:flex;gap:8px}
.uqin input{flex:1;min-width:0;font-size:18px;height:56px;padding:0 14px;text-align:left}
.uqin button{flex:0 0 auto;height:56px;min-width:104px;padding:0 14px;font-size:16px;border-radius:16px}
.uqin.off{display:none}
.uqmain{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1;overflow:hidden;padding-top:2px}
.uqchips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.uqchip{background:var(--panel);border-radius:12px;border-bottom:3px solid var(--c);padding:7px 12px;font-weight:800;font-size:14px;display:flex;gap:6px;align-items:center}
.uqchip.ok{background:#12381f}
.uqmsg{text-align:center;font-weight:800;font-size:15px;color:#ffd23f;min-height:20px;line-height:1.25}
.uqcard{display:flex;align-items:center;gap:10px;background:var(--panel);border-radius:18px;padding:8px 14px;border-left:10px solid var(--c);flex:1 1 0;min-height:46px;max-height:clamp(54px,11vh,86px);position:relative;transition:background .25s,box-shadow .25s}
.uqcard .nm{font-size:12px;font-weight:800;color:#b5b5dc;line-height:1}
.uqcard .an{font-size:clamp(19px,6.6vw,28px);font-weight:900;line-height:1.1;word-break:break-word;overflow:hidden;max-height:2.3em}
.uqcard .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.uqcard .bd{font-weight:900;font-size:15px;text-align:right;white-space:nowrap;line-height:1.1}
.uqcard.hid .an{color:#ffffff30}
.uqcard.pop{animation:uqpop .35s}
.uqcard.mt{background:var(--g2);box-shadow:inset 0 0 0 3px var(--g);animation:uqglow .5s}
.uqcard.mt .bd{color:var(--g);font-size:19px}
.uqcard.lw{opacity:.6}
.uqcard.ob{background:#4a1220;box-shadow:inset 0 0 0 3px #ff4b4b;animation:uqshake .45s}
.uqcard.ob .bd{color:#ff7a7a}
.uqcard.dim{opacity:.5}
@keyframes uqpop{0%{transform:scale(.6) rotate(-3deg);opacity:0}60%{transform:scale(1.07)}100%{transform:none;opacity:1}}
@keyframes uqglow{0%{transform:scale(1)}40%{transform:scale(1.04)}100%{transform:none}}
@keyframes uqshake{0%,100%{transform:none}20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
`;
      document.head.append(s);
    };
    function submit(){
      if(submitted||!S0||S0.ph!=='write')return;
      const v=inp.value.replace(/\s+/g,' ').trim();
      if(!v){inp.classList.remove('shake');void inp.offsetWidth;inp.classList.add('shake');return;}
      submitted=true;c.act({k:'ans',a:v});sfx.good();buzz(20);
      inp.blur();inp.disabled=true;btn.disabled=true;btn.textContent='Locked ✓';
    }
    function card(id,cls,an,bd,gc){
      const d=E('div','uqcard '+(cls||''),'<div class="tx"><div class="nm"></div><div class="an"></div></div><div class="bd"></div>');
      d.style.setProperty('--c',c.col(id));
      if(gc){d.style.setProperty('--g',gc);d.style.setProperty('--g2',gc+'30');}
      const p=c.pl(id);d.querySelector('.nm').textContent=(p?p.n:'?')+(id===c.me()?' (you)':'');
      d.querySelector('.an').textContent=an;d.querySelector('.bd').textContent=bd||'';
      return d;
    }
    // group info among the answers revealed so far
    function groups(S){
      const seen=[],info={};
      for(const sh of S.shown)if(sh.g&&!seen.includes(sh.g))seen.push(sh.g);
      for(const sh of S.shown)if(sh.g){const o=info[sh.g]||(info[sh.g]={g:sh.g,n:0,ids:[],a:sh.a,col:GC[seen.indexOf(sh.g)%GC.length]});o.n++;o.ids.push(sh.id);}
      return info;
    }
    function draw(S,R){
      const pl=R.pl;
      if(S.ph==='wait'){msg.textContent='Get ready…';return;}
      if(S.ph==='done')return;
      rdEl.textContent='ROUND '+(S.rd+1)+'/'+S.nr;
      catEl.textContent=S.cat;
      const sig=JSON.stringify([S.ph,S.rd,S.sub,S.shown.length,S.out,S.tot,pl.map(p=>p.aw),submitted]);
      if(sig===lastSig)return;lastSig=sig;
      main.innerHTML='';
      inRow.classList.toggle('off',S.ph!=='write');
      const me=c.me();
      if(S.ph==='write'){
        if(S.sub[me]&&!submitted){submitted=true;inp.disabled=true;btn.disabled=true;btn.textContent='Locked ✓';try{inp.blur();}catch(e){}}
        const ch=E('div','uqchips');
        for(const p of pl){const done=S.sub[p.id];const x=E('div','uqchip'+(done?' ok':''),'<span></span><span></span>');x.style.setProperty('--c',COLORS[p.ci]);x.children[0].textContent=p.n;x.children[1].textContent=p.aw?'💤':done?'✅':'✍️';ch.append(x);}
        main.append(ch);
        msg.textContent=submitted?'Locked in! Hoping someone thinks like you…':'Match ONE other player, but not everyone!';
      }else{
        const fin=S.ph==='settle',info=groups(S),n=pl.length;
        let order=S.ord.slice();
        if(fin)order.sort((a,b)=>{const sa=S.shown.find(o=>o.id===a),sb=S.shown.find(o=>o.id===b);return ((sb&&sb.g?(info[sb.g]||{n:0}).n:0)-(sa&&sa.g?(info[sa.g]||{n:0}).n:0))||(S.ord.indexOf(a)-S.ord.indexOf(b));});
        order.forEach(id=>{
          const i=S.ord.indexOf(id),sh=S.shown[i];
          if(!sh){main.append(card(id,'hid','???',''));return;}
          const gi=sh.g?info[sh.g]:null;
          let cls='',bd='',gc=null;
          if(sh.x==='n'){cls='dim';bd='no answer';}
          else if(fin){
            const o=S.out[id];
            if(o==='m'){cls='mt';bd='🤝 +'+(S.rp[id]||0);gc=gi.col;}
            else if(o==='a'){cls='ob';bd='😵 too obvious';}
            else if(o==='l'){cls='lw';bd='🐺 lone wolf';}
          }else if(gi&&gi.n>1){cls='mt';bd='🤝 match!';gc=gi.col;}
          if(i===S.shown.length-1&&!fin)cls+=' pop';
          main.append(card(id,cls,sh.a||'—',bd,gc));
        });
        if(fin){
          const sc=E('div','uqchips');
          for(const p of pl){const x=E('div','uqchip','<span></span><b></b>');x.style.setProperty('--c',COLORS[p.ci]);x.children[0].textContent=p.n;x.children[1].textContent=(S.tot[p.id]||0)+(S.rp[p.id]?' (+'+S.rp[p.id]+')':'');sc.append(x);}
          main.append(sc);
          const vals=Object.values(S.out);
          if(vals.includes('a')){const a=S.shown.find(o=>S.out[o.id]==='a');msg.textContent='😵 Everyone said "'+(a?a.a:'?')+'". Too obvious: 0 for all!';}
          else if(vals.includes('m')){
            const gs=Object.values(info).filter(g=>g.n>1);
            msg.textContent='🤝 '+gs.map(g=>g.ids.map(id=>(c.pl(id)||{}).n).join(' & ')+' matched (+'+g.n+' each)').join(' · ');
          }else msg.textContent='🐺 Nobody matched. Mind-reading fail! 0 points.';
        }else msg.textContent=S.shown.length?'':'Let\'s see what everyone wrote…';
      }
    }
    return{
      mount(r){
        st();root=r;
        const f=E('div','uq');
        const h=E('div','uqh','<span></span><b></b>');rdEl=h.children[0];tmEl=h.children[1];
        const b=E('div','uqbar','<i></i>');barI=b.firstChild;
        catEl=E('div','uqcat');
        inRow=E('div','uqin off');
        inp=E('input');inp.type='text';inp.maxLength=26;inp.placeholder='Your answer…';
        inp.setAttribute('autocomplete','off');inp.setAttribute('autocorrect','off');inp.setAttribute('autocapitalize','off');inp.setAttribute('spellcheck','false');inp.setAttribute('enterkeyhint','send');inp.setAttribute('aria-label','Your answer');
        btn=E('button','btn','LOCK IT IN');
        inRow.append(inp,btn);
        main=E('div','uqmain');msg=E('div','uqmsg');
        f.append(h,b,catEl,inRow,msg,main);r.append(f);
        inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
        btn.addEventListener('pointerdown',e=>{e.preventDefault();submit();});
      },
      start(){started=true;},
      update(S,R){
        S0=S;
        if(S.rd!==lastRd){lastRd=S.rd;submitted=false;inp.value='';inp.disabled=false;btn.disabled=false;btn.textContent='LOCK IT IN';lastSig='';}
        if(S.ph==='write'&&lastPh!=='write'&&started){try{inp.focus({preventScroll:true});}catch(e){}}
        if(started){
          if(S.shown.length>lastShown&&S.ph==='reveal'){
            const nw=S.shown[S.shown.length-1];const m=nw.g&&S.shown.filter(o=>o.g===nw.g).length>1;
            if(m){sfx.good();buzz(30);}else sfx.tap();
          }
          if(S.ph==='settle'&&lastPh!=='settle'){
            const vals=Object.values(S.out);
            if(vals.includes('a')){sfx.bad();buzz([60,40,80]);}else if(vals.includes('m'))sfx.win();else sfx.tick();
          }
        }
        lastShown=S.shown.length;lastPh=S.ph;
        draw(S,R);
      },
      frame(){
        if(!S0||!barI)return;
        const S=S0;let rem=S.pe-c.t();
        const timed=S.ph==='write';
        barI.style.width=timed&&S.pd?(clamp(rem/S.pd,0,1)*100)+'%':'0';
        tmEl.textContent=timed?Math.max(0,Math.ceil(rem))+'s':'';
        if(S.ph==='write'&&!submitted&&rem<0.15&&inp.value.trim())submit();
      },
      stop(){try{inp&&inp.blur();}catch(e){}}
    };
  }
};

// ---- host helpers (module-private) ----
function startRound(H,S){
  S.cat=S._cats[S.rd];S.ph='write';S.pd=WRITE;S.pe=S.t+S.pd;S.sub={};S._ans={};S.ord=[];S.shown=[];S.out={};S.rp={};
}
function beginReveal(H,S){
  const items=H.players.map(p=>{
    const a=S._ans[p.id]||'',k=nrm(a);
    return{id:p.id,a,k,st:(!a||!k)?'n':'v',g:0};
  });
  const v=items.filter(x=>x.st==='v');
  const par=v.map((_,i)=>i);const find=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i;};
  for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++)if(same(v[i].k,v[j].k))par[find(i)]=find(j);
  v.forEach((x,i)=>x.g=find(i)+1);
  S._items=items;S.ord=shuffle(items.map(x=>x.id));S.shown=[];S.ph='reveal';S._nx=S.t+0.9;S.pd=0;
}
function settle(H,S){
  const n=Math.max(2,H.players.filter(p=>!p.aw).length);   // "everyone" = everyone still at the table
  S.out={};S.rp={};
  for(const it of S._items){
    if(it.st==='n'){S.out[it.id]='n';S.rp[it.id]=0;continue;}
    const g=S._items.filter(o=>o.g&&o.g===it.g).length;
    let o='l',pts=0;
    if(g>=n){o='a';}
    else if(g>=2){o='m';pts=g;}
    S.out[it.id]=o;S.rp[it.id]=pts;S.tot[it.id]=(S.tot[it.id]||0)+pts;
  }
  S.ph='settle';S.pe=S.t+3.2;S.pd=0;
}
function nextRound(H,S){
  if(S.rd+1>=S.nr){S.over=true;S.hold=0.4;S.ph='done';return;}
  S.rd++;
  startRound(H,S);
}
})();
