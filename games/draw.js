// DRAW & GUESS — Pictionary on phones. One player draws (live-streamed stroke batches), everyone else types guesses.
// Host is authoritative: it holds the secret word (S._word), the full stroke list (S._strokes, for resync + final reveal),
// validates + matches guesses, hands out points. Clients keep a local copy of the strokes and render them on a canvas.
(function(){
const DW=1000,DH=1250;                       // logical canvas (4:5 portrait), every phone scales this to fit
const PAL=['#15151f','#e5352b','#1f7ae0','#2fa84f','#ffb000'];   // black red blue green amber
const BW=[7,17,34];                          // brush widths (logical px)
const PICK=5,REV=3.5,GOT_MAX=6,GOT_MIN=2;
const CAT={animal:['🐾','Animal'],food:['🍕','Food'],object:['🔧','Thing'],action:['🏃','Action'],place:['🏝️','Place']};
// word|alternate,alternate  (plural / -s and one-letter typos are tolerated automatically)
const RAW={
 animal:'giraffe;elephant;penguin;shark|great white;octopus;butterfly;snail;kangaroo;crocodile|alligator,croc;spider;owl;dolphin;monkey|ape,chimp,chimpanzee,gorilla;rabbit|bunny;turtle|tortoise;bee|bumblebee;camel;snake;pig;cow;frog|toad;lion;whale;bat;duck;horse|pony;jellyfish;hedgehog;dinosaur|trex,t rex,tyrannosaurus;crab;flamingo;sloth',
 food:'pizza;banana;hamburger|burger,cheeseburger;ice cream|icecream,ice lolly;cupcake|muffin;watermelon;pineapple;hot dog|hotdog,sausage;sandwich|sarnie;popcorn;donut|doughnut;pancake;carrot;fried egg|egg;taco|burrito;spaghetti|pasta,noodles;cookie|biscuit;apple;strawberry;sushi;birthday cake|cake;french fries|fries,chips;lollipop|lolly;mushroom',
 object:'skateboard;umbrella|brolly;bicycle|bike;guitar;scissors;headphones|earphones;glasses|spectacles,sunglasses;alarm clock|clock;light bulb|lightbulb,bulb;key;candle;toothbrush;telephone|phone,mobile phone,mobile;camera;ladder;backpack|rucksack,schoolbag;balloon;crown;rocket|spaceship;robot;snowman;tent;trophy;television|tv;laptop|computer;toilet|loo;bed;chair;hammer;anchor;boat|ship,sailboat;aeroplane|airplane,plane,jet;helicopter;train;bus;kite;sword;magnet;postbox|mailbox,letterbox;chainsaw;vacuum cleaner|hoover,vacuum;piano;drum|drums;trampoline;parachute;microphone|mic;calculator;treasure chest|treasure;ghost',
 action:'sleeping|sleep;swimming|swim;dancing|dance;fishing;painting;sneezing|sneeze;knitting|knit;skiing|ski;surfing|surf;reading|read;running|run;brushing teeth|brush teeth,toothbrushing;climbing|climb;skydiving|skydive,parachuting;cooking|cook;singing|sing;laughing|laugh;driving|drive;flying|fly;boxing|box;yoga;haircut|getting a haircut;karate|kung fu;jumping|jump;crying|cry',
 place:'volcano;dentist|dental,dentists;pyramid;beach;desert island|island;igloo;zoo;hospital;school|classroom;jungle|rainforest;farm;waterfall;library;airport;supermarket|shop,store;circus;playground;cinema|movies,movie theatre;campsite|camping,campfire;mountain;bakery;outer space|space;lighthouse;windmill;eiffel tower|eiffel;castle;haunted house|haunted;bridge'
};
const WORDS=[];
for(const cat in RAW)RAW[cat].split(';').forEach(s=>{const a=s.split('|');WORDS.push({w:a[0],cat,alt:a[1]?a[1].split(','):[]});});

// ---------- answer matching ----------
const nz=s=>String(s).toLowerCase().replace(/&/g,'and').replace(/^(a|an|the)\s+/,'').replace(/[^a-z0-9]/g,'');
function stems(s){const o=[s];if(s.length>3&&s.endsWith('s'))o.push(s.slice(0,-1));if(s.length>4&&s.endsWith('es'))o.push(s.slice(0,-2));if(s.length>4&&s.endsWith('ies'))o.push(s.slice(0,-3)+'y');return o;}
function lev1(a,b){                           // edit distance <= 1 ?
  if(a===b)return true;const la=a.length,lb=b.length;if(Math.abs(la-lb)>1)return false;
  let i=0;while(i<la&&i<lb&&a[i]===b[i])i++;
  if(la===lb)return a.slice(i+1)===b.slice(i+1);
  return la>lb?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);
}
function lev(a,b){const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const q=[i];for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=q;}return p[n];}
function dclose(word,alts,guess){const g=nz(guess);if(g.length<3)return false;return [word].concat(alts||[]).some(t=>{const n=nz(t);return n.length>=4&&lev(g,n)<=(n.length>=7?2:1);});}
function dmatch(word,alts,guess){
  const g=nz(guess);if(!g)return false;const gs=stems(g);
  for(const t of [word].concat(alts||[])){
    const n=nz(t);if(!n)continue;const ts=stems(n);
    if(gs.some(x=>ts.includes(x)))return true;
    if(t===word&&n.length>=6&&g.length>=5&&lev1(g,n))return true;
  }
  return false;
}
function hintStr(w,rev){return [...w].map((ch,i)=>ch===' '?'   ':(/[a-z0-9]/i.test(ch)&&!rev.has(i)?'_':ch.toUpperCase())).join(' ');}

