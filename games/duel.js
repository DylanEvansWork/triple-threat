// Fake-Out Duel — hold the button, let go ONLY on solid green. Decoys (🃏) flash a fake amber cue on everyone else's phone.
(function(){
const D=5, SET_MAX=5, WAIT_MIN=1.5, WAIT_MAX=5, FAKE=.9, AFTER_FAKE=.4, COLLECT=1.5, LATE=.35, RES=2.8, DECOYS=2, WAIT_CAP=6.5;
const LABEL={early:'FALSE START',jump:'TOO FAST (jumped)',fake:'FELL FOR A DECOY',nohold:"wasn't holding"};

function injectStyle(){
  if(document.getElementById('st-duel'))return;
  const s=document.createElement('style');s.id='st-duel';
  s.textContent=`
.dl{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:8px 10px 12px;background:#0b0b17;overflow:hidden}
.dl.wait{background:#0c1530}
.dl.go{background:#00e676}
.dl.fake{animation:dlstrobe .13s steps(1) infinite}
.dl.fs{background:#4a0d17}
@keyframes dlstrobe{0%{background:#ff9100}34%{background:#ffd600}67%{background:#ff5d00}}
.dl-top{display:flex;gap:6px;flex:0 0 auto}
.dl-c{flex:1;min-width:0;background:#171734;border-radius:12px;border-bottom:4px solid var(--c);padding:4px 6px;text-align:center}
.dl-c .nm{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dl-c .pt{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.15}
.dl-c .dls{font-size:13px;min-height:17px;line-height:1.3}
.dl-c.aw{opacity:.4}
.dl-c.bad{background:#4a0d17}
.dl-hd{display:flex;justify-content:space-between;font-size:12px;font-weight:900;color:#8d8db8;letter-spacing:1px;flex:0 0 auto;padding:0 4px}
.dl.go .dl-hd,.dl.fake .dl-hd{color:#0008}
.dl-mid{flex:0 0 auto;min-height:130px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px}
.dl-big{font-size:min(13vw,52px);font-weight:900;line-height:1.05}
.dl-sub{font-size:14px;font-weight:700;color:#c6c6e8;line-height:1.3;max-width:330px}
.dl.go .dl-big{font-size:min(30vw,128px);color:#00331a}
.dl.go .dl-sub{color:#00331a;font-size:18px}
.dl.fake .dl-big{font-size:min(24vw,98px);color:#3a1a00;animation:dljit .09s infinite;letter-spacing:2px}
.dl.fake .dl-sub{color:#3a1a00;font-weight:900}
@keyframes dljit{0%{transform:translate(-3px,1px) skewX(-6deg)}50%{transform:translate(3px,-2px) skewX(6deg)}100%{transform:translate(-2px,-1px) skewX(-3deg)}}
.dl.wait .dl-big{animation:dlpulse 1s infinite alternate}
@keyframes dlpulse{from{opacity:.6}to{opacity:1}}
.dl.fs .dl-big{color:#ff6b6b}
.dl-dec{flex:0 0 auto;min-height:60px;border:0;border-radius:18px;background:linear-gradient(180deg,#9b59ff,#6b2fd6);color:#fff;font-weight:900;font-size:19px;box-shadow:0 4px 0 #34107a;touch-action:none}
.dl-dec[disabled]{opacity:.3;box-shadow:none}
.dl-dec:active{transform:translateY(3px);box-shadow:0 1px 0 #34107a}
.dl-fire{flex:1;min-height:170px;border:0;border-radius:30px;background:linear-gradient(180deg,#ff5d6e,#d81f33);color:#fff;font-weight:900;font-size:min(11vw,44px);box-shadow:0 8px 0 #7a0f1c;touch-action:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:transform .05s}
.dl-fire small{font-size:14px;font-weight:700;opacity:.85}
.dl-fire.hold{transform:translateY(6px);box-shadow:0 2px 0 #7a0f1c;background:linear-gradient(180deg,#ff3d4f,#b3132a)}
.dl-fire.dead{background:#2a2a4a;box-shadow:none;color:#7a7aa8}
.dl.go .dl-fire{background:#fff;color:#00331a;box-shadow:0 8px 0 #0a8a4a}
.dl.fake .dl-fire{box-shadow:0 8px 0 #7a4a00}
.dl-resp{flex:1;min-height:0;display:flex;flex-direction:column;gap:7px;justify-content:flex-start;padding-top:28px}
.dl-rb{text-align:center;font-size:22px;font-weight:900;line-height:1.15;min-height:54px;display:flex;align-items:center;justify-content:center}
.dl-row{display:flex;align-items:center;gap:8px;background:#171734;border-radius:14px;border-left:8px solid var(--c);padding:9px 12px;font-weight:800;font-size:15px;animation:dlpop .35s backwards}
.dl-row.w{background:#12381f;box-shadow:0 0 0 2px #52ff7a}
.dl-row .nm{flex:0 0 auto;max-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dl-row .rs{flex:1;text-align:right;font-size:14px;color:#cfcff0}
.dl-row .rs.bad{color:#ff6b6b}
.dl-row .dp{flex:0 0 38px;text-align:right;font-size:20px;font-weight:900}
.dl-row .dp.p{color:#52ff7a}.dl-row .dp.m{color:#ff6b6b}.dl-row .dp.z{color:#6d6d96}
.dl-row .tt{flex:0 0 40px;text-align:right;font-size:12px;color:#8d8db8;font-weight:900}
@keyframes dlpop{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}
.dl-fl{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:5}
.dl-fl.go{animation:dlfl .5s}
@keyframes dlfl{0%{opacity:.6}100%{opacity:0}}
`;
  document.head.append(s);
}

GAMES.duel={
  name:'Fake-Out Duel',emoji:'⚔️',tag:'Quick-draw standoff. Trust nothing that isn\'t solid green.',
  min:2,max:4,
  rules:[
    ['✊','5 duels. Press and HOLD the big red button. Keep holding while you wait.'],
    ['🟢','When the screen goes solid GREEN with "FIRE!", LET GO as fast as you can. Fastest wins the duel (+2).'],
    ['🚫','Let go BEFORE green = false start, −1 and you\'re out of that duel.'],
    ['🃏','Each player has 2 DECOYS per game. Tap 🃏 while waiting (with your other thumb!) to flash a fake flickering orange "FIRE?" on everyone else\'s screen. Anyone who falls for it loses 1.'],
    ['👀','Real = solid green and "FIRE!". Fake = orange, flickering and "FIRE?". Don\'t flinch.']
  ],
  ctrl:'One thumb holds the red button, the other taps 🃏. Let go ONLY on solid green.',
  win:'Most points after 5 duels: +2 per duel won, −1 per false start or decoy fall.',
  dur:75,hz:20,better:'high',fmt:v=>v+' pts',

  init(H){
    const pts={},dc={};H.players.forEach(p=>{pts[p.id]=0;dc[p.id]=DECOYS;});
    return{d:0,mode:'set',sa:0,w0:0,g0:0,pts,dc,hold:{},lock:{},fk:0,fkBy:-1,fkN:0,rs:null,hist:[],
      _goAt:0,_g0p:0,_rep:{},_firstAt:0,_allSince:0,_dused:{}};
  },
  begin(H,S){this.startDuel(S);},
  startDuel(S){
    S.mode='set';S.sa=S.t;S.hold={};S.lock={};S.rs=null;S.fk=0;S.fkBy=-1;S._rep={};S._firstAt=0;S._allSince=0;S._dused={};
  },
  finish(H,S){
    const reps=Object.keys(S._rep).map(id=>({id:+id,ms:S._rep[id].ms,arr:S._rep[id].arr})).sort((a,b)=>a.ms-b.ms||a.arr-b.arr);
    const w=reps.length?reps[0].id:null;
    const ms={};reps.forEach(r=>ms[r.id]=r.ms);
    if(w!==null)S.pts[w]+=2;
    S.rs={w,ms};
    S.hist.push({w,ms,lock:Object.assign({},S.lock)});
    S.mode='res';S.sa=S.t;
    H.emit({e:'res',w});
  },
  tick(H,S,dt){
    if(S.over)return;
    const act=H.players.filter(p=>!p.aw).map(p=>p.id),el=S.t-S.sa;
    if(!act.length){S.over=true;S.hold=.2;return;}
    if(S.mode==='set'){
      const holders=act.filter(id=>S.hold[id]);
      if(holders.length===act.length){if(!S._allSince)S._allSince=S.t;}else S._allSince=0;
      if((S._allSince&&S.t-S._allSince>=.45)||el>=SET_MAX){
        act.forEach(id=>{if(!S.hold[id])S.lock[id]='nohold';});
        S.mode='wait';S.w0=S.t;S._goAt=S.t+rnd(WAIT_MIN,WAIT_MAX);
        if(!holders.length)this.finish(H,S);
      }
    }else if(S.mode==='wait'){
      const elig=act.filter(id=>!S.lock[id]);
      if(!elig.length){this.finish(H,S);}
      else if(S.t>=S._goAt&&S.t>=S.fk+AFTER_FAKE){S.mode='go';S.g0=S.t;S._g0p=performance.now();H.emit({e:'go'});}
    }else if(S.mode==='go'){
      const elig=act.filter(id=>!S.lock[id]);
      const all=elig.every(id=>S._rep[id]);
      if(all||S.t-S.g0>=COLLECT||(S._firstAt&&S.t>=S._firstAt+LATE))this.finish(H,S);
    }else if(S.mode==='res'){
      if(el>=RES){
        S.d++;
        if(S.d>=D||S.t+9>this.dur){S.over=true;S.hold=.4;}
        else this.startDuel(S);
      }
    }
  },
  act(H,S,pid,m){
    if(S.over)return;
    const pl=H.players.find(p=>p.id===pid);if(!pl)return;
    if(m.k==='h'){if(S.mode==='set')S.hold[pid]=true;}
    else if(m.k==='r'){
      let ms=typeof m.ms==='number'?m.ms:-1;
      if(S.mode==='set'){S.hold[pid]=false;}
      else if(S.mode==='wait'){
        if(S.lock[pid])return;
        S.lock[pid]=m.f?'fake':'early';S.pts[pid]-=1;S.hold[pid]=false;H.emit({e:'fs',p:pid,k:S.lock[pid]});
      }else if(S.mode==='go'){
        if(S.lock[pid]||S._rep[pid]||!S.hold[pid])return;
        S.hold[pid]=false;
        if(ms<0||ms<80){S.lock[pid]=ms<0?'early':'jump';S.pts[pid]-=1;H.emit({e:'fs',p:pid,k:S.lock[pid]});return;}
        const arr=performance.now()-S._g0p;
        if(ms>arr+60)ms=Math.round(arr);                 // can't have reacted for longer than has elapsed
        ms=Math.min(ms,5000);
        S._rep[pid]={ms,arr:performance.now()};
        if(!S._firstAt)S._firstAt=S.t;
      }
    }else if(m.k==='decoy'){
      if(S.mode!=='wait'||(S.dc[pid]||0)<=0||S._dused[pid])return;
      if(S.t<S.fk||S.t-S.w0>WAIT_CAP||S._goAt-S.t<.12)return;
      S.dc[pid]--;S._dused[pid]=true;S.fk=S.t+FAKE;S.fkBy=pid;S.fkN++;
      S._goAt=Math.max(S._goAt,S.fk+AFTER_FAKE+rnd(0,.35));
      for(const p of H.players){if(p.aw)continue;if(p.id===pid)H.emit({e:'sent',left:S.dc[pid]},pid);else H.emit({e:'fake',by:pid,d:FAKE},p.id);}
    }
  },
  val(S,id){return S.pts[id]||0;},

  mk(c){
    let fireS,root,chipsEl,hdEl,bigEl,subEl,midEl,decB,fireB,fireT,resEl,fl;
    let down=false,sentHold=false,goAt=0,fakeUntil=0,fakeSeen=0,myFS=false,fired=0,lastD=-1,lastMode='',plKey='',chips={},lastGlitch=0,sentFlash=0,resKey='',lastView='';
    const S0=()=>c.R()&&c.R().S;
    const GL=['FIRE?','F1RE?','FI̷RE?','F▮RE?','FIR_?','F!RE¿','FIRE?!'];
    const name=id=>(c.pl(id)||{n:'?'}).n;
    function view(S){
      const me=c.me(),now=performance.now();
      if(S.mode==='res')return'res';
      if(S.lock[me]||myFS)return'fs';
      if(S.mode==='go'&&goAt)return'go';
      if(S.mode==='wait'&&now<fakeUntil)return'fake';
      if(S.mode==='wait'||S.mode==='go')return'wait';
      return'set';
    }
    function onGo(){
      if(goAt)return;goAt=performance.now();apply();
      beep(880,.3,'square',.22);buzz(70);
    }
    function paintView(S){
      const v=view(S);
      if(v!==lastView){lastView=v;root.className='dl '+v;}
      const me=c.me(),locked=!!S.lock[me]||myFS;
      resEl.style.display=v==='res'?'flex':'none';midEl.style.display=v==='res'?'none':'flex';
      decB.style.display=v==='res'?'none':'';fireB.style.display=v==='res'?'none':'';
      if(v==='set'){bigEl.textContent=down?'STEADY… ✊':'HOLD THE BUTTON 👇';subEl.textContent=down?'Waiting for everyone to hold…':'Press and keep holding. Don\'t let go until GREEN.';}
      else if(v==='wait'){bigEl.textContent='WAIT FOR GREEN…';subEl.textContent='Only SOLID GREEN is real. Let go early = −1.';}
      else if(v==='go'){bigEl.textContent=fired?('⚡ '+fired+' ms'):'FIRE!';subEl.textContent=fired?'Waiting for the others…':'LET GO NOW!';if(fired)bigEl.style.fontSize='min(18vw,72px)';else bigEl.style.fontSize='';}
      else if(v==='fs'){const k=S.lock[me]||'early';bigEl.textContent='💥 '+(LABEL[k]||'FALSE START');subEl.textContent=k==='nohold'?'You weren\'t holding. Sit this one out.':'−1 point. You\'re out of this duel.';}
      if(v!=='go')bigEl.style.fontSize='';
      fireB.classList.toggle('hold',down&&(v==='set'||v==='wait'||v==='go'));
      fireB.classList.toggle('dead',v==='fs');
      fireT.textContent=v==='go'?(fired?'DONE':'LET GO!!!'):(v==='fs'?'—':(down?'HOLDING ✊':'HOLD ME'));
      fireS.textContent=v==='set'?'keep your finger on me':(v==='wait'?'keep holding… not yet':(v==='go'&&!fired?'release it!':''));
      const cnt=S.dc[me]||0;
      decB.disabled=!(S.mode==='wait'&&cnt>0&&now()>=fakeUntil&&!S.over&&c.t()>=S.fk);
      decB.textContent=sentFlash>performance.now()?'😈 DECOY SENT':'🃏 DECOY ×'+cnt;
    }
    const now=()=>performance.now();
    function apply(){const S=S0();if(S&&root)paintView(S);}
    function renderRes(S){
      const k=S.d+'|'+S.hist.length;if(k===resKey)return;resKey=k;
      resEl.innerHTML='';const rs=S.rs||{w:null,ms:{}};
      const rb=E('div','dl-rb');rb.textContent=rs.w===null?'💤 Nobody fired. No points.':'🏆 '+name(rs.w)+' wins the duel! +2';rb.style.color=rs.w===null?'#cfcff0':c.col(rs.w);resEl.append(rb);
      const R=c.R();R.pl.forEach((p,i)=>{
        const id=p.id,lk=S.lock[id],has=rs.ms[id]!==undefined;
        const d=E('div','dl-row'+(rs.w===id?' w':''),'<span class="nm"></span><span class="rs"></span><span class="dp"></span><span class="tt"></span>');
        d.style.setProperty('--c',COLORS[p.ci]);d.style.animationDelay=(i*.08)+'s';
        d.querySelector('.nm').textContent=p.n+(id===c.me()?' ★':'');
        const rsE=d.querySelector('.rs'),dp=d.querySelector('.dp');
        if(lk&&lk!=='nohold'){rsE.textContent=LABEL[lk];rsE.classList.add('bad');dp.textContent='−1';dp.classList.add('m');}
        else if(lk==='nohold'){rsE.textContent=LABEL.nohold;dp.textContent='0';dp.classList.add('z');}
        else if(has){rsE.textContent=rs.ms[id]+' ms';dp.textContent=rs.w===id?'+2':'0';dp.classList.add(rs.w===id?'p':'z');}
        else{rsE.textContent=p.aw?'left the game':'too slow';dp.textContent='0';dp.classList.add('z');}
        d.querySelector('.tt').textContent=(S.pts[id]||0)+' pts';
        resEl.append(d);
      });
    }
    return{
      mount(rt){
        injectStyle();root=E('div','dl set');rt.append(root);
        hdEl=E('div','dl-hd');chipsEl=E('div','dl-top');
        midEl=E('div','dl-mid');bigEl=E('div','dl-big');subEl=E('div','dl-sub');midEl.append(bigEl,subEl);
        resEl=E('div','dl-resp');resEl.style.display='none';
        decB=E('button','dl-dec','🃏 DECOY ×2');decB.disabled=true;
        fireB=E('button','dl-fire','<span></span><small></small>');fireT=fireB.firstChild;fireS=fireB.lastChild;
        fl=E('div','dl-fl');
        root.append(hdEl,chipsEl,midEl,resEl,decB,fireB,fl);
        decB.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const S=S0();if(!S||c.R().ph!=='play'||decB.disabled)return;c.act({k:'decoy'});});
        fireB.addEventListener('pointerdown',e=>{
          e.preventDefault();try{fireB.setPointerCapture(e.pointerId);}catch(x){}
          const S=S0();if(!S||c.R().ph!=='play'||down)return;
          down=true;sfx.tick();buzz(15);
          if(S.mode==='set'){c.act({k:'h'});sentHold=true;}
          apply();
        });
        const up=e=>{
          if(!down)return;down=false;const S=S0();if(!S||c.R().ph!=='play'){apply();return;}
          const me=c.me();
          if(S.mode==='set'){c.act({k:'r',ms:-1});}
          else if(!(S.lock[me]||myFS)&&(S.mode==='wait'||S.mode==='go')){
            if(S.mode==='go'&&goAt&&!fired){fired=Math.max(1,Math.round(performance.now()-goAt));c.act({k:'r',ms:fired});sfx.tap();buzz(25);}
            else if(!fired){myFS=true;c.act({k:'r',ms:-1,f:performance.now()<fakeUntil+500&&fakeSeen?1:0});sfx.bad();buzz([80,40,80]);fl.style.background='#ff2a3a';fl.classList.remove('go');void fl.offsetWidth;fl.classList.add('go');}
          }
          apply();
        };
        fireB.addEventListener('pointerup',up);fireB.addEventListener('pointercancel',up);
      },
      start(){},
      update(S,R){
        if(!root||!S)return;
        const key=R.pl.map(p=>p.id+p.n).join('|');
        if(key!==plKey){plKey=key;chipsEl.innerHTML='';chips={};R.pl.forEach(p=>{const d=E('div','dl-c','<div class="nm"></div><div class="pt"></div><div class="dls"></div>');d.style.setProperty('--c',COLORS[p.ci]);d.querySelector('.nm').textContent=p.n+(p.id===c.me()?' ★':'');chips[p.id]=d;chipsEl.append(d);});}
        if(S.d!==lastD){lastD=S.d;goAt=0;fakeUntil=0;fakeSeen=0;myFS=false;fired=0;sentHold=false;resKey='';lastView='';}
        if(S.mode!==lastMode){
          if(S.mode==='set'){goAt=0;fakeUntil=0;fakeSeen=0;myFS=false;fired=0;sentHold=false;}
          if(S.mode==='res'){const w=S.rs&&S.rs.w;if(w===c.me()){sfx.win();buzz([40,30,40]);}else if(w!==null&&w!==undefined)sfx.bad();
            if(w===c.me()){fl.style.background='#52ff7a';fl.classList.remove('go');void fl.offsetWidth;fl.classList.add('go');}}
          lastMode=S.mode;
        }
        if(S.mode==='set'&&down&&!sentHold){sentHold=true;c.act({k:'h'});}
        if(S.mode==='go'&&!goAt&&!S.lock[c.me()])onGo();     // fallback if the event was missed
        hdEl.innerHTML='<span>DUEL '+Math.min(D,S.d+1)+' / '+D+'</span><span>🃏 = decoy</span>';
        for(const p of R.pl){const d=chips[p.id];if(!d)continue;
          d.querySelector('.pt').textContent=(S.pts[p.id]||0)+' pts';d.classList.toggle('aw',!!p.aw);
          const lk=S.lock[p.id];let st='';
          if(S.mode==='set')st=S.hold[p.id]?'✊':'·';
          else if(S.mode==='res')st=S.rs&&S.rs.w===p.id?'🏆':'';
          else st=lk&&lk!=='nohold'?'💥':lk==='nohold'?'💤':(S.mode==='go'?'':'✊');
          st+=' '+'🃏'.repeat(S.dc[p.id]||0);
          d.querySelector('.dls').textContent=st;d.classList.toggle('bad',!!lk&&lk!=='nohold'&&S.mode!=='res');}
        if(S.mode==='res')renderRes(S);
        paintView(S);
      },
      event(m){
        const S=S0();if(!S)return;
        if(m.e==='go'){onGo();}
        else if(m.e==='fake'){
          fakeUntil=performance.now()+m.d*1000;fakeSeen=1;lastGlitch=0;
          beep(330,.12,'sawtooth',.12,90);setTimeout(()=>beep(300,.12,'sawtooth',.12,90),130);buzz([20,30,20]);apply();
        }
        else if(m.e==='sent'){sentFlash=performance.now()+900;sfx.good();apply();}
        else if(m.e==='fs'){if(m.p!==c.me()){sfx.tick();}}
      },
      frame(){
        const S=S0();if(!S||!root)return;const t=performance.now();
        if(S.mode==='wait'&&t<fakeUntil){
          if(t-lastGlitch>85){lastGlitch=t;bigEl.textContent=GL[Math.floor(Math.random()*GL.length)];subEl.textContent='is it? ...is it?!';}
        }
        if(lastView==='fake'&&t>=fakeUntil||(lastView!=='fake'&&t<fakeUntil&&S.mode==='wait'))apply();
        if(S.mode==='wait'||S.mode==='go'||S.mode==='set'){
          const cnt=S.dc[c.me()]||0;const dis=!(S.mode==='wait'&&cnt>0&&t>=fakeUntil&&c.t()>=S.fk);if(decB.disabled!==dis)decB.disabled=dis;
        }
      },
      stop(){}
    };
  }
};
})();
