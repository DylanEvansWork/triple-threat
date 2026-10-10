// BLAST ZONE — Bomberman-lite. Host-authoritative bombs/flames/crates; each phone predicts its own movement and
// reports its position (host validates collisions + speed), remote players are snapshot-interpolated.
(function(){
'use strict';
const GW=9,GH=11,NC=GW*GH;
const SPAWN=[[0,0],[GW-1,GH-1],[GW-1,0],[0,GH-1]];
const FUSE=2.2,FLAME=.55,SD_AT=55,SD_STEP=.45,SD_LEAD=1.4;
const SP0=4,SP_STEP=.5,SP_MAX=5.5,NB_MAX=5,RG_MAX=6,CRATE_P=.64,PU_P=.27;
const idx=(x,y)=>y*GW+x,inb=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH;
const r2=v=>Math.round(v*100)/100;
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
// sudden-death order: outer ring inwards, pillars skipped
const SPIRAL=(()=>{const o=[];let x0=0,y0=0,x1=GW-1,y1=GH-1;
  while(x0<=x1&&y0<=y1){
    for(let x=x0;x<=x1;x++)o.push([x,y0]);
    for(let y=y0+1;y<=y1;y++)o.push([x1,y]);
    if(y1>y0)for(let x=x1-1;x>=x0;x--)o.push([x,y1]);
    if(x1>x0)for(let y=y1-1;y>y0;y--)o.push([x0,y]);
    x0++;y0++;x1--;y1--;}
  return o.filter(([x,y])=>!(x%2===1&&y%2===1));})();

// ------------------------------------------------------------------ host helpers
function bombAt(S,x,y){for(const b of S._b)if(b.x===x&&b.y===y)return b;return null;}
function solidFor(S,i,x,y){
  if(!inb(x,y))return true;
  if(S._g[idx(x,y)]!==0)return true;
  const b=bombAt(S,x,y);
  return !!(b&&!(b.pm&(1<<i)));
}
function kill(S,i){const p=S._p[i];if(!p.alive)return;p.alive=false;p.dt=S.t;p.mv=0;S._died=true;}
function boom(S,b0){
  const q=[b0];
  while(q.length){
    const b=q.pop();if(b.dead)continue;b.dead=true;
    S._b.splice(S._b.indexOf(b),1);
    const flame=(x,y)=>{
      S._fm.set(idx(x,y),FLAME);
      for(let k=S._pu.length-1;k>=0;k--){const u=S._pu[k];if(u.x===x&&u.y===y&&u.born<S.t-1e-9)S._pu.splice(k,1);}
    };
    flame(b.x,b.y);
    for(const [dx,dy] of DIRS){
      for(let k=1;k<=b.rg;k++){
        const x=b.x+dx*k,y=b.y+dy*k;
        if(!inb(x,y))break;
        const ci=idx(x,y),c=S._g[ci];
        if(c===1||c===3)break;
        if(c===2){
          S._g[ci]=0;S._gd=true;
          const t=S._cp[ci];if(t)S._pu.push({x,y,t,born:S.t});
          flame(x,y);break;
        }
        flame(x,y);
        const ob=bombAt(S,x,y);
        if(ob){q.push(ob);break;}
      }
    }
    S._boom=true;
  }
}

GAMES.bomber={
  name:'Blast Zone',emoji:'💥',tag:'Blow up crates. Blow up your friends. Try not to blow up yourself.',
  min:2,max:4,
  rules:[
    ['🕹️','Drag your left thumb to run around the maze. Tap the big 💣 with your right thumb to drop a bomb.'],
    ['💥','Bombs go off after 2 seconds in a + shape. They smash crates, set off other bombs and kill anyone they touch. Yes, you too.'],
    ['🎁','Crates may hide power-ups: 🔥 bigger blast, 💣 extra bomb, 👟 speed.'],
    ['⚠️','After about a minute the walls close in. Red tiles = a wall is about to drop.'],
    ['👑','Last one alive wins. Dying first means last place.']
  ],
  ctrl:'Left thumb: drag anywhere to move. Right thumb: tap 💣 to drop a bomb.',
  win:'Last player alive wins. Die earlier = rank lower. Die together = tie.',
  dur:120,hz:20,better:'high',
  fmt:v=>v>=1e5?'Last alive 👑':'Out at '+Math.round(v)+'s',

  // ---------------------------------------------------------------- HOST
  init(H){
    const g=new Array(NC).fill(0),clear=new Set(),cp={};
    for(const [sx,sy] of SPAWN){
      const dx=sx?-1:1,dy=sy?-1:1;
      [[0,0],[1,0],[2,0],[0,1],[0,2],[2,1],[1,2]].forEach(([a,b])=>clear.add(idx(sx+dx*a,sy+dy*b)));
    }
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
      const i=idx(x,y);
      if(x%2===1&&y%2===1){g[i]=1;continue;}
      if(clear.has(i))continue;
      if(Math.random()<CRATE_P){g[i]=2;if(Math.random()<PU_P){const r=Math.random();cp[i]=r<.4?'r':r<.8?'b':'s';}}
    }
    const S={W:GW,H:GH,ids:H.players.map(p=>p.id),sdAt:SD_AT,hold:2.4,
      _g:g,_cp:cp,_b:[],_fm:new Map(),_pu:[],_sdI:0,_sdNext:SD_AT+SD_LEAD,_gd:true,
      _p:H.players.map((hp,i)=>({x:SPAWN[i][0],y:SPAWN[i][1],alive:true,sp:SP0,nb:1,rg:2,face:2,mv:0,ct:0,rj:0,dt:null}))};
    this._pub(S);
    return S;
  },
  _pub(S){
    if(S._gd){S.g=S._g.map(v=>'.#cs'[v]).join('');S._gd=false;}
    S.b=S._b.map(b=>[b.x,b.y,r2(Math.max(0,b.t)),b.rg,b.o,b.pm]);
    const f=[];for(const [k,v] of S._fm)f.push([k%GW,Math.floor(k/GW),r2(v)]);S.f=f;
    S.pu=S._pu.map(u=>[u.x,u.y,u.t]);
    const sd=[];
    for(let k=S._sdI;k<SPIRAL.length&&k<S._sdI+4;k++){const left=S._sdNext+(k-S._sdI)*SD_STEP-S.t;if(left<=SD_LEAD+.01)sd.push([SPIRAL[k][0],SPIRAL[k][1],r2(Math.max(0,left))]);}
    S.sd=sd;
    S.pl=S._p.map((p,i)=>({x:r2(p.x),y:r2(p.y),a:p.alive?1:0,sp:p.sp,nb:p.nb,rg:p.rg,u:S._b.reduce((n,b)=>n+(b.o===i?1:0),0),f:p.face,mv:p.mv,rj:p.rj,dt:p.dt==null?null:r2(p.dt)}));
  },
  begin(H,S){
    // everyone starts safe; reset claim clocks
    S._p.forEach(p=>{p.ct=0;});
  },
  tick(H,S,dt){
    const n=S._p.length;
    S._died=false;S._boom=false;
    if(!S.over)H.players.forEach((hp,i)=>{if(hp.aw)kill(S,i);});
    // fuses
    for(const b of S._b.slice())b.t-=dt;
    for(const b of S._b.slice())if(!b.dead&&b.t<=0)boom(S,b);
    // flames decay
    for(const [k,v] of S._fm){const nv=v-dt;if(nv<=0)S._fm.delete(k);else S._fm.set(k,nv);}
    // sudden death: land blocks
    while(S.t>=S._sdNext&&S._sdI<SPIRAL.length){
      const [x,y]=SPIRAL[S._sdI++];S._sdNext+=SD_STEP;
      const i=idx(x,y);
      const b=bombAt(S,x,y);if(b)boom(S,b);
      S._g[i]=3;S._gd=true;S._cp[i]=null;S._fm.delete(i);
      S._pu=S._pu.filter(u=>!(u.x===x&&u.y===y));
      S._p.forEach((p,pi)=>{if(p.alive&&!S.over&&Math.round(p.x)===x&&Math.round(p.y)===y)kill(S,pi);});
      S._land=true;
    }
    // flames kill
    if(!S.over)for(let pi=0;pi<n;pi++){
      const p=S._p[pi];if(!p.alive)continue;
      for(const [k] of S._fm){const fx=k%GW,fy=Math.floor(k/GW);if(Math.abs(p.x-fx)<.45&&Math.abs(p.y-fy)<.45){kill(S,pi);break;}}
    }
    // power-ups
    for(let pi=0;pi<n;pi++){
      const p=S._p[pi];if(!p.alive)continue;
      const tx=Math.round(p.x),ty=Math.round(p.y);
      for(let k=S._pu.length-1;k>=0;k--){const u=S._pu[k];
        if(u.x===tx&&u.y===ty&&Math.abs(p.x-tx)<.5&&Math.abs(p.y-ty)<.5){
          if(u.t==='r')p.rg=Math.min(RG_MAX,p.rg+1);else if(u.t==='b')p.nb=Math.min(NB_MAX,p.nb+1);else p.sp=Math.min(SP_MAX,p.sp+SP_STEP);
          S._pu.splice(k,1);}}
    }
    // bomb pass-through ends when the walker has left the tile
    for(const b of S._b)if(b.pm)for(let pi=0;pi<n;pi++)if(b.pm&(1<<pi)){const p=S._p[pi];if(!p.alive||Math.round(p.x)!==b.x||Math.round(p.y)!==b.y)b.pm&=~(1<<pi);}
    // win check
    if(!S.over){
      const alive=S._p.filter(p=>p.alive).length;
      if(alive<=1){S.over=true;const w=S._p.findIndex(p=>p.alive);S.winner=w;}
    }
    this._pub(S);
  },
  act(H,S,pid,m){
    const i=S.ids.indexOf(pid);if(i<0||S.over)return;
    const p=S._p[i];if(!p.alive)return;
    if(m.k!=='mv'&&m.k!=='bomb')return;
    // validate the position the phone claims
    let x=+m.x,y=+m.y;
    if(!isFinite(x)||!isFinite(y))return;
    x=clamp(x,0,GW-1);y=clamp(y,0,GH-1);
    const dtc=clamp(S.t-p.ct,.02,.6);p.ct=S.t;
    const budget=p.sp*dtc*1.6+.45;
    let dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy),rej=false;
    let why='';
    if(d>budget){const k=budget/d;dx*=k;dy*=k;rej=true;why='speed';}
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.2));
    let lx=p.x,ly=p.y;
    for(let s=1;s<=steps;s++){
      const nx=p.x+dx*s/steps,ny=p.y+dy*s/steps;
      if(solidFor(S,i,Math.round(nx),Math.round(ny))){rej=true;why='solid '+Math.round(nx)+','+Math.round(ny);break;}
      lx=nx;ly=ny;
    }
    if(rej){p.rj++;(S._rl=S._rl||[]).push([i,r2(S.t),r2(p.x),r2(p.y),r2(x),r2(y),why]);if(S._rl.length>30)S._rl.shift();}
    p.x=lx;p.y=ly;
    if(m.f>=0&&m.f<=3)p.face=m.f|0;
    p.mv=m.m?1:0;
    if(m.k==='bomb'){
      const tx=Math.round(p.x),ty=Math.round(p.y),ti=idx(tx,ty);
      const used=S._b.reduce((n,b)=>n+(b.o===i?1:0),0);
      if(used>=p.nb||S._g[ti]!==0||bombAt(S,tx,ty)||S._fm.has(ti))return;
      let pm=0;S._p.forEach((q,qi)=>{if(q.alive&&Math.round(q.x)===tx&&Math.round(q.y)===ty)pm|=1<<qi;});
      S._b.push({x:tx,y:ty,t:FUSE,rg:p.rg,o:i,pm:pm|(1<<i)});
    }
  },
  val(S,id){
    const i=S.ids.indexOf(id);if(i<0)return null;
    const p=S._p[i];return p.alive?1e6:p.dt;
  },

  // ---------------------------------------------------------------- CLIENT
  mk(c){
    if(!document.getElementById('st-bomber')){
      const st=document.createElement('style');st.id='st-bomber';
      st.textContent='.bm-joy,.bm-bz{position:absolute;touch-action:none;z-index:2}.bm-joy{left:0;width:60%}.bm-bz{right:0;width:40%}'
        +'.bm-hint{position:absolute;left:0;right:0;top:46%;text-align:center;font-weight:800;font-size:15px;color:#ffffff40;pointer-events:none;line-height:1.3}'
        +'.bm-btn{position:absolute;right:max(14px,5%);bottom:16px;width:104px;height:104px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff7a9f,#ff3d81 60%,#b01f55);box-shadow:0 7px 0 #7a1238,0 0 36px #ff3d8160;display:flex;align-items:center;justify-content:center;font-size:52px;pointer-events:none;transition:transform .05s}'
        +'.bm-btn.dn{transform:translateY(5px);box-shadow:0 2px 0 #7a1238,0 0 36px #ff3d8160}.bm-btn.off{filter:grayscale(.85) brightness(.6)}'
        +'.bm-btn b{position:absolute;right:-4px;top:-4px;min-width:28px;height:28px;border-radius:14px;background:#0b0b17;border:2px solid #fff;font-size:14px;line-height:24px;text-align:center;color:#fff;padding:0 4px}';
      document.head.append(st);
    }
    let cvo,root,joyEl,bzEl,btn,badge,hint,joy,started=false,keyH=null;
    let S=null,prev=null,mi=-1,L=null,jx=0,jy=0,axis=0,lastFrame=0,lastSend=0,lastSent=null,lastRj=0,claimN=0;
    let cs=40,ox=0,oy=0,lw=0,lh=0;
    const snaps=[],ghosts=[],parts=[],dieAt={},rendered=[];
    let shk=0,lastBoom=0,banner=null,bannerT=0,sdWarned=false,sdOn=false,moved=false,hintOff=false,lastBtnTxt='';
    const num=i=>String(i+1);

    // ---------- local movement ----------
    const solidL=(x,y)=>{
      if(!inb(x,y))return true;
      if(S.g[idx(x,y)]!=='.')return true;
      for(const b of S.b)if(b[0]===x&&b[1]===y)return true;
      for(const gh of ghosts)if(gh.x===x&&gh.y===y)return true;
      return false;
    };
    function stepAxis(a,s,d){
      const q=a?'y':'x',p=a?'x':'y';
      const lane=Math.round(L[p]),off=L[p]-lane,qc=Math.round(L[q]);
      const tA=ln=>a?solidL(ln,qc+s):solidL(qc+s,ln);
      const tH=ln=>a?solidL(ln,qc):solidL(qc,ln);
      const ahead=tA(lane);
      if(ahead&&Math.abs(off)>=.28){
        const ol=lane+(off>0?1:-1);
        if(!tA(ol)&&!tH(ol)){const k=Math.min(d,Math.abs(L[p]-(lane+(off>0?.5:-.5)))+.02);L[p]+=(off>0?1:-1)*k;return k;}
      }
      if(Math.abs(off)>1e-4){const k=Math.min(Math.abs(off),d*1.1);L[p]-=Math.sign(off)*k;}
      let k=d;
      if(ahead){k=Math.max(0,Math.min(d,(qc-L[q])*s));}
      L[q]+=s*k;
      return k;
    }
    function simulate(dt){
      const ax=Math.abs(jx),ay=Math.abs(jy);
      L.mv=false;
      if(Math.max(ax,ay)<.28)return;
      if(axis===0&&ay>ax*1.25)axis=1;else if(axis===1&&ax>ay*1.25)axis=0;
      const sp=S.pl[mi].sp,d=sp*dt;
      const comp=a=>a?jy:jx;
      const moved=stepAxis(axis,Math.sign(comp(axis))||1,d);
      let tot=moved;
      if(moved<d*.2){const o=1-axis;if(Math.abs(comp(o))>.3){tot+=stepAxis(o,Math.sign(comp(o)),d);L.face=o?(jy>0?2:0):(jx>0?1:3);}}
      else L.face=axis?(jy>0?2:0):(jx>0?1:3);
      L.x=clamp(L.x,0,GW-1);L.y=clamp(L.y,0,GH-1);
      if(tot>1e-4)L.mv=true;
    }
    function sendClaim(now,force){
      if(!L)return;
      const key=r2(L.x)+','+r2(L.y)+','+(L.mv?1:0)+','+L.face;
      if(!force&&(now-lastSend<40||key===lastSent))return;
      lastSend=now;lastSent=key;
      c.act({k:'mv',x:r2(L.x),y:r2(L.y),f:L.face,m:L.mv?1:0,n:++claimN});
    }
    function myAlive(){return S&&mi>=0&&S.pl[mi]&&S.pl[mi].a===1&&!S.over;}
    function dropBomb(){
      if(!started||!S||c.R().ph!=='play'||!myAlive()||!L)return;
      const p=S.pl[mi];
      const tx=Math.round(L.x),ty=Math.round(L.y);
      if(p.u+ghosts.length>=p.nb)return;
      if(solidL(tx,ty))return;
      ghosts.push({x:tx,y:ty,t:performance.now()+700,c:mi});
      sfx.tap();buzz(15);
      lastSend=0;
      c.act({k:'bomb',x:r2(L.x),y:r2(L.y),f:L.face,m:L.mv?1:0,n:++claimN});
    }

    // ---------- particles / effects ----------
    function spark(x,y,col,n,sp,life,sz){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(.3+Math.random())*sp;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:life*(.6+Math.random()*.6),m:life,c:col,s:sz*(.6+Math.random()*.8)});}}
    function onState(){
      const now=performance.now();
      if(!prev)return;
      // new flames => explosion juice
      const pk=new Set(prev.f.map(a=>a[0]+','+a[1])),nw=[];
      for(const f of S.f)if(!pk.has(f[0]+','+f[1]))nw.push(f);
      if(nw.length){
        let near=99;
        for(const f of nw){spark(f[0],f[1],Math.random()<.5?'#ffd23f':'#ff7a1a',4,3.2,.55,3);if(L)near=Math.min(near,Math.hypot(f[0]-L.x,f[1]-L.y));}
        shk=Math.min(16,Math.max(shk,5+nw.length*.7+(near<3?4:0)));
        if(now-lastBoom>120){lastBoom=now;sfx.boom();if(near<4)buzz(near<2?[40,20,60]:30);}
      }
      // crates destroyed / blocks landed
      for(let i=0;i<NC;i++){
        if(prev.g[i]!==S.g[i]){
          const x=i%GW,y=Math.floor(i/GW);
          if(prev.g[i]==='c'&&S.g[i]==='.')spark(x,y,'#c47a3a',7,2.6,.7,3.5);
          if(S.g[i]==='s'){spark(x,y,'#ff4d4d',10,2.2,.6,3);shk=Math.max(shk,9);beep(90,.25,'square',.16,-40);buzz(25);}
        }
      }
      // deaths + pick-ups
      for(let i=0;i<S.pl.length;i++){
        const a=prev.pl[i],b=S.pl[i];if(!a)continue;
        if(a.a&&!b.a){dieAt[i]=now;const col=c.col(S.ids[i]);spark(b.x,b.y,col,22,3.6,.9,4);spark(b.x,b.y,'#fff',8,2.4,.6,2.5);shk=Math.max(shk,12);
          if(i===mi){sfx.bad();buzz([90,40,140]);}else{beep(300,.18,'square',.1,-120);}}
        if(i===mi&&b.a&&(b.rg>a.rg||b.nb>a.nb||b.sp>a.sp)){sfx.good();buzz(20);spark(b.x,b.y,'#fff',12,2.2,.5,2.5);}
      }
      if(S.over&&!prev.over){
        const w=S.winner;
        banner=w>=0?{t:'👑 '+(c.pl(S.ids[w])?c.pl(S.ids[w]).n:'?')+' wins!',col:c.col(S.ids[w])}:{t:'💥 Everybody blew up!',col:'#ffd23f'};
        bannerT=now;if(w>=0&&w===mi)sfx.win();
      }
    }

    // ---------- layout / drawing ----------
    function layout(){
      const W=cvo.W,Hh=cvo.H;if(W===lw&&Hh===lh)return;lw=W;lh=Hh;
      cs=Math.max(24,Math.floor(Math.min((W-4)/GW,(Hh-190)/GH)));
      ox=Math.round((W-cs*GW)/2);oy=18;
      const top=Math.round(oy+cs*GH*.55);
      joyEl.style.top=top+'px';joyEl.style.bottom='0';bzEl.style.top=top+'px';bzEl.style.bottom='0';
    }
    const px=x=>ox+(x+.5)*cs,py=y=>oy+(y+.5)*cs;
    function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
    function remotePos(i,now){
      const sn=snaps[i];if(!sn||!sn.length)return null;
      const T=now-105;
      if(sn.length===1||T<=sn[0].t)return sn[0];
      for(let k=sn.length-1;k>0;k--){const a=sn[k-1],b=sn[k];if(T>=a.t&&T<=b.t){const u=(T-a.t)/Math.max(1,b.t-a.t);return{x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u)};}}
      return sn[sn.length-1];
    }
    function drawPlayer(g,i,x,y,now,dying){
      const id=S.ids[i],col=c.col(id),pl=c.pl(id),p=S.pl[i];
      const X=px(x),Y=py(y),r=cs*.36;
      let sc=1,rot=0,al=1;
      if(dying!==null){const u=dying;sc=Math.max(0,1-u*1.1);rot=u*9;al=Math.max(0,1-u);}
      const bob=(p.mv&&!dying)?Math.abs(Math.sin(now/75))*cs*.07:0;
      g.save();g.globalAlpha=al;
      // shadow
      g.fillStyle='#00000055';g.beginPath();g.ellipse(X,Y+r*.95,r*.85*sc,r*.34*sc,0,0,6.283);g.fill();
      if(i===mi&&dying===null){g.strokeStyle='#ffffffcc';g.lineWidth=2;g.beginPath();g.ellipse(X,Y+r*.95,r*1.15,r*.5,0,0,6.283);g.stroke();}
      g.translate(X,Y-bob);g.rotate(rot);g.scale(sc,sc);
      g.fillStyle=col;g.beginPath();g.arc(0,0,r,0,6.283);g.fill();
      g.fillStyle='#ffffff30';g.beginPath();g.arc(-r*.3,-r*.35,r*.45,0,6.283);g.fill();
      g.lineWidth=2.5;g.strokeStyle='#0b0b17';g.beginPath();g.arc(0,0,r,0,6.283);g.stroke();
      // eyes toward facing
      const f=DIRS[p.f]||DIRS[2],ex=f[0]*r*.28,ey=f[1]*r*.2;
      g.fillStyle='#fff';
      const eo=f[0]!==0?[[0,-1],[0,1]]:[[-1,0],[1,0]];
      for(const [ax,ay] of eo){g.beginPath();g.arc(ex+ax*r*.32,ey+ay*r*.3-r*.05,r*.2,0,6.283);g.fill();}
      g.fillStyle='#0b0b17';
      for(const [ax,ay] of eo){g.beginPath();g.arc(ex+ax*r*.32+f[0]*r*.08,ey+ay*r*.3-r*.05+f[1]*r*.08,r*.09,0,6.283);g.fill();}
      g.restore();
      if(dying!==null)return;
      // number badge + name tag
      g.save();
      g.fillStyle='#0b0b17';g.beginPath();g.arc(X+r*.78,Y+r*.62-bob,cs*.15,0,6.283);g.fill();g.strokeStyle=col;g.lineWidth=1.5;g.stroke();
      g.fillStyle='#fff';g.font='900 '+Math.round(cs*.2)+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(num(i),X+r*.78,Y+r*.64-bob);
      const nm=(pl?pl.n:'?').slice(0,5);
      g.font='800 '+Math.max(8,Math.round(cs*.21))+'px system-ui,sans-serif';
      const tw=g.measureText(nm).width+8,ty=Y-r-cs*.3-bob;
      g.fillStyle='#0b0b17cc';rr(g,X-tw/2,ty-cs*.12,tw,cs*.26,cs*.1);g.fill();
      g.fillStyle=col;g.fillText(nm,X,ty+cs*.01);
      if(i===mi){g.fillStyle='#fff';const ay=ty-cs*.28-Math.abs(Math.sin(now/220))*cs*.12;g.beginPath();g.moveTo(X-cs*.14,ay-cs*.12);g.lineTo(X+cs*.14,ay-cs*.12);g.lineTo(X,ay+cs*.08);g.closePath();g.fill();}
      g.restore();
    }
    function draw(now){
      const g=cvo.g,W=cvo.W,Hh=cvo.H;
      g.clearRect(0,0,W,Hh);
      layout();
      if(!S){return;}
      const dt=Math.min(.05,(now-(draw.t||now))/1000);draw.t=now;
      shk=Math.max(0,shk-shk*dt*8-dt*3);
      g.save();
      if(shk>.2)g.translate((Math.random()-.5)*shk,(Math.random()-.5)*shk);
      const mw=cs*GW,mh=cs*GH;
      // floor
      for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){g.fillStyle=(x+y)%2?'#171736':'#1c1c40';g.fillRect(ox+x*cs,oy+y*cs,cs,cs);}
      // power-ups
      for(const [x,y,t] of S.pu){
        const X=px(x),Y=py(y)+Math.sin(now/260+x*2+y)*cs*.05;
        const col=t==='r'?'#ff7a1a':t==='b'?'#cfcfff':'#52ff7a';
        g.fillStyle=col+'33';g.beginPath();g.arc(X,Y,cs*.4,0,6.283);g.fill();
        g.strokeStyle=col;g.lineWidth=2;g.beginPath();g.arc(X,Y,cs*.36+Math.sin(now/180)*1.2,0,6.283);g.stroke();
        g.font=Math.round(cs*.5)+'px serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';g.fillText(t==='r'?'🔥':t==='b'?'💣':'👟',X,Y+1);
      }
      // walls
      for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
        const ch=S.g[idx(x,y)];if(ch==='.')continue;
        const X=ox+x*cs,Y=oy+y*cs;
        if(ch==='#'){
          g.fillStyle='#22224a';rr(g,X+1,Y+2,cs-2,cs-2,5);g.fill();
          g.fillStyle='#4a4a86';rr(g,X+1,Y+1,cs-2,cs-5,5);g.fill();
          g.fillStyle='#6a6ab0';rr(g,X+4,Y+4,cs-8,cs*.22,3);g.fill();
        }else if(ch==='c'){
          g.fillStyle='#6a3d17';rr(g,X+2,Y+3,cs-4,cs-4,4);g.fill();
          g.fillStyle='#c7803d';rr(g,X+2,Y+2,cs-4,cs-6,4);g.fill();
          g.strokeStyle='#8a5522';g.lineWidth=2;g.beginPath();g.moveTo(X+4,Y+cs*.4);g.lineTo(X+cs-4,Y+cs*.4);g.moveTo(X+4,Y+cs*.68);g.lineTo(X+cs-4,Y+cs*.68);g.moveTo(X+cs/2,Y+3);g.lineTo(X+cs/2,Y+cs-4);g.stroke();
          g.fillStyle='#ffffff25';g.fillRect(X+4,Y+4,cs-8,2);
        }else{
          g.fillStyle='#3a1010';g.fillRect(X,Y,cs,cs);
          g.save();g.beginPath();g.rect(X+1,Y+1,cs-2,cs-2);g.clip();
          g.strokeStyle='#ff4d4d';g.lineWidth=5;for(let k=-cs;k<cs*2;k+=11){g.beginPath();g.moveTo(X+k,Y+cs);g.lineTo(X+k+cs,Y);g.stroke();}
          g.restore();g.strokeStyle='#ff4d4d';g.lineWidth=2;g.strokeRect(X+1,Y+1,cs-2,cs-2);
        }
      }
      // sudden-death warnings
      for(const [x,y,left] of S.sd){
        const X=ox+x*cs,Y=oy+y*cs,bl=(Math.floor(now/(left<.5?60:140))%2)?.55:.25;
        g.fillStyle='rgba(255,60,60,'+bl+')';g.fillRect(X,Y,cs,cs);
        g.strokeStyle='#ff4d4d';g.lineWidth=2;g.strokeRect(X+2,Y+2,cs-4,cs-4);
        g.fillStyle='#fff';g.font='900 '+Math.round(cs*.5)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('!',X+cs/2,Y+cs/2+1);
      }
      // bombs (server bombs + ghost bombs)
      const drawBomb=(x,y,left,owner)=>{
        const X=px(x),Y=py(y),fast=left<.8,pu=1+(fast?.12:.07)*Math.sin(now/(fast?45:120));
        const r=cs*.33*pu,hot=fast&&Math.floor(now/70)%2===0;
        g.fillStyle='#00000055';g.beginPath();g.ellipse(X,Y+cs*.3,r*.9,r*.35,0,0,6.283);g.fill();
        const col=owner>=0?c.col(S.ids[owner]):'#fff';
        g.strokeStyle=col;g.lineWidth=3;g.beginPath();g.arc(X,Y,r+2,0,6.283);g.stroke();
        const gr=g.createRadialGradient(X-r*.35,Y-r*.4,r*.1,X,Y,r);gr.addColorStop(0,hot?'#ff9a8a':'#6d6d9a');gr.addColorStop(1,hot?'#b01a1a':'#101024');
        g.fillStyle=gr;g.beginPath();g.arc(X,Y,r,0,6.283);g.fill();
        g.fillStyle='#ffffff55';g.beginPath();g.arc(X-r*.35,Y-r*.4,r*.2,0,6.283);g.fill();
        // fuse + spark
        g.strokeStyle='#c9b08a';g.lineWidth=2;g.beginPath();g.moveTo(X+r*.4,Y-r*.7);g.quadraticCurveTo(X+r*.9,Y-r*1.2,X+r*.7,Y-r*1.5);g.stroke();
        const sk=(Math.random()*2+2)*(cs/40);g.fillStyle=Math.random()<.5?'#ffd23f':'#fff';g.beginPath();g.arc(X+r*.7+(Math.random()-.5)*2,Y-r*1.5+(Math.random()-.5)*2,sk,0,6.283);g.fill();
      };
      for(const [x,y,left,rg,o] of S.b)drawBomb(x,y,left,o);
      for(const gh of ghosts)if(!S.b.some(b=>b[0]===gh.x&&b[1]===gh.y))drawBomb(gh.x,gh.y,FUSE,gh.c);
      // flames
      for(const [x,y,rem] of S.f){
        const X=px(x),Y=py(y),a=Math.min(1,rem/.25),fl=1+Math.sin(now/40+x*3+y*5)*.06,R=cs*.62*fl;
        const gr=g.createRadialGradient(X,Y,0,X,Y,R);gr.addColorStop(0,'rgba(255,255,230,'+a+')');gr.addColorStop(.35,'rgba(255,210,63,'+a+')');gr.addColorStop(.75,'rgba(255,100,20,'+a*.9+')');gr.addColorStop(1,'rgba(255,40,20,0)');
        g.fillStyle=gr;g.beginPath();g.rect(X-cs*.5,Y-cs*.5,cs,cs);g.fill();
        g.fillStyle='rgba(255,140,30,'+a*.55+')';g.fillRect(X-cs*.5,Y-cs*.5,cs,cs);
        g.fillStyle='rgba(255,255,220,'+a*.9+')';rr(g,X-cs*.26*fl,Y-cs*.26*fl,cs*.52*fl,cs*.52*fl,cs*.2);g.fill();
      }
      // players (back to front)
      rendered.length=0;
      for(let i=0;i<S.pl.length;i++){
        const p=S.pl[i];let pos;
        if(i===mi&&L&&p.a)pos={x:L.x,y:L.y};else pos=remotePos(i,now)||{x:p.x,y:p.y};
        const dy=dieAt[i]!==undefined?(now-dieAt[i])/900:null;
        if(!p.a&&(dy===null||dy>=1))continue;
        rendered.push({i,x:pos.x,y:pos.y,dy:p.a?null:dy});
      }
      rendered.sort((a,b)=>a.y-b.y);
      for(const r of rendered)drawPlayer(g,r.i,r.x,r.y,now,r.dy);
      // ghosts of the dead
      for(const r of rendered)if(r.dy!==null){const u=r.dy;g.globalAlpha=Math.max(0,1-u);g.font=Math.round(cs*.6)+'px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('💀',px(r.x),py(r.y)-u*cs*1.1);g.globalAlpha=1;}
      // particles
      for(let k=parts.length-1;k>=0;k--){
        const q=parts[k];q.l-=dt;if(q.l<=0){parts.splice(k,1);continue;}
        q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=2.4*dt;q.vx*=.985;
        g.globalAlpha=Math.min(1,q.l/q.m*1.5);g.fillStyle=q.c;g.fillRect(px(q.x)-q.s/2,py(q.y)-q.s/2,q.s,q.s);
      }
      g.globalAlpha=1;
      g.restore();
      // maze frame
      g.strokeStyle='#2d2d62';g.lineWidth=2;rr(g,ox-1,oy-1,mw+2,mh+2,4);g.stroke();

      // ---- HUD under the maze ----
      const hy=oy+mh+10,n=S.pl.length,pw=Math.min(100,(W-16-(n-1)*6)/n);
      const tot=pw*n+(n-1)*6;let hx=(W-tot)/2;
      g.textBaseline='middle';
      for(let i=0;i<n;i++){
        const p=S.pl[i],col=c.col(S.ids[i]),pl=c.pl(S.ids[i]);
        g.globalAlpha=p.a?1:.4;
        g.fillStyle='#171734';rr(g,hx,hy,pw,28,9);g.fill();
        g.fillStyle=col;g.fillRect(hx+4,hy+24,pw-8,3);
        g.fillStyle=col;g.beginPath();g.arc(hx+14,hy+13,8,0,6.283);g.fill();
        g.fillStyle='#0b0b17';g.font='900 11px system-ui';g.textAlign='center';g.fillText(num(i),hx+14,hy+14);
        g.fillStyle='#fff';g.font='800 12px system-ui';g.textAlign='left';
        let nm=(pl?pl.n:'?').slice(0,7)+(i===mi?' ★':'');if(!p.a)nm='☠ '+nm;
        g.fillText(nm,hx+26,hy+14);
        g.globalAlpha=1;hx+=pw+6;
      }
      // contextual hint / stats
      const me=mi>=0?S.pl[mi]:null;let line='',col='#cfcff0';
      if(S.over)line='';
      else if(me&&!me.a){line='💀 You’re out — watch the finish!';col='#ff8fb3';}
      else if(S.t>=S.sdAt){line='⚠ SUDDEN DEATH — walls closing in!';col='#ff6b6b';}
      else if(S.sdAt-S.t<12){line='Walls close in '+Math.ceil(S.sdAt-S.t)+'s';col='#ffd23f';}
      else if(S.t<7&&me){line='Blast crates 📦 — run from your own bomb!';col='#ffd23f';}
      if(line){g.fillStyle=col;let fs=14;g.font='800 14px system-ui';while(fs>9&&g.measureText(line).width>W-16){fs--;g.font='800 '+fs+'px system-ui';}g.textAlign='center';g.fillText(line,W/2,hy+46);}
      if(me){g.fillStyle='#8d8db8';g.font='800 13px system-ui';g.textAlign='center';g.fillText('💣 '+Math.max(0,me.nb-me.u)+'/'+me.nb+'   🔥 '+me.rg+'   👟 '+Math.round((me.sp-SP0)/SP_STEP),W/2,hy+68);}
      // sudden-death banner
      if(S.t>=S.sdAt&&S.t<S.sdAt+2.6&&!S.over){const u=(S.t-S.sdAt);g.save();g.globalAlpha=Math.min(1,(2.6-u)*1.5);g.fillStyle='#000a';g.fillRect(0,oy+mh*.4,W,cs*1.4);g.fillStyle='#ff4d4d';g.font='900 '+Math.round(cs*.7)+'px system-ui';g.textAlign='center';g.fillText('⚠ SUDDEN DEATH ⚠',W/2,oy+mh*.4+cs*.7);g.restore();}
      // winner banner
      if(banner){const u=Math.min(1,(now-bannerT)/300);g.save();g.fillStyle='rgba(11,11,23,'+.78*u+')';g.fillRect(0,oy+mh*.38,W,cs*2.2);g.translate(W/2,oy+mh*.38+cs*1.1);g.scale(.6+.4*u,.6+.4*u);g.fillStyle=banner.col;g.font='900 '+Math.round(cs*.78)+'px system-ui';g.textAlign='center';g.fillText(banner.t,0,0);g.restore();}
      if(me&&btn){
        const txt=Math.max(0,me.nb-me.u)+'|'+(me.a&&!S.over);
        if(txt!==lastBtnTxt){lastBtnTxt=txt;badge.textContent=Math.max(0,me.nb-me.u);btn.classList.toggle('off',!(me.a&&me.nb-me.u>0&&!S.over));}
      }
    }

    return{
      mount(r){
        root=r;cvo=mkCanvas(root);
        joyEl=document.createElement('div');joyEl.className='bm-joy';
        bzEl=document.createElement('div');bzEl.className='bm-bz';
        hint=document.createElement('div');hint.className='bm-hint';hint.innerHTML='☝ drag here<br>to move';hint.style.left='0';hint.style.right='40%';hint.style.top='58%';
        joyEl.append(hint);
        btn=document.createElement('div');btn.className='bm-btn';btn.textContent='💣';badge=document.createElement('b');badge.textContent='1';btn.append(badge);
        bzEl.append(btn);
        root.append(joyEl,bzEl);
        joy=Joy(joyEl,(x,y)=>{jx=x;jy=y;if(!hintOff&&(x||y)){hintOff=true;hint.style.display='none';}},{radius:48});
        bzEl.addEventListener('pointerdown',e=>{e.preventDefault();btn.classList.add('dn');dropBomb();});
        const up=()=>btn.classList.remove('dn');
        bzEl.addEventListener('pointerup',up);bzEl.addEventListener('pointercancel',up);bzEl.addEventListener('pointerleave',up);
        keyH=e=>{if((e.key===' '||e.key==='b'||e.key==='B')&&!e.repeat&&e.target.tagName!=='INPUT'){e.preventDefault();dropBomb();}};
        document.addEventListener('keydown',keyH);
        layout();
      },
      start(){started=true;if(S&&mi>=0){const p=S.pl[mi];L={x:p.x,y:p.y,face:p.f,mv:false};}lastFrame=performance.now();},
      update(s,R){
        const now=performance.now();
        prev=S;S=s;
        mi=S.ids.indexOf(c.me());
        S.pl.forEach((p,i)=>{
          const a=snaps[i]||(snaps[i]=[]);a.push({t:now,x:p.x,y:p.y});if(a.length>8)a.shift();
        });
        if(mi>=0&&!L){const p=S.pl[mi];L={x:p.x,y:p.y,face:p.f,mv:false};}
        if(L&&mi>=0){
          const p=S.pl[mi];
          if(p.rj!==lastRj){lastRj=p.rj;L.x=p.x;L.y=p.y;}
          else if(Math.hypot(p.x-L.x,p.y-L.y)>2.6){L.x=p.x;L.y=p.y;}
        }
        for(let k=ghosts.length-1;k>=0;k--){const gh=ghosts[k];if(S.b.some(b=>b[0]===gh.x&&b[1]===gh.y)||now>gh.t)ghosts.splice(k,1);}
        onState();
        if(R&&R.ph!=='play')draw(now);
      },
      frame(rem){
        const now=performance.now();
        const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
        if(S&&L&&started&&c.R().ph==='play'){
          if(myAlive()){simulate(dt);sendClaim(now,false);}
          else L.mv=false;
        }
        draw(now);
      },
      event(m){},
      stop(){
        started=false;
        if(joy)joy.destroy();
        if(keyH)document.removeEventListener('keydown',keyH);
      }
    };
  }
};
})();
