// BLUFF & BLAME — Part A: "Most Likely To…" secret votes (3 prompts). Part B: Fib Round (2 weird-but-true facts, write a fake, spot the real one).
(function(){
const PROMPTS=[
["Who is most likely to cry at a movie?","🏆 Certified Crier"],
["Who is most likely to get lost in their own town?","🧭 Human Compass (Broken)"],
["Who is most likely to eat the last slice without asking?","🍕 Slice Bandit"],
["Who would survive a zombie apocalypse the longest?","🧟 Last One Standing"],
["Who is most likely to be late to their own birthday?","⏰ Fashionably Late"],
["Who is most likely to become famous?","⭐ Future Celeb"],
["Who is most likely to reply 3 days later?","📵 Ghost Mode"],
["Who is most likely to trip over absolutely nothing?","🤸 Gravity's Victim"],
["Who could talk their way out of a speeding ticket?","🎤 Smooth Talker"],
["Who would win a hot-dog eating contest?","🌭 Dog Destroyer"],
["Who is most likely to fall asleep during a movie?","😴 Cinema Snoozer"],
["Who is most likely to adopt 10 cats?","🐱 Cat Lord"],
["Who is most likely to laugh at the worst possible moment?","🤭 Giggle Menace"],
["Who would win a staring contest?","👀 Eyes of Steel"],
["Who is most likely to forget their own phone number?","🧠 Goldfish Brain"],
["Who would be best on a desert island?","🏝️ Island Legend"],
["Who is most likely to start a random dance party?","🕺 Party Starter"],
["Who would spend all their money on snacks?","🍿 Snack Billionaire"],
["Who is most likely to be a secret millionaire?","💰 Secret Tycoon"],
["Who is most likely to get stuck in a lift?","🛗 Lift Magnet"],
["Who is most likely to spill a drink on someone?","🥤 Spill Wizard"],
["Who is most likely to cheat at board games?","🎲 Shady Dealer"],
["Who could chat to a stranger for a whole hour?","🗣️ Chatterbox"],
["Who would make the best secret agent?","🕵️ Agent Zero"],
["Who is most likely to rage-quit a video game?","🎮 Rage Quitter"],
["Who is most likely to stay up until 5am?","🦉 Night Owl"],
["Who is most likely to laugh at their own joke?","😂 Own Biggest Fan"]
];
// Only well-known, definitely-true facts. a = real answer, alt = wordings that count as "the real answer" (fakes too close are bounced), fb = silly auto-fill fakes.
const FACTS=[
{q:"Wombats are the only animals whose poo comes out shaped like ______.",a:"cubes",alt:["cube","cubes","cube shaped","cubed","cubical","cubic"],f:"Wombat poo is cube-shaped, so it doesn't roll off rocks and logs.",fb:["tiny stars","footballs","triangles"]},
{q:"On Venus, one full day (a single spin) lasts longer than one ______.",a:"year",alt:["year","venus year","a year","years"],f:"Venus spins so slowly that its day is longer than its year.",fb:["week","century","month"]},
{q:"An octopus has ______ hearts.",a:"three",alt:["3","three","3 hearts"],f:"Octopuses have three hearts: two for the gills, one for the body.",fb:["seven","nine","five"]},
{q:"Sealed pure honey almost never ______, even after thousands of years.",a:"spoils",alt:["spoil","spoils","goes bad","go bad","goes off","go off","rots","rot","expires","expire","gets bad","gone off","going bad"],f:"Honey is so low in water and so acidic that bacteria can't live in it.",fb:["melts","gets lonely","turns blue"]},
{q:"Botanically speaking, bananas are classed as ______.",a:"berries",alt:["berry","berries"],f:"Bananas are berries. Strawberries are not.",fb:["vegetables","nuts","roots"]},
{q:"Cleopatra lived closer in time to the ______ than to the building of the Great Pyramid.",a:"Moon landing",alt:["moon landing","moon landings","the moon landing","first moon landing","apollo 11","apollo","moon landing 1969","moon landing in 1969","moon","1969"],f:"The Great Pyramid is about 4,500 years old. Cleopatra lived about 2,000 years ago.",fb:["dinosaurs","Ice Age","first tamed dog"]},
{q:"The shortest war in history, Britain vs Zanzibar in 1896, lasted about ______.",a:"40 minutes",alt:["40 minutes","40 mins","40 min","forty minutes","38 minutes","45 minutes","38 mins","45 mins","38 min","45 min","less than an hour","under an hour","an hour or less","about 40 minutes","half an hour","38 to 45 minutes"],f:"The Anglo-Zanzibar War of 1896 lasted roughly 38 to 45 minutes.",fb:["3 days","two weeks","9 hours"]},
{q:"A group of flamingos is called a ______.",a:"flamboyance",alt:["flamboyance","a flamboyance","flamboyance of flamingos"],f:"A flamboyance of flamingos. It's a real collective noun.",fb:["parade","blush","flutter"]},
{q:"A group of crows is called a ______.",a:"murder",alt:["murder","a murder","murder of crows"],f:"A murder of crows. Yes, really.",fb:["chorus","riot","gloom"]},
{q:"A group of owls is called a ______.",a:"parliament",alt:["parliament","a parliament","parliament of owls"],f:"A parliament of owls.",fb:["senate","council","hoot"]},
{q:"The national animal of Scotland is the ______.",a:"unicorn",alt:["unicorn","a unicorn","unicorns"],f:"Scotland's official national animal is the unicorn.",fb:["Highland cow","stag","Loch Ness monster"]},
{q:"The Eiffel Tower can grow about 15 cm taller in summer because the iron ______.",a:"expands",alt:["expands","expand","expanded","expansion","thermal expansion","gets hot","gets warm","heats up","warms up","grows","stretches","stretch","swells"],f:"Heat makes metal expand, so the tower is taller on hot days.",fb:["melts","gets lighter","swells with rain"]},
{q:"Sea otters hold hands while they sleep so they don't ______.",a:"drift apart",alt:["drift apart","float apart","drift away","float away","drift off","float off","get separated","separate","drift","float","get lost","lose each other","drift away from each other","float away from each other"],f:"Sea otters link up in groups called rafts to stay together.",fb:["get cold","tickle each other","get eaten"]},
{q:"Nintendo was founded in 1889 as a company that made ______.",a:"playing cards",alt:["playing cards","cards","card","playing card","hanafuda","hanafuda cards","trading cards","flower cards"],f:"Nintendo started by making hanafuda playing cards in Kyoto.",fb:["kimonos","toy trains","tea sets"]},
{q:"Before it was called Google, the search engine's original name was ______.",a:"BackRub",alt:["backrub","back rub","back rubs"],f:"Larry Page and Sergey Brin first called their search engine BackRub.",fb:["WebCrawl","NetSurfer","SearchBot"]},
{q:"When Fredric Baur, inventor of the Pringles can, died, some of his ashes were buried in a ______.",a:"Pringles can",alt:["pringles can","pringle can","pringles tube","pringles","pringles container","can of pringles","tube of pringles","a pringles can","pringles pot","pringle","pringles box","crisp tube","crisp can","chip can","chip tube"],f:"He asked to be buried in one. Part of his ashes went in a Pringles can.",fb:["time capsule","flowerpot","biscuit tin"]},
{q:"Butterflies taste with their ______.",a:"feet",alt:["feet","foot","their feet","legs","leg","tarsi"],f:"Butterflies have taste sensors on their feet.",fb:["wings","eyes","knees"]},
{q:"A giraffe has ______ bones in its neck, the same number as a human.",a:"seven",alt:["7","seven","7 bones","seven bones"],f:"Giraffes, humans and nearly all mammals have seven neck vertebrae.",fb:["twelve","three","nineteen"]},
{q:"Russia stretches across ______ time zones.",a:"eleven",alt:["11","eleven","11 time zones","eleven time zones"],f:"Russia has 11 time zones, more than any other country on land.",fb:["four","nineteen","six"]},
{q:"Bubble wrap was originally invented to be ______.",a:"wallpaper",alt:["wallpaper","wall paper","textured wallpaper","wall covering","wallpapers","wall paper","wall coverings"],f:"Bubble wrap was first made as textured wallpaper in 1957.",fb:["pillow stuffing","a swimsuit","a shower mat"]},
{q:"Koalas have fingerprints that are almost identical to ______.",a:"humans",alt:["humans","human","people","a human","person","human beings","humankind","men","man","us"],f:"Koala fingerprints are so like ours that they could confuse a crime scene.",fb:["goldfish","cows","penguins"]},
{q:"The little dot over a lowercase 'i' is called a ______.",a:"tittle",alt:["tittle","tittles","title","a tittle"],f:"The dot on an i or j really is called a tittle.",fb:["dibble","pinprick","speckle"]},
{q:"The word 'quarantine' comes from the Italian for ______ days.",a:"forty",alt:["40","forty","forty days"],f:"Quaranta giorni: ships once waited 40 days before docking.",fb:["fourteen","ten","twenty-one"]},
{q:"Antarctica is technically the world's largest ______.",a:"desert",alt:["desert","deserts","a desert","dessert"],f:"A desert is a place with very little rain. Antarctica is the biggest.",fb:["rainforest","swamp","beach"]},
{q:"A garden snail has thousands of tiny ______.",a:"teeth",alt:["teeth","tooth","teeths","tiny teeth","a teeth"],f:"A snail's tongue is covered in thousands of tiny teeth.",fb:["eyes","legs","hearts"]},
{q:"Light from the Sun takes about ______ minutes to reach Earth.",a:"eight",alt:["8","eight","8 minutes","eight minutes","about 8","about eight"],f:"Sunlight takes roughly 8 minutes and 20 seconds to get here.",fb:["three","twenty","fifty"]},
{q:"A shrimp's heart is located in its ______.",a:"head",alt:["head","its head","the head","heads","skull"],f:"A shrimp's heart sits in its head.",fb:["tail","left claw","tummy"]},
{q:"Peanuts aren't actually nuts. They're ______.",a:"legumes",alt:["legumes","legume","beans","bean","pulses","pulse","a legume"],f:"Peanuts grow underground and are legumes, like peas and lentils.",fb:["roots","tiny melons","fungi"]},
{q:"The first item ever sold on eBay was a broken ______.",a:"laser pointer",alt:["laser pointer","laser","laser pen","laser pointers","pointer","laser light","laser beam"],f:"eBay's first sale in 1995 was a broken laser pointer for $14.83.",fb:["toaster","guitar","bicycle"]},
{q:"Cats are unable to taste ______.",a:"sweetness",alt:["sweetness","sweet","sweets","sugar","sweet things","sweet stuff","sugary things","sweet foods"],f:"Cats don't have a working sweet-taste receptor.",fb:["salt","water","fish"]}
];
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
function lev1(a,b){
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
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const clean=s=>String(s==null?'':s).replace(/\s+/g,' ').replace(/[.!?\s]+$/,'').trim();
const A_N=3,B_N=2,A_VOTE=10,A_REV=4.8,B_WRITE=25,B_PICK=15;

GAMES.social={
  name:'Bluff & Blame',emoji:'🤥',tag:'Do you know your friends? Can you spot a lie?',
  min:2,max:4,
  rules:[
    ['👉','PART 1, "Most Likely To": a question about your group pops up. Secretly tap who fits best (yourself is allowed). 3 questions.'],
    ['🎯','Most votes wins a silly title. You score +1 every time you voted WITH the crowd. Read the room!'],
    ['🤥','PART 2, "Fib Round": a weird-but-TRUE fact appears with a blank. Write a fake answer that sounds real.'],
    ['🔍','All answers get mixed together. Tap the one you think is true: +2 if you find the real one, and +1 for every player who falls for YOUR fake.']
  ],
  ctrl:'Tap a name to vote. Type your fake answer, then tap the one you believe.',
  win:'Total points from both parts: reading the room, spotting truth, fooling friends.',
  dur:150,hz:10,better:'high',fmt:v=>v+' pts',

  // ---------------- host ----------------
  init(H){
    const tot={},priv={};H.players.forEach(p=>{tot[p.id]=0;priv[p.id]={mine:-1};});
    return{ph:'wait',part:'A',pi:0,pd:0,pe:0,pr:'',ti:'',vtd:{},vc:{},vv:{},win:[],sc:{},
      q:'',sub:{},opts:[],pk:{},rv:null,step:0,tot,
      _prm:shuffle(PROMPTS).slice(0,A_N),_fct:shuffle(FACTS).slice(0,B_N),_votes:{},_fake:{},_picks:{},_au:[],_real:-1,_ord:[],_nx:0,_end:0,_tot:Object.assign({},tot),_priv:priv};
  },
  begin(H,S){startVote(H,S,0);},
  tick(H,S,dt){
    const act=H.players.filter(p=>!p.aw);
    if(S.ph==='a_vote'){
      const all=act.length>0&&act.every(p=>S.vtd[p.id]);
      if(S.t>=S.pe||all&&S.t>S.pe-S.pd+0.9||!act.length)revealVote(H,S);
    }else if(S.ph==='a_rev'){
      if(S.t>=S.pe){if(S.pi+1<A_N)startVote(H,S,S.pi+1);else startWrite(H,S,0);}
    }else if(S.ph==='b_write'){
      const all=act.length>0&&act.every(p=>S.sub[p.id]);
      if(S.t>=S.pe+0.6||all&&S.t>S.pe-S.pd+1.2||!act.length)startPick(H,S);
    }else if(S.ph==='b_pick'){
      const all=act.length>0&&act.every(p=>S.pk[p.id]);
      if(S.t>=S.pe||all&&S.t>S.pe-S.pd+0.9||!act.length)startReveal(H,S);
    }else if(S.ph==='b_rev'){
      const r=S.rv;
      if(S.step<r.ord.length){
        if(S.t>=S._nx){S.step++;S._nx=S.t+(S.step===r.ord.length-1?1.95:1.6);if(S.step===r.ord.length)S._end=S.t+2.7;}
      }else if(S.t>=S._end)finishReveal(H,S);
    }
  },
  act(H,S,pid,m){
    if(m.k==='vote'){
      if(S.ph!=='a_vote'||S.vtd[pid])return;
      const to=+m.to;if(!H.players.some(p=>p.id===to))return;
      S._votes[pid]=to;S.vtd[pid]=true;
    }else if(m.k==='fake'){
      if(S.ph!=='b_write'||S.t>S.pe+0.7||S.sub[pid])return;
      let a=clean(m.a).slice(0,28);if(!a)return;
      const f=S._fct[S.pi],k=nrm(a);
      if(!k){return;}
      if(same(k,nrm(f.a))||f.alt.some(x=>same(k,nrm(x)))){H.emit({k:'rej',why:'real'},pid);return;}
      S._fake[pid]=a;S.sub[pid]=true;
    }else if(m.k==='pick'){
      if(S.ph!=='b_pick'||S.pk[pid])return;
      const i=+m.i;if(!(i>=0&&i<S.opts.length))return;
      if(S._au[i]&&S._au[i].includes(pid))return;
      S._picks[pid]=i;S.pk[pid]=true;
    }
  },
  val(S,id){return S.tot[id]||0;},

  // ---------------- client ----------------
  mk(c){
    let hdr,tmEl,barI,card,inRow,inp,btn,main,msg;
    let started=false,S0=null,key='',myVote=-1,myPick=-1,submitted=false,lastSig='',lastStep=-1,lastPh='';
    const st=()=>{
      if(document.getElementById('st-social'))return;
      const s=document.createElement('style');s.id='st-social';
      s.textContent=`
.sc{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:8px 14px 10px;overflow:hidden}
.sch{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:13px;color:var(--dim);letter-spacing:1px}
.sch b{font-size:17px;color:#fff;font-variant-numeric:tabular-nums}
.scbar{height:6px;border-radius:4px;background:#ffffff14;overflow:hidden;flex:0 0 6px}
.scbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#19d3ff,#ff3d81)}
.sccard{background:linear-gradient(135deg,#2a2a5e,#1d1d44);border-radius:18px;padding:14px 16px;font-weight:900;font-size:clamp(19px,6.2vw,26px);line-height:1.2;text-align:center;min-height:clamp(70px,12vh,112px);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 #0f0f26}
.sccard.sm{font-size:clamp(16px,5vw,21px);min-height:0;padding:10px 14px}
.scblank{display:inline-block;min-width:3.2em;border-bottom:4px solid #ffd23f;color:#ffd23f;margin:0 3px}
.scin{display:flex;gap:8px}
.scin input{flex:1;min-width:0;font-size:18px;height:56px;padding:0 14px}
.scin button{flex:0 0 auto;height:56px;min-width:104px;padding:0 14px;font-size:16px;border-radius:16px}
.scin.off{display:none}
.scmain{display:flex;flex-direction:column;gap:9px;min-height:0;flex:1;overflow:hidden;padding-top:2px}
.scmsg{text-align:center;font-weight:800;font-size:15px;color:#ffd23f;min-height:20px;line-height:1.25}
.scchips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.scchip{background:var(--panel);border-radius:12px;border-bottom:3px solid var(--c);padding:7px 12px;font-weight:800;font-size:14px;display:flex;gap:6px;align-items:center}
.scchip.ok{background:#12381f}
.scbtn{display:flex;align-items:center;gap:12px;background:var(--panel);border:0;border-left:10px solid var(--c);border-radius:18px;padding:0 16px;flex:1 1 0;min-height:44px;max-height:clamp(54px,10.5vh,80px);font-weight:900;font-size:clamp(18px,6vw,27px);color:#fff;text-align:left;width:100%;box-shadow:0 4px 0 #0e0e24;font-family:inherit}
.scbtn:active{transform:translateY(3px);box-shadow:0 1px 0 #0e0e24}
.scbtn.sel{background:#143a52;box-shadow:inset 0 0 0 3px #19d3ff}
.scbtn.off{opacity:.42}
.scbtn .tg{margin-left:auto;font-size:13px;font-weight:800;color:#cfcff0}
.scbtn span.t{flex:1;min-width:0;word-break:break-word;line-height:1.15}
.scrow{position:relative;background:var(--panel);border-radius:16px;border-left:10px solid var(--c);padding:6px 12px;flex:1 1 0;min-height:44px;max-height:clamp(52px,9.5vh,72px);display:flex;flex-direction:column;justify-content:center;gap:4px;overflow:hidden}
.scrow .nm{font-weight:900;font-size:17px;display:flex;justify-content:space-between;gap:8px;position:relative;z-index:1}
.scrow .fl{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#ffffff10,#ffffff30);transition:width .9s cubic-bezier(.2,.9,.3,1);z-index:0}
.scrow .dots{display:flex;gap:5px;position:relative;z-index:1;min-height:14px}
.scrow .dots i{width:14px;height:14px;border-radius:50%;display:block;animation:scpop .3s backwards}
.scrow.w{box-shadow:inset 0 0 0 3px #ffd23f,0 0 24px #ffd23f55}
.scban{text-align:center;font-weight:900;font-size:clamp(20px,6.6vw,28px);color:#ffd23f;animation:scban .6s backwards;animation-delay:1.3s;line-height:1.15}
.scopt{background:var(--panel);border-radius:16px;padding:8px 14px;flex:1 1 0;min-height:44px;max-height:clamp(52px,9vh,72px);font-weight:900;font-size:clamp(18px,5.8vw,24px);display:flex;flex-direction:column;justify-content:center;gap:3px;border-left:10px solid #2d2d62;transition:background .25s}
.scopt .nt{font-size:13px;font-weight:800;color:#d8d8f4;line-height:1.25}
.scopt.fk{border-left-color:#ff4b4b;background:#3a1220}
.scopt.rl{border-left-color:#52ff7a;background:#12381f;box-shadow:0 0 22px #52ff7a44}
.scopt.cur{animation:scpop .4s}
.scfact{background:#1d1d40;border-radius:14px;padding:10px 12px;font-size:14.5px;line-height:1.35;color:#d8d8f4;text-align:left;animation:scban .5s backwards}
.scfact b{color:#52ff7a}
@keyframes scpop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.06)}100%{transform:none;opacity:1}}
@keyframes scban{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:none;opacity:1}}
`;
      document.head.append(s);
    };
    function submit(){
      if(submitted||!S0||S0.ph!=='b_write')return;
      const v=inp.value.replace(/\s+/g,' ').trim();
      if(!v){inp.classList.add('shake');setTimeout(()=>inp.classList.remove('shake'),350);return;}
      c.act({k:'fake',a:v});
      submitted=true;inp.blur();btn.disabled=true;btn.textContent='Checking…';
      // host answers with an event only when it rejects; otherwise S.sub[me] flips to true
    }
    function blank(el,text){
      el.innerHTML='';
      const w=E('div');w.style.cssText='display:block;width:100%';el.append(w);
      const parts=text.split('______');
      w.append(document.createTextNode(parts[0]||''));
      const nb=E('span');nb.style.whiteSpace='nowrap';w.append(nb);
      nb.append(E('span','scblank','&nbsp;&nbsp;&nbsp;'));
      if(parts[1])nb.append(document.createTextNode(parts[1]));
    }
    function fillBlank(text,a){return text.replace('______',a);}
    function dots(ids,wrap){ids.forEach((id,i)=>{const d=E('i');d.style.background=c.col(id);d.style.animationDelay=(i*.12)+'s';wrap.append(d);});}
    function names(ids){return ids.map(id=>(c.pl(id)||{n:'?'}).n);}
    function draw(S,R){
      const pl=R.pl,me=c.me();
      if(S.ph==='wait'){msg.textContent='Get ready…';return;}
      if(S.ph==='done')return;
      const isA=S.ph.startsWith('a_');
      hdr.firstChild.textContent=isA?'PART 1 · MOST LIKELY '+(S.pi+1)+'/'+A_N:'PART 2 · FIB ROUND '+(S.pi+1)+'/'+B_N;
      inRow.classList.toggle('off',S.ph!=='b_write');
      const sig=JSON.stringify([S.ph,S.pi,S.vtd,S.sub,S.pk,S.step,myVote,myPick,submitted,pl.map(p=>p.aw),S.opts.length,S.tot]);
      if(sig===lastSig)return;lastSig=sig;
      main.innerHTML='';
      if(isA){
        card.className='sccard';card.textContent=S.pr;
        if(S.ph==='a_vote'){
          for(const p of pl){
            const b=E('button','scbtn'+(myVote===p.id?' sel':'')+(myVote>=0&&myVote!==p.id?' off':''),'<span class="t"></span><span class="tg"></span>');
            b.style.setProperty('--c',COLORS[p.ci]);b.firstChild.textContent=p.n+(p.id===me?' (me)':'');
            if(myVote===p.id)b.lastChild.textContent='✓ voted';
            b.addEventListener('pointerdown',e=>{e.preventDefault();if(myVote>=0||c.R().ph!=='play'||!S0||S0.ph!=='a_vote')return;myVote=p.id;c.act({k:'vote',to:p.id});sfx.tap();buzz(25);lastSig='';draw(S0,c.R());});
            main.append(b);
          }
          const left=pl.filter(p=>!p.aw&&!S.vtd[p.id]).length;
          msg.textContent=myVote>=0?(left?'Locked in! Waiting for '+left+' more…':'Locked in!'):'Secret vote! Tap who fits best.';
        }else{ // a_rev
          const mx=Math.max(1,...pl.map(p=>S.vc[p.id]||0));
          const winTitle=S.win.length>0;
          const ban=E('div','scban');ban.textContent=winTitle?S.ti+' → '+names(S.win).join(' & ')+(S.win.length>1?'  (TIE!)':''):'No votes?!';
          main.append(ban);
          for(const p of pl){
            const n=S.vc[p.id]||0,row=E('div','scrow'+(S.win.includes(p.id)?' w':''),'<div class="fl"></div><div class="nm"><span></span><span></span></div><div class="dots"></div>');
            row.style.setProperty('--c',COLORS[p.ci]);
            row.querySelector('.nm').children[0].textContent=p.n+(p.id===me?' (me)':'');
            row.querySelector('.nm').children[1].textContent=n+(n===1?' vote':' votes');
            dots(Object.keys(S.vv).filter(v=>S.vv[v]===p.id).map(Number),row.querySelector('.dots'));
            main.append(row);
            const fl=row.querySelector('.fl');requestAnimationFrame(()=>requestAnimationFrame(()=>{fl.style.width=(n/mx*100)+'%';}));
          }
          const got=S.sc[me];
          msg.textContent=got?'You read the room! +1 🎯':'Not with the crowd this time…';
        }
      }else{
        // fib phases
        if(S.ph==='b_write'){
          card.className='sccard';blank(card,S.q);
          const ch=E('div','scchips');
          for(const p of pl){const done=S.sub[p.id];const x=E('div','scchip'+(done?' ok':''),'<span></span><span></span>');x.style.setProperty('--c',COLORS[p.ci]);x.children[0].textContent=p.n;x.children[1].textContent=p.aw?'💤':done?'✅':'✍️';ch.append(x);}
          main.append(ch);
          if(S.sub[me]){btn.textContent='Locked ✓';inp.disabled=true;}
          if(!msg.dataset.rej||S.sub[me])msg.textContent=S.sub[me]?'Locked in! Waiting for the others…':'Write a fake that sounds REAL. +1 per player you fool.';
        }else if(S.ph==='b_pick'){
          card.className='sccard sm';blank(card,S.q);
          const mine=(c.priv()||{}).mine;
          S.opts.forEach(o=>{
            const own=o.i===mine;
            const b=E('button','scbtn'+(myPick===o.i?' sel':'')+(own||(myPick>=0&&myPick!==o.i)?' off':''),'<span class="t"></span><span class="tg"></span>');
            b.style.setProperty('--c','#6c6cc8');b.firstChild.textContent=o.t;
            if(own)b.lastChild.textContent='your lie';else if(myPick===o.i)b.lastChild.textContent='✓';
            if(!own)b.addEventListener('pointerdown',e=>{e.preventDefault();if(myPick>=0||c.R().ph!=='play'||!S0||S0.ph!=='b_pick')return;myPick=o.i;c.act({k:'pick',i:o.i});sfx.tap();buzz(25);lastSig='';draw(S0,c.R());});
            main.append(b);
          });
          const left=pl.filter(p=>!p.aw&&!S.pk[p.id]).length;
          msg.textContent=myPick>=0?(left?'Locked in! Waiting for '+left+' more…':'Locked in!'):'Which one is TRUE? Find it for +2!';
        }else if(S.ph==='b_rev'){
          const r=S.rv;card.className='sccard sm';blank(card,S.q);
          if(S.step>=r.ord.length){card.className='sccard sm';card.textContent=fillBlank(S.q,r.opts.find(o=>o.real).t);}
          S.opts.forEach(o=>{
            const ro=r.opts[o.i],pos=r.ord.indexOf(o.i),shown=pos>=0&&pos<S.step;
            let cls='scopt',nt='';
            if(shown){
              if(ro.real){cls+=' rl';nt='✅ THE TRUTH · '+(ro.pk.length?names(ro.pk).join(', ')+' found it (+2 each)':'nobody found it!');}
              else{cls+=' fk';nt=(ro.au.length?'🤥 '+names(ro.au).join(' & ')+' wrote this':'🤖 auto-filled')+' · '+(ro.pk.length?'fooled '+names(ro.pk).join(', ')+(ro.au.length?' (+1 each)':''):'fooled nobody');}
              if(pos===S.step-1)cls+=' cur';
            }
            const d=E('div',cls,'<div class="tx"></div><div class="nt"></div>');d.firstChild.textContent=o.t;d.lastChild.textContent=nt;
            if(!nt)d.lastChild.remove();
            main.append(d);
          });
          if(S.step>=r.ord.length){const f=E('div','scfact','<b>FACT:</b> ');f.append(document.createTextNode(r.fact));main.append(f);}
          msg.textContent=S.step<r.ord.length?(S.step?'':'Moment of truth…'):'';
        }
      }
    }
    return{
      mount(r){
        st();
        const f=E('div','sc');
        hdr=E('div','sch','<span></span><b></b>');tmEl=hdr.lastChild;
        const b=E('div','scbar','<i></i>');barI=b.firstChild;
        card=E('div','sccard');
        inRow=E('div','scin off');
        inp=E('input');inp.type='text';inp.maxLength=28;inp.placeholder='Your fake answer…';
        inp.setAttribute('autocomplete','off');inp.setAttribute('autocorrect','off');inp.setAttribute('autocapitalize','off');inp.setAttribute('spellcheck','false');inp.setAttribute('enterkeyhint','send');inp.setAttribute('aria-label','Your fake answer');
        btn=E('button','btn','SUBMIT');inRow.append(inp,btn);
        msg=E('div','scmsg');main=E('div','scmain');
        f.append(hdr,b,card,inRow,msg,main);r.append(f);
        inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
        btn.addEventListener('pointerdown',e=>{e.preventDefault();submit();});
      },
      start(){started=true;},
      event(m){
        if(m&&m.k==='rej'){
          submitted=false;inp.disabled=false;btn.disabled=false;btn.textContent='SUBMIT';inp.value='';
          msg.dataset.rej='1';msg.textContent='😬 Too close to the real answer! Write a different lie.';sfx.bad();buzz([40,30,40]);
          try{inp.focus({preventScroll:true});}catch(e){}
        }
      },
      update(S,R){
        S0=S;
        const k=S.ph+':'+S.pi;
        if(k!==key){
          key=k;myVote=-1;myPick=-1;submitted=false;lastSig='';msg.dataset.rej='';
          inp.value='';inp.disabled=false;btn.disabled=false;btn.textContent='SUBMIT';
          if(S.ph==='b_write'&&started){try{inp.focus({preventScroll:true});}catch(e){}}
        }
        if(started){
          if(S.ph==='a_rev'&&lastPh!=='a_rev'){sfx.win();if(S.sc[c.me()])buzz(30);}
          if(S.ph==='b_rev'){
            if(S.step!==lastStep&&S.step>0){
              const r=S.rv,idx=r.ord[S.step-1];
              if(r.opts[idx].real){sfx.win();buzz([30,30,60]);}else{if(r.opts[idx].pk.includes(c.me())){sfx.bad();buzz(80);}else sfx.tap();}
            }
          }
          if(S.ph==='b_pick'&&lastPh!=='b_pick')sfx.go();
        }
        lastStep=S.ph==='b_rev'?S.step:-1;lastPh=S.ph;
        draw(S,R);
      },
      frame(){
        if(!S0||!barI)return;
        const S=S0,rem=S.pe-c.t();
        const timed=S.ph==='a_vote'||S.ph==='b_write'||S.ph==='b_pick';
        barI.style.width=timed&&S.pd?(clamp(rem/S.pd,0,1)*100)+'%':'0';
        tmEl.textContent=timed?Math.max(0,Math.ceil(rem))+'s':'';
        if(S.ph==='b_write'&&!submitted&&rem<0.15&&inp.value.trim())submit();
      },
      stop(){try{inp&&inp.blur();}catch(e){}}
    };
  }
};

// ---- host helpers ----
function startVote(H,S,i){
  S.pi=i;S.part='A';S.ph='a_vote';S.pr=S._prm[i][0];S.ti='';S.vtd={};S.vc={};S.vv={};S.win=[];S.sc={};S._votes={};
  S.pd=A_VOTE;S.pe=S.t+A_VOTE;
}
function revealVote(H,S){
  const cnt={};H.players.forEach(p=>cnt[p.id]=0);
  const vv={};
  for(const v in S._votes){const to=S._votes[v];cnt[to]=(cnt[to]||0)+1;vv[v]=to;}
  const mx=Math.max(0,...Object.values(cnt));
  const win=mx>0?H.players.filter(p=>cnt[p.id]===mx).map(p=>p.id):[];
  S.vc=cnt;S.vv=vv;S.win=win;S.ti=S._prm[S.pi][1];S.sc={};
  for(const v in S._votes)if(win.includes(S._votes[v])){S.sc[v]=1;S._tot[v]=(S._tot[v]||0)+1;}
  S.tot=Object.assign({},S._tot);
  S.ph='a_rev';S.pd=0;S.pe=S.t+A_REV;
}
function startWrite(H,S,i){
  S.pi=i;S.part='B';S.ph='b_write';S.q=S._fct[i].q;S.sub={};S.opts=[];S.pk={};S.rv=null;S.step=0;S._fake={};S._picks={};S._au=[];S._real=-1;
  H.players.forEach(p=>S._priv[p.id]={mine:-1});
  S.pd=B_WRITE;S.pe=S.t+B_WRITE;
}
function startPick(H,S){
  const f=S._fct[S.pi];
  // merge identical fakes (same normalised text), then add the real answer; unsubmitted players get a silent generic fill-in
  const list=[];
  const add=(text,au)=>{const k=nrm(text);const ex=list.find(o=>same(o.k,k));if(ex){if(au!=null&&!ex.au.includes(au))ex.au.push(au);return;}list.push({k,t:cap(clean(text)),au:au==null?[]:[au],real:false});};
  const fbs=shuffle(f.fb);let fi=0;
  H.players.forEach(p=>{
    if(S._fake[p.id])add(S._fake[p.id],p.id);
    else if(!p.aw){add(fbs[fi%fbs.length],null);fi++;}
  });
  list.push({k:nrm(f.a),t:cap(f.a),au:[],real:true});
  const opts=shuffle(list);
  S.opts=opts.map((o,i)=>({i,t:o.t}));
  S._au=opts.map(o=>o.au);S._real=opts.findIndex(o=>o.real);
  S.pk={};S._picks={};
  H.players.forEach(p=>{S._priv[p.id]={mine:opts.findIndex(o=>o.au.includes(p.id))};});
  S.ph='b_pick';S.pd=B_PICK;S.pe=S.t+B_PICK;
}
function startReveal(H,S){
  const f=S._fct[S.pi];
  const pk=S.opts.map(()=>[]);
  for(const pid in S._picks)pk[S._picks[pid]].push(+pid);
  const gain={};
  S.opts.forEach((o,i)=>{
    if(i===S._real)pk[i].forEach(id=>gain[id]=(gain[id]||0)+2);
    else pk[i].forEach(()=>S._au[i].forEach(a=>gain[a]=(gain[a]||0)+1));
  });
  S._gain=gain;
  const fakes=shuffle(S.opts.map((o,i)=>i).filter(i=>i!==S._real));
  const ord=fakes.concat([S._real]);
  S.rv={opts:S.opts.map((o,i)=>({t:o.t,au:S._au[i],pk:pk[i],real:i===S._real})),ord,fact:f.f,gain};
  S.step=0;S.ph='b_rev';S.pd=0;S.pe=S.t+60;S._nx=S.t+0.9;S._end=1e9;
}
function finishReveal(H,S){
  const g=S._gain||{};
  for(const id in g)S._tot[id]=(S._tot[id]||0)+g[id];
  S.tot=Object.assign({},S._tot);
  if(S.pi+1<B_N)startWrite(H,S,S.pi+1);
  else{S.over=true;S.hold=0.4;S.ph='done';}
}
})();