GAMES.draw={
  name:'Draw & Guess',emoji:'🎨',tag:'Pictionary on your phones: draw it, guess it, roast it',
  min:2,max:4,
  rules:[
    ['🎲','Everyone takes a turn drawing (2 players: twice each). On your turn secretly pick 1 of 3 words — you get 5 seconds.'],
    ['🖌️','Draw it with your finger in about 35 seconds. No letters or numbers! Everyone else watches it appear LIVE.'],
    ['⌨️','Guessing? Type your guess in the box at the top. Wrong guesses show up for everyone, so steal ideas (and laugh at them).'],
    ['⭐','Right answer, fast = 6 points, slow = 2. The drawer gets 2 for every player who guesses it, +2 if EVERYONE does. Hints appear as time runs out.']
  ],
  ctrl:'Drawer: finger + colours, undo, clear. Guessers: type & hit Send.',
  win:'Most points after every turn wins. Guess fast, draw clearly.',
  dur:165,hz:10,better:'high',fmt:v=>v+' pts',

  // ================= HOST =================
  init(H){
    const ids=shuffle(H.players.map(p=>p.id)),n=ids.length;
    const order=n===2?[ids[0],ids[1],ids[0],ids[1]]:ids;
    const pts={};H.players.forEach(p=>pts[p.id]=0);
    return{st:'wait',tn:0,nt:order.length,order,dl:order.length<=3?40:30,dr:-1,pe:0,ds:0,cat:'',hint:'',got:{},chat:[],cs:0,pc:0,rv:null,pts,
      _word:null,_opts:[],_strokes:[],_used:[],_rev:null,_lg:{},_priv:{}};
  },
  begin(H,S){S.tn=0;startTurn(H,S);},
  tick(H,S,dt){
    if(S.st==='wait')return;
    const act=H.players.filter(p=>!p.aw);
    if(act.length<2){S.over=true;S.hold=.2;return;}
    const dr=H.players.find(p=>p.id===S.dr);
    if(S.st==='pick'){
      if(!dr||dr.aw)endTurn(H,S,true);
      else if(S.t>=S.pe)choose(H,S,Math.floor(Math.random()*S._opts.length));
    }else if(S.st==='draw'){
      const w=S._word.w,el=S.t-S.ds;
      if(S.hint===''&&el>=S.dl*.5){S._rev=new Set();S.hint=hintStr(w,S._rev);}
      if(S._rev&&S._rev.size===0&&el>=S.dl*.75){
        const idx=[];[...w].forEach((ch,i)=>{if(/[a-z0-9]/i.test(ch))idx.push(i);});
        shuffle(idx).slice(0,idx.length<=4?1:2).forEach(i=>S._rev.add(i));S.hint=hintStr(w,S._rev);
      }
      const gs=act.filter(p=>p.id!==S.dr);
      if(!dr||dr.aw)endTurn(H,S,true);
      else if(gs.length&&gs.every(p=>S.got[p.id]!=null))endTurn(H,S,false);
      else if(S.t>=S.pe)endTurn(H,S,false);
    }else if(S.st==='reveal'){
      if(S.t>=S.pe){
        if(S.tn+1>=S.order.length){S.over=true;S.hold=.3;S.pe=S.t+99;}
        else{S.tn++;startTurn(H,S);}
      }
    }
  },
  act(H,S,pid,m){
    if(S.st==='wait')return;
    const isDr=pid===S.dr;
    switch(m.k){
      case 'pick':if(isDr&&S.st==='pick'){const i=m.i|0;if(i>=0&&i<S._opts.length)choose(H,S,i);}break;
      case 'pts':{
        if(!isDr||S.st!=='draw'||!Array.isArray(m.p))return;
        const p=m.p;if(p.length<2||p.length>200||p.length%2)return;
        const q=[];for(let i=0;i<p.length;i++)q.push(clamp(Math.round(+p[i]||0),0,i%2?DH:DW));
        if(S.pc+q.length/2>9000)return;
        const sid=m.sid|0,c=clamp(m.c|0,0,PAL.length-1),w=clamp(m.w|0,0,BW.length-1);
        let st=S._strokes[S._strokes.length-1];
        if(!st||st.sid!==sid){if(S._strokes.length>=400)return;st={sid,c,w,p:[]};S._strokes.push(st);}
        for(const v of q)st.p.push(v);S.pc+=q.length/2;
        for(const pl of H.players)if(pl.id!==S.dr&&!pl.aw)H.emit({k:'d',tn:S.tn,sid,c:st.c,w:st.w,p:q},pl.id);
        break;}
      case 'undo':if(isDr&&S.st==='draw'&&S._strokes.length){const s=S._strokes.pop();S.pc-=s.p.length/2;viewers(H,S,{k:'u',tn:S.tn});}break;
      case 'clear':if(isDr&&S.st==='draw'&&S._strokes.length){S._strokes=[];S.pc=0;viewers(H,S,{k:'x',tn:S.tn});}break;
      case 'sync':H.emit({k:'full',tn:S.tn,st:S._strokes.map(s=>({sid:s.sid,c:s.c,w:s.w,p:s.p}))},pid);break;
      case 'g':guess(H,S,pid,m);break;
    }
  },
  val(S,id){return S.pts[id]||0;},

  // ================= CLIENT =================
  mk(c){
    if(!document.getElementById('st-draw')){const s=document.createElement('style');s.id='st-draw';s.textContent=`
.drw{position:absolute;inset:0;display:flex;flex-direction:column;gap:5px;padding:7px 8px 6px}
.drw-top{min-height:46px;display:flex;align-items:stretch;flex:0 0 auto}
.drw-form{display:none;flex:1;gap:6px;margin:0}
.drw-form input{flex:1;min-width:0;font-size:17px;padding:9px 12px;border-radius:14px;-webkit-user-select:text;user-select:text}
.drw-form button{flex:0 0 66px;border:0;border-radius:14px;background:linear-gradient(180deg,#ff6498,#ff3d81);color:#fff;font-weight:900;font-size:15px;box-shadow:0 3px 0 #a91d51}
.drw-form button:active{transform:translateY(2px);box-shadow:0 1px 0 #a91d51}
.drw-msg{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:21px;line-height:1.1;border-radius:14px;background:var(--panel);padding:4px 10px;color:#fff;min-width:0;overflow:hidden}
.drw-msg b{color:#ffd23f;letter-spacing:1px}
.drw-msg.ok{background:#12351f;color:#52ff7a}
.drw-info{position:relative;flex:0 0 auto;height:27px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14px;font-weight:800;color:#cfcff0;padding:0 4px 3px}
.drw-info .il{white-space:pre;overflow:hidden;text-overflow:ellipsis;min-width:0;letter-spacing:.5px}
.drw-info .ir{flex:0 0 auto;font-variant-numeric:tabular-nums;color:#ffd23f}
.drw-info i{position:absolute;left:0;bottom:0;height:3px;width:100%;background:linear-gradient(90deg,#19d3ff,#ff3d81);border-radius:2px;transform-origin:left}
.drw-cvw{position:relative;flex:0 1 auto;width:100%;aspect-ratio:800/998;min-height:90px;background:#101028;border-radius:14px;overflow:hidden}
.drw-cvw canvas{position:absolute;inset:0;margin:auto;touch-action:none;background:#fff;border-radius:8px;box-shadow:0 2px 14px #0008;display:block}
.drw-ov{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;text-align:center;background:rgba(11,11,23,.93);z-index:2}
.drw-ov.on{display:flex}
.drw-ov h3{margin:0;font-size:22px;font-weight:900}
.drw-ov p{margin:0;color:#c6c6e8;font-size:15px}
.drw-pk{display:flex;flex-direction:column;gap:9px;width:100%;max-width:300px}
.drw-pk button{border:0;border-radius:16px;background:var(--panel2);color:#fff;padding:12px 14px;min-height:56px;font-size:21px;font-weight:900;box-shadow:0 4px 0 #14142f;display:flex;align-items:center;justify-content:space-between;gap:8px}
.drw-pk button small{font-size:13px;color:#c6c6e8;font-weight:700}
.drw-pk button:active{transform:translateY(3px);box-shadow:0 1px 0 #14142f}
.drw-chat{flex:1 0 66px;overflow-y:auto;background:var(--panel);border-radius:12px;padding:3px 9px;font-size:14px;line-height:19px;touch-action:pan-y;-webkit-overflow-scrolling:touch}
.drw-chat.dr{flex-basis:50px}
.drw-chat div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drw-chat b{font-weight:900}
.drw-chat .ok{color:#52ff7a;font-weight:800}
.drw-tools{display:none;flex-direction:column;gap:5px;flex:0 0 auto}
.drw-tools.off{opacity:.35;pointer-events:none}
.drw-row{display:flex;gap:6px}
.drw-row button{flex:1;height:48px;border:0;border-radius:12px;background:var(--panel2);display:flex;align-items:center;justify-content:center;font-size:21px;padding:0}
.drw-row button:active{transform:scale(.94)}
.drw-row button.sel{background:#3b3b78;box-shadow:inset 0 0 0 3px #fff}
.drw-row button i{display:block;border-radius:50%;background:#fff}
.drw-row.cols button i{width:30px;height:30px;box-shadow:0 0 0 2px #0006}
@keyframes drwpop{0%{transform:scale(.6);opacity:0}100%{transform:none;opacity:1}}
.drw-msg.pop{animation:drwpop .35s}
`;document.head.append(s);}

    let wrap,topEl,form,inp,msg,info,il,ir,bar,cvw,cv,g,ov,chat,tools,toolBtns={};
    let S0=null,tn=-1,lastCs=0,lay='',strokes=[],started=false;
    let col=0,sz=1,sidc=Math.floor(Math.random()*1e6)*1000,cur=null,curI0=0,pend=[],drawing=null,flushT=0,ro=null;
    let mism=0,lastSync=0,lastSec=-1,gotPrev=0,lastGuessT=0,inkUntil=0,closeUntil=0;
    const pts=()=>strokes.reduce((a,s)=>a+s.p.length/2,0);

    function fit(){
      if(!cvw)return;const r=cvw.getBoundingClientRect();
      const s=Math.max(.05,Math.min((r.width-8)/DW,(r.height-8)/DH));
      const w=Math.floor(DW*s),h=Math.floor(DH*s),dpr=Math.min(2,window.devicePixelRatio||1);
      cv.style.width=w+'px';cv.style.height=h+'px';cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
      g.setTransform(cv.width/DW,0,0,cv.height/DH,0,0);redraw();
    }
    function seg(s,i0){
      const p=s.p,n=p.length/2;if(!n)return;
      g.strokeStyle=g.fillStyle=PAL[s.c];g.lineWidth=BW[s.w];g.lineCap='round';g.lineJoin='round';
      if(n===1){g.beginPath();g.arc(p[0],p[1],BW[s.w]/2,0,7);g.fill();return;}
      const a=Math.max(i0,1);if(a>=n)return;
      g.beginPath();g.moveTo(p[(a-1)*2],p[(a-1)*2+1]);for(let i=a;i<n;i++)g.lineTo(p[i*2],p[i*2+1]);g.stroke();
    }
    function redraw(){g.fillStyle='#fff';g.fillRect(0,0,DW,DH);for(const s of strokes)seg(s,0);}
    function newTurn(t){
      tn=t;strokes=[];cur=null;pend=[];drawing=null;redraw();chat.innerHTML='';lastCs=0;lay='';gotPrev=0;mism=0;
    }
    function flush(){
      while(pend.length&&cur){const part=pend.splice(0,160);c.act({k:'pts',sid:cur.sid,c:cur.c,w:cur.w,p:part});}
    }
    function pos(e){const r=cv.getBoundingClientRect();return[clamp(Math.round((e.clientX-r.left)/r.width*DW),0,DW),clamp(Math.round((e.clientY-r.top)/r.height*DH),0,DH)];}
    function canDraw(){return S0&&S0.st==='draw'&&S0.dr===c.me();}
    function addPt(x,y){
      if(!cur)return;const p=cur.p,n=p.length;
      if(n>=2&&Math.hypot(x-p[n-2],y-p[n-1])<4)return;
      if(n>=400||pts()>=8900)return;
      cur.p.push(x,y);pend.push(x,y);seg(cur,(n/2));
    }
    function renderChat(S){
      for(const e of S.chat){
        if(e.i<=lastCs)continue;lastCs=e.i;
        const d=document.createElement('div');
        const nm=document.createElement('b');const p=c.pl(e.id);nm.textContent=p?p.n:'?';nm.style.color=c.col(e.id);
        if(e.ok){d.className='ok';d.append('✅ ',nm,' got it!');
          if(e.id===c.me()){sfx.good();buzz([30,40,30]);}else sfx.good();}
        else{d.append(nm,' '+e.tx);}
        chat.append(d);
      }
      while(chat.children.length>40)chat.firstChild.remove();
      chat.scrollTop=chat.scrollHeight;
    }
    const catLabel=S=>S.cat&&CAT[S.cat]?CAT[S.cat][0]+' '+CAT[S.cat][1]:'';
    function setMsg(html,cls){msg.className='drw-msg'+(cls?' '+cls:'');msg.innerHTML='<div>'+html+'</div>';}
    function nameOf(id){const p=c.pl(id);return p?p.n:'?';}
    function sendGuess(){
      const v=inp.value.trim();if(!v)return;
      if(performance.now()-lastGuessT<250)return;lastGuessT=performance.now();
      c.act({k:'g',tx:v.slice(0,28)});inp.value='';sfx.tap();
    }
    function layout(S,R){
      const me=c.me(),isDr=S.dr===me,got=S.got[me]!=null,pv=c.priv()||{};
      const key=[S.st,S.tn,isDr,got,pv.ph||''].join('|');if(key===lay)return;lay=key;
      const showForm=S.st==='draw'&&!isDr&&!got;
      form.style.display=showForm?'flex':'none';msg.style.display=showForm?'none':'flex';
      tools.style.display=isDr?'flex':'none';tools.classList.toggle('off',S.st!=='draw');
      chat.classList.toggle('dr',isDr);
      ov.classList.remove('on');ov.innerHTML='';
      if(S.st==='wait'){setMsg('🎨 Get ready…');}
      else if(S.st==='pick'){
        if(isDr){
          setMsg('🎲 Your turn to draw!');ov.classList.add('on');
          const o=pv.opts||[];ov.innerHTML='<h3>Pick a word</h3><p>Secret — only you can see these</p>';
          const box=document.createElement('div');box.className='drw-pk';
          o.forEach((x,i)=>{const b=document.createElement('button');b.innerHTML='<span></span><small></small>';b.firstChild.textContent=x.w;b.lastChild.textContent=CAT[x.cat][0]+' '+CAT[x.cat][1];
            b.addEventListener('pointerdown',e=>{e.preventDefault();sfx.tap();c.act({k:'pick',i});ov.classList.remove('on');setMsg('✏️ Get drawing…');});box.append(b);});
          ov.append(box);const sc=document.createElement('p');sc.textContent=R.pl.map(p=>p.n+' '+(S.pts[p.id]||0)).join('  ·  ');ov.append(sc);
        }else{
          setMsg('🎨 <span></span> is choosing…');msg.querySelector('span').textContent=nameOf(S.dr);
          ov.classList.add('on');ov.innerHTML='<h3>Get ready to guess!</h3><p></p><p class="sc"></p>';ov.querySelector('p').textContent=nameOf(S.dr)+' is picking a secret word.';
          ov.querySelector('.sc').textContent=R.pl.map(p=>p.n+' '+(S.pts[p.id]||0)).join('  ·  ');
        }
      }else if(S.st==='draw'){
        if(isDr){setMsg('✏️ Draw: <b></b>','pop');msg.querySelector('b').textContent=(pv.word||'').toUpperCase();}
        else if(got){setMsg('✅ You got it! +'+S.got[me]+' — keep it secret','ok pop');}
      }else if(S.st==='reveal'){
        const rv=S.rv||{};
        if(rv.left)setMsg('😬 '+nameOf(S.dr)+' left — skipping');
        else if(!rv.got||!rv.got.length)setMsg('😂 Nobody got <b></b>','pop');
        else setMsg('The word was <b></b>','pop');
        const b=msg.querySelector('b');if(b)b.textContent=(rv.w||'').toUpperCase();
        if(rv.w&&rv.got&&rv.got.length){sfx.win();}else if(rv.w){sfx.bad();}
      }
    }
    return{
      mount(root){
        wrap=E('div','drw');
        topEl=E('div','drw-top');
        form=E('form','drw-form');
        inp=E('input');inp.type='text';inp.placeholder='Type your guess…';inp.maxLength=28;inp.setAttribute('autocomplete','off');inp.setAttribute('autocapitalize','off');inp.setAttribute('autocorrect','off');inp.setAttribute('spellcheck','false');inp.setAttribute('enterkeyhint','send');inp.setAttribute('aria-label','guess');
        const sb=E('button','','Send');sb.type='button';
        sb.addEventListener('pointerdown',e=>{e.preventDefault();sendGuess();});    // preventDefault: keep keyboard open for rapid guessing
        form.addEventListener('submit',e=>{e.preventDefault();sendGuess();});
        form.append(inp,sb);
        msg=E('div','drw-msg','🎨 Get ready…');
        topEl.append(form,msg);
        info=E('div','drw-info','<span class="il"></span><span class="ir"></span><i></i>');il=info.querySelector('.il');ir=info.querySelector('.ir');bar=info.querySelector('i');
        cvw=E('div','drw-cvw');cv=E('canvas');cvw.append(cv);g=cv.getContext('2d');
        ov=E('div','drw-ov');cvw.append(ov);
        chat=E('div','drw-chat');
        tools=E('div','drw-tools');
        const r1=E('div','drw-row cols'),r2=E('div','drw-row');
        PAL.forEach((p,i)=>{const b=E('button','','<i></i>');b.firstChild.style.background=p;b.dataset.c=i;b.addEventListener('pointerdown',e=>{e.preventDefault();col=i;sfx.tap();sel();});r1.append(b);toolBtns['c'+i]=b;});
        [10,18,28].forEach((d,i)=>{const b=E('button','','<i></i>');b.firstChild.style.cssText='width:'+d+'px;height:'+d+'px';b.addEventListener('pointerdown',e=>{e.preventDefault();sz=i;sfx.tap();sel();});r2.append(b);toolBtns['s'+i]=b;});
        const un=E('button','','↩️'),cl=E('button','','🗑️');
        un.addEventListener('pointerdown',e=>{e.preventDefault();if(!canDraw()||drawing!==null||!strokes.length)return;sfx.tap();strokes.pop();redraw();c.act({k:'undo'});});
        cl.addEventListener('pointerdown',e=>{e.preventDefault();if(!canDraw()||drawing!==null||!strokes.length)return;sfx.bad();strokes=[];redraw();c.act({k:'clear'});});
        r2.append(un,cl);tools.append(r1,r2);
        wrap.append(topEl,info,cvw,chat,tools);root.append(wrap);
        function sel(){for(let i=0;i<PAL.length;i++)toolBtns['c'+i].classList.toggle('sel',i===col);for(let i=0;i<3;i++)toolBtns['s'+i].classList.toggle('sel',i===sz);}
        sel();
        // drawing input
        cv.addEventListener('pointerdown',e=>{
          if(!canDraw()||drawing!==null)return;e.preventDefault();
          try{cv.setPointerCapture(e.pointerId);}catch(x){}
          if(strokes.length>=395||pts()>=8800){inkUntil=performance.now()+2500;sfx.bad();return;}
          drawing=e.pointerId;cur={sid:++sidc,c:col,w:sz,p:[]};strokes.push(cur);
          const q=pos(e);cur.p.push(q[0],q[1]);pend.push(q[0],q[1]);seg(cur,0);
        });
        cv.addEventListener('pointermove',e=>{
          if(drawing!==e.pointerId||!cur)return;e.preventDefault();
          const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
          for(const ev of (evs.length?evs:[e])){const q=pos(ev);addPt(q[0],q[1]);}
        });
        const up=e=>{if(drawing!==e.pointerId)return;drawing=null;flush();};
        cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
        if(window.ResizeObserver){ro=new ResizeObserver(fit);ro.observe(cvw);}else addEventListener('resize',fit);
        flushT=setInterval(flush,70);
        fit();
      },
      start(){started=true;},
      stop(){clearInterval(flushT);if(ro)ro.disconnect();else removeEventListener('resize',fit);},
      update(S,R){
        S0=S;
        if(S.st==='wait'){layout(S,R);return;}
        if(S.tn!==tn)newTurn(S.tn);
        layout(S,R);renderChat(S);
        const me=c.me(),isDr=S.dr===me;
        // info line
        if(S.st==='pick')il.textContent=isDr?'🎲 Choose fast!':'🎨 '+nameOf(S.dr)+' is choosing…';
        else if(S.st==='draw'){
          if(isDr){const gs=R.pl.filter(p=>p.id!==S.dr&&!p.aw).length,k=Object.keys(S.got).length;il.textContent=catLabel(S)+'  ·  ✅ '+k+'/'+gs+' got it';}
          else il.textContent=catLabel(S)+(S.hint?'   '+S.hint:'');
          // someone else got it: little pulse already via chat
        }else if(S.st==='reveal'){
          const rv=S.rv||{};il.textContent='';
          if(rv.got&&rv.got.length){const parts=rv.got.map(x=>nameOf(x.id)+' +'+x.pt);il.textContent='✅ '+parts.join(' · ')+'   🎨 '+nameOf(S.dr)+' +'+rv.dp;}
          else il.textContent=rv.left?'':'🎨 '+nameOf(S.dr)+' +0 — '+['art critics are stumped 🧐','the drawing speaks for itself 🫥','Picasso is crying 💀','bold artistic choices 🎭'][S.tn%4];
        }else il.textContent='';
        {const now=performance.now();if(now<inkUntil)il.textContent='🎨 Out of ink! Undo or clear';else if(now<closeUntil)il.textContent='🔥 So close!! Keep going';}
        // resync strokes if our copy drifted (reconnect, dropped batch)
        if(S.st!=='wait'&&drawing===null&&pts()!==S.pc){
          const now=performance.now();if(!mism)mism=now;
          else if(now-mism>1200&&now-lastSync>2500){lastSync=now;c.act({k:'sync'});}
        }else mism=0;
      },
      frame(rem){
        const S=S0;if(!S||S.st==='wait')return;
        const left=Math.max(0,S.pe-c.t());
        const tot=S.st==='pick'?PICK:S.st==='draw'?S.dl:REV;
        ir.textContent=S.st==='reveal'?'':Math.ceil(left)+'s';
        const now=performance.now();if(now<inkUntil)il.textContent='🎨 Out of ink! Undo or clear';else if(now<closeUntil)il.textContent='🔥 So close!! Keep going';
        bar.style.transform='scaleX('+clamp(left/tot,0,1)+')';
        if(S.st==='draw'){const sec=Math.ceil(left);if(sec!==lastSec){lastSec=sec;if(sec>0&&sec<=5){sfx.tick();}}}
      },
      event(m){
        if(!m)return;
        if(m.k==='close'){closeUntil=performance.now()+2200;sfx.tick();buzz(20);return;}
        if(m.tn!==undefined&&m.tn!==tn){if(m.tn>tn)newTurn(m.tn);else return;}
        if(S0&&S0.dr===c.me()&&m.k!=='full')return;
        if(m.k==='d'){
          let s=strokes[strokes.length-1];
          if(!s||s.sid!==m.sid){s={sid:m.sid,c:m.c,w:m.w,p:[]};strokes.push(s);}
          const i0=s.p.length/2;for(const v of m.p)s.p.push(v);seg(s,i0);
        }else if(m.k==='u'){strokes.pop();redraw();}
        else if(m.k==='x'){strokes=[];redraw();}
        else if(m.k==='full'){strokes=m.st.map(s=>({sid:s.sid,c:s.c,w:s.w,p:s.p.slice()}));redraw();}
      }
    };
  }
};
GAMES.draw._close=dclose;GAMES.draw._match=dmatch;GAMES.draw._words=WORDS;GAMES.draw._hint=hintStr;

