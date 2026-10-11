// WORD BOMB — hot-potato word game. One shared hidden fuse; type a real word containing the syllable to pass the bomb. 2 lives. Host validates against games/words.txt.
(function(){
// candidate syllables (all verified at build time to appear in hundreds of dictionary words); filtered again against the loaded dictionary on the host.
const SYL={
 A:['ch','sh','th','ph','st','tr','pr','pl','bl','gr','cr','sp','sc','cl','br','fl','dr','sl','fr','gl','qu','ck','ou','ea','ai','ie','oo','ee','oa','ow','au','oi','ly','ty','ry','mp','nd','nt','ll','ss','ct'],
 B:['wi','we','wo','he','hi','ho','ha','ba','be','bo','bu','ca','fa','fe','fi','fo','ga','ge','gi','go','ma','me','mi','mo','mu','na','ne','no','pa','pe','pi','po','pu','ra','ro','sa','se','si','so','su','ta','tu','un','up','ur','va','vi','la','lo','lu','di','do','du','ig'],
 C:['ing','ion','ent','ate','ers','ter','ist','con','tin','res','tor','rat','tic','men','tra','all','ive','ies','pro','ect','cal','ver','ine','red','est','ant','com','int','ess','str','der','pre','per','dis','gra','era','min','tri','sta','ran','lin','ity','cat','ble','ere','ous','and','the','log','rec','ial','out','ove','und','oun','ard','abl','ell','ill','ear','ast','ish','sub','ort','lar','car','ven','ric','lan','pla','pol','ste']
};
const MIN_WORDS=150;           // a syllable must appear in at least this many dictionary words to be used (brief asked >= 40)
const LIVES=2,FUSE_MIN=6.5,FUSE_MAX=12,PASS_MIN=2.0,BOOM_PAUSE=2.4;
let DICT=null,DLOAD=null,POOL=null;

function stems(w){
  const r=[],L=w.length;
  if(w.endsWith('ies'))r.push(w.slice(0,-3)+'y');
  if(w.endsWith('es'))r.push(w.slice(0,-2));
  if(w.endsWith('s')&&!w.endsWith('ss'))r.push(w.slice(0,-1));
  if(w.endsWith('ied'))r.push(w.slice(0,-3)+'y');
  if(w.endsWith('ed')){r.push(w.slice(0,-2));r.push(w.slice(0,-1));if(L>5&&w[L-3]===w[L-4])r.push(w.slice(0,-3));}
  if(w.endsWith('ing')){r.push(w.slice(0,-3));r.push(w.slice(0,-3)+'e');if(L>6&&w[L-4]===w[L-5])r.push(w.slice(0,-4));}
  if(w.endsWith('er')){r.push(w.slice(0,-2));r.push(w.slice(0,-1));if(L>5&&w[L-3]===w[L-4])r.push(w.slice(0,-3));}
  if(w.endsWith('est')){r.push(w.slice(0,-3));r.push(w.slice(0,-2));}
  if(w.endsWith('ly'))r.push(w.slice(0,-2));
  if(w.endsWith('ily'))r.push(w.slice(0,-3)+'y');
  if(w.endsWith('ier'))r.push(w.slice(0,-3)+'y');
  if(w.endsWith('iest'))r.push(w.slice(0,-4)+'y');
  return r.filter(s=>s.length>=3);
}
function inDict(w){
  if(DICT.has(w))return true;
  if(stems(w).some(s=>DICT.has(s)))return true;
  if(w.length>=10){ // long compounds (strawberry = straw+berry, friendship = friend+ship)
    for(let i=4;i<=w.length-4;i++)if(DICT.has(w.slice(0,i))&&DICT.has(w.slice(i)))return true;
  }
  return false;
}
function loadDict(){
  if(DICT||DLOAD)return;
  try{
    DLOAD=fetch('games/words.txt').then(r=>{if(!r.ok)throw new Error('dict '+r.status);return r.text();}).then(t=>{
      const arr=t.split('\n').map(x=>x.trim()).filter(x=>/^[a-z]{3,20}$/.test(x));
      if(arr.length<5000)throw new Error('dict too small');
      const all=[].concat(SYL.A,SYL.B,SYL.C),cnt={};
      for(const s of all)cnt[s]=0;
      for(const w of arr)for(const s of all)if(w.length>s.length&&w.indexOf(s)>=0)cnt[s]++;
      const pool={A:[],B:[],C:[]};
      for(const k of ['A','B','C'])pool[k]=SYL[k].filter(s=>cnt[s]>=MIN_WORDS);
      POOL=pool;DICT=new Set(arr);
    }).catch(()=>{DLOAD=null;DICT=null;setTimeout(loadDict,4000);});
  }catch(e){DLOAD=null;}
}
function pickSyl(S){
  const pool=POOL||SYL,r=Math.random();
  const grp=r<0.4?'A':r<0.65?'B':'C';
  let cand=pool[grp].filter(s=>!S._recent.includes(s));
  if(!cand.length)cand=pool[grp];
  const s=pick(cand);
  S._recent.push(s);if(S._recent.length>10)S._recent.shift();
  return s;
}
const alive=(S,id)=>S.lives[id]>0;
function nextAlive(H,S,from){
  const ids=H.players.map(p=>p.id),i=ids.indexOf(from);
  let any=-1;
  for(let k=1;k<=ids.length;k++){
    const id=ids[(i+k)%ids.length];
    if(!alive(S,id))continue;
    const pl=H.players.find(p=>p.id===id);
    if(!pl.aw)return id;          // prefer someone who is actually here
    if(any<0)any=id;
  }
  return any;
}
function passBomb(H,S,from){
  if(S._tot-S._el<PASS_MIN)S._tot=S._el+PASS_MIN;
  S.cur=nextAlive(H,S,from);S.syl=pickSyl(S);S.typed='';S.tn++;
}
function newBomb(H,S,holder){
  const sd=S.t>85;
  S.cur=holder;S.syl=pickSyl(S);S.typed='';S.ph='turn';S.heat=0;
  S._tot=sd?rnd(4,7):rnd(FUSE_MIN,FUSE_MAX);S._el=0;S.tn=(S.tn||0)+1;
}
function finish(H,S){
  const left=H.players.filter(p=>alive(S,p.id));
  S.ph='over';S.over=true;S.hold=2.6;S.cur=-1;S.win=left.length===1?left[0].id:-1;
}
function eliminate(H,S,id){
  if(!alive(S,id))return;
  S.lives[id]=0;S.out.push(id);
}

GAMES.bombparty={
  name:'Word Bomb',emoji:'💣',tag:'Type a word before the bomb blows up in your hands.',
  min:2,max:4,
  rules:[
    ['🔤','The bomb shows a few letters, like "ING" or "TR". When it\'s YOUR turn, type a real word that contains those letters anywhere in it.'],
    ['🔥','Get it right and the bomb flies to the next player with new letters. Nobody knows when it will explode, so be quick!'],
    ['♻️','Words can\'t be used twice, and wrong words just shake. Keep trying.'],
    ['💥','If it blows up while you hold it, you lose a life. You have 2 lives. Last one standing wins.']
  ],
  ctrl:'Type your word, press Enter (or SEND). Everyone sees what you type.',
  win:'Outlive the others. First knocked out = last place.',
  dur:120,hz:20,better:'high',
  fmt:v=>v>=10000?'🏆 '+Math.floor((v-10000)/1000)+'❤️ left':'💀 out',

  // ---------------- host ----------------
  init(H){
    loadDict();
    const lives={},words={};H.players.forEach(p=>{lives[p.id]=LIVES;words[p.id]=0;});
    return{ph:'wait',cur:-1,syl:'',typed:'',heat:0,lives,words,out:[],used:[],boom:null,pe:0,win:-1,tn:0,
      _recent:[],_awT:{},_tot:9,_el:0,_set:new Set(),dict:!!DICT};
  },
  begin(H,S){
    S.dict=!!DICT;
    const ids=H.players.map(p=>p.id);
    newBomb(H,S,pick(ids));
  },
  tick(H,S,dt){
    // away players: bomb skips a holder who has vanished for 1.5s; after 8s away they are out (a quick reconnect/reload keeps your seat)
    for(const p of H.players){
      if(p.aw)S._awT[p.id]=(S._awT[p.id]||0)+dt;else S._awT[p.id]=0;
      if(p.aw&&alive(S,p.id)&&S._awT[p.id]>8){
        eliminate(H,S,p.id);
        if(S.ph==='turn'&&S.cur===p.id&&H.players.filter(q=>alive(S,q.id)).length>1)passBomb(H,S,p.id);
      }
    }
    if(S.ph==='over')return;
    if(S.ph==='turn'&&(S._awT[S.cur]||0)>1.5&&H.players.filter(q=>alive(S,q.id)).length>1){
      const nx=nextAlive(H,S,S.cur),np=H.players.find(q=>q.id===nx);
      if(nx!==S.cur&&np&&!np.aw){S._awT[S.cur]=0.0;passBomb(H,S,S.cur);}
    }
    if(H.players.filter(p=>alive(S,p.id)).length<=1){finish(H,S);return;}
    if(S.ph==='turn'){
      S._el+=dt;S.heat=clamp(S._el/S._tot,0,1);
      if(S._el>=S._tot){
        const id=S.cur;S.lives[id]=Math.max(0,S.lives[id]-1);
        const dead=S.lives[id]<=0;if(dead)S.out.push(id);
        S.boom={id,dead,n:S.tn};S.ph='boom';S.pe=S.t+BOOM_PAUSE;S.typed='';S.heat=1;
      }
    }else if(S.ph==='boom'){
      if(S.t>=S.pe){
        if(H.players.filter(p=>alive(S,p.id)).length<=1)finish(H,S);
        else newBomb(H,S,nextAlive(H,S,S.boom.id));
      }
    }
  },
  act(H,S,pid,m){
    if(!m||typeof m!=='object'||S.ph!=='turn'||pid!==S.cur||typeof m.w!=='string')return;
    if(m.k==='typ'){
      S.typed=m.w.toLowerCase().replace(/[^a-z]/g,'').slice(0,20);
    }else if(m.k==='w'){
      const w=m.w.slice(0,64).toLowerCase().trim();
      let why='';
      if(!/^[a-z]+$/.test(w)||w.length>20)why='nw';
      else if(w.length<3)why='short';
      else if(w.indexOf(S.syl)<0)why='syl';
      else if(w.length<=S.syl.length)why='syl';
      else if(S._set.has(w))why='used';
      else if(DICT&&!inDict(w))why='nw';
      if(why){H.emit({k:'bad',id:pid,why,w});return;}
      S._set.add(w);S.used.push(w);S.words[pid]=(S.words[pid]||0)+1;
      // hot potato: the fuse keeps burning, but the next holder always gets a fair sliver
      passBomb(H,S,pid);
      S.last={id:pid,w,n:S.tn};
      S.dict=!!DICT;
    }
  },
  val(S,id){
    if(S.lives[id]<=0){const i=S.out.indexOf(id);return i<0?0:i;}
    return 10000+S.lives[id]*1000+Math.min(999,S.words[id]||0);
  },

  // ---------------- client ----------------
  mk(c){
    let root,pRow,bombEl,sylEl,fuseEl,infoEl,inRow,inp,btn,live,msg,usedEl,ovl,tapHint,wantFocus=false,keyF=null;
    const myTurn=()=>S0&&S0.cur===c.me()&&S0.ph==='turn';
    function focusIn(){if(myTurn()&&inRow&&!inRow.classList.contains('off')){try{inp.focus({preventScroll:true});}catch(e){}}}
    let lastPsig='',lastLive='',S0=null,started=false,lastTn=-1,lastUsed=0,lastBoom=-1,nextTick=0,lastSend=0,sendT=0,lastSent='',lastPh='';
    const st=()=>{
      if(document.getElementById('st-bombparty'))return;
      const s=document.createElement('style');s.id='st-bombparty';
      s.textContent=`
.bp{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:8px 12px 10px;overflow:hidden}
.bpp{display:flex;gap:6px}
.bpc{flex:1;min-width:0;background:var(--panel);border-radius:14px;border-bottom:4px solid var(--c);padding:6px 6px 5px;text-align:center;position:relative;font-weight:800;font-size:13px;transition:transform .15s,background .15s}
.bpc .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bpc .h{font-size:15px;letter-spacing:1px;min-height:20px;line-height:20px}
.bpc.cur{background:#4a1220;transform:translateY(-2px);box-shadow:0 0 0 2px #ff4b4b}
.bpc.dead{opacity:.35;filter:grayscale(1)}
.bpc .b{position:absolute;top:1px;right:3px;font-size:20px;display:none}
.bpc.cur .b{display:block;animation:bpthrob .4s infinite alternate}
.bpb{position:relative;height:clamp(116px,24vh,200px);flex:0 0 auto;display:flex;align-items:center;justify-content:center}
.bpbomb{position:relative;width:clamp(104px,22vh,168px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#4b4b78,#1a1a36 62%,#0a0a18);box-shadow:0 0 calc(10px + var(--h,0)*46px) calc(var(--h,0)*10px) rgba(255,61,40,calc(.15 + var(--h,0)*.7)),inset 0 -8px 18px #0008;display:flex;align-items:center;justify-content:center;border:3px solid rgb(calc(80 + var(--h,0)*175),calc(80 - var(--h,0)*50),calc(120 - var(--h,0)*100))}
.bpbomb.pulse{animation:bppulse .1s}
.bpsyl{font-weight:900;font-size:clamp(34px,9vh,60px);letter-spacing:2px;color:#fff;text-transform:uppercase;text-shadow:0 2px 0 #0008}
.bpfuse{position:absolute;top:-16px;left:62%;width:6px;height:22px;background:#9a7b4f;border-radius:3px;transform:rotate(25deg)}
.bpfuse::after{content:'✨';position:absolute;top:-18px;left:-8px;font-size:20px;animation:bpspark .15s infinite alternate}
.bpinfo{text-align:center;font-weight:900;font-size:15px;min-height:20px;color:#ffd23f}
.bpin{display:flex;gap:8px}
.bpin input{flex:1;min-width:0;font-size:22px;height:58px;padding:0 14px;text-transform:lowercase;letter-spacing:1px}
.bpin button{flex:0 0 auto;height:58px;min-width:88px;padding:0 14px;font-size:16px;border-radius:16px}
.bpin.off{display:none}
.bplive{height:58px;border-radius:16px;background:var(--panel);border:2px dashed #33336e;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:26px;letter-spacing:2px;color:#fff;overflow:hidden;white-space:nowrap}
.bplive b{color:#ff9f1c}
.bplive.off{display:none}
.bplive.sh,.bpin.sh{animation:shake .3s}
.bp.mine{box-shadow:inset 0 0 0 4px #52ff7a77;animation:bpmine .8s infinite alternate}
@keyframes bpmine{from{box-shadow:inset 0 0 0 3px #52ff7a33}to{box-shadow:inset 0 0 0 5px #52ff7aaa}}
.bpmsg{text-align:center;font-weight:800;font-size:14px;min-height:18px;color:#ff7a7a}
.bpused{display:flex;flex-wrap:wrap;gap:5px;align-content:flex-start;overflow:hidden;flex:1;min-height:0}
.bpused span{background:#1d1d40;border-radius:9px;padding:3px 8px;font-size:12.5px;font-weight:700;color:#b8b8e0}
.bpused span.new{background:#12381f;color:#8dffa6;animation:bppop .3s}
.bpovl{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;background:rgba(40,6,10,.93);z-index:3;padding:20px}
.bpovl.on{display:flex;animation:bppop .25s}
.bpovl .bx{font-size:84px;line-height:1}
.bpovl h3{margin:0;font-size:30px;font-weight:900}
.bpovl p{margin:0;font-size:18px;font-weight:700;color:#ffd5d5}
.bptap{position:absolute;left:12px;right:12px;display:none;text-align:center;font-weight:900;color:#19d3ff;font-size:14px}
@keyframes bpthrob{from{transform:scale(1)}to{transform:scale(1.25) rotate(10deg)}}
@keyframes bpspark{from{opacity:.4;transform:scale(.8)}to{opacity:1;transform:scale(1.2)}}
@keyframes bppulse{0%{transform:scale(1)}50%{transform:scale(1.07)}100%{transform:scale(1)}}
@keyframes bppop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:none;opacity:1}}
`;
      document.head.append(s);
    };
    const WHY={nw:'🚫 Not a word!',syl:'Must contain the letters in the bomb',used:'♻️ Already used!',short:'Too short (3+ letters)'};
    function sendTyped(force){
      const v=inp.value;if(v===lastSent&&!force)return;
      const now=performance.now();
      if(now-lastSend>=70){lastSend=now;lastSent=v;c.act({k:'typ',w:v});}
      else if(!sendT){sendT=setTimeout(()=>{sendT=0;lastSend=performance.now();lastSent=inp.value;c.act({k:'typ',w:inp.value});},75);}
    }
    function submit(){
      if(!S0||S0.ph!=='turn'||S0.cur!==c.me())return;
      const w=inp.value.toLowerCase().replace(/[^a-z]/g,'');
      if(!w){inpShake();return;}
      c.act({k:'w',w});
    }
    function inpShake(){inRow.classList.remove('sh');void inRow.offsetWidth;inRow.classList.add('sh');}
    function liveHTML(){
      live.innerHTML='';
      const t=S0?S0.typed:'';
      if(!t){live.textContent='…';live.style.opacity=.4;return;}
      live.style.opacity=1;
      const i=t.indexOf(S0.syl);
      if(i<0){live.textContent=t;return;}
      live.append(document.createTextNode(t.slice(0,i)));
      const b=E('b');b.textContent=t.slice(i,i+S0.syl.length);live.append(b);
      live.append(document.createTextNode(t.slice(i+S0.syl.length)));
    }
    function draw(S,R){
      const me=c.me(),pl=R.pl;
      // player cards
      const psig=JSON.stringify([S.lives,S.cur,S.ph,pl.map(p=>p.n)]);
      if(psig!==lastPsig){lastPsig=psig;
      pRow.innerHTML='';
      for(const p of pl){
        const l=S.lives[p.id]||0;
        const d=E('div','bpc'+(S.cur===p.id&&S.ph==='turn'?' cur':'')+(l<=0?' dead':''),'<span class="b">💣</span><div class="n"></div><div class="h"></div>');
        d.style.setProperty('--c',COLORS[p.ci]);
        d.querySelector('.n').textContent=p.n+(p.id===me?' ★':'');
        d.querySelector('.h').textContent=l<=0?'💀':'❤️'.repeat(l)+'🖤'.repeat(Math.max(0,2-l));
        pRow.append(d);
      }}
      sylEl.textContent=S.syl||'…';
      const mine=S.cur===me&&S.ph==='turn';
      inRow.classList.toggle('off',!mine);root.firstChild.classList.toggle('mine',mine);
      live.classList.toggle('off',mine||S.ph==='wait');
      if(S.ph==='turn'){
        const cp=c.pl(S.cur);
        infoEl.textContent=mine?'YOUR TURN! Type a word with "'+S.syl.toUpperCase()+'"':(cp?cp.n:'?')+' is on the clock…';
        infoEl.style.color=mine?'#52ff7a':'#ffd23f';
        if(!mine){const k=S.typed+'|'+S.syl;if(k!==lastLive){lastLive=k;liveHTML();}}
      }else if(S.ph==='boom')infoEl.textContent='';
      else if(S.ph==='over')infoEl.textContent=S.win>=0?'🏆 '+(c.pl(S.win)||{}).n+' survives!':'Time!';
      else infoEl.textContent='Get ready…';
      // used words
      if(S.used.length!==lastUsed){
        usedEl.innerHTML='';
        S.used.slice(-36).reverse().forEach((w,i)=>{const s=E('span',i===0?'new':'');s.textContent=w;usedEl.append(s);});
      }
      // overlay
      const showBoom=S.ph==='boom'&&S.boom;
      ovl.classList.toggle('on',!!showBoom);
      if(showBoom){
        const bp=c.pl(S.boom.id)||{n:'?'};
        ovl.querySelector('h3').textContent=S.boom.id===me?'💥 BOOM! You blew up!':'💥 '+bp.n+' blew up!';
        ovl.querySelector('p').textContent=S.boom.dead?'☠️ '+bp.n+' is OUT!':bp.n+' loses a life ('+S.lives[S.boom.id]+' left)';
      }
    }
    return{
      mount(r){
        st();root=r;
        const f=E('div','bp');
        pRow=E('div','bpp');
        bombEl=E('div','bpb','<div class="bpbomb"><div class="bpfuse"></div><div class="bpsyl"></div></div>');
        const bb=bombEl.firstChild;fuseEl=bb;sylEl=bb.querySelector('.bpsyl');
        infoEl=E('div','bpinfo');
        inRow=E('div','bpin off');
        inp=E('input');inp.type='text';inp.maxLength=20;inp.placeholder='type a word…';
        inp.setAttribute('autocomplete','off');inp.setAttribute('autocorrect','off');inp.setAttribute('autocapitalize','off');inp.setAttribute('spellcheck','false');inp.setAttribute('enterkeyhint','send');inp.setAttribute('aria-label','Your word');
        btn=E('button','btn','SEND');inRow.append(inp,btn);
        live=E('div','bplive off','…');
        msg=E('div','bpmsg');usedEl=E('div','bpused');
        ovl=E('div','bpovl','<div class="bx">💥</div><h3></h3><p></p>');
        f.append(pRow,bombEl,infoEl,inRow,live,msg,usedEl,ovl);r.append(f);
        inp.addEventListener('input',()=>{const v=inp.value.toLowerCase().replace(/[^a-z]/g,'');if(v!==inp.value)inp.value=v;msg.textContent='';sendTyped();});
        inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
        btn.addEventListener('pointerdown',e=>{e.preventDefault();submit();});
        f.addEventListener('click',e=>{if(e.target!==inp&&!(e.target.closest&&e.target.closest('button')))focusIn();});
        // laptop: just start typing — any letter key on your turn goes into the box
        keyF=e=>{if(!myTurn()||document.activeElement===inp||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key&&e.key.length===1&&/[a-z]/i.test(e.key))focusIn();};
        document.addEventListener('keydown',keyF);
      },
      start(){started=true;},
      update(S,R){
        S0=S;
        const me=c.me();
        if(started){
          if(S.tn!==lastTn&&S.ph==='turn'){
            if(lastTn>=0&&S.used.length>lastUsed){sfx.good();bombEl.firstChild.classList.remove('pulse');}
            if(S.cur===me){ // my turn begins
              inp.value='';lastSent='';msg.textContent='';
              wantFocus=true;
              buzz(40);sfx.go();
            }
          }
          if(S.ph==='boom'&&S.boom&&S.boom.n!==lastBoom){
            lastBoom=S.boom.n;sfx.boom();buzz([120,40,160]);
            root.classList.remove('shake');void root.offsetWidth;root.classList.add('shake');
            try{inp.blur();}catch(e){}
          }
          if(S.ph==='over'&&lastPh!=='over'){sfx.win();}
        }
        if(S.tn!==lastTn&&S.last&&S.last.id===me&&S.last.n===S.tn){try{inp.blur();}catch(e){}inp.value='';} // blur keyboard after my successful word
        lastTn=S.tn;
        draw(S,R);
        if(wantFocus){wantFocus=false;focusIn();setTimeout(focusIn,60);}
        lastUsed=S.used.length;lastPh=S.ph;
      },
      event(m){
        if(!m||m.k!=='bad')return;
        const mine=m.id===c.me();
        if(mine){msg.textContent=WHY[m.why]||'Nope!';inpShake();inp.select&&inp.select();}
        else{live.classList.remove('sh');void live.offsetWidth;live.classList.add('sh');}
        sfx.bad();if(mine)buzz([30,30,30]);
      },
      frame(){
        if(!S0||!started)return;
        const S=S0;
        const h=S.ph==='turn'?S.heat:S.ph==='boom'?1:0;
        fuseEl.style.setProperty('--h',h.toFixed(3));
        if(S.ph==='turn'){
          const now=performance.now()/1000;
          if(now>=nextTick){
            const iv=0.72-0.6*Math.pow(h,1.3);
            nextTick=now+iv;
            beep(520+h*700,0.035,'square',0.04+h*0.04);
            fuseEl.classList.remove('pulse');void fuseEl.offsetWidth;fuseEl.classList.add('pulse');
            if(S.cur===c.me()&&h>0.7)buzz(15);
          }
        }
      },
      stop(){clearTimeout(sendT);if(keyF)document.removeEventListener('keydown',keyF);try{inp&&inp.blur();}catch(e){}}
    };
  }
};
})();
