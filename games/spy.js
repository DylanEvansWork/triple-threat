// SPY IN THE CROWD — a dot in a crowd of identical dots. Blend in, hunt the other humans, don't shoot bots.
(function(){
'use strict';
const WW=100,WH=120,RAD=2.7;                    // arena (world units) and dot radius
const VMAX=7.2,ACC=26,TURN=2.2;                          // top speed, acceleration and turn-rate limits: identical for bots and players
const COOL=1.2,LOCKT=2.0,GRACE=3.0,HITR=7.4;    // reload, bot-misfire lockout, no-shooting opening, tap forgiveness radius
const LEN=72;                                   // game over (reveal) at 72s, hold 3s -> engine ends at 75s
const r2=v=>Math.round(v*100)/100;
const gauss=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const angd=(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};

// ---------------- bot brain: smooth wander, pauses, short stints of clustering ----------------
function botInit(d){
  d.mode=Math.random()<.3?'pause':'walk';d.th=rnd(0,6.283);d.tr=rnd(-.6,.6);d.sp=rnd(3.8,7.4);
  d.tm=d.mode==='pause'?rnd(.3,2.2):rnd(2,7);d.fr=0;d.jog=Math.random()<.5;d.sp=d.jog?VMAX:rnd(3.2,VMAX-1);d.cv=pick([.25,.25,.7,1.3]);
  if(d.careless==null)d.careless=Math.random()<.45;
}
function botNext(d,alive){
  const r=Math.random();
  if(r<.32){d.mode='pause';d.tm=rnd(.4,2.8);}
  else if(r<.5&&alive.length>3){const f=alive[Math.floor(Math.random()*alive.length)];if(f&&f.id!==d.id){d.mode='follow';d.fr=f.id;d.tm=rnd(6,12);}else{d.mode='walk';d.tm=rnd(2,6);}}
  else{d.mode='walk';d.tm=rnd(2.5,7);d.jog=Math.random()<.5;d.sp=d.jog?VMAX:rnd(3.2,VMAX-1);d.cv=pick([.25,.25,.7,1.3]);d.tr=rnd(-1.6,1.6)*Math.min(1,d.cv+.3);}
}
function botStep(d,dt,alive){
  d.tm-=dt;let want=0;
  if(d.mode==='pause'){if(d.tm<=0)botNext(d,alive);}
  else{
    d.tr+=-d.tr*.9*dt+gauss()*1.5*(d.cv||.7)*Math.sqrt(dt);d.tr=clamp(d.tr,-1.9,1.9);
    if(!d.jog)d.sp=clamp(d.sp+gauss()*.9*dt,3,VMAX-.5);want=d.sp;
    if(d.mode==='follow'||d.mode==='dwell'){
      const f=alive.find(o=>o.id===d.fr);
      if(!f)d.mode='walk';
      else{
        const dx=f.x-d.x,dy=f.y-d.y,dist=Math.hypot(dx,dy);
        if(d.mode==='follow'){d.tr=clamp(angd(Math.atan2(dy,dx),d.th)*2.2,-2.2,2.2);if(dist<9){d.mode='dwell';d.tm=rnd(2,4.5);}else if(d.tm<=0)botNext(d,alive);}
        else{want=2.1;if(dist>12)d.tr=clamp(angd(Math.atan2(dy,dx),d.th)*2,-2,2);if(d.tm<=0)botNext(d,alive);}
      }
    }else if(d.tm<=0)botNext(d,alive);
    d.th+=d.tr*dt;
  }
  // soft wall avoidance (turn away smoothly, like a person who sees the edge coming)
  const M=d.careless?1.5:8;let px=0,py=0;
  if(d.x<M)px+=(M-d.x)/M;if(d.x>WW-M)px-=(d.x-(WW-M))/M;if(d.y<M)py+=(M-d.y)/M;if(d.y>WH-M)py-=(d.y-(WH-M))/M;
  if(px||py){const m=Math.min(1,Math.hypot(px,py));d.th+=angd(Math.atan2(py,px),d.th)*clamp(m*4*dt,0,.45);}
  return[want,d.th];
}

GAMES.spy={
  name:'Spy in the Crowd',emoji:'🕵️',tag:'Everyone is a dot. Blend in, hunt the other humans.',
  min:2,max:4,
  rules:[
    ['🕵️','You are ONE dot in a crowd of identical dots. Only you can see the glowing ring around your own dot. The crowd is mostly bots.'],
    ['🕹️','Steer with the joystick at the bottom. Walk like a bot: wander, pause, turn. Stand still or run dead straight and you give yourself away.'],
    ['🎯','Tap a dot up top to shoot it (reload ~1 s). Hit another PLAYER: +3 and they are out. Hit a BOT: −1 and you are frozen for 2 s.'],
    ['👀','Find the dots that move a bit too human. Don\'t spray and pray: bots punish you and everyone sees your shot.'],
    ['🏁','Round ends after 75 s or when only one player is left. Survivors get +2.']],
  ctrl:'Left thumb: joystick (bottom of the screen) to walk. Right thumb: tap a dot in the arena to shoot.',
  win:'+3 per player shot, −1 per bot shot, +2 if you survive. Highest total wins the round.',
  dur:75,hz:20,better:'high',fmt:v=>v+' pts',

  // ================= HOST =================
  init(H){
    const n=H.players.length,nb=10+3*n,tot=nb+n;
    const ids=shuffle(Array.from({length:tot},(_,i)=>i+1));
    const dots=[],P={},priv={},all={};
    const spot=()=>{for(let k=0;k<60;k++){const x=rnd(9,WW-9),y=rnd(9,WH-9);if(dots.every(d=>Math.hypot(d.x-x,d.y-y)>7.5))return[x,y];}return[rnd(9,WW-9),rnd(9,WH-9)];};
    for(let i=0;i<tot;i++){
      const[x,y]=spot(),pl=i<n?H.players[i]:null;
      const d={id:ids[i],x,y,vx:0,vy:0,pid:pl?pl.id:-1,alive:true,cs:0,hd:rnd(0,6.283),wb:0};botInit(d);if(d.pid<0&&d.mode==='walk'){d.cs=d.sp;d.hd=d.th;}
      if(pl){P[pl.id]={a:1,k:0,w:0,cd:0,lk:0,dt:0};priv[pl.id]={me:d.id};all[d.id]=pl.id;}
      dots.push(d);
    }
    return{_dots:dots,_in:{},_all:all,_priv:priv,_dis:rnd(17,23),pl:P,d:[],crowd:tot,rev:null};
  },
  begin(H,S){S.t=0;},
  tick(H,S,dt){
    const dots=S._dots,alive=dots.filter(d=>d.alive);
    // away players: their dot quietly becomes a bot (no tell), they count as out
    for(const p of H.players){const P=S.pl[p.id];if(p.aw&&P&&P.a){P.a=0;P.dt=S.t;const d=dots.find(d=>d.pid===p.id);if(d){d.pid=-1;botInit(d);}S._priv[p.id]={ghost:1,all:S._all};}}
    for(const d of alive){
      let dspd,dhd;
      if(d.pid>=0){
        const inp=S._in[d.pid];let x=0,y=0;
        if(inp&&S.t-inp.t<4){x=inp.x;y=inp.y;}
        const m=Math.hypot(x,y);
        if(m<.12){dspd=0;dhd=d.hd;}else{
          dspd=Math.min(1,m)*VMAX;dhd=Math.atan2(y,x);
          // rubber walls: a dot steered into the edge slides away from it (bots do the same), so nobody gets stuck hugging a wall
          const M=9;let px=0,py=0;if(d.x<M)px+=(M-d.x)/M;if(d.x>WW-M)px-=(d.x-(WW-M))/M;if(d.y<M)py+=(M-d.y)/M;if(d.y>WH-M)py-=(d.y-(WH-M))/M;
          if((px||py)&&Math.cos(dhd)*px+Math.sin(dhd)*py<0){const k=Math.min(1,Math.hypot(px,py));dhd+=angd(Math.atan2(py,px),dhd)*k*.85;}
        }
      }else{const v=botStep(d,dt,alive);dspd=v[0];dhd=v[1];}
      // identical physics for everyone: acceleration-limited speed, turn-rate-limited heading, a little natural wobble
      d.cs+=clamp(dspd-d.cs,-ACC*dt,ACC*dt);
      if(dspd>.3){if(d.cs<.8)d.hd=dhd;else d.hd+=clamp(angd(dhd,d.hd),-TURN*dt,TURN*dt);}
      d.wb+=-d.wb*1.2*dt+gauss()*.35*Math.sqrt(dt);d.hd+=d.wb*dt*(d.cs>.8?1:0);
      let vx=Math.cos(d.hd)*d.cs,vy=Math.sin(d.hd)*d.cs,hit=false;
      d.x+=vx*dt;d.y+=vy*dt;
      if(d.x<RAD){d.x=RAD;if(vx<0){vx=0;hit=true;}}if(d.x>WW-RAD){d.x=WW-RAD;if(vx>0){vx=0;hit=true;}}
      if(d.y<RAD){d.y=RAD;if(vy<0){vy=0;hit=true;}}if(d.y>WH-RAD){d.y=WH-RAD;if(vy>0){vy=0;hit=true;}}
      if(hit){d.cs=Math.hypot(vx,vy);if(d.cs>.3)d.hd=Math.atan2(vy,vx);if(d.pid<0){d.th=d.hd;d.tr=0;if(d.mode==='walk'&&d.tm<1)d.tm=rnd(1,3);}}
      d.vx=vx;d.vy=vy;
    }
    // soft separation so nobody sits exactly on someone else
    for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
      const a=alive[i],b=alive[j];let dx=b.x-a.x,dy=b.y-a.y;const dist=Math.hypot(dx,dy),mn=RAD*1.9;
      if(dist<mn){if(dist<.001){dx=Math.random()-.5;dy=Math.random()-.5;}const k=(mn-dist)/2/(dist||1);a.x-=dx*k;a.y-=dy*k;b.x+=dx*k;b.y+=dy*k;}
    }
    // the crowd thins out: every few seconds a random bot wanders off (poof) so the hunt tightens
    if(!S.over&&S.t>=S._dis){
      const bots=alive.filter(d=>d.pid<0);
      if(bots.length>5){const d=bots[Math.floor(Math.random()*bots.length)];d.alive=false;alive.splice(alive.indexOf(d),1);H.emit({e:'pf',x:r2(d.x),y:r2(d.y),id:d.id});}
      S._dis=S.t+rnd(5,8);
    }
    S.d=alive.map(d=>[d.id,r2(d.x),r2(d.y),r2(d.vx),r2(d.vy)]).sort((a,b)=>a[0]-b[0]);S.crowd=S.d.length;
    if(!S.over){
      if(S.t>=LEN)finish(S);
      else if(H.players.filter(p=>S.pl[p.id]&&S.pl[p.id].a).length<=1)finish(S);
    }
  },
  act(H,S,pid,m){
    const P=S.pl[pid];if(!P)return;
    if(m.k==='j'){
      const x=+m.x,y=+m.y;if(!isFinite(x)||!isFinite(y))return;
      const l=Math.hypot(x,y);S._in[pid]={x:l>1?x/l:x,y:l>1?y/l:y,t:S.t};
    }else if(m.k==='s'){
      if(S.over||!P.a||S.t<GRACE||S.t<P.cd||S.t<P.lk)return;
      const tx=+m.x,ty=+m.y;if(!isFinite(tx)||!isFinite(ty))return;
      const mine=S._dots.find(d=>d.pid===pid&&d.alive);if(!mine)return;
      const alive=S._dots.filter(d=>d.alive&&d.id!==mine.id);
      let tgt=null,bd=HITR;
      if(m.h!=null){const hd=alive.find(d=>d.id===m.h);if(hd&&Math.hypot(hd.x-tx,hd.y-ty)<HITR+2.5)tgt=hd;}
      if(!tgt)for(const d of alive){const q=Math.hypot(d.x-tx,d.y-ty);if(q<bd){bd=q;tgt=d;}}
      P.cd=S.t+COOL;
      if(!tgt){H.emit({e:'sh',by:pid,x:r2(tx),y:r2(ty),r:'m'});return;}
      tgt.alive=false;
      if(tgt.pid>=0){
        const V=S.pl[tgt.pid];V.a=0;V.dt=S.t;P.k++;
        S._priv[tgt.pid]={ghost:1,all:S._all};
        H.emit({e:'sh',by:pid,x:r2(tgt.x),y:r2(tgt.y),r:'p',id:tgt.id,v:tgt.pid});
        if(H.players.filter(p=>S.pl[p.id]&&S.pl[p.id].a).length<=1)finish(S);
      }else{
        P.w++;P.lk=S.t+LOCKT;
        H.emit({e:'sh',by:pid,x:r2(tgt.x),y:r2(tgt.y),r:'b',id:tgt.id});
      }
    }
  },
  val(S,id){const P=S.pl[id];return P?P.k*3-P.w+(P.a?2:0):null;},
  score(H,S){
    const n=H.players.length,rows=H.players.map(p=>({id:p.id,v:GAMES.spy.val(S,p.id)||0})).sort((a,b)=>b.v-a.v);
    rows.forEach((x,i)=>{x.rank=(i>0&&rows[i-1].v===x.v)?rows[i-1].rank:i;});
    return rows.map(x=>{const P=S.pl[x.id];return{id:x.id,rank:x.rank,pts:Math.max(0,n-x.rank),label:x.v+' pts · '+P.k+' kill'+(P.k===1?'':'s')+(P.w?' · '+P.w+' bot hit'+(P.w===1?'':'s'):'')+(P.a?' · survived':' · out')};});
  },

  // ================= CLIENT =================
  mk(c){
    let g,cvh,field,joy,strip,rlI,rlT,scT,pips,feed,banner,hint,flash,root0,joyH=null,S=null,jh=null;
    const dd=new Map();let parts=[],rings=[],floats=[];
    let aim=null,aimPid=null,jx=0,jy=0,jdirty=false,lastSend=0,tm=0,myCd=0,hb=0,hb2=0,shakeT=0,jUsed=false,over=false,lastLay='';
    let lay={s:1,ox:0,oy:0,ah:0,strip:34,jy:0},lastTs=performance.now(),started=false,bannerT=0;
    const ghost=()=>{const p=c.priv();return!!(p&&p.ghost);};
    const myDot=()=>{const p=c.priv();return p&&p.me!=null?p.me:null;};
    function style(){
      if(document.getElementById('st-spy'))return;const s=document.createElement('style');s.id='st-spy';
      s.textContent=`
.spy-field,.spy-joy{position:absolute;left:0;right:0;touch-action:none}
.spy-strip{position:absolute;left:0;right:0;display:flex;align-items:center;gap:8px;padding:0 10px;pointer-events:none}
.spy-rl{flex:1;height:24px;border-radius:12px;background:#ffffff14;position:relative;overflow:hidden}
.spy-rl i{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg,#19d3ff,#52ff7a);border-radius:12px}
.spy-rl.cool i{background:linear-gradient(90deg,#ffd23f,#ff9f1c)}
.spy-rl.frz i{background:linear-gradient(90deg,#ff3d81,#a91d51)}
.spy-rl.dead i{background:#ffffff10}
.spy-rl b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;letter-spacing:1px;text-shadow:0 1px 3px #000a}
.spy-sc{font-size:13px;font-weight:900;color:#cfcff0;white-space:nowrap}
.spy-pips{display:flex;gap:5px;align-items:center}
.spy-pips span{width:17px;height:17px;border-radius:50%;display:block;border:2px solid var(--c);background:var(--c);box-shadow:0 0 8px var(--c)}
.spy-pips span.x{background:transparent;box-shadow:none;opacity:.4}
.spy-feed{position:absolute;left:8px;top:6px;right:8px;display:flex;flex-direction:column;gap:3px;pointer-events:none;align-items:flex-start}
.spy-feed div{font-size:12.5px;font-weight:800;background:#0b0b17cc;padding:3px 8px;border-radius:8px;animation:spyin .25s}
@keyframes spyin{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.spy-ban{position:absolute;left:12px;right:12px;top:34%;text-align:center;pointer-events:none;font-weight:900;font-size:21px;line-height:1.15;padding:12px 14px;border-radius:16px;background:#0b0b17ee;border:2px solid #ffffff30;display:none;z-index:2}
.spy-ban.rev{top:4%;font-size:17px;padding:8px 12px}
.spy-ban.bad{border-color:#ff3d81;color:#ff8fb3}.spy-ban.good{border-color:#52ff7a;color:#9dffb4}
.spy-ban small{display:block;font-size:13px;font-weight:700;color:#cfcff0;margin-top:3px}
.spy-hint{position:absolute;left:0;right:0;bottom:8px;text-align:center;pointer-events:none;font-weight:800;font-size:14px;color:#cfcff0;text-shadow:0 1px 4px #000}
.spy-flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle,transparent 30%,#ff3d81aa);opacity:0;z-index:3}
.spy-flash.on{animation:spyfl .9s}
@keyframes spyfl{0%{opacity:1}100%{opacity:0}}
`;document.head.append(s);
    }
    function layout(){
      const W=cvh.W,H=cvh.H,key=W+'x'+H;if(key===lastLay)return;lastLay=key;
      const jH=Math.round(H*.34),st=34,ah=H-jH-st;
      const s=Math.min((W-10)/WW,(ah-8)/WH);
      lay={s,ox:(W-WW*s)/2,oy:(ah-WH*s)/2+1,ah,strip:st,jy:ah+st,jH};
      field.style.top='0';field.style.height=ah+'px';
      strip.style.top=ah+'px';strip.style.height=st+'px';
      joy.style.top=(ah+st)+'px';joy.style.bottom='0';
      feed.style.top='6px';
    }
    const w2cv=(x,y)=>[lay.ox+x*lay.s,lay.oy+y*lay.s];
    function candidate(wx,wy){
      const me=myDot();let best=null,bd=HITR;
      for(const o of dd.values()){if(o.id===me)continue;const q=Math.hypot(o.x-wx,o.y-wy);if(q<bd){bd=q;best=o.id;}}
      return best;
    }
    function aimUpd(e){
      const r=field.getBoundingClientRect(),x=(e.clientX-r.left-lay.ox)/lay.s,y=(e.clientY-r.top-lay.oy)/lay.s;
      aim={x:clamp(x,0,WW),y:clamp(y,0,WH)};aim.cand=candidate(aim.x,aim.y);
    }
    function note(txt,cls,ms){
      banner.className='spy-ban '+(cls||'');banner.innerHTML='';
      const parts=String(txt).split('\n');banner.append(document.createTextNode(parts[0]));
      if(parts[1]){const s=document.createElement('small');s.textContent=parts[1];banner.append(s);}
      banner.style.display='block';clearTimeout(bannerT);bannerT=setTimeout(()=>banner.style.display='none',ms||2200);
    }
    function addFeed(txt,col){
      const d=document.createElement('div');d.textContent=txt;if(col)d.style.borderLeft='4px solid '+col;feed.append(d);
      while(feed.children.length>3)feed.firstChild.remove();setTimeout(()=>d.remove(),3200);
    }
    function burst(x,y,col,n,sp){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(sp||18)*(.3+Math.random());parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:.5+Math.random()*.5,t:0,col});}}
    function ready(){const t=c.t(),P=S&&S.pl[c.me()];if(!P||!P.a)return false;return t>=GRACE&&t>=P.cd&&t>=P.lk&&t>=myCd;}
    function fire(){
      if(!aim||!S||c.R().ph!=='play'||S.over)return;
      const P=S.pl[c.me()];if(!P||!P.a)return;
      if(c.t()<GRACE){note('Weapons hot in '+Math.ceil(GRACE-c.t())+'…','',700);sfx.tick();return;}
      if(!ready()){sfx.tick();return;}
      if(aim.cand==null){rings.push({x:aim.x,y:aim.y,col:'#ffffff55',t:0,r:HITR});return;}  // nothing near the finger: don't waste a shot
      myCd=c.t()+COOL;
      c.act({k:'s',x:+aim.x.toFixed(2),y:+aim.y.toFixed(2),h:aim.cand});
      beep(900,.06,'square',.08,-500);buzz(12);
    }
    function sendJoy(force){
      const now=performance.now();
      if((jdirty&&now-lastSend>=30)||(force)||now-lastSend>250){
        c.act({k:'j',x:+jx.toFixed(2),y:+jy.toFixed(2)});lastSend=now;jdirty=false;
      }
    }

    function draw(dt){
      const W=cvh.W,H=cvh.H;layout();g.setTransform(cvh.dpr,0,0,cvh.dpr,0,0);
      g.clearRect(0,0,W,H);
      const s=lay.s,ox=lay.ox,oy=lay.oy,now=performance.now(),gh=ghost(),priv=c.priv()||{},me=myDot();
      let sx=0,sy=0;if(shakeT>0){shakeT-=dt;sx=(Math.random()-.5)*8*Math.min(1,shakeT*3);sy=(Math.random()-.5)*8*Math.min(1,shakeT*3);}
      g.save();g.translate(sx,sy);
      // arena
      g.fillStyle='#10102a';g.strokeStyle='#2d2d62';g.lineWidth=2;
      g.beginPath();g.roundRect?g.roundRect(ox-2,oy-2,WW*s+4,WH*s+4,12):g.rect(ox-2,oy-2,WW*s+4,WH*s+4);g.fill();g.stroke();
      g.strokeStyle='rgba(255,255,255,.04)';g.lineWidth=1;g.beginPath();
      for(let i=1;i<10;i++){g.moveTo(ox+i*10*s,oy);g.lineTo(ox+i*10*s,oy+WH*s);}
      for(let i=1;i<12;i++){g.moveTo(ox,oy+i*10*s);g.lineTo(ox+WW*s,oy+i*10*s);}
      g.stroke();
      // move display positions toward (target + velocity * age)
      for(const o of dd.values()){
        const age=Math.min(.12,(now-o.ts)/1000),tx=o.tx+o.vx*age,ty=o.ty+o.vy*age,k=1-Math.exp(-dt*18);
        if(o.nw){o.x=tx;o.y=ty;o.nw=false;}else{o.x+=(tx-o.x)*k;o.y+=(ty-o.y)*k;}
      }
      // dots: every one drawn exactly the same
      const rp=RAD*s;
      for(const o of dd.values()){
        const[px,py]=w2cv(o.x,o.y);
        g.fillStyle='#cfd3ee';g.beginPath();g.arc(px,py,rp,0,6.283);g.fill();
        g.strokeStyle='rgba(8,8,24,.55)';g.lineWidth=1.5;g.stroke();
      }
      // private rings: my own dot; ghosts/everyone at the end see all players
      const rev=S&&S.rev,all=gh?(priv.all||{}):null;
      for(const o of dd.values()){
        let col=null,strong=false;
        if(rev&&rev[o.id]!=null){col=c.col(rev[o.id]);strong=true;}
        else if(gh&&all&&all[o.id]!=null)col=c.col(all[o.id]);
        else if(!gh&&o.id===me)col=c.col(c.me());
        if(col){
          const[px,py]=w2cv(o.x,o.y),pulse=.72+.28*Math.sin(now/230);
          g.save();g.globalAlpha=strong?1:pulse;g.strokeStyle=col;g.lineWidth=strong?3.2:2.4;g.shadowColor=col;g.shadowBlur=strong?16:11;
          g.beginPath();g.arc(px,py,rp+4.5+(strong?1.5:0),0,6.283);g.stroke();g.restore();
          if(!strong&&!gh&&o.id===me&&c.t()<GRACE+1.5){g.save();g.globalAlpha=clamp(GRACE+1.5-c.t(),0,1);g.fillStyle=col;g.font='900 12px system-ui';g.textAlign='center';g.fillText('YOU',px,py-rp-9);g.restore();}
          if(strong){const p=c.pl(rev[o.id]);if(p){g.fillStyle=col;g.font='900 11px system-ui';g.textAlign='center';g.fillText(p.n,px,py-rp-9);}}
        }
      }
      // aim reticle
      if(aim&&aimPid!==null){
        const[px,py]=w2cv(aim.x,aim.y),rd=HITR*s;
        g.save();g.setLineDash([5,5]);g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=1.5;g.beginPath();g.arc(px,py,rd,0,6.283);g.stroke();g.restore();
        if(aim.cand!=null){const o=dd.get(aim.cand);if(o){const[qx,qy]=w2cv(o.x,o.y);g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.arc(qx,qy,rp+3,0,6.283);g.stroke();
          g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=1.5;g.beginPath();g.moveTo(qx-rp-9,qy);g.lineTo(qx-rp+1,qy);g.moveTo(qx+rp-1,qy);g.lineTo(qx+rp+9,qy);g.moveTo(qx,qy-rp-9);g.lineTo(qx,qy-rp+1);g.moveTo(qx,qy+rp-1);g.lineTo(qx,qy+rp+9);g.stroke();}}
      }
      // effects
      for(const r of rings){r.t+=dt;const k=r.t/.35;if(k>=1)continue;const[px,py]=w2cv(r.x,r.y);g.strokeStyle=r.col;g.globalAlpha=1-k;g.lineWidth=3*(1-k)+1;g.beginPath();g.arc(px,py,(r.r||HITR)*s*(.3+.9*k),0,6.283);g.stroke();g.globalAlpha=1;}
      rings=rings.filter(r=>r.t<.35);
      for(const p of parts){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;const[px,py]=w2cv(p.x,p.y);g.globalAlpha=Math.max(0,1-p.t/p.l);g.fillStyle=p.col;g.beginPath();g.arc(px,py,Math.max(.5,3*(1-p.t/p.l)),0,6.283);g.fill();}
      g.globalAlpha=1;parts=parts.filter(p=>p.t<p.l);
      for(const f of floats){f.t+=dt;const[px,py]=w2cv(f.x,f.y-f.t*7);g.globalAlpha=Math.max(0,1-f.t/1.1);g.fillStyle=f.col;g.font='900 17px system-ui';g.textAlign='center';g.strokeStyle='#000a';g.lineWidth=3;g.strokeText(f.txt,px,py);g.fillText(f.txt,px,py);}
      g.globalAlpha=1;floats=floats.filter(f=>f.t<1.1);
      g.restore();
      // joystick hint
      if(!jUsed&&!over){
        g.save();g.globalAlpha=.35+.1*Math.sin(now/300);g.strokeStyle='#fff';g.lineWidth=2;g.setLineDash([6,6]);
        const cx=W/2,cy=lay.jy+(H-lay.jy)/2;g.beginPath();g.arc(cx,cy,48,0,6.283);g.stroke();g.setLineDash([]);
        g.fillStyle='#fff';g.font='800 14px system-ui';g.textAlign='center';g.fillText('drag here to walk',cx,cy+4);g.restore();
      }else{
        g.save();g.globalAlpha=.25;g.fillStyle='#fff';g.font='800 11px system-ui';g.textAlign='center';g.fillText('JOYSTICK ZONE',W/2,H-8);g.restore();
      }
    }
    function hud(){
      if(!S)return;const t=c.t(),me=c.me(),P=S.pl[me],gh=ghost();
      let txt='READY',cls='',pct=1;
      if(!P||!P.a||gh){txt='👻 SPECTATING';cls='dead';pct=1;}
      else if(S.over){txt='ROUND OVER';cls='dead';}
      else if(t<GRACE){txt='BLEND IN… '+Math.ceil(GRACE-t);cls='cool';pct=t/GRACE;}
      else if(t<P.lk){txt='FROZEN (shot a bot) '+(P.lk-t).toFixed(1)+'s';cls='frz';pct=(P.lk-t)/LOCKT;}
      else if(t<Math.max(P.cd,myCd)){const e=Math.max(P.cd,myCd);txt='RELOADING';cls='cool';pct=1-(e-t)/COOL;}
      rlI.style.width=(clamp(pct,0,1)*100)+'%';rlT.textContent=txt;rlI.parentNode.className='spy-rl '+cls;
      if(P)scT.textContent=(P.k*3-P.w)+' pts';
      const sig=S.pl?Object.keys(S.pl).map(id=>S.pl[id].a).join(''):'';
      if(pips.dataset.s!==sig){pips.dataset.s=sig;pips.innerHTML='';
        const cr=document.createElement('span');cr.style.cssText='background:none;border:0;box-shadow:none;width:auto;height:auto;font-size:13px;font-weight:900;color:#cfcff0';cr.className='crowd';pips.append(cr);
        for(const p of c.R().pl){const s=document.createElement('span');s.style.setProperty('--c',c.col(p.id));if(!(S.pl[p.id]&&S.pl[p.id].a))s.className='x';pips.append(s);}}
      const cr=pips.querySelector('.crowd');if(cr)cr.textContent='👥'+(S.crowd||0);
      const live=Object.values(S.pl).filter(p=>p.a).length;
      hint.textContent=(P&&P.a&&!S.over)?(t<GRACE?'Move like a bot. Shooting unlocks in '+Math.ceil(GRACE-t)+'…':(live<=2&&c.R().pl.length>2?'Only '+live+' players left. Who is moving wrong?':'Tap a dot to shoot it. Bots punish!')):'';
    }

    return{
      dbg:{w2c(x,y){const r=field.getBoundingClientRect();return{x:r.left+lay.ox+x*lay.s,y:r.top+lay.oy+y*lay.s};},get field(){return field;},get joy(){return joy;},dots:()=>[...dd.values()],lay:()=>lay},
      mount(root){
        style();root0=root;cvh=mkCanvas(root);cvh.cv.style.pointerEvents='none';g=cvh.g;
        field=E('div','spy-field');joy=E('div','spy-joy');strip=E('div','spy-strip');
        strip.innerHTML='<div class="spy-rl"><i></i><b></b></div><div class="spy-sc"></div><div class="spy-pips"></div>';
        rlI=strip.querySelector('i');rlT=strip.querySelector('b');scT=strip.querySelector('.spy-sc');pips=strip.querySelector('.spy-pips');
        feed=E('div','spy-feed');banner=E('div','spy-ban');hint=E('div','spy-hint');flash=E('div','spy-flash');
        field.append(feed,hint);root.append(field,strip,joy,banner,flash);
        field.addEventListener('pointerdown',e=>{if(aimPid!==null||ghost())return;aimPid=e.pointerId;try{field.setPointerCapture(e.pointerId);}catch(x){}aimUpd(e);e.preventDefault();});
        field.addEventListener('pointermove',e=>{if(e.pointerId===aimPid)aimUpd(e);});
        const up=e=>{if(e.pointerId!==aimPid)return;aimUpd(e);aimPid=null;fire();aim=null;};
        field.addEventListener('pointerup',up);
        field.addEventListener('pointercancel',e=>{if(e.pointerId===aimPid){aimPid=null;aim=null;}});
        jh=Joy(joy,(x,y)=>{jx=x;jy=y;jdirty=true;if(x||y)jUsed=true;},{radius:55});
        layout();draw(.016);
      },
      start(){started=true;lastTs=performance.now();tm=setInterval(()=>{if(c.R()&&c.R().ph==='play')sendJoy(false);},30);},
      update(S_,R){
        S=S_;const now=performance.now();
        if(S.d){const seen=new Set();for(const r of S.d){seen.add(r[0]);let o=dd.get(r[0]);if(!o){o={id:r[0],x:r[1],y:r[2],nw:true};dd.set(r[0],o);}o.tx=r[1];o.ty=r[2];o.vx=r[3];o.vy=r[4];o.ts=now;}
          for(const id of [...dd.keys()])if(!seen.has(id))dd.delete(id);}
        if(S.over&&!over){over=true;note('🔎 Identities revealed!','rev',2800);sfx.win&&beep(440,.3,'triangle',.12);}
        hud();
        if(!started||R.ph!=='play'){draw(.016);}
      },
      frame(rem){
        const now=performance.now(),dt=Math.min(.05,(now-lastTs)/1000);lastTs=now;
        draw(dt);hud();
        // tension: heartbeat once the player pool is thin / time is short
        if(S&&!S.over&&c.R().ph==='play'){
          const live=Object.values(S.pl).filter(p=>p.a).length,t=c.t();
          const rate=(live<=2&&c.R().pl.length>2)||t>55?1:0;
          if(rate&&now-hb>(t>62?700:1000)){hb=now;beep(62,.16,'sine',.35);setTimeout(()=>beep(55,.14,'sine',.22),170);}
        }
      },
      event(m){
        if(m&&m.e==='pf'){dd.delete(m.id);burst(m.x,m.y,'#8d8db8',10,10);return;}
        if(!m||m.e!=='sh')return;
        const by=c.pl(m.by),bcol=c.col(m.by),mine=m.by===c.me();
        rings.push({x:m.x,y:m.y,col:bcol,t:0,r:m.r==='m'?HITR*.7:HITR});
        if(m.id!=null)dd.delete(m.id);
        if(m.r==='p'){
          const v=c.pl(m.v),vcol=c.col(m.v);
          burst(m.x,m.y,vcol,30,26);burst(m.x,m.y,'#fff',10,14);
          floats.push({x:m.x,y:m.y-2,txt:'+3',col:bcol,t:0});
          addFeed((by?by.n:'?')+' eliminated '+(v?v.n:'?')+' 🎯',vcol);
          sfx.boom();beep(110,.7,'sine',.22,-50);   // the "hush"
          if(m.v===c.me()){shakeT=.6;flash.classList.remove('on');void flash.offsetWidth;flash.classList.add('on');buzz([90,40,220]);
            note('☠️ You were spotted by '+(by?by.n:'someone')+'!\nSpectating now: rings show where the players are.','bad',3400);}
          else if(mine){buzz([40,30,40]);note('🎯 Got '+(v?v.n:'them')+'! +3','good',1800);}
        }else if(m.r==='b'){
          burst(m.x,m.y,'#8d8db8',14,16);
          floats.push({x:m.x,y:m.y-2,txt:'−1',col:'#ff6b6b',t:0});
          addFeed((by?by.n:'?')+' shot a BOT 🤖 (−1)',bcol);
          if(mine){sfx.bad();buzz([60,30,120]);note('🤖 Oops, that was a bot!\n−1 point and you\'re frozen for 2 s','bad',2000);}
          else beep(220,.15,'square',.06,-60);
        }else{
          if(!mine)beep(500,.04,'square',.04,-200);
        }
      },
      stop(){clearInterval(tm);clearTimeout(bannerT);try{jh&&jh.destroy();}catch(e){}}
    };
  }
};

function finish(S){
  S.over=true;S.hold=3;S.rev={};
  for(const d of S._dots)if(d.alive&&d.pid>=0)S.rev[d.id]=d.pid;
}
})();
