// ARTILLERY — secret simultaneous aiming, wind, destructible hills. Host simulates every shell; clients replay the same volley.
(function(){
'use strict';
const WW=100,WH=140,DX=.5,N=201;               // world size, terrain columns
const G=40,VK=.62,TDT=1/120,SAMP=6;            // gravity, power->speed, sim step, samples every 6 steps (0.05 s)
const TR=3.6,CR=6.5,BR=10,MAXD=50;             // tank hit radius, crater radius, blast radius, max damage
const AIM1=12,AIM=10,VOLLEYS=6;
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;

function hAt(T,x){x=clamp(x,0,WW);const f=x/DX,i=Math.floor(f);if(i>=N-1)return T[N-1];return T[i]+(T[i+1]-T[i])*(f-i);}
function carve(T,cx,cy,r){
  const i0=Math.max(0,Math.floor((cx-r)/DX)),i1=Math.min(N-1,Math.ceil((cx+r)/DX));
  for(let i=i0;i<=i1;i++){
    const dx=i*DX-cx;if(Math.abs(dx)>=r)continue;const s=Math.sqrt(r*r-dx*dx),h=T[i];
    if(h<=cy-s)continue;
    T[i]=h<=cy+s?Math.max(0,cy-s):Math.max(0,h-2*s);
  }
}
function genTerrain(slots){
  const ph=[rnd(0,6.28),rnd(0,6.28),rnd(0,6.28)],T=new Array(N);
  const tg=slots.map(()=>rnd(46,58));
  for(let i=0;i<N;i++){
    const x=i*DX;let h=36+9*Math.sin(x*.07+ph[0])+6*Math.sin(x*.15+ph[1])+3*Math.sin(x*.33+ph[2]);
    slots.forEach((sx,k)=>{const d=Math.abs(x-sx);if(d<15){const w=d<4?1:(1-(d-4)/11);const e=w*w*(3-2*w);h=h+(tg[k]-h)*e;}});
    T[i]=r1(clamp(h,16,64));
  }
  return T;
}
// deterministic volley simulation. tanks:[{p,x,y,hp,a}], shots:[{p,a,pw}] -> {shells,ex,T,tanks}
function simulate(T0,tanks0,wind,shots){
  const T=T0.slice(),tanks=tanks0.map(t=>Object.assign({},t)),ex=[];
  const sh=shots.map(s=>{
    const t=tanks.find(t=>t.p===s.p),r=s.a*Math.PI/180,v=s.pw*VK;
    return{p:s.p,a:s.a,pw:s.pw,x:t.x+Math.cos(r)*4.6,y:t.y+1.6+Math.sin(r)*4.6,vx:Math.cos(r)*v,vy:Math.sin(r)*v,path:[],live:true,te:0,age:0};
  });
  const dealt={},selfd={},kills={};
  const explode=(s,x,y,t)=>{
    x=r2(x);y=r2(y);const e={t:r1(t*100)/100,x,y,dm:{},k:[],f:{}};
    for(const k of tanks){
      if(!k.a)continue;const d=Math.hypot(x-k.x,y-(k.y+1.5));
      if(d>=BR)continue;
      let dmg=Math.round(MAXD*(1-Math.max(0,d-TR)/(BR-TR)));dmg=Math.min(dmg,k.hp);if(dmg<=0)continue;
      k.hp-=dmg;e.dm[k.p]=(e.dm[k.p]||0)+dmg;
      if(k.p===s.p)selfd[s.p]=(selfd[s.p]||0)+dmg;else dealt[s.p]=(dealt[s.p]||0)+dmg;
      if(k.hp<=0){k.a=0;e.k.push(k.p);if(k.p!==s.p)kills[s.p]=(kills[s.p]||0)+1;}
    }
    carve(T,x,y,CR);
    for(const k of tanks){
      if(!k.a)continue;const ny=hAt(T,k.x);
      if(ny<k.y-.01){
        const drop=k.y-ny;e.f[k.p]=[r1(k.y),r1(ny)];k.y=ny;
        const fd=drop>3?Math.min(12,Math.round((drop-3)*1.5)):0;
        if(fd>0){const d2=Math.min(fd,k.hp);k.hp-=d2;e.dm[k.p]=(e.dm[k.p]||0)+d2;if(k.hp<=0){k.a=0;e.k.push(k.p);}}
      }
    }
    ex.push(e);
  };
  let t=0;
  for(let step=0;step<7*120;step++){
    if(!sh.some(s=>s.live))break;
    for(const s of sh){if(s.live&&step%SAMP===0)s.path.push(r1(s.x),r1(s.y));}
    t=step*TDT;
    for(const s of sh){
      if(!s.live)continue;
      s.vx+=wind*TDT;s.vy-=G*TDT;s.x+=s.vx*TDT;s.y+=s.vy*TDT;s.age+=TDT;
      if(s.x<-6||s.x>WW+6||s.y<-12){s.live=false;s.te=t;s.out=1;continue;}
      let hit=false;
      for(const k of tanks){if(!k.a)continue;if(k.p===s.p&&s.age<.3)continue;if(Math.hypot(s.x-k.x,s.y-(k.y+1.5))<TR){hit=true;break;}}
      if(!hit&&s.x>=0&&s.x<=WW&&s.y<=hAt(T,s.x))hit=true;
      if(hit){s.live=false;s.te=t;explode(s,s.x,s.y,t);}
    }
  }
  for(const s of sh)if(s.live){s.live=false;s.te=t;s.out=1;}
  return{shells:sh.map(s=>({p:s.p,a:s.a,pw:s.pw,path:s.path,te:r2(s.te),out:s.out?1:0})),ex,T:T.map(r1),tanks,dealt,selfd,kills};
}

GAMES.artillery={
  name:'Artillery',emoji:'🎯',tag:'Secret aim, wind, craters. Everyone fires at once.',
  min:2,max:4,
  rules:[
    ['🎯','Six volleys. Each one, you secretly aim your tank: drag back like a slingshot, the angle and power show below.'],
    ['🔒','Tap LOCK IN when you are happy. When everybody is locked (or 10 s are up) ALL shells fire at the same time.'],
    ['💨','Wind pushes every shell sideways. Check the wind arrow, then correct using the ghost trace of your last shot.'],
    ['💥','Shells blow craters in the ground. Direct hit ≈ 50 damage, splash less. Tanks fall when the hill under them goes.'],
    ['🏆','Score = damage you deal (+25 per kill) minus damage you do to yourself. Most points wins.']],
  ctrl:'Drag anywhere on the battlefield to aim (pull back = power). Use the +/− buttons to fine-tune, then LOCK IN.',
  win:'Damage dealt to others + 25 per kill − damage to yourself.',
  dur:100,hz:10,better:'high',fmt:v=>v+' pts',
  dbg:{simulate,carve,hAt,N,WW,WH},

  // ================= HOST =================
  init(H){
    const n=H.players.length;
    const base={2:[16,84],3:[14,50,86],4:[12,37,63,88]}[n]||[16,84];
    const slots=shuffle(base.map(x=>clamp(x+rnd(-3,3),8,92)));
    const T=genTerrain(slots),tk={},sc={},priv={},aim={};
    H.players.forEach((p,i)=>{
      const x=r1(slots[i]);tk[p.id]={x,y:r1(hAt(T,x)),hp:100,a:1};sc[p.id]={d:0,s:0,k:0};
      aim[p.id]={a:x<50?55:125,pw:62};priv[p.id]={a:aim[p.id].a,pw:aim[p.id].pw};
    });
    return{ter:T,tk,sc,v:1,st:'aim',wind:Math.round(rnd(-8,8)),aimEnd:AIM1+0,flyEnd:0,lk:{},_aim:aim,_priv:priv};
  },
  begin(H,S){S.t=0;S.aimEnd=AIM1;},
  tick(H,S,dt){
    if(S.over)return;
    for(const p of H.players){const k=S.tk[p.id];if(p.aw&&k&&k.a){k.a=0;k.hp=0;}}
    const alive=H.players.filter(p=>S.tk[p.id].a);
    if(alive.length<=1&&S.st==='aim'){return endGame(S);}
    if(S.st==='aim'){
      if(S.t>=S.aimEnd||alive.every(p=>S.lk[p.id]))resolve(H,S);
    }else if(S.st==='fly'&&S.t>=S.flyEnd){
      const al=H.players.filter(p=>S.tk[p.id].a);
      if(S.v>=VOLLEYS||al.length<=1)return endGame(S);
      S.v++;S.st='aim';S.aimEnd=S.t+AIM;S.lk={};
      let w=Math.round(rnd(-9,9));if(Math.abs(w)<1)w=rnd(0,1)<.5?-2:2;S.wind=w;
    }
  },
  act(H,S,pid,m){
    if(m.k!=='aim'||S.over||S.st!=='aim')return;
    const k=S.tk[pid];if(!k||!k.a||S.lk[pid])return;
    const a=+m.a,pw=+m.p;if(!isFinite(a)||!isFinite(pw))return;
    S._aim[pid]={a:clamp(a,0,180),pw:clamp(pw,5,100),tc:1};
    if(m.l)S.lk[pid]=1;
  },
  val(S,id){const c=S.sc[id];return c?Math.round(c.d+25*c.k-c.s):null;},

  // ================= CLIENT =================
  mk(c){
    let wrap,main,cvh,g,ctl,hudV,hudW,hudL,tbar,aNum,pNum,lockB,flipB,msg,hint;
    let S=null,pend=null,anim=null,dT=null,dTank={},traces=null,stars=[];
    let aimA=55,aimP=62,locked=false,aimInit=false,lastVol=0,sendT=0,dirty=false,lastSent=0,tm=0,shakeT=0,lastTick=-1;
    let drag=null,parts=[],floats=[],rings=[],streaks=[],lastTs=performance.now(),started=false,hintGone=false,rep=0,repD=0;
    const L={s:1,ox:0,oy:0};
    const alive=()=>{const k=S&&S.tk[c.me()];return!!(k&&k.a);};
    function style(){
      if(document.getElementById('st-artillery'))return;const s=document.createElement('style');s.id='st-artillery';
      s.textContent=`
.art-wrap{position:absolute;inset:0;display:flex;flex-direction:column;background:#0b0b17}
.art-main{position:relative;flex:1;min-height:0;touch-action:none;overflow:hidden}
.art-hud{position:absolute;left:6px;right:6px;top:8px;display:flex;gap:6px;align-items:center;pointer-events:none}
.art-chip{background:#0b0b17cc;border-radius:12px;padding:5px 10px;font-weight:900;font-size:14px;display:flex;align-items:center;gap:6px;white-space:nowrap}
.art-chip.w b{font-size:18px}
.art-lks{display:flex;gap:4px;margin-left:auto}
.art-lks span{width:20px;height:20px;border-radius:50%;border:2px solid var(--c);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#000}
.art-lks span.on{background:var(--c)}.art-lks span.x{opacity:.25}
.art-tb{position:absolute;left:0;right:0;top:0;height:4px;background:#ffffff14;pointer-events:none}
.art-tb i{display:block;height:100%;width:100%;background:#52ff7a}
.art-tb.low i{background:#ff3d81}
.art-hint{position:absolute;left:10px;right:10px;top:46%;text-align:center;pointer-events:none;font-weight:900;font-size:19px;text-shadow:0 2px 8px #000;line-height:1.25}
.art-hint small{display:block;font-size:13px;font-weight:700;color:#cfcff0;margin-top:4px}
.art-msg{position:absolute;left:0;right:0;bottom:6px;text-align:center;pointer-events:none;font-weight:800;font-size:13px;color:#cfcff0;text-shadow:0 1px 4px #000}
.art-ctl{flex:0 0 auto;padding:7px 10px 10px;background:#12122c;border-top:2px solid #2d2d62;display:flex;flex-direction:column;gap:7px}
.art-row{display:flex;gap:8px}
.art-grp{flex:1;display:flex;align-items:center;gap:4px;background:#1d1d40;border-radius:14px;padding:3px}
.art-grp .nm{flex:1;text-align:center;line-height:1}
.art-grp .nm small{display:block;font-size:10px;font-weight:800;color:#8d8db8;letter-spacing:1px;margin-bottom:2px}
.art-grp .nm b{font-size:22px;font-weight:900;font-variant-numeric:tabular-nums}
.art-b{width:48px;height:48px;flex:0 0 48px;border:0;border-radius:12px;background:#34346d;color:#fff;font-size:24px;font-weight:900;touch-action:none;display:flex;align-items:center;justify-content:center}
.art-b:active{background:#4a4a96}
.art-grp{min-width:0}
@media (max-width:360px){.art-b{width:42px;flex:0 0 42px}.art-grp .nm b{font-size:19px}}
.art-lock{flex:1;height:54px;border:0;border-radius:16px;font-size:21px;font-weight:900;background:linear-gradient(180deg,#52ff7a,#22c25a);color:#052a12;box-shadow:0 5px 0 #138a3a;touch-action:none}
.art-lock:active{transform:translateY(3px);box-shadow:0 2px 0 #138a3a}
.art-lock.done{background:#2a2a58;color:#8d8db8;box-shadow:0 5px 0 #14142f;pointer-events:none}
.art-flip{width:62px;height:54px;border:0;border-radius:16px;background:#34346d;color:#fff;font-size:11px;font-weight:900;touch-action:none;line-height:1.1}
.art-flip b{display:block;font-size:20px}
`;document.head.append(s);
    }
    function layout(){const W=cvh.W,H=cvh.H;L.s=Math.min(W/WW,H/WH);L.ox=(W-WW*L.s)/2;L.oy=H-WH*L.s;}
    const X=x=>L.ox+x*L.s,Y=y=>L.oy+(WH-y)*L.s;
    function setTerrain(T){dT=T.slice();}
    function syncS(s){
      if(!s||!s.ter)return;setTerrain(s.ter);
      for(const id in s.tk){const k=s.tk[id];dTank[id]=Object.assign({},k,{dy:k.y,hp:k.hp,show:k.hp});}
    }
    function stubPts(){
      const r=aimA*Math.PI/180,v=aimP*VK,tk=S&&S.tk[c.me()];if(!tk)return[];
      const pts=[];let x=tk.x+Math.cos(r)*4.6,y=(dTank[c.me()]?dTank[c.me()].dy:tk.y)+1.6+Math.sin(r)*4.6,vx=Math.cos(r)*v,vy=Math.sin(r)*v;
      const T=Math.min(.45,22/Math.max(v,1));
      for(let t=0;t<=T;t+=.03){pts.push([x,y]);x+=vx*.03;y+=vy*.03-.5*G*.0009;vy-=G*.03;}
      return pts;
    }
    function sendAim(l){c.act({k:'aim',a:+aimA.toFixed(1),p:+aimP.toFixed(1),l:l?1:0});lastSent=performance.now();dirty=false;}
    function setAim(a,p,send){
      aimA=clamp(a,0,180);aimP=clamp(p,5,100);hintGone=true;dirty=true;aNum.textContent=Math.round(aimA<=90?aimA:180-aimA)+'°';pNum.textContent=Math.round(aimP);
      flipB.querySelector('b').textContent=aimA<=90?'➡':'⬅';
    }
    function lock(){
      if(locked||!alive()||!S||S.st!=='aim'||c.R().ph!=='play')return;
      locked=true;sendAim(true);sfx.good();buzz(20);refresh();
    }
    function refresh(){
      const a=alive(),on=a&&S&&S.st==='aim'&&!locked;
      lockB.className='art-lock'+((!a||!S||S.st!=='aim'||locked)?' done':'');
      lockB.textContent=!a?'💀 You are out':locked?'LOCKED ✓ waiting…':(S&&S.st==='fly'?'💥 …':'🔒 LOCK IN');
      ctl.style.opacity=on?'1':'.75';
    }
    function bindHold(btn,fn){
      const stop=()=>{clearTimeout(rep);clearInterval(repD);};
      btn.addEventListener('pointerdown',e=>{e.preventDefault();if(locked||!alive()||!S||S.st!=='aim')return;fn();stop();rep=setTimeout(()=>{repD=setInterval(fn,70);},320);});
      for(const ev of['pointerup','pointercancel','pointerleave'])btn.addEventListener(ev,()=>{stop();});
    }
    function startAnim(m){
      anim={t0:performance.now(),m,done:0,fin:false,lastIdx:{}};
      parts.length=0;traces=null;shakeT=0;
      for(const sh of m.shells)beep(260,.5,'sawtooth',.05,500);
      msg.textContent='';
    }
    function applyEx(e){
      carveLocal(e);
      const T=dTank;
      rings.push({x:e.x,y:e.y,t:0,r:CR*1.7,col:'#ffd23f'});
      for(let i=0;i<22;i++){const a=Math.random()*6.283,v=rnd(8,34);parts.push({x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v+10,l:.5+Math.random()*.6,t:0,col:Math.random()<.5?'#ffb13d':'#ff5a3d',g:1});}
      for(let i=0;i<10;i++){const a=Math.random()*6.283,v=rnd(4,16);parts.push({x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:.8+Math.random()*.6,t:0,col:'#6b5a4a',g:1});}
      sfx.boom();
      let big=false;
      for(const id in e.dm){const t=T[id];if(!t)continue;t.hp=Math.max(0,t.hp-e.dm[id]);floats.push({x:t.x,y:t.dy+7,txt:'−'+e.dm[id],col:'#ff6b6b',t:0});if(+id===c.me()){big=true;}}
      for(const id of e.k){const t=T[id];if(t){t.a=0;t.hp=0;floats.push({x:t.x,y:t.dy+13,txt:'💀 KO',col:'#fff',t:0});for(let i=0;i<30;i++){const a=Math.random()*6.283,v=rnd(10,40);parts.push({x:t.x,y:t.dy+2,vx:Math.cos(a)*v,vy:Math.sin(a)*v+14,l:.8+Math.random(),t:0,col:c.col(+id),g:1});}}}
      if(big){shakeT=.5;buzz([60,30,90]);}
      for(const id in e.f){const t=T[id];if(t)t.ty=e.f[id][1];}
      // fall to the new ground
      for(const id in T){const t=T[id];if(t.a){const ny=hAt(dT,t.x);if(ny<t.dy-.01)t.ty=ny;}}
    }
    function carveLocal(e){carve(dT,e.x,e.y,CR);}
    function finishAnim(){
      traces=anim.m.shells;anim=null;
      if(pend){syncS(pend);pend=null;}else if(S)syncS(S);
      refresh();
    }

    function draw(dt){
      const W=cvh.W,H=cvh.H;layout();g.setTransform(cvh.dpr,0,0,cvh.dpr,0,0);
      const s=L.s,now=performance.now();
      // sky
      const sg=g.createLinearGradient(0,0,0,H);sg.addColorStop(0,'#0b0b17');sg.addColorStop(1,'#24245a');g.fillStyle=sg;g.fillRect(0,0,W,H);
      g.fillStyle='#ffffff';for(const st of stars){g.globalAlpha=st[2];g.fillRect(X(st[0]),Y(st[1]),1.6,1.6);}g.globalAlpha=1;
      // wind streaks
      const w=S?S.wind:0;
      if(Math.random()<.4){streaks.push({x:w>=0?-5:105,y:rnd(60,140),l:rnd(3,8)});}
      g.strokeStyle='#ffffff30';g.lineWidth=1.2;
      for(const k of streaks){k.x+=w*3.2*dt+(w>=0?4:-4)*dt;g.beginPath();g.moveTo(X(k.x),Y(k.y));g.lineTo(X(k.x+k.l*Math.sign(w||1)),Y(k.y));g.stroke();}
      streaks=streaks.filter(k=>k.x>-12&&k.x<112);
      let sx=0,sy=0;if(shakeT>0){shakeT-=dt;sx=(Math.random()-.5)*7;sy=(Math.random()-.5)*7;}
      g.save();g.translate(sx,sy);
      if(!dT){g.restore();return;}
      // terrain
      g.beginPath();g.moveTo(X(0),H+5);for(let i=0;i<N;i++)g.lineTo(X(i*DX),Y(dT[i]));g.lineTo(X(WW),H+5);g.closePath();
      const tg=g.createLinearGradient(0,Y(65),0,Y(0));tg.addColorStop(0,'#3f8a4a');tg.addColorStop(.25,'#2b5e37');tg.addColorStop(1,'#14202a');
      g.fillStyle=tg;g.fill();g.strokeStyle='#7fe08a';g.lineWidth=2;g.beginPath();for(let i=0;i<N;i++){const px=X(i*DX),py=Y(dT[i]);i?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();
      // previous volley traces
      const me=c.me();
      if(traces&&!anim){for(const sh of traces){const mine=sh.p===me;g.strokeStyle=c.col(sh.p);g.globalAlpha=mine?.85:.35;g.lineWidth=mine?2:1.4;g.setLineDash([2,5]);g.beginPath();for(let i=0;i<sh.path.length;i+=2){const px=X(sh.path[i]),py=Y(sh.path[i+1]);i?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();g.setLineDash([]);
        if(mine&&sh.path.length){const ex=sh.path[sh.path.length-2],ey=sh.path[sh.path.length-1];g.globalAlpha=.9;g.fillStyle=c.col(me);g.beginPath();g.arc(X(ex),Y(ey),3,0,6.283);g.fill();}}g.globalAlpha=1;}
      // tanks
      const ids=Object.keys(dTank);
      for(const id of ids){
        const t=dTank[id];if(!t)continue;
        const gy=hAt(dT,t.x);if(t.ty!=null){t.dy+=(t.ty-t.dy)*Math.min(1,dt*7);if(Math.abs(t.ty-t.dy)<.05){t.dy=t.ty;t.ty=null;}}else t.dy+=(gy-t.dy)*Math.min(1,dt*10);
        drawTank(t,+id,now);
      }
      // aim stub + drag band
      if(alive()&&S&&S.st==='aim'&&!anim&&dTank[me]){
        const pts=stubPts();g.strokeStyle=c.col(me);g.lineWidth=4.5;g.lineCap='round';g.shadowColor=c.col(me);g.shadowBlur=8;for(let i=1;i<pts.length;i++){g.globalAlpha=1-i/pts.length*.85;g.beginPath();g.moveTo(X(pts[i-1][0]),Y(pts[i-1][1]));g.lineTo(X(pts[i][0]),Y(pts[i][1]));g.stroke();}g.globalAlpha=1;g.shadowBlur=0;
        if(drag){g.strokeStyle='#ffffff88';g.lineWidth=2;g.beginPath();g.moveTo(drag.ax,drag.ay);g.lineTo(drag.x,drag.y);g.stroke();g.fillStyle='#ffffff55';g.beginPath();g.arc(drag.ax,drag.ay,9,0,6.283);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(drag.x,drag.y,12,0,6.283);g.fill();}
      }
      // volley animation
      if(anim){
        const at=(now-anim.t0)/1000,m=anim.m;
        for(const e of m.ex){if(!e.ap&&at>=e.t){e.ap=1;applyEx(e);}}
        for(const sh of m.shells){
          const col=c.col(sh.p),f=at/.05,i=Math.floor(f),n=sh.path.length/2;
          const upto=Math.min(n-1,i);
          g.strokeStyle=col;g.lineWidth=2.4;g.globalAlpha=.8;g.beginPath();for(let k=0;k<=upto;k++){const px=X(sh.path[k*2]),py=Y(sh.path[k*2+1]);k?g.lineTo(px,py):g.moveTo(px,py);}
          if(at<sh.te&&i<n-1){const fr=f-i,px=X(sh.path[i*2]+(sh.path[i*2+2]-sh.path[i*2])*fr),py=Y(sh.path[i*2+1]+(sh.path[i*2+3]-sh.path[i*2+1])*fr);g.lineTo(px,py);g.stroke();g.globalAlpha=1;g.fillStyle='#fff';g.shadowColor=col;g.shadowBlur=12;g.beginPath();g.arc(px,py,3.6,0,6.283);g.fill();g.shadowBlur=0;}
          else{g.stroke();g.globalAlpha=1;}
        }
        if(at>=m.D&&!anim.fin){anim.fin=true;finishAnim();}
      }
      // fx
      for(const r of rings){r.t+=dt;const k=r.t/.45;if(k>=1)continue;g.globalAlpha=1-k;g.strokeStyle=r.col;g.lineWidth=4*(1-k)+1;g.beginPath();g.arc(X(r.x),Y(r.y),r.r*s*(.2+.8*k),0,6.283);g.stroke();g.fillStyle='#fff6d0';if(k<.25){g.globalAlpha=.8*(1-k*4);g.beginPath();g.arc(X(r.x),Y(r.y),CR*s*(.5+k*3),0,6.283);g.fill();}}
      g.globalAlpha=1;rings=rings.filter(r=>r.t<.45);
      for(const p of parts){p.t+=dt;p.vy-=40*dt*p.g;p.x+=p.vx*dt;p.y+=p.vy*dt;g.globalAlpha=Math.max(0,1-p.t/p.l);g.fillStyle=p.col;g.fillRect(X(p.x)-2,Y(p.y)-2,4,4);}
      g.globalAlpha=1;parts=parts.filter(p=>p.t<p.l);
      for(const f of floats){f.t+=dt;g.globalAlpha=Math.max(0,1-f.t/1.6);g.font='900 18px system-ui';g.textAlign='center';g.strokeStyle='#000';g.lineWidth=4;g.fillStyle=f.col;g.strokeText(f.txt,X(f.x),Y(f.y)-f.t*22);g.fillText(f.txt,X(f.x),Y(f.y)-f.t*22);}
      g.globalAlpha=1;floats=floats.filter(f=>f.t<1.6);
      g.restore();
    }
    function drawTank(t,id,now){
      const s=L.s,col=c.col(id),px=X(t.x),py=Y(t.dy),p=c.pl(id);
      const slope=Math.atan2(hAt(dT,t.x-2)-hAt(dT,t.x+2),4);
      g.save();g.translate(px,py);g.rotate(slope*.8);
      if(!t.a){g.fillStyle='#444';g.fillRect(-3.4*s,-1.8*s,6.8*s,1.8*s);g.fillStyle='#222';g.beginPath();g.arc(0,-1.8*s,1.6*s,Math.PI,0);g.fill();
        g.restore();g.font=(2.8*s)+'px system-ui';g.textAlign='center';g.fillText('💀',px,py-4*s);return;}
      // barrel
      let ang=null;const me=id===c.me()&&alive()&&S&&S.st==='aim'&&!anim;
      if(me)ang=aimA;else if(anim){const sh=anim.m.shells.find(q=>q.p===id);if(sh)ang=sh.a;}
      if(ang==null)ang=(t.x<50?60:120);
      g.save();g.translate(0,-2.1*s);g.rotate(-(ang*Math.PI/180)-slope*.8);g.fillStyle='#e4e6f8';g.strokeStyle='#0b0b17';g.lineWidth=1;g.fillRect(0,-.55*s,4.8*s,1.1*s);g.strokeRect(0,-.55*s,4.8*s,1.1*s);g.restore();
      g.fillStyle=col;g.strokeStyle='#0b0b17';g.lineWidth=1.5;
      g.beginPath();g.roundRect?g.roundRect(-3.5*s,-2.2*s,7*s,2.2*s,.9*s):g.rect(-3.5*s,-2.2*s,7*s,2.2*s);g.fill();g.stroke();
      g.beginPath();g.arc(0,-2.2*s,1.9*s,Math.PI,0);g.fill();g.stroke();
      g.fillStyle='#0b0b17';for(let i=-2;i<=2;i+=2){g.beginPath();g.arc(i*1.2*s,-.5*s,.55*s,0,6.283);g.fill();}
      g.restore();
      // hp bar + name
      const bw=8*s,bx=px-bw/2,by=py-8.6*s;
      g.fillStyle='#000a';g.fillRect(bx-1,by-1,bw+2,6);g.fillStyle=t.hp>50?'#52ff7a':t.hp>25?'#ffd23f':'#ff3d81';g.fillRect(bx,by,bw*clamp(t.hp/100,0,1),4);
      g.fillStyle=col;g.font='900 11px system-ui';g.textAlign='center';g.fillText((p?p.n:'')+(id===c.me()?' ★':''),px,by-4);
      if(id===c.me()){g.fillStyle=col;g.beginPath();g.moveTo(px,by-20);g.lineTo(px-4,by-27);g.lineTo(px+4,by-27);g.closePath();g.fill();}
    }
    function hud(){
      if(!S)return;
      hudV.textContent='VOLLEY '+Math.min(S.v,VOLLEYS)+'/'+VOLLEYS;
      const w=S.wind;hudW.innerHTML='';const a=document.createElement('span');a.textContent=w===0?'·':(w>0?'➡'.repeat(Math.min(3,1+Math.floor(Math.abs(w)/4))):'⬅'.repeat(Math.min(3,1+Math.floor(Math.abs(w)/4))));
      const b=document.createElement('b');b.textContent=Math.abs(w);hudW.append('💨 ',a,b);
      let sig='';for(const p of c.R().pl)sig+=p.id+(S.tk[p.id]&&S.tk[p.id].a?(S.lk[p.id]?'L':'a'):'x');
      if(hudL.dataset.s!==sig){hudL.dataset.s=sig;hudL.innerHTML='';for(const p of c.R().pl){const k=S.tk[p.id],d=document.createElement('span');d.style.setProperty('--c',c.col(p.id));d.className=(!k||!k.a)?'x':S.lk[p.id]?'on':'';d.textContent=S.lk[p.id]?'✓':'';hudL.append(d);}}
    }
    return{
      dbg:{aim:()=>({a:aimA,p:aimP,locked}),get main(){return main;},get lock(){return lockB;},anim:()=>!!anim,dT:()=>dT,tanks:()=>dTank,traces:()=>traces,L},
      mount(root){
        style();for(let i=0;i<60;i++)stars.push([rnd(0,100),rnd(40,140),rnd(.2,.8)]);
        wrap=E('div','art-wrap');main=E('div','art-main');ctl=E('div','art-ctl');wrap.append(main,ctl);root.append(wrap);
        cvh=mkCanvas(main);g=cvh.g;cvh.cv.style.pointerEvents='none';
        const hudEl=E('div','art-hud');hudV=E('div','art-chip');hudW=E('div','art-chip w');hudL=E('div','art-lks');hudEl.append(hudV,hudW,hudL);
        tbar=E('div','art-tb','<i></i>');hint=E('div','art-hint','Drag anywhere to aim<small>pull back like a slingshot: farther = more power</small>');msg=E('div','art-msg');
        main.append(tbar,hudEl,hint,msg);
        // controls
        const row1=E('div','art-row'),row2=E('div','art-row');
        const gA=E('div','art-grp','<button class="art-b">▼</button><div class="nm"><small>ANGLE</small><b>55°</b></div><button class="art-b">▲</button>');
        const gP=E('div','art-grp','<button class="art-b">−</button><div class="nm"><small>POWER</small><b>62</b></div><button class="art-b">+</button>');
        aNum=gA.querySelector('b');pNum=gP.querySelector('b');
        const eA=gA.querySelectorAll('button'),eP=gP.querySelectorAll('button');
        const elev=d=>{const f=aimA<=90?1:-1;let e=(aimA<=90?aimA:180-aimA)+d;e=clamp(e,0,90);setAim(f>0?e:180-e,aimP);};
        bindHold(eA[0],()=>elev(-1));bindHold(eA[1],()=>elev(1));
        bindHold(eP[0],()=>setAim(aimA,aimP-1));bindHold(eP[1],()=>setAim(aimA,aimP+1));
        row1.append(gA,gP);
        flipB=E('button','art-flip','<b>➡</b>FLIP');lockB=E('button','art-lock','🔒 LOCK IN');
        flipB.addEventListener('pointerdown',e=>{e.preventDefault();if(locked||!alive()||!S||S.st!=='aim')return;setAim(180-aimA,aimP);sfx.tap();});
        lockB.addEventListener('pointerdown',e=>{e.preventDefault();lock();});
        row2.append(flipB,lockB);ctl.append(row1,row2);
        // slingshot drag on the battlefield
        main.addEventListener('pointerdown',e=>{
          if(drag||locked||!alive()||!S||S.st!=='aim'||c.R().ph!=='play'||anim)return;
          try{main.setPointerCapture(e.pointerId);}catch(x){}
          const r=main.getBoundingClientRect();drag={id:e.pointerId,ax:e.clientX-r.left,ay:e.clientY-r.top,x:e.clientX-r.left,y:e.clientY-r.top};e.preventDefault();
        });
        main.addEventListener('pointermove',e=>{
          if(!drag||e.pointerId!==drag.id)return;const r=main.getBoundingClientRect();drag.x=e.clientX-r.left;drag.y=e.clientY-r.top;
          const dx=drag.ax-drag.x,dy=drag.y-drag.ay,len=Math.hypot(dx,dy);
          if(len<10)return;
          let a=Math.atan2(dy,dx)*180/Math.PI;if(dy<0)a=dx>=0?0:180;
          setAim(a,len/130*100);
        });
        const up=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;if(dirty)sendAim(false);};
        main.addEventListener('pointerup',up);main.addEventListener('pointercancel',up);
        layout();
      },
      start(){started=true;lastTs=performance.now();tm=setInterval(()=>{if(dirty&&!locked&&c.R().ph==='play'&&performance.now()-lastSent>110)sendAim(false);},60);},
      update(S_,R){
        const first=!S;S=S_;
        if(!aimInit){const p=c.priv();if(p&&p.a!=null){aimInit=true;setAim(p.a,p.pw);dirty=false;}}
        if(first||(!anim&&!dT)){syncS(S);}
        if(S.st==='aim'&&S.v!==lastVol&&!anim){lastVol=S.v;locked=false;syncS(S);if(S.v>1)hint.style.display='none';}
        else if(anim)pend=S;
        else if(S.st==='aim'&&!locked&&!lastVol){lastVol=S.v;}
        if(S.st==='aim'&&!anim&&S.lk[c.me()]&&!locked)locked=true;
        if(hudV)hud();refresh();
        if(S.over&&!anim&&dT){msg.textContent='';}
        if(R.ph!=='play')draw(.016);
      },
      frame(rem){
        const now=performance.now(),dt=Math.min(.05,(now-lastTs)/1000);lastTs=now;
        draw(dt);
        if(S&&c.R().ph==='play'){
          const left=S.st==='aim'?clamp(S.aimEnd-c.t(),0,AIM1):0,tot=S.v===1?AIM1:AIM;
          tbar.firstChild.style.width=(S.st==='aim'?clamp(left/tot,0,1)*100:0)+'%';tbar.className='art-tb'+(left<3&&S.st==='aim'?' low':'');
          if(S.st==='aim'&&alive()&&!locked&&left<3.2&&Math.ceil(left)!==lastTick){lastTick=Math.ceil(left);sfx.tick();}
          if(S.st==='aim'&&!anim){const ls=Object.keys(S.lk).length,al=Object.values(S.tk).filter(k=>k.a).length;
            msg.textContent=!alive()?'💀 Out of the fight — watching the rest':locked?('Locked in. Waiting for '+(al-ls)+' more…'):(ls?ls+'/'+al+' locked in':'');}
          if(S.st==='fly'&&!anim)msg.textContent='🔥 FIRE!';
          if(!hintGone&&S.v===1)hint.style.display='block';else if(hintGone)hint.style.display='none';
        }
      },
      event(m){if(m&&m.e==='vol'){if(anim)finishAnim();startAnim(m);}},
      stop(){clearInterval(tm);clearTimeout(rep);clearInterval(repD);}
    };
  }
};

// ---- host helpers ----
function resolve(H,S){
  const tanks=H.players.map(p=>({p:p.id,x:S.tk[p.id].x,y:S.tk[p.id].y,hp:S.tk[p.id].hp,a:S.tk[p.id].a}));
  const shots=tanks.filter(t=>t.a&&S._aim[t.p].tc).map(t=>({p:t.p,a:S._aim[t.p].a,pw:S._aim[t.p].pw}));
  const r=simulate(S.ter,tanks,S.wind,shots);
  S.ter=r.T;
  for(const t of r.tanks){const k=S.tk[t.p];k.hp=t.hp;k.a=t.a;k.y=r1(t.y);}
  for(const p of H.players){const c=S.sc[p.id];c.d+=(r.dealt[p.id]||0);c.s+=(r.selfd[p.id]||0);c.k+=(r.kills[p.id]||0);S._priv[p.id]={a:S._aim[p.id].a,pw:S._aim[p.id].pw};}
  let D=0;for(const e of r.ex)D=Math.max(D,e.t);for(const s of r.shells)D=Math.max(D,s.te);
  D=Math.min(8,D+1.7);
  H.emit({e:'vol',v:S.v,wind:S.wind,shells:r.shells,ex:r.ex,D:r2(D)});
  S.st='fly';S.flyEnd=S.t+D+.4;S.lk={};
}
function endGame(S){S.over=true;S.hold=2.5;S.st='fly';}
})();
