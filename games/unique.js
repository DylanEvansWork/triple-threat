// BE UNIQUE — category blitz where matching answers cancel out. 4 rounds: write (18s) -> one-by-one reveal -> settle -> optional 🔥 vote (5s) -> tally.
(function(){
const CATS=[
"Name a fruit","Something you'd find in a school bag","A superhero","A word that rhymes with 'cat'","A famous Disney movie","An excuse for being late",
"A pizza topping","An animal you would NOT want as a pet","Something that's yellow","Something to take to a desert island","A famous YouTuber or streamer","A type of cereal",
"Something that's freezing cold","Something you do in the shower","A video game","A fast food place","Something in a kitchen drawer","A really annoying sound",
"Something you'd NEVER say to a teacher","A country in Europe","A famous singer","Something that comes in pairs","An ice cream flavour","A job that sounds fun",
"A job that sounds awful","Something you find at the beach","A sport nobody should watch","A board game","Something in your pocket right now","What you yell when you stub your toe (keep it PG)",
"A school subject","A cartoon character","A colour of the rainbow","Something that's round","A famous duo (Batman & Robin...)","A dinosaur",
"Something in a haunted house","An animal starting with B","Something in a bathroom","A famous landmark","A sweet or candy","An emoji you use way too much",
"Something sticky","What to do on a rainy day","Something you should NOT microwave","A Pixar character","Something really long","An animal at the zoo",
"A funny-sounding word","Something with wheels","A planet","A birthday present everyone wants","A reason to skip school (shh)","A band your parents love",
"Something to bring to a picnic","A good name for a pet goldfish","A football (soccer) club","A drink","Something that smells terrible","A theme park ride",
"Something from Harry Potter","Something you'd find in space","Something scary","A Disney princess","Something made of wood","A way to travel",
"A holiday or celebration","Something that makes you laugh","Something you'd see in winter","A word that rhymes with 'blue'","Something in a wallet or purse","A bad habit",
"A mythical creature","Something in a forest","A snack at the cinema","A food you eat with your hands","A famous inventor","Something under your bed",
"A good name for a dog","Something red","A musical instrument","Something people lie about","A thing you'd find in a garden","A famous cartoon animal",
"Something loud","A superpower you'd want","A word that rhymes with 'night'","Something you do when you're bored","A type of shoe","A famous painting or artist"
];
const STOP=new Set('name a an the of in on at to for with that who you youd your would could might can is it its and or be being famous good bad best worst word words thing things something someone type kind one this these those what when where why how are was were do does did not never nobody have has had get got from by as up out all any some more most really very too keep pg'.split(' '));
function stem(x){
  if(x.length>3){
    if(x.length>4&&/ies$/.test(x))return x.slice(0,-3)+'y';
    if(/(ches|shes|sses|xes|zes)$/.test(x))return x.slice(0,-2);
    if(/s$/.test(x)&&!/(ss|us|is)$/.test(x))return x.slice(0,-1);
  }
  return x;
}
function nrm(s){
  s=String(s||'').toLowerCase();
  try{s=s.normalize('NFD').replace(/[̀-ͯ]/g,'');}catch(e){}
  s=s.replace(/&/g,' and ').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  let w=s.split(' ').filter(Boolean);
  while(w.length>1&&(w[0]==='a'||w[0]==='an'||w[0]==='the'))w.shift();
  return w.map(stem).join('');
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
function same(a,b){return a===b||(a.length>=5&&b.length>=5&&lev1(a,b));}
function catKeys(cat){
  const s=cat.toLowerCase().replace(/[^a-z0-9' ]+/g,' ').replace(/'s?\b/g,'').replace(/'/g,'').split(/\s+/).filter(w=>w.length>=3&&!STOP.has(w));
  return s.map(stem);
}
function echo(cat,k){return catKeys(cat).some(x=>x===k);}

GAMES.unique={
  name:'Be Unique',emoji:'✍️',tag:'Think different. Match someone and you both get nothing.',
  min:2,max:4,
  rules:[
    ['✍️','A category appears. Type ONE short answer fast (18 seconds).'],
    ['💥','Everyone\'s answers get revealed. If two or more people wrote the same thing, it CLASHES and nobody scores. "Pizza" + "pizzas" + "a pizza" = clash.'],
    ['⭐','A UNIQUE answer scores 2 points. Answering with the category itself or nothing scores 0.'],
    ['🔥','Then tap 🔥 on your favourite answer that isn\'t yours: the most 🔥 gets +1. 4 rounds total.']
  ],
  ctrl:'Type your answer, press Enter or LOCK IT IN. Tap 🔥 to vote.',
  win:'Most points over 4 rounds. 2 per unique answer, +1 for the best answer.',
  dur:140,hz:10,better:'high',fmt:v=>v+' pts',

  // ---------------- host ----------------
  init(H){
    const tot={};H.players.forEach(p=>tot[p.id]=0);
    return{rd:0,nr:4,cat:'',ph:'wait',pd:0,pe:0,sub:{},ord:[],shown:[],out:{},fire:[],vtd:{},fw:[],fc:{},rp:{},tot,
      _cats:shuffle(CATS).slice(0,4),_ans:{},_items:[],_fv:{},_nx:0};
  },
  begin(H,S){startRound(H,S);},
  tick(H,S,dt){
    if(S.ph==='write'){
      const act=H.players.filter(p=>!p.aw);
      const all=act.length>0&&act.every(p=>S.sub[p.id]);
      if(S.t>=S.pe+0.6||(all&&S.t>S.pe-S.pd+1.2)||(!act.length))beginReveal(H,S);
    }else if(S.ph==='reveal'){
      if(S.shown.length<S.ord.length){
        if(S.t>=S._nx){
          const id=S.ord[S.shown.length],it=S._items.find(x=>x.id===id);
          S.shown.push({id,a:it.a,g:it.g,x:it.st==='n'||it.st==='e'?it.st:''});
          S._nx=S.t+(S.ord.length>3?1.35:1.6);
        }
      }else if(S.t>=S._nx+0.4)settle(H,S);
    }else if(S.ph==='settle'){
      if(S.t>=S.pe)startFire(H,S);
    }else if(S.ph==='fire'){
      const el=elig(H,S),all=el.length>0&&el.every(id=>id in S._fv);
      if(S.t>=S.pe||all)tally(H,S);
    }else if(S.ph==='tally'){
      if(S.t>=S.pe)nextRound(H,S);
    }
  },
  act(H,S,pid,m){
    if(m.k==='ans'){
      if(S.ph!=='write'||S.t>S.pe+0.7||S.sub[pid])return;
      let a=String(m.a==null?'':m.a).replace(/\s+/g,' ').trim().slice(0,26);
      if(!a)return;
      S._ans[pid]=a;S.sub[pid]=true;
    }else if(m.k==='fire'){
      if(S.ph!=='fire'||pid in S._fv)return;
      const to=+m.to;if(!S.fire.includes(to)||to===pid)return;
      S._fv[pid]=to;S.vtd[pid]=true;
    }
  },
  val(S,id){return S.tot[id]||0;},

  // ---------------- client ----------------
  mk(c){
    let root,rdEl,tmEl,barI,catEl,inRow,inp,btn,main,msg;
    let started=false,submitted=false,myVote=-1,lastRd=-1,lastSig='',lastShown=0,lastPh='',S0=null;
    const st=()=>{
      if(document.getElementById('st-unique'))return;
      const s=document.createElement('style');s.id='st-unique';
      s.textContent=`
.uq{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:8px 14px 10px;overflow:hidden}
.uqh{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:13px;color:var(--dim);letter-spacing:1px}
.uqh b{font-size:17px;color:#fff;font-variant-numeric:tabular-nums}
.uqbar{height:6px;border-radius:4px;background:#ffffff14;overflow:hidden;flex:0 0 6px}
.uqbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#19d3ff,#ff3d81)}
.uqcat{background:linear-gradient(135deg,#2a2a5e,#1d1d44);border-radius:18px;padding:14px 16px;font-weight:900;font-size:clamp(20px,6.6vw,28px);line-height:1.18;text-align:center;min-height:clamp(70px,12vh,110px);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 #0f0f26}
.uqin{display:flex;gap:8px}
.uqin input{flex:1;min-width:0;font-size:18px;height:56px;padding:0 14px;text-align:left}
.uqin button{flex:0 0 auto;height:56px;min-width:104px;padding:0 14px;font-size:16px;border-radius:16px}
.uqin.off{display:none}
.uqmain{display:flex;flex-direction:column;gap:9px;padding-top:4px;min-height:0;flex:1;overflow:hidden}
.uqchips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.uqchip{background:var(--panel);border-radius:12px;border-bottom:3px solid var(--c);padding:7px 12px;font-weight:800;font-size:14px;display:flex;gap:6px;align-items:center}
.uqchip.ok{background:#12381f}
.uqmsg{text-align:center;font-weight:800;font-size:15px;color:#ffd23f;min-height:20px}
.uqcard{display:flex;align-items:center;gap:10px;background:var(--panel);border-radius:18px;padding:10px 14px;border-left:10px solid var(--c);min-height:clamp(54px,11vh,86px);position:relative;transition:background .2s,box-shadow .2s}
.uqcard .nm{font-size:12px;font-weight:800;color:#b5b5dc;line-height:1}
.uqcard .an{font-size:clamp(20px,7vw,30px);font-weight:900;line-height:1.1;word-break:break-word}
.uqcard .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.uqcard .bd{font-weight:900;font-size:15px;text-align:right;white-space:nowrap;line-height:1.1}
.uqcard.hid .an{color:#ffffff30}
.uqcard.pop{animation:uqpop .35s}
.uqcard.cl{background:#4a1220;box-shadow:inset 0 0 0 3px #ff4b4b;animation:uqshake .4s}
.uqcard.cl .bd{color:#ff7a7a}
.uqcard.un{background:#12381f;box-shadow:inset 0 0 0 3px #52ff7a}
.uqcard.un .bd{color:#52ff7a;font-size:20px}
.uqcard.dim{opacity:.55}
.uqcard.win{box-shadow:inset 0 0 0 3px #ffd23f,0 0 22px #ffd23f66}
.uqcard.vote{cursor:pointer;min-height:clamp(64px,12vh,92px)}
.uqcard.vote:active{transform:scale(.98)}
.uqcard.mine{opacity:.5}
.uqcard.sel{background:#4a2410;box-shadow:inset 0 0 0 3px #ff9f1c}
.uqfire{font-size:30px;line-height:1}
@keyframes uqpop{0%{transform:scale(.6) rotate(-3deg);opacity:0}60%{transform:scale(1.07)}100%{transform:none;opacity:1}}
@keyframes uqshake{0%,100%{transform:none}20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
`;
      document.head.append(s);
    };
    function submit(){
      if(submitted||!S0||S0.ph!=='write')return;
      const v=inp.value.replace(/\s+/g,' ').trim();
      if(!v){inp.classList.add('shake');setTimeout(()=>inp.classList.remove('shake'),350);return;}
      submitted=true;c.act({k:'ans',a:v});sfx.good();buzz(20);
      inp.blur();inp.disabled=true;btn.disabled=true;btn.textContent='Locked ✓';
    }
    function card(id,cls,an,bd){
      const d=E('div','uqcard '+(cls||''),'<div class="tx"><div class="nm"></div><div class="an"></div></div><div class="bd"></div>');
      d.style.setProperty('--c',c.col(id));
      const p=c.pl(id);d.querySelector('.nm').textContent=(p?p.n:'?')+(id===c.me()?' (you)':'');
      d.querySelector('.an').textContent=an;d.querySelector('.bd').textContent=bd||'';
      return d;
    }
    function draw(S,R){
      const pl=R.pl;
      if(S.ph==='wait'){msg.textContent='Get ready…';main.innerHTML='';return;}
      rdEl.textContent='ROUND '+(S.rd+1)+'/'+S.nr;
      catEl.textContent=S.cat;
      const sig=JSON.stringify([S.ph,S.rd,S.sub,S.shown.length,S.out,S.vtd,S.fw,S.fc,myVote,S.tot,pl.map(p=>p.aw)]);
      if(sig===lastSig)return;lastSig=sig;
      main.innerHTML='';
      inRow.classList.toggle('off',S.ph!=='write');
      if(S.ph==='write'){
        const ch=E('div','uqchips');
        for(const p of pl){const done=S.sub[p.id];const x=E('div','uqchip'+(done?' ok':''),'<span></span><span></span>');x.style.setProperty('--c',COLORS[p.ci]);x.children[0].textContent=p.n;x.children[1].textContent=p.aw?'💤':done?'✅':'✍️';ch.append(x);}
        main.append(ch);
        msg.textContent=submitted?'Locked in! Waiting for the others…':'Type ONE answer. Match someone and you both score 0!';
      }else if(S.ph==='reveal'||S.ph==='settle'){
        const fin=S.ph==='settle';
        S.ord.forEach((id,i)=>{
          const sh=S.shown[i];
          if(!sh){main.append(card(id,'hid','???',''));return;}
          const grp=sh.g?S.shown.filter(o=>o.g===sh.g).length:0;
          let cls='',bd='';
          if(sh.x==='n'){cls='dim';bd='no answer · 0';}
          else if(sh.x==='e'){cls='dim';bd='too obvious · 0';}
          else if(grp>1){cls='cl';bd='💥 CLASH · 0';}
          else if(fin){cls='un';bd='+2 ⭐';}
          if(i===S.shown.length-1&&!fin)cls+=' pop';
          main.append(card(id,cls,sh.a||'—',bd));
        });
        msg.textContent=fin?'Unique answers score 2!':(S.shown.length?'':'Let\'s see what everyone wrote…');
      }else if(S.ph==='fire'){
        const mine=S.fire.includes(c.me());
        S.fire.forEach(id=>{
          const sh=S.shown.find(o=>o.id===id);
          const me=id===c.me();
          const d=card(id,'vote'+(me?' mine':'')+(myVote===id?' sel':''),sh?sh.a:'',me?'yours':'🔥');
          if(!me&&myVote<0){d.addEventListener('pointerdown',e=>{e.preventDefault();if(myVote>=0||c.R().ph!=='play')return;myVote=id;c.act({k:'fire',to:id});sfx.good();buzz(25);lastSig='';draw(S0,c.R());});}
          main.append(d);
        });
        const others=S.fire.filter(id=>id!==c.me()).length;
        msg.textContent=myVote>=0?'🔥 Vote locked in!':others?'Tap the answer you like best! Most 🔥 gets +1':'Others are voting on your answer 👀';
      }else if(S.ph==='tally'){
        S.fire.forEach(id=>{
          const w=S.fw.includes(id);
          const sh=S.shown.find(o=>o.id===id);
          main.append(card(id,w?'win':'',sh?sh.a:'',(S.fc[id]?'🔥'.repeat(Math.min(5,S.fc[id])):'')+(w?' +1':'')));
        });
        const sc=E('div','uqchips');
        for(const p of pl){const x=E('div','uqchip','<span></span><b></b>');x.style.setProperty('--c',COLORS[p.ci]);x.children[0].textContent=p.n;x.children[1].textContent=S.tot[p.id]+(S.rp[p.id]?' (+'+S.rp[p.id]+')':'');sc.append(x);}
        main.append(sc);
        msg.textContent=S.fw.length?'🔥 '+S.fw.map(id=>(c.pl(id)||{}).n).join(' & ')+' take the crowd vote!':'Nobody got any 🔥';
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
        if(S.rd!==lastRd){lastRd=S.rd;submitted=false;myVote=-1;inp.value='';inp.disabled=false;btn.disabled=false;btn.textContent='LOCK IT IN';lastSig='';}
        if(S.ph==='write'&&lastPh!=='write'&&started){try{inp.focus({preventScroll:true});}catch(e){}}
        if(started){
          if(S.shown.length>lastShown&&S.ph==='reveal'){
            const n=S.shown[S.shown.length-1];const clash=n.g&&S.shown.filter(o=>o.g===n.g).length>1;
            if(clash){sfx.bad();buzz([40,30,60]);}else sfx.tap();
          }
          if(S.ph==='settle'&&lastPh!=='settle'&&S.shown.some(o=>!o.x&&S.out[o.id]==='u')){sfx.win();}
          if(S.ph==='tally'&&lastPh!=='tally'&&S.fw.length){sfx.good();}
        }
        lastShown=S.shown.length;lastPh=S.ph;
        draw(S,R);
      },
      frame(){
        if(!S0||!barI)return;
        const S=S0;let rem=S.pe-c.t();
        const timed=S.ph==='write'||S.ph==='fire';
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
  S.cat=S._cats[S.rd];S.ph='write';S.pd=18;S.pe=S.t+S.pd;S.sub={};S._ans={};S.ord=[];S.shown=[];S.out={};S.fire=[];S.vtd={};S.fw=[];S.fc={};S.rp={};S._fv={};
}
function beginReveal(H,S){
  const items=H.players.map(p=>{
    const a=S._ans[p.id]||'',k=nrm(a);let st='v';
    if(!a||!k)st='n';else if(echo(S.cat,k))st='e';
    return{id:p.id,a,k,st,g:0};
  });
  const v=items.filter(x=>x.st==='v');
  const par=v.map((_,i)=>i);const find=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i;};
  for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++)if(same(v[i].k,v[j].k))par[find(i)]=find(j);
  v.forEach((x,i)=>x.g=find(i)+1);
  v.forEach(x=>{x.st=v.filter(o=>o.g===x.g).length>1?'c':'u';});
  S._items=items;S.ord=shuffle(items.map(x=>x.id));S.shown=[];S.ph='reveal';S._nx=S.t+0.9;S.pd=0;
}
function settle(H,S){
  S.out={};S.rp={};
  for(const it of S._items){S.out[it.id]=it.st;const pts=it.st==='u'?2:0;S.rp[it.id]=pts;S.tot[it.id]=(S.tot[it.id]||0)+pts;}
  S.ph='settle';S.pe=S.t+2.4;S.pd=0;
}
function elig(H,S){
  const cand=S.fire;
  return H.players.filter(p=>!p.aw&&cand.some(x=>x!==p.id)).map(p=>p.id);
}
function startFire(H,S){
  S.fire=S._items.filter(x=>x.st==='u').map(x=>x.id);
  S._fv={};S.vtd={};
  if(!S.fire.length||!elig(H,S).length){S.fire=[];nextRound(H,S);return;}
  S.ph='fire';S.pd=5;S.pe=S.t+5;
}
function tally(H,S){
  const cnt={};for(const v in S._fv){const to=S._fv[v];cnt[to]=(cnt[to]||0)+1;}
  const mx=Math.max(0,...Object.values(cnt));
  S.fc=cnt;S.fw=mx>0?S.fire.filter(id=>cnt[id]===mx):[];
  S.fw.forEach(id=>{S.tot[id]=(S.tot[id]||0)+1;S.rp[id]=(S.rp[id]||0)+1;});
  S.ph='tally';S.pe=S.t+2.4;S.pd=0;
}
function nextRound(H,S){
  if(S.rd+1>=S.nr){S.over=true;S.hold=0.4;S.ph='done';return;}
  S.rd++;
  startRound(H,S);
}
})();
