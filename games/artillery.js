// ARTILLERY (real-time) — your barrel sweeps; HOLD to freeze it and charge power, RELEASE to fire. Everyone shoots whenever they like.
(function(){
'use strict';
const WW=100,WH=140,DX=.5,N=201;               // world size, terrain columns
const G=40,VK=.62;                              // gravity, power -> shell speed
const TR=3.6,CR=6,BR=8,MAXD=33;                 // tank hit radius, crater radius, blast radius, max (direct hit) damage
const RELOAD=.9,CHARGE=1.4,SWEEP_T=2.1,ARC=75;  // reload (s), 0->100% power time (s), sweep period (s), sweep half-arc (deg)
const LEN=80,HZ0=38;                            // round length; meteors start at HZ0
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100,q4=v=>Math.round(v*4)/4;

const hAt=(T,x)=>{x=clamp(x,0,WW);const f=x/DX,i=Math.floor(f);if(i>=N-1)return T[N-1];return T[i]+(T[i+1]-T[i])*(f-i);};
function carve(T,cx,cy,r){
  const i0=Math.max(0,Math.floor((cx-r)/DX)),i1=Math.min(N-1,Math.ceil((cx+r)/DX));
  for(let i=i0;i<=i1;i++){
    const dx=i*DX-cx;if(Math.abs(dx)>=r)continue;const s=Math.sqrt(r*r-dx*dx),h=T[i];
    if(h<=cy-s)continue;
    T[i]=q4(h<=cy+s?Math.max(0,cy-s):Math.max(0,h-2*s));
  }
}
const enc=T=>{let s='';for(let i=0;i<N;i++)s+=String.fromCharCode(48+clamp(Math.round(T[i]*4),0,255));return s;};
const dec=s=>{const T=new Array(N);for(let i=0;i<N;i++)T[i]=((s.charCodeAt(i)||48)-48)/4;return T;};
function genTerrain(slots){
  const ph=[rnd(0,6.28),rnd(0,6.28),rnd(0,6.28)],T=new Array(N),tg=slots.map(()=>rnd(46,58));
  for(let i=0;i<N;i++){
    const x=i*DX;let h=36+9*Math.sin(x*.07+ph[0])+6*Math.sin(x*.15+ph[1])+3*Math.sin(x*.33+ph[2]);
    slots.forEach((sx,k)=>{const d=Math.abs(x-sx);if(d<15){const w=d<4?1:(1-(d-4)/11);const e=w*w*(3-2*w);h=h+(tg[k]-h)*e;}});
    T[i]=q4(clamp(h,16,63));
  }
  return T;
}
// pure single-shell flight (used by the test bots' solver and previews): returns impact point or null if it leaves the map
function flight(T,wind,x0,y0,a,pw,tanks,self){
  const r=a*Math.PI/180,v=pw*VK;let x=x0+Math.cos(r)*4.6,y=y0+1.6+Math.sin(r)*4.6,vx=Math.cos(r)*v,vy=Math.sin(r)*v,age=0;
  const dt=1/120;
  for(let i=0;i<900;i++){
    vx+=wind*dt;vy-=G*dt;x+=vx*dt;y+=vy*dt;age+=dt;
    if(x<-6||x>WW+6||y<-12)return null;
    if(tanks)for(const k of tanks){if(!k.a||(k.p===self&&age<.3))continue;if(Math.hypot(x-k.x,y-(k.y+1.5))<TR)return{x,y,t:age};}
    if(x>=0&&x<=WW&&y<=hAt(T,x))return{x,y,t:age};
  }
  return null;
}
const sweepAng=(t,ph)=>90+ARC*Math.sin(2*Math.PI*t/SWEEP_T+ph);
const powAt=h=>{const u=(h/CHARGE)%2;return 100*(u<1?u:2-u);};

GAMES.artillery={
  name:'Artillery',emoji:'🎯',tag:'Real-time tank duel. Hold, charge, release, boom.',
  min:2,max:4,
  rules:[
    ['↔️','Your tank\'s barrel sweeps left and right on its own.'],
    ['👆','HOLD anywhere to stop the barrel at that angle. Keep holding and the POWER bar fills up.'],
    ['💥','RELEASE to fire: the longer you held, the harder the shot. Reload takes about 1 s, then fire as often as you like. Everyone shoots at once.'],
    ['💨','Wind pushes shells sideways and changes over time. A ✕ marks where your last shot landed, so adjust. Shells carve craters; tanks fall when the hill goes. Late on, meteors rain down!'],
    ['🏆','A wrecked tank rebuilds after 5 s. Score = damage you deal (+25 per kill) minus damage you do to yourself. A direct hit is about a third of a tank.']],
  ctrl:'One finger, anywhere on the screen: hold to freeze the aim, keep holding to charge, release to fire.',
  win:'Damage dealt to others + 25 per kill − damage to yourself.',
  dur:86,hz:20,better:'high',fmt:v=>v+' pts',
  dbg:{flight,hAt,carve,dec,enc,sweepAng,powAt,N,WW,WH,VK,SWEEP_T,CHARGE},

  // ================= HOST =================
  init(H){
    const n=H.players.length;
    const base={2:[16,84],3:[14,50,86],4:[12,37,63,88]}[n]||[16,84];
    const slots=shuffle(base.map(x=>clamp(x+rnd(-3,3),8,92)));
    const T=genTerrain(slots),tk={},sc={},ph={};
    H.players.forEach((p,i)=>{const x=r1(slots[i]);tk[p.id]={x,y:hAt(T,x),hp:100,a:1,h:null,cd:0,fa:null,rt:0,inv:0};sc[p.id]={d:0,s:0,k:0};ph[p.id]=r2(rnd(0,6.28));});
    return{ter:enc(T),tv:1,tk,sc,ph,wind:Math.round(rnd(-6,6)),sh:[],hz:[],_T:T,_sh:[],_nid:1,_wt:0,_wn:11,_hn:HZ0,_hz:[]};
  },
  tick(H,S,dt){
    if(S.over)return;
    for(const p of H.players){
      const k=S.tk[p.id];if(!k)continue;
      if(p.aw){if(k.a){k.a=0;k.hp=0;k.h=null;}k.rt=0;continue;}
      if(!k.a&&k.rt&&S.t>=k.rt&&S.t<LEN-5){   // wrecked tanks rebuild after a few seconds (60 HP, brief shield)
        const x=k.x;k.a=1;k.hp=60;k.y=hAt(S._T,x);k.h=null;k.cd=r2(S.t+.8);k.inv=r2(S.t+2.2);k.rt=0;H.emit({e:'rs',p:p.id});
      }
    }
    // wind drifts toward a new target every ~12 s
    if(S.t>=S._wn){S._wt=Math.round(rnd(-9,9));S._wn=S.t+rnd(10,14);}
    S.wind=r2(S.wind+clamp(S._wt-S.wind,-1.5*dt,1.5*dt));
    // shells (6 sub-steps of 1/120 s per 50 ms tick)
    const n=Math.max(1,Math.round(dt*120)),h=dt/n;
    for(const s of S._sh.slice()){
      if(!S._sh.includes(s))continue;
      for(let i=0;i<n&&s.live;i++){
        s.vx+=S.wind*h;s.vy-=G*h;s.x+=s.vx*h;s.y+=s.vy*h;s.age+=h;
        if(s.x<-6||s.x>WW+6||s.y<-12||s.age>12){s.live=false;H.emit({e:'x',by:s.p,x:r1(clamp(s.x,0,WW)),y:r1(clamp(hAt(S._T,clamp(s.x,0,WW)),0,WH)),out:1});break;}
        let hit=false;
        for(const pid in S.tk){const k=S.tk[pid];if(!k.a)continue;if(+pid===s.p&&s.age<.3)continue;if(Math.hypot(s.x-k.x,s.y-(k.y+1.5))<TR){hit=true;break;}}
        if(!hit&&s.x>=0&&s.x<=WW&&s.y<=hAt(S._T,s.x))hit=true;
        if(hit){s.live=false;explode(H,S,s.x,s.y,s.p);}
      }
    }
    S._sh=S._sh.filter(s=>s.live);
    S.sh=S._sh.map(s=>[s.id,r1(s.x),r1(s.y),r1(s.vx),r1(s.vy),s.p]);
    // late-game meteor storm: nobody can turtle forever
    if(S.t>=S._hn){
      const alive=H.players.filter(p=>S.tk[p.id].a),tg=alive.length&&Math.random()<.75?S.tk[alive[Math.floor(Math.random()*alive.length)].id].x+rnd(-10,10):rnd(8,92);
      S._hz.push({x:r1(clamp(tg,5,95)),t:S.t+1.4});
      const u=clamp((S.t-HZ0)/(LEN-HZ0),0,1);S._hn=S.t+3.2-2.3*u;
    }
    for(const m of S._hz.slice())if(S.t>=m.t){S._hz.splice(S._hz.indexOf(m),1);explode(H,S,m.x,hAt(S._T,m.x),-1);}
    S.hz=S._hz.map(m=>[m.x,r2(m.t)]);
    if(S.t>=LEN||(!H.players.some(p=>!p.aw&&p.id!==undefined&&S.tk[p.id].a)&&!H.players.some(p=>!p.aw&&S.tk[p.id].rt))||H.players.filter(p=>!p.aw).length<=1){S.over=true;S.hold=2.5;}
  },
  act(H,S,pid,m){
    const k=S.tk[pid];if(!k||!k.a||S.over||!m)return;
    if(m.k==='hold'){const a=+m.a;if(isFinite(a))k.h=r1(clamp(a,0,180));}
    else if(m.k==='rel'){k.h=null;}
    else if(m.k==='fire'){
      const a=+m.a,pw=+m.p;if(!isFinite(a)||!isFinite(pw))return;
      if(S.t<k.cd-.15)return;if(S._sh.filter(s=>s.p===pid).length>=6)return;
      const A=clamp(a,0,180),P=clamp(pw,12,100),r=A*Math.PI/180,v=P*VK;
      S._sh.push({id:S._nid++,p:pid,x:k.x+Math.cos(r)*4.6,y:k.y+1.6+Math.sin(r)*4.6,vx:Math.cos(r)*v,vy:Math.sin(r)*v,age:0,live:true});
      k.cd=r2(S.t+RELOAD);k.h=null;k.fa=r1(A);
    }
  },
  val(S,id){const c=S.sc[id];return c?Math.round(c.d+25*c.k-c.s):null;},

  // ================= CLIENT =================
  mk(c){
    let wrap,touch,cvh,g,hud,hudW,hudS,hint,feedEl,cdW;
    let S=null,dT=null,tv=-1,dTank={},shells=new Map(),parts=[],floats=[],rings=[],streaks=[],stars=[],mark=null,hzSeen=false,shots=0;
    let sweepT=rnd(0,2),charge=null,activeId=null,reloadEnd=0,lastTs=performance.now(),started=false,shakeT=0,recoil=0,lastHeart=0,lastTick=0;
    const L={s:1,ox:0,oy:0,ph:92};
    const me=()=>c.me(),alive=()=>{const k=S&&S.tk[me()];return!!(k&&k.a);};
    const myPh=()=>S&&S.ph&&S.ph[me()]||0;
    const angNow=()=>charge?charge.ang:sweepAng(sweepT,myPh());
    const powNow=()=>charge?powAt((performance.now()-charge.t0)/1000):0;
    const reloading=()=>performance.now()<reloadEnd;
    function style(){
      if(document.getElementById('st-artillery'))return;const s=document.createElement('style');s.id='st-artillery';
      s.textContent=`
.art-wrap{position:absolute;inset:0;background:#0b0b17;touch-action:none;overflow:hidden}
.art-touch{position:absolute;inset:0;touch-action:none}
.art-hud{position:absolute;left:6px;right:6px;top:8px;display:flex;gap:6px;align-items:flex-start;pointer-events:none}
.art-chip{background:#0b0b17cc;border-radius:12px;padding:5px 10px;font-weight:900;font-size:14px;display:flex;align-items:center;gap:6px;white-space:nowrap}
.art-chip b{font-size:18px}
.art-sc{margin-left:auto;display:flex;flex-direction:column;gap:3px;align-items:flex-end}
.art-sc div{background:#0b0b17cc;border-right:4px solid var(--c);border-radius:8px;padding:2px 8px;font-size:12px;font-weight:900;font-variant-numeric:tabular-nums}
.art-feed{position:absolute;left:8px;top:46px;display:flex;flex-direction:column;gap:3px;pointer-events:none}
.art-feed div{font-size:12.5px;font-weight:800;background:#0b0b17cc;padding:3px 8px;border-radius:8px;border-left:4px solid var(--c);animation:artin .25s;width:fit-content}
@keyframes artin{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.art-hint{position:absolute;left:10px;right:10px;top:38%;text-align:center;pointer-events:none;font-weight:900;font-size:20px;text-shadow:0 2px 8px #000;line-height:1.3}
.art-hint small{display:block;font-size:14px;font-weight:700;color:#cfcff0;margin-top:4px}
.art-warn{position:absolute;left:10px;right:10px;top:30%;text-align:center;pointer-events:none;font-weight:900;font-size:24px;color:#ff6b6b;text-shadow:0 2px 10px #000;display:none;animation:artpulse .4s infinite alternate}
@keyframes artpulse{from{opacity:.6}to{opacity:1}}
`;document.head.append(s);
    }
    function layout(){const W=cvh.W,H=cvh.H,PH=88;L.s=Math.min(W/WW,(H-PH)/WH);L.ox=(W-WW*L.s)/2;L.oy=(H-PH)-WH*L.s;L.ph=PH;}
    const X=x=>L.ox+x*L.s,Y=y=>L.oy+(WH-y)*L.s;
    function addFeed(txt,col){const d=document.createElement('div');d.style.setProperty('--c',col);d.textContent=txt;feedEl.append(d);while(feedEl.children.length>3)feedEl.firstChild.remove();setTimeout(()=>d.remove(),3500);}
    function canAct(){return started&&c.R().ph==='play'&&S&&!S.over&&alive();}
    function press(e){
      if(activeId!==null)return;e.preventDefault();
      if(!canAct())return;
      if(reloading()){beep(180,.05,'square',.04);return;}
      activeId=e.pointerId;try{touch.setPointerCapture(e.pointerId);}catch(x){}
      charge={t0:performance.now(),ang:sweepAng(sweepT,myPh())};
      c.act({k:'hold',a:+charge.ang.toFixed(1)});buzz(8);beep(300,.05,'square',.05);hint.style.display='none';
    }
    function release(e,cancel){
      if(e.pointerId!==activeId)return;activeId=null;
      if(!charge)return;
      if(cancel||!canAct()){charge=null;c.act({k:'rel'});return;}
      const p=powNow(),a=charge.ang;charge=null;
      if(p<12){c.act({k:'rel'});beep(160,.06,'square',.05);return;}   // accidental tap: no shot, no reload
      c.act({k:'fire',a:+a.toFixed(1),p:+p.toFixed(1)});
      reloadEnd=performance.now()+RELOAD*1000;recoil=1;shots++;buzz(25);beep(220,.35,'sawtooth',.07,260);
    }
    function applyX(m){
      const T=dT;
      if(!m.out){carve(T,m.x,m.y,CR);tv++;}
      const mine=m.by===me();
      if(mine||m.out){}
      if(mine){mark={x:m.x,y:m.y,t:performance.now()};}
      if(m.out)return;
      rings.push({x:m.x,y:m.y,t:0,r:CR*1.8,col:m.by<0?'#ff6b6b':'#ffd23f'});
      const sz=m.by<0?1.3:1;
      for(let i=0;i<24*sz;i++){const a=Math.random()*6.283,v=rnd(8,36);parts.push({x:m.x,y:m.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v+10,l:.5+Math.random()*.6,t:0,col:Math.random()<.5?'#ffb13d':'#ff5a3d'});}
      for(let i=0;i<10;i++){const a=Math.random()*6.283,v=rnd(4,16);parts.push({x:m.x,y:m.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:.8+Math.random()*.6,t:0,col:'#6b5a4a'});}
      const mt=S&&S.tk[me()],dist=mt?Math.hypot(mt.x-m.x,mt.y-m.y):99;
      beep(Math.max(60,130-dist),.4,'sawtooth',clamp(.22-dist*.003,.03,.22),-70);
      if(dist<30)shakeT=Math.max(shakeT,clamp(.55-dist*.012,.1,.5));
      for(const id in (m.dm||{})){const t=dTank[id];if(!t)continue;floats.push({x:t.x,y:t.dy+8,txt:'−'+m.dm[id],col:+id===me()?'#ff3d81':'#ff9f9f',t:0});if(+id===me()){shakeT=.5;buzz([60,30,90]);}else if(mine)buzz(15);}
      for(const id of (m.k||[])){const t=dTank[id];if(!t)continue;const v=c.pl(+id),b=c.pl(m.by);
        addFeed(m.by<0?(v?v.n:'?')+' ☄️ got smashed':(b?b.n:'?')+(+id===m.by?' blew themself up':' 💥 '+(v?v.n:'?')),c.col(+id));
        for(let i=0;i<34;i++){const a=Math.random()*6.283,v2=rnd(10,44);parts.push({x:t.x,y:t.dy+2,vx:Math.cos(a)*v2,vy:Math.sin(a)*v2+14,l:.8+Math.random(),t:0,col:c.col(+id)});}
        if(+id===me()){shakeT=.9;buzz([120,40,200]);}}
    }
    function syncTanks(){
      for(const id in S.tk){const k=S.tk[id];let t=dTank[id];if(!t)t=dTank[id]={x:k.x,dy:k.y,hp:k.hp,show:k.hp};t.x=k.x;t.ty=k.y;t.hp=k.hp;t.a=k.a;t.h=k.h;t.cd=k.cd;t.fa=k.fa;t.rt=k.rt;t.inv=k.inv;if(k.a&&t.dead){t.dead=false;t.dy=k.y;t.show=k.hp;}if(!k.a)t.dead=true;}
    }
    function draw(dt){
      const W=cvh.W,H=cvh.H;layout();g.setTransform(cvh.dpr,0,0,cvh.dpr,0,0);const s=L.s,now=performance.now();
      const sg=g.createLinearGradient(0,0,0,H);sg.addColorStop(0,'#0b0b17');sg.addColorStop(1,'#24245a');g.fillStyle=sg;g.fillRect(0,0,W,H);
      g.fillStyle='#fff';for(const st of stars){g.globalAlpha=st[2];g.fillRect(X(st[0]),Y(st[1]),1.6,1.6);}g.globalAlpha=1;
      const w=S?S.wind:0;
      if(Math.random()<.4)streaks.push({x:w>=0?-5:105,y:rnd(60,140),l:rnd(3,8)});
      g.strokeStyle='#ffffff30';g.lineWidth=1.2;
      for(const k of streaks){k.x+=(w*3.2+(w>=0?4:-4))*dt;g.beginPath();g.moveTo(X(k.x),Y(k.y));g.lineTo(X(k.x+k.l*Math.sign(w||1)),Y(k.y));g.stroke();}
      streaks=streaks.filter(k=>k.x>-12&&k.x<112);
      if(!dT||!S)return;
      let sx=0,sy=0;if(shakeT>0){shakeT-=dt;sx=(Math.random()-.5)*8*Math.min(1,shakeT*3);sy=(Math.random()-.5)*8*Math.min(1,shakeT*3);}
      g.save();g.translate(sx,sy);
      // terrain
      g.beginPath();g.moveTo(X(0),H+5);for(let i=0;i<N;i++)g.lineTo(X(i*DX),Y(dT[i]));g.lineTo(X(WW),H+5);g.closePath();
      const tg=g.createLinearGradient(0,Y(65),0,Y(0));tg.addColorStop(0,'#3f8a4a');tg.addColorStop(.25,'#2b5e37');tg.addColorStop(1,'#14202a');g.fillStyle=tg;g.fill();
      g.strokeStyle='#7fe08a';g.lineWidth=2;g.beginPath();for(let i=0;i<N;i++){const px=X(i*DX),py=Y(dT[i]);i?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();
      // meteor warnings
      const t=c.t();
      for(const m of S.hz||[]){
        const left=m[1]-t;if(left<-.2)continue;const px=X(m[0]),gy=Y(hAt(dT,m[0]));
        g.save();g.globalAlpha=.35+.35*Math.sin(now/60);g.strokeStyle='#ff4d4d';g.lineWidth=2;g.setLineDash([4,5]);g.beginPath();g.moveTo(px,0);g.lineTo(px,gy);g.stroke();g.setLineDash([]);g.restore();
        g.fillStyle='#ff4d4d';g.beginPath();g.arc(px,gy-3,CR*s*clamp(1-left/1.4,0,1)*.9+2,0,6.283);g.globalAlpha=.4;g.fill();g.globalAlpha=1;
        const my=Y(WH+10-(1-clamp(left/1.4,0,1))*(WH+10-hAt(dT,m[0])));g.fillStyle='#ffb13d';g.shadowColor='#ff5a3d';g.shadowBlur=14;g.beginPath();g.arc(px,my,5,0,6.283);g.fill();g.shadowBlur=0;
        g.strokeStyle='#ff5a3daa';g.lineWidth=4;g.beginPath();g.moveTo(px,my);g.lineTo(px+8,my-30);g.stroke();
      }
      // last landing marker (mine)
      if(mark){const px=X(mark.x),py=Y(mark.y),col=c.col(me());g.save();g.strokeStyle=col;g.lineWidth=3;g.shadowColor=col;g.shadowBlur=8;g.beginPath();g.moveTo(px-6,py-6);g.lineTo(px+6,py+6);g.moveTo(px+6,py-6);g.lineTo(px-6,py+6);g.stroke();g.restore();}
      // tanks
      for(const id in dTank){const k=dTank[id];
        if(k.ty!=null){const gy=hAt(dT,k.x);const tgt=Math.min(k.ty,gy);k.dy+=(tgt-k.dy)*Math.min(1,dt*(k.dy>tgt+.5?9:12));}
        k.show+=(k.hp-k.show)*Math.min(1,dt*6);
        drawTank(k,+id,now);}
      // shells
      for(const sh of shells.values()){
        const age=Math.min(.15,(now-sh.ts)/1000),tx=sh.x+sh.vx*age+.5*w*age*age,ty=sh.y+sh.vy*age-.5*G*age*age,kk=1-Math.exp(-dt*28);
        if(sh.nw){sh.dx=tx;sh.dy=ty;sh.nw=false;}else{sh.dx+=(tx-sh.dx)*kk;sh.dy+=(ty-sh.dy)*kk;}
        sh.tr.push([sh.dx,sh.dy]);if(sh.tr.length>16)sh.tr.shift();
        const col=c.col(sh.p);
        g.lineWidth=3;g.lineCap='round';
        for(let i=1;i<sh.tr.length;i++){g.globalAlpha=i/sh.tr.length*.8;g.strokeStyle=col;g.beginPath();g.moveTo(X(sh.tr[i-1][0]),Y(sh.tr[i-1][1]));g.lineTo(X(sh.tr[i][0]),Y(sh.tr[i][1]));g.stroke();}
        g.globalAlpha=1;g.fillStyle='#fff';g.shadowColor=col;g.shadowBlur=12;g.beginPath();g.arc(X(sh.dx),Y(sh.dy),3.6,0,6.283);g.fill();g.shadowBlur=0;
      }
      // fx
      for(const r of rings){r.t+=dt;const k=r.t/.45;if(k>=1)continue;g.globalAlpha=1-k;g.strokeStyle=r.col;g.lineWidth=4*(1-k)+1;g.beginPath();g.arc(X(r.x),Y(r.y),r.r*s*(.2+.8*k),0,6.283);g.stroke();if(k<.25){g.fillStyle='#fff6d0';g.globalAlpha=.8*(1-k*4);g.beginPath();g.arc(X(r.x),Y(r.y),CR*s*(.5+k*3),0,6.283);g.fill();}}
      g.globalAlpha=1;rings=rings.filter(r=>r.t<.45);
      for(const p of parts){p.t+=dt;p.vy-=40*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;g.globalAlpha=Math.max(0,1-p.t/p.l);g.fillStyle=p.col;g.fillRect(X(p.x)-2,Y(p.y)-2,4,4);}
      g.globalAlpha=1;parts=parts.filter(p=>p.t<p.l);
      for(const f of floats){f.t+=dt;g.globalAlpha=Math.max(0,1-f.t/1.4);g.font='900 18px system-ui';g.textAlign='center';g.strokeStyle='#000';g.lineWidth=4;g.fillStyle=f.col;g.strokeText(f.txt,X(f.x),Y(f.y)-f.t*24);g.fillText(f.txt,X(f.x),Y(f.y)-f.t*24);}
      g.globalAlpha=1;floats=floats.filter(f=>f.t<1.4);
      g.restore();
      drawPanel(W,H,now);
    }
    function drawTank(k,id,now){
      const s=L.s,col=c.col(id),px=X(k.x),py=Y(k.dy),p=c.pl(id),isMe=id===me();
      const slope=Math.atan2(hAt(dT,k.x-2)-hAt(dT,k.x+2),4);
      g.save();g.translate(px,py);g.rotate(slope*.8);
      if(!k.a){g.fillStyle='#444';g.fillRect(-3.4*s,-1.8*s,6.8*s,1.8*s);g.fillStyle='#222';g.beginPath();g.arc(0,-1.8*s,1.6*s,Math.PI,0);g.fill();g.restore();g.font=(2.8*s)+'px system-ui';g.textAlign='center';g.fillText('💀',px,py-4*s);if(k.rt){const left=Math.max(0,Math.ceil(k.rt-c.t()));g.fillStyle=col;g.font='900 12px system-ui';g.fillText((p?p.n:'')+' back in '+left,px,py-7.5*s);}return;}
      let ang;
      if(isMe)ang=angNow();else if(k.h!=null)ang=k.h;else ang=sweepAng(c.t(),S.ph[id]||0);
      const rec=isMe?recoil*1.1*s:0;
      g.save();g.translate(0,-2.1*s);g.rotate(-(ang*Math.PI/180)-slope*.8);g.fillStyle='#e4e6f8';g.strokeStyle='#0b0b17';g.lineWidth=1;g.fillRect(-rec,-.55*s,4.8*s,1.1*s);g.strokeRect(-rec,-.55*s,4.8*s,1.1*s);
      if(isMe||k.h!=null){g.setLineDash([2,6]);g.strokeStyle=col;g.globalAlpha=isMe?.85:.5;g.lineWidth=2.5;g.beginPath();g.moveTo(5.4*s,0);g.lineTo(5.4*s+(charge&&isMe?16:9)*s,0);g.stroke();g.setLineDash([]);g.globalAlpha=1;}
      g.restore();
      if(k.inv&&c.t()<k.inv){g.save();g.translate(px,py);g.strokeStyle='#19d3ff';g.globalAlpha=.5+.4*Math.sin(now/70);g.lineWidth=3;g.beginPath();g.arc(0,-2.2*s,6.2*s,0,6.283);g.stroke();g.restore();}
      g.fillStyle=col;g.strokeStyle='#0b0b17';g.lineWidth=1.5;
      g.beginPath();g.roundRect?g.roundRect(-3.5*s,-2.2*s,7*s,2.2*s,.9*s):g.rect(-3.5*s,-2.2*s,7*s,2.2*s);g.fill();g.stroke();
      g.beginPath();g.arc(0,-2.2*s,1.9*s,Math.PI,0);g.fill();g.stroke();
      g.fillStyle='#0b0b17';for(let i=-2;i<=2;i+=2){g.beginPath();g.arc(i*1.2*s,-.5*s,.55*s,0,6.283);g.fill();}
      g.restore();
      // reload ring (mine) / hp bar + name
      if(isMe&&reloading()){const f=1-(reloadEnd-now)/(RELOAD*1000);g.strokeStyle='#ffd23f';g.lineWidth=3;g.beginPath();g.arc(px,py-2.5*s,5.6*s,-Math.PI/2,-Math.PI/2+6.283*clamp(f,0,1));g.stroke();}
      const bw=8*s,bx=px-bw/2,by=py-8.9*s;
      g.fillStyle='#000a';g.fillRect(bx-1,by-1,bw+2,6);g.fillStyle=k.show>50?'#52ff7a':k.show>25?'#ffd23f':'#ff3d81';g.fillRect(bx,by,bw*clamp(k.show/100,0,1),4);
      g.fillStyle=col;g.font='900 11px system-ui';g.textAlign='center';g.fillText((p?p.n:'')+(isMe?' ★':''),px,by-4);
      if(isMe){g.beginPath();g.moveTo(px,by-19);g.lineTo(px-4,by-26);g.lineTo(px+4,by-26);g.closePath();g.fill();}
    }
    function drawPanel(W,H,now){
      const top=H-L.ph;g.fillStyle='#12122ccc';g.fillRect(0,top,W,L.ph);g.fillStyle='#2d2d62';g.fillRect(0,top,W,2);
      const a=angNow(),el=a<=90?a:180-a,pw=powNow(),ch=!!charge,col=c.col(me());
      g.textAlign='left';g.fillStyle='#8d8db8';g.font='800 11px system-ui';g.fillText('ANGLE',14,top+20);
      g.fillStyle=ch?'#fff':'#cfcff0';g.font='900 34px system-ui';g.fillText(Math.round(el)+'°',14,top+56);
      g.font='900 22px system-ui';g.fillText(a<=90?'➡':'⬅',90,top+54);
      const bx=122,bw=W-bx-14,by=top+30,bh=30;
      g.fillStyle='#ffffff14';g.beginPath();g.roundRect?g.roundRect(bx,by,bw,bh,15):g.rect(bx,by,bw,bh);g.fill();
      if(ch){const f=pw/100,gr=g.createLinearGradient(bx,0,bx+bw,0);gr.addColorStop(0,'#52ff7a');gr.addColorStop(.6,'#ffd23f');gr.addColorStop(1,'#ff3d81');g.fillStyle=gr;g.beginPath();g.roundRect?g.roundRect(bx,by,Math.max(8,bw*f),bh,15):g.rect(bx,by,bw*f,bh);g.fill();
        g.fillStyle='#fff';g.font='900 18px system-ui';g.textAlign='center';g.fillText(Math.round(pw)+'%',bx+bw/2,by+bh-8);
        g.fillStyle='#8d8db8';g.font='800 11px system-ui';g.textAlign='left';g.fillText('POWER — RELEASE TO FIRE',bx,top+20);}
      else if(reloading()){const f=1-(reloadEnd-now)/(RELOAD*1000);g.fillStyle='#ffd23f';g.beginPath();g.roundRect?g.roundRect(bx,by,Math.max(8,bw*clamp(f,0,1)),bh,15):g.rect(bx,by,bw*f,bh);g.fill();g.fillStyle='#3a2300';g.font='900 15px system-ui';g.textAlign='center';g.fillText('RELOADING',bx+bw/2,by+bh-9);
        g.fillStyle='#8d8db8';g.font='800 11px system-ui';g.textAlign='left';g.fillText('POWER',bx,top+20);}
      else{const kk=S&&S.tk[me()];g.fillStyle=alive()?col:'#8d8db8';g.font='900 15px system-ui';g.textAlign='center';g.fillText(alive()?'HOLD to stop the aim':(kk&&kk.rt?'💀 Rebuilding in '+Math.max(0,Math.ceil(kk.rt-c.t())):'💀 You are out'),bx+bw/2,by+bh-9);g.fillStyle='#8d8db8';g.font='800 11px system-ui';g.textAlign='left';g.fillText('POWER',bx,top+20);}
    }
    function hudUpd(){
      if(!S)return;const w=S.wind;hudW.innerHTML='';const a=document.createElement('span');
      a.textContent=Math.abs(w)<.5?'·':(w>0?'➡':'⬅').repeat(Math.min(3,1+Math.floor(Math.abs(w)/3.5)));
      const b=document.createElement('b');b.textContent=Math.abs(w).toFixed(0);hudW.append('💨 ',a,b);
      const rows=c.R().pl.map(p=>{const q=S.sc[p.id]||{d:0,k:0,s:0};return{p,v:Math.round(q.d+25*q.k-q.s)};});
      const sig=JSON.stringify(rows.map(r=>[r.p.id,r.v]));if(hudS.dataset.s!==sig){hudS.dataset.s=sig;hudS.innerHTML='';for(const r of rows){const d=document.createElement('div');d.style.setProperty('--c',c.col(r.p.id));d.textContent=r.p.n.slice(0,6)+' '+r.v;hudS.append(d);}}
    }
    return{
      dbg:{angle:angNow,power:powNow,charging:()=>!!charge,reloading,get touch(){return touch;},dT:()=>dT,tanks:()=>dTank,shells:()=>shells,mark:()=>mark,shots:()=>shots,L},
      mount(root){
        style();for(let i=0;i<60;i++)stars.push([rnd(0,100),rnd(40,140),rnd(.2,.8)]);
        wrap=E('div','art-wrap');root.append(wrap);cvh=mkCanvas(wrap);g=cvh.g;cvh.cv.style.pointerEvents='none';
        touch=E('div','art-touch');hud=E('div','art-hud');hudW=E('div','art-chip');hudS=E('div','art-sc');hud.append(hudW,hudS);
        feedEl=E('div','art-feed');hint=E('div','art-hint','HOLD to stop the aim<small>keep holding to charge power · RELEASE to fire</small>');
        cdW=E('div','art-warn','☄️ METEORS INCOMING');
        wrap.append(touch,hud,feedEl,hint,cdW);
        touch.addEventListener('pointerdown',press);
        touch.addEventListener('pointerup',e=>release(e,false));
        touch.addEventListener('pointercancel',e=>release(e,true));
        touch.addEventListener('lostpointercapture',e=>release(e,true));
        layout();
      },
      start(){started=true;lastTs=performance.now();if(S)syncTanks();},
      update(S_,R){
        S=S_;
        if(S.tv!==tv){dT=dec(S.ter);tv=S.tv;}
        syncTanks();
        // shells: launch snapshot rows [id,x,y,vx,vy,owner]
        const now=performance.now(),seen=new Set();
        for(const r of S.sh){seen.add(r[0]);let o=shells.get(r[0]);
          if(!o){o={id:r[0],p:r[5],tr:[],nw:true};shells.set(r[0],o);const k=S.tk[o.p];
            if(k){const px=k.x,d=S.tk[me()]?Math.hypot(S.tk[me()].x-px,S.tk[me()].y-k.y):50;if(o.p!==me())beep(300,.2,'sawtooth',clamp(.07-d*.001,.01,.07),200);}
            for(let i=0;i<5;i++)parts.push({x:r[1],y:r[2],vx:rnd(-8,8),vy:rnd(0,10),l:.3,t:0,col:'#ffe9a0'});}
          o.x=r[1];o.y=r[2];o.vx=r[3];o.vy=r[4];o.ts=now;}
        for(const id of [...shells.keys()])if(!seen.has(id))shells.delete(id);
        if(S.t>=HZ0-.5&&!hzSeen&&R.ph==='play'){hzSeen=true;cdW.style.display='block';setTimeout(()=>cdW.style.display='none',2600);sfx.bad();}
        hudUpd();
        if(R.ph!=='play'||!started)draw(.016);
      },
      frame(rem){
        const now=performance.now(),dt=Math.min(.05,(now-lastTs)/1000);lastTs=now;
        if(!charge)sweepT+=dt;
        if(recoil>0)recoil=Math.max(0,recoil-dt*6);
        if(charge&&now-charge.t0>8000){charge=null;activeId=null;c.act({k:'rel'});}
        draw(dt);
        if(S&&c.R().ph==='play'&&!S.over&&S.t>HZ0&&now-lastHeart>900){lastHeart=now;beep(55,.14,'sine',.25);}
        if(shots>=2)hint.style.display='none';
        else if(started&&S&&S.t<1)hint.style.display='block';
      },
      event(m){if(!m)return;if(m.e==='x'&&dT)applyX(m);else if(m.e==='rs'){const t=dTank[m.p];if(t){t.dead=false;rings.push({x:t.x,y:t.ty||t.dy,t:0,r:8,col:'#19d3ff'});if(m.p===me()){buzz(40);sfx.good();}}}},
      stop(){}
    };
  }
};

// ---- host helpers ----
function explode(H,S,x,y,by){
  x=r2(x);y=r2(y);const T=S._T,dm={},ks=[];
  for(const pid in S.tk){
    const k=S.tk[pid];if(!k.a||(k.inv&&S.t<k.inv))continue;const d=Math.hypot(x-k.x,y-(k.y+1.5));if(d>=BR)continue;
    let dmg=Math.round(MAXD*(1-Math.max(0,d-TR)/(BR-TR)));dmg=Math.min(dmg,k.hp);if(dmg<=0)continue;
    k.hp-=dmg;dm[pid]=(dm[pid]||0)+dmg;
    if(by>=0){if(+pid===by)S.sc[by].s+=dmg;else S.sc[by].d+=dmg;}
    if(k.hp<=0){k.a=0;k.h=null;k.rt=r2(S.t+5);ks.push(+pid);if(by>=0&&+pid!==by)S.sc[by].k++;}
  }
  carve(T,x,y,CR);S.ter=enc(T);S.tv++;
  for(const pid in S.tk){
    const k=S.tk[pid];if(!k.a)continue;const ny=hAt(T,k.x);
    if(ny<k.y-.01){
      const drop=k.y-ny;k.y=ny;const fd=drop>3?Math.min(8,Math.round((drop-3)*1.2)):0;
      if(fd>0){const d2=Math.min(fd,k.hp);k.hp-=d2;dm[pid]=(dm[pid]||0)+d2;if(k.hp<=0){k.a=0;k.h=null;k.rt=r2(S.t+5);ks.push(+pid);}}
    }
  }
  H.emit({e:'x',by,x,y,dm,k:ks});
}
})();