// ---------- host helpers ----------
function viewers(H,S,msg){for(const p of H.players)if(p.id!==S.dr&&!p.aw)H.emit(msg,p.id);}
function startTurn(H,S){
  // skip turns of absent players
  while(S.tn<S.order.length){const p=H.players.find(p=>p.id===S.order[S.tn]);if(p&&!p.aw)break;S.tn++;}
  if(S.tn>=S.order.length){S.over=true;S.hold=.2;return;}
  const id=S.order[S.tn];
  S.dr=id;S.st='pick';S.pe=S.t+PICK;S.got={};S.chat=[];S.hint='';S.cat='';S.pc=0;S.rv=null;
  S._strokes=[];S._word=null;S._rev=null;S._lg={};
  // 3 words, different categories where possible, never repeated within a game
  const pool=shuffle(WORDS.filter(w=>!S._used.includes(w.w))),opts=[],cats=new Set();
  for(const w of pool){if(opts.length<3&&!cats.has(w.cat)){opts.push(w);cats.add(w.cat);}}
  for(const w of pool){if(opts.length<3&&!opts.includes(w))opts.push(w);}
  S._opts=opts;S._priv={[id]:{ph:'pick',opts:opts.map(w=>({w:w.w,cat:w.cat}))}};
}
function choose(H,S,i){
  const w=S._opts[i];if(!w)return;
  S._word=w;S._used.push(w.w);S.cat=w.cat;S.st='draw';S.ds=S.t;S.pe=S.t+S.dl;
  S._priv={[S.dr]:{ph:'draw',word:w.w}};
}
function pushChat(S,e){e.i=++S.cs;S.chat.push(e);if(S.chat.length>30)S.chat.shift();}
function guess(H,S,pid,m){
  if(S.st!=='draw'||pid===S.dr||S.got[pid]!=null)return;
  const p=H.players.find(p=>p.id===pid);if(!p||p.aw)return;
  const tx=String(m.tx==null?'':m.tx).replace(/\s+/g,' ').trim().slice(0,28);if(!tx)return;
  if(S.t-(S._lg[pid]==null?-9:S._lg[pid])<.2)return;S._lg[pid]=S.t;
  if(dmatch(S._word.w,S._word.alt,tx)){
    const frac=clamp((S.t-S.ds)/S.dl,0,1),pt=Math.round(GOT_MAX-(GOT_MAX-GOT_MIN)*frac);
    S.got[pid]=pt;S.pts[pid]=(S.pts[pid]||0)+pt;S.pts[S.dr]=(S.pts[S.dr]||0)+2;
    pushChat(S,{id:pid,ok:1});
  }else{pushChat(S,{id:pid,tx});if(dclose(S._word.w,S._word.alt,tx))H.emit({k:'close'},pid);}
}
function endTurn(H,S,left){
  const gs=H.players.filter(p=>!p.aw&&p.id!==S.dr),ids=Object.keys(S.got).map(Number);
  let dp=ids.length*2,bonus=false;
  if(ids.length>=2&&gs.length>=2&&gs.every(p=>S.got[p.id]!=null)){S.pts[S.dr]+=2;dp+=2;bonus=true;}
  S.rv={w:S._word?S._word.w:null,got:ids.map(id=>({id,pt:S.got[id]})),dp,bonus,left:!!left&&!S._word};
  S.st='reveal';S.pe=S.t+REV;S._priv={};
}
})();
