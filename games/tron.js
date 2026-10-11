// LIGHT CYCLES — 3 quick mini-rounds of grid Tron. Host steps the grid at a speed-ramped rate; bikes are described by
// corner polylines + a continuous progress value, clients interpolate (others) / predict (own turns, scheduled by cell index).
(function(){
'use strict';
const TW=28,TH=40,CD1=1.0,CD=2.0,END=1.8,SH_AT=14,SH_STEP=.7,MR_CAP=26,SP0=6.5,SP1=11,SP_T=28,NMINI=3;
const DX=[0,1,0,-1],DY=[-1,0,1,0];
const SPAWN=[[3,6,1],[24,33,3],[24,6,2],[3,33,0]];
const idx=(x,y)=>y*TW+x,inb=(x,y)=>x>=0&&y>=0&&x<TW&&y<TH;
const r2=v=>Math.round(v*100)/100;

function startMini(H,S){
  const n=S.ids.length;S.mr++;
  S._g=new Int8Array(TW*TH).fill(-1);
  S.st='cd';S._cdLen=S.mr===1?CD1:CD;S.cd=S._cdLen;S._pt=0;S.mt=0;S.sh=0;S._ev=0;S._acc=0;S.ph=0;S.sp=SP0;S.win=-2;
  const order=n===2?[0,1]:n===3?[0,2,1]:[0,2,1,3];
  S._b=[];
  for(let i=0;i<n;i++){
    const [x,y,d]=SPAWN[order[(i+S.mr-1)%n]];
    const away=!!H.players[i].aw;
    S._b.push({x,y,d,alive:!away,k:0,gr:0,pts:[x,y,x,y],q:[],aq:0,cs:away?-1:null,mtc:0,dprev:d});
    if(!away)S._g[idx(x,y)]=i;
  }
}
function crash(S,i,at){const b=S._b[i];if(!b.alive)return;b.alive=false;b.cs=at==null?S._ev:at;b.mtc=S.mt;}
function endMini(S){
  const n=S._b.length,key=b=>b.alive?1e9:b.cs;
  const ord=S._b.map((b,i)=>i).sort((a,b)=>key(S._b[b])-key(S._b[a]));
  const rank=[];ord.forEach((i,j)=>{rank[i]=(j>0&&key(S._b[ord[j-1]])===key(S._b[i]))?rank[ord[j-1]]:j;});
  const mp=[];
  for(let i=0;i<n;i++){const p=n-1-rank[i];mp.push(p);S._tot[i]+=p;S._surv[i]+=S._b[i].alive?S.mt:S._b[i].mtc;S.mpts[i].push(p);}
  S.mlast=mp;
  const w=S._b.findIndex(b=>b.alive);
  S.win=w>=0?w:(rank.filter(r=>r===0).length===1?rank.indexOf(0):-1);
  S.st='end';S._pt=0;
}
function ring(S,l){
  const d=l-1;
  for(let y=0;y<TH;y++)for(let x=0;x<TW;x++)if(Math.min(x,y,TW-1-x,TH-1-y)===d)S._g[idx(x,y)]=9;
  S._b.forEach((b,i)=>{if(b.alive&&Math.min(b.x,b.y,TW-1-b.x,TH-1-b.y)<=d)crash(S,i,S._ev+.5);});
}
function step(S){
  const bs=S._b,n=bs.length;
  S._ev++;
  const nx=[];
  for(let i=0;i<n;i++){const b=bs[i];if(!b.alive)continue;
    if(b.q.length&&b.q[0].at<=b.k){const t=b.q.shift();S._ap=(S._ap||0)+1;if(t.late)S._late=(S._late||0)+1;b.d=(b.d+(t.r>0?1:3))&3;b.aq=t.seq;}
    nx[i]=[b.x+DX[b.d],b.y+DY[b.d]];
  }
  const dead=new Set();
  for(let i=0;i<n;i++){
    if(!nx[i])continue;const [x,y]=nx[i];
    if(!inb(x,y)||S._g[idx(x,y)]!==-1){
      // one-step grace: the bike brakes at the wall for a beat so a last-moment (or laggy) turn still counts
      if(!bs[i].gr&&S.mt<MR_CAP-1){bs[i].gr=1;nx[i]=null;}else dead.add(i);
    }else bs[i].gr=0;
  }
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(nx[i]&&nx[j]&&nx[i][0]===nx[j][0]&&nx[i][1]===nx[j][1]){dead.add(i);dead.add(j);}
  for(const i of dead)crash(S,i);
  for(let i=0;i<n;i++){
    const b=bs[i];if(!b.alive||!nx[i])continue;
    b.x=nx[i][0];b.y=nx[i][1];b.k++;S._g[idx(b.x,b.y)]=i;
    if(b.d===b.dprev)b.pts[b.pts.length-2]=b.x,b.pts[b.pts.length-1]=b.y;
    else b.pts.push(b.x,b.y);
    b.dprev=b.d;
  }
}

GAMES.tron={
  name:'Light Cycles',emoji:'🏍️',tag:'Neon bikes, deadly trails, one thumb.',
  min:2,max:4,
  rules:[
    ['👆','Your bike drives itself and leaves a glowing wall. Tap the LEFT half of the screen to turn left, the RIGHT half to turn right.'],
    ['💥','Hit a wall, any trail (even your own) or another bike and you crash out of that mini-round.'],
    ['⚡','The bikes keep speeding up and the arena starts shrinking, so someone always loses.'],
    ['🏁','3 quick mini-rounds back to back. Last bike alive wins each one.'],
    ['🏆','Last alive gets the most points, first to crash gets 0. Most points after 3 rounds wins.']
  ],
  ctrl:'Tap left half = turn left. Tap right half = turn right (from your bike’s point of view).',
  win:'Points over 3 mini-rounds (last alive best). Tie: longest total survival.',
  dur:110,hz:20,better:'high',
  fmt:v=>{const n=Math.floor(v+1e-6);return n+(n===1?' pt':' pts');},

  // ---------------------------------------------------------------- HOST
  init(H){
    const n=H.players.length;
    const S={W:TW,H:TH,ids:H.players.map(p=>p.id),mr:0,hold:2.6,
      _tot:Array(n).fill(0),_surv:Array(n).fill(0),mpts:H.players.map(()=>[]),tot:Array(n).fill(0),pg:Array(n).fill(0),mlast:null};
    startMini(H,S);
    this._pub(S);
    return S;
  },
  _pub(S){
    S.tot=S._tot.slice();
    S.bk=S._b.map(b=>({p:b.pts.slice(),k:b.k,d:b.d,a:b.alive?1:0,aq:b.aq,h:b.gr&&b.alive?1:0}));
    S.shT=S.st==='run'?r2(S.mt<SH_AT?SH_AT-S.mt:SH_AT+S.sh*SH_STEP-S.mt):99;
    S.ph=r2(S.ph);S.cd=r2(S.cd);S.mt=r2(S.mt);
  },
  tick(H,S,dt){
    if(S.over)return;
    H.players.forEach((hp,i)=>{if(hp.aw&&S._b[i].alive&&S.st!=='end')crash(S,i);});
    S._pt+=dt;
    if(S.st==='cd'){
      S.cd=Math.max(0,S._cdLen-S._pt);
      if(S._pt>=S._cdLen){S.st='run';S._pt=0;S.cd=0;}
    }
    if(S.st==='run'){
      S.mt+=dt;
      S.sp=r2(SP0+(SP1-SP0)*Math.min(1,S.mt/SP_T));
      S._acc+=S.sp*dt;
      if(S.mt>=SH_AT){const L=Math.min(14,Math.floor((S.mt-SH_AT)/SH_STEP)+1);while(S.sh<L)ring(S,++S.sh);}
      let guard=0;
      while(S._acc>=1&&S.st==='run'&&guard++<4){
        S._acc-=1;step(S);
        if(S._b.filter(b=>b.alive).length<=1)endMini(S);
      }
      if(S.st==='run'&&S._b.filter(b=>b.alive).length<=1)endMini(S);
      if(S.st==='run'&&S.mt>=MR_CAP){S._b.forEach((b,i)=>crash(S,i));endMini(S);}
      if(S.st==='run')S.ph=S._acc;
    }else if(S.st==='end'){
      if(S._pt>=END){if(S.mr>=NMINI){S.over=true;S.st='over';}else startMini(H,S);}
    }
    this._pub(S);
  },
  act(H,S,pid,m){
    const i=S.ids.indexOf(pid);if(i<0||S.over)return;
    const b=S._b[i];if(!b)return;
    if(m.k==='p'){S.pg[i]=m.id|0;return;}
    if(m.k!=='t'||S.st!=='run'||!b.alive)return;
    const r=m.r>0?1:-1;
    if(b.q.length>=2)return;
    const want=m.at|0;let at=Math.max(b.k,Math.min(b.k+80,want));
    if(b.q.length&&at<=b.q[b.q.length-1].at)at=b.q[b.q.length-1].at+1;
    b.q.push({at,r,seq:m.seq|0,late:want<b.k});
  },
  val(S,id){const i=S.ids.indexOf(id);return i<0?null:S._tot[i]+S._surv[i]/1000;},

  // ---------------------------------------------------------------- CLIENT
  mk(c){
    let cvo,root,zone,started=false,keyH=null;
    let S=null,prev=null,mi=-1,recvT=0,seqN=0,lastMr=-1,lastSt='',lastFlash=-1;
    const polys=[],hist=[],pend=[],parts=[],toasts=[],rtts=[];
    let pingId=0,pingAt=0,pingT=null,shk=0,errX=0,errY=0,tapFlash={l:0,r:0},lw=0,lh=0,cs=13,ox=0,oy=0,hintT=0,lastFrame=0;
    const HUD=76;
    const isH=()=>typeof isHost!=='undefined'&&isHost;
    const rttEst=()=>isH()?.02:Math.max(.03,Math.min(.3,(rtts.length?rtts.slice().sort((a,b)=>a-b)[Math.floor(rtts.length/2)]:.08)+.04));

    function build(pts,k,d){
      const vx=[],vy=[],vs=[];let s=0;
      for(let j=0;j<pts.length;j+=2){
        if(j>0)s+=Math.abs(pts[j]-pts[j-2])+Math.abs(pts[j+1]-pts[j-1]);
        vx.push(pts[j]);vy.push(pts[j+1]);vs.push(s);
      }
      return{vx,vy,vs,td:d,n:vx.length};
    }
    function posAt(P,s){
      const n=P.n;if(!n)return null;
      if(s<=0)return{x:P.vx[0],y:P.vy[0],d:segDir(P,1)};
      const l=n-1;
      if(s>=P.vs[l]){const e=s-P.vs[l];return{x:P.vx[l]+DX[P.td]*e,y:P.vy[l]+DY[P.td]*e,d:P.td};}
      for(let m=l;m>0;m--)if(P.vs[m-1]<=s){
        const len=P.vs[m]-P.vs[m-1];if(len<=0)continue;
        const u=(s-P.vs[m-1])/len;
        return{x:P.vx[m-1]+(P.vx[m]-P.vx[m-1])*u,y:P.vy[m-1]+(P.vy[m]-P.vy[m-1])*u,d:segDir(P,m)};
      }
      return{x:P.vx[0],y:P.vy[0],d:P.td};
    }
    function segDir(P,m){
      for(let q=Math.min(m,P.n-1);q>0;q--){const dx=Math.sign(P.vx[q]-P.vx[q-1]),dy=Math.sign(P.vy[q]-P.vy[q-1]);if(dx||dy)return dx>0?1:dx<0?3:dy>0?2:0;}
      return P.td;
    }
    // visual progress (cells) of a bike from a snapshot
    const svOf=(b,st,ph)=>b.a?(b.h?b.k:(b.k>0?b.k-1+(st==='cd'?0:ph):0)):b.k;
    function myPoly(){
      const b=S.bk[mi],base=polys[mi];
      const P={vx:base.vx.slice(),vy:base.vy.slice(),vs:base.vs.slice(),td:b.d,n:base.n};
      let m=b.k,d=b.d;
      for(const p of pend){
        const v=Math.max(p.v,m);
        if(v>m){const l=P.n-1;P.vx.push(P.vx[l]+DX[d]*(v-m));P.vy.push(P.vy[l]+DY[d]*(v-m));P.vs.push(P.vs[l]+(v-m));P.n++;m=v;}
        d=(d+(p.r>0?1:3))&3;
      }
      P.td=d;return P;
    }
    function pendDir(){let d=S.bk[mi].d;for(const p of pend)d=(d+(p.r>0?1:3))&3;return d;}

    function tap(side){
      if(!started||!S||c.R().ph!=='play')return;
      tapFlash[side<0?'l':'r']=performance.now();
      if(S.st!=='run'||mi<0||!S.bk[mi].a)return;
      if(pend.length>=2)return;
      const b=S.bk[mi],now=performance.now();
      const sv=svOf(b,S.st,S.ph)+S.sp*(now-recvT)/1000;
      let v=Math.ceil(sv+S.sp*rttEst()-1e-6);
      v=Math.max(v,b.k);
      if(pend.length)v=Math.max(v,pend[pend.length-1].v+1);
      const p={seq:++seqN,v,r:side};pend.push(p);
      c.act({k:'t',r:side,at:v,seq:p.seq});
      beep(side<0?520:640,.04,'square',.06);buzz(6);
    }
    function spark(x,y,col,n,sp,life,sz){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(.3+Math.random())*sp;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:life*(.6+Math.random()*.6),m:life,c:col,s:sz*(.6+Math.random()*.8)});}}

    function onState(now){
      if(S.mr!==lastMr){lastMr=S.mr;hist.length=0;pend.length=0;parts.length=0;toasts.length=0;errX=errY=0;lastFlash=-1;}
      S.bk.forEach((b,i)=>{
        polys[i]=build(b.p,b.k,b.d);
        const h=hist[i]||(hist[i]=[]);h.push({t:now,s:svOf(b,S.st,S.ph)});if(h.length>10)h.shift();
        if(prev&&prev.bk[i]&&prev.mr===S.mr&&prev.bk[i].a&&!b.a){
          const P=polys[i],e=posAt(P,P.vs[P.n-1]);
          const col=c.col(S.ids[i]),pl=c.pl(S.ids[i]);
          spark(e.x+DX[b.d]*.5,e.y+DY[b.d]*.5,col,36,9,.9,4);spark(e.x+DX[b.d]*.5,e.y+DY[b.d]*.5,'#fff',10,6,.5,3);
          parts.push({ring:1,x:e.x+DX[b.d]*.5,y:e.y+DY[b.d]*.5,l:.6,m:.6,c:col});
          toasts.push({t:(pl?pl.n:'?')+' crashed!',c:col,at:now});
          shk=Math.max(shk,i===mi?14:8);sfx.boom();buzz(i===mi?[60,30,90]:20);
        }
      });
      if(mi>=0){const b=S.bk[mi];while(pend.length&&pend[0].seq<=b.aq)pend.shift();if(!b.a)pend.length=0;}
      if(S.pg&&mi>=0&&pingT!==null&&S.pg[mi]===pingId){rtts.push((now-pingT)/1000);if(rtts.length>6)rtts.shift();pingT=null;}
      if(S.st==='cd'&&S.mr>1){const f=Math.ceil(S.cd/.67);if(f!==lastFlash&&f>0){lastFlash=f;sfx.count();}}
      if(S.st==='run'&&lastSt==='cd'&&S.mr>1){sfx.go();}
      if(S.st==='end'&&lastSt==='run'){if(S.win===mi&&mi>=0){sfx.good();buzz([30,30,30]);}}
      if(S.over&&!(prev&&prev.over))sfx.win();
      lastSt=S.st;
    }
    function layout(){
      const W=cvo.W,Hh=cvo.H;if(W===lw&&Hh===lh)return;lw=W;lh=Hh;
      cs=Math.min((W-6)/TW,(Hh-HUD-6)/TH);ox=(W-cs*TW)/2;oy=8;
    }
    const X=x=>ox+(x+.5)*cs,Y=y=>oy+(y+.5)*cs;
    function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
    function bikePos(i,now){
      const b=S.bk[i],P=polys[i];
      if(!b.a)return{s:P.vs[P.n-1],P};
      if(i===mi){
        const Pm=myPoly(),sv=svOf(b,S.st,S.ph)+(S.st==='run'?S.sp*Math.max(0,Math.min(.25,(now-recvT)/1000)):0);
        return{s:sv,P:Pm};
      }
      const h=hist[i],T=now-90;let s=h[h.length-1].s;
      if(h.length>1&&T<h[h.length-1].t){
        if(T<=h[0].t)s=h[0].s;
        else for(let k=h.length-1;k>0;k--){const a=h[k-1],bb=h[k];if(T>=a.t&&T<=bb.t){s=a.s+(bb.s-a.s)*(T-a.t)/Math.max(1,bb.t-a.t);break;}}
      }
      return{s,P};
    }
    function trailPath(g,P,s){
      g.beginPath();
      let started=false;
      for(let m=0;m<P.n;m++){
        if(P.vs[m]>=s&&m>0)break;
        if(!started){g.moveTo(X(P.vx[m]),Y(P.vy[m]));started=true;}else g.lineTo(X(P.vx[m]),Y(P.vy[m]));
      }
      const e=posAt(P,s);if(e){if(!started)g.moveTo(X(e.x),Y(e.y));g.lineTo(X(e.x),Y(e.y));}
    }
    function draw(now,dt){
      const g=cvo.g,W=cvo.W,Hh=cvo.H;
      g.clearRect(0,0,W,Hh);layout();if(!S||!S.bk[0])return;
      shk=Math.max(0,shk-shk*dt*8-dt*2);
      g.save();if(shk>.2)g.translate((Math.random()-.5)*shk,(Math.random()-.5)*shk);
      const aw=cs*TW,ah=cs*TH;
      g.fillStyle='#07070f';g.fillRect(ox,oy,aw,ah);
      g.strokeStyle='#ffffff0d';g.lineWidth=1;g.beginPath();
      for(let x=0;x<=TW;x++){g.moveTo(ox+x*cs,oy);g.lineTo(ox+x*cs,oy+ah);}
      for(let y=0;y<=TH;y++){g.moveTo(ox,oy+y*cs);g.lineTo(ox+aw,oy+y*cs);}
      g.stroke();
      // shrinking walls
      if(S.sh>0){
        const L=S.sh;g.fillStyle='#3a1028';
        g.fillRect(ox,oy,aw,L*cs);g.fillRect(ox,oy+ah-L*cs,aw,L*cs);g.fillRect(ox,oy+L*cs,L*cs,ah-2*L*cs);g.fillRect(ox+aw-L*cs,oy+L*cs,L*cs,ah-2*L*cs);
        g.strokeStyle='#ff4d6d';g.lineWidth=2;g.strokeRect(ox+L*cs,oy+L*cs,aw-2*L*cs,ah-2*L*cs);
      }
      if(S.st==='run'&&S.shT<1.6||S.sh>0&&S.st==='run'){
        const L=Math.min(S.sh,13);g.strokeStyle='rgba(255,77,109,'+(.35+.35*Math.sin(now/90))+')';g.lineWidth=3;
        g.strokeRect(ox+(L+.5)*cs,oy+(L+.5)*cs,aw-(2*L+1)*cs,ah-(2*L+1)*cs);
      }
      g.lineWidth=2;g.strokeStyle='#2d2d62';g.strokeRect(ox-1,oy-1,aw+2,ah+2);
      // trails + bikes
      g.lineJoin='round';g.lineCap='round';
      const heads=[];
      for(let i=0;i<S.bk.length;i++){
        const b=S.bk[i];if(b.k===0&&!b.a)continue;
        const col=c.col(S.ids[i]),bp=bikePos(i,now);
        let s=bp.s,P=bp.P,pos=posAt(P,s);if(!pos)continue;
        if(i===mi&&b.a){errX*=Math.exp(-dt*14);errY*=Math.exp(-dt*14);pos={x:pos.x+errX,y:pos.y+errY,d:pos.d};}
        const dead=!b.a,al=dead?.5:1;
        g.globalAlpha=al;
        trailPath(g,P,s);
        g.strokeStyle=col+'30';g.lineWidth=cs*1.25;g.stroke();
        g.strokeStyle=col+'aa';g.lineWidth=cs*.62;g.stroke();
        g.strokeStyle=col;g.lineWidth=cs*.4;g.stroke();
        g.strokeStyle='#ffffffaa';g.lineWidth=cs*.12;g.stroke();
        g.globalAlpha=1;
        if(!dead)heads.push({i,pos,col,b});
      }
      for(const h of heads){
        const {i,pos,col,b}=h,px=X(pos.x),py=Y(pos.y);
        const dir=i===mi?pendDir():pos.d;
        const a=dir*Math.PI/2;
        g.save();g.translate(px,py);
        g.fillStyle=col+'55';g.beginPath();g.arc(0,0,cs*1.1+Math.sin(now/120)*1,0,6.283);g.fill();
        g.rotate(pos.d*Math.PI/2);
        g.fillStyle='#fff';rr(g,-cs*.3,-cs*.5,cs*.6,cs*1.0,cs*.25);g.fill();
        g.fillStyle=col;rr(g,-cs*.2,-cs*.42,cs*.4,cs*.6,cs*.18);g.fill();
        g.restore();
        // heading arrow (shows the queued turn instantly)
        g.save();g.translate(px,py);g.rotate(a);g.fillStyle=i===mi?'#fff':col;
        g.beginPath();g.moveTo(0,-cs*1.9);g.lineTo(cs*.7,-cs*1.0);g.lineTo(-cs*.7,-cs*1.0);g.closePath();g.fill();g.restore();
        const pl=c.pl(S.ids[i]),nm=(pl?pl.n:'?').slice(0,6);
        g.font='800 '+Math.max(9,Math.round(cs*.8))+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
        const tw=g.measureText(nm).width+8,ty=py+(pos.d===2?-cs*2.6:cs*2.3);
        const tx=Math.max(tw/2+2,Math.min(cvo.W-tw/2-2,px)),ty2=Math.max(oy+cs,Math.min(oy+ah-cs,ty));g.fillStyle='#0b0b17cc';rr(g,tx-tw/2,ty2-cs*.6,tw,cs*1.2,cs*.4);g.fill();g.fillStyle=col;g.fillText(i===mi?'YOU':nm,tx,ty2+1);
      }
      // particles
      for(let k=parts.length-1;k>=0;k--){
        const q=parts[k];q.l-=dt;if(q.l<=0){parts.splice(k,1);continue;}
        if(q.ring){const u=1-q.l/q.m;g.strokeStyle=q.c;g.globalAlpha=1-u;g.lineWidth=3;g.beginPath();g.arc(X(q.x),Y(q.y),u*cs*7,0,6.283);g.stroke();g.globalAlpha=1;continue;}
        q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.97;q.vy*=.97;
        g.globalAlpha=Math.min(1,q.l/q.m*1.5);g.fillStyle=q.c;g.fillRect(X(q.x)-q.s/2,Y(q.y)-q.s/2,q.s,q.s);
      }
      g.globalAlpha=1;g.restore();
      // edge hints (coloured, in my colour)
      const mine=mi>=0?c.col(S.ids[mi]):'#fff',alive=mi>=0&&S.bk[mi].a;
      const hintA=alive?.28:.1;
      const fl=(t)=>Math.max(0,1-(now-t)/220);
      for(const side of[0,1]){
        const x0=side?W-18:0,fa=fl(side?tapFlash.r:tapFlash.l),gr=g.createLinearGradient(x0,0,side?W:18,0);
        gr.addColorStop(side?1:0,mine+(fa>0?'ff':Math.round(hintA*255).toString(16).padStart(2,'0')));gr.addColorStop(side?0:1,mine+'00');
        g.fillStyle=gr;g.fillRect(x0,0,18,Hh);
        if(fa>0){g.fillStyle='rgba(255,255,255,'+fa*.12+')';g.fillRect(side?W/2:0,0,W/2,Hh);}
      }
      // big tap-zone hint under the HUD (fills the empty bottom area)
      {const zy=oy+ah+HUD*.3+HUD*.62+10,zh=Hh-zy-8;
        if(zh>40){for(const side of[0,1]){const zx=side?W/2+3:8,zw=W/2-11,fa=fl(side?tapFlash.r:tapFlash.l);
          g.fillStyle=mine+(fa>0?'55':'14');rr(g,zx,zy,zw,zh,16);g.fill();g.strokeStyle=mine+(fa>0?'ff':'44');g.lineWidth=2;g.stroke();
          g.fillStyle=mine+(fa>0?'ff':'99');g.textAlign='center';g.textBaseline='middle';
          g.font='900 '+Math.min(54,Math.round(zh*.4))+'px system-ui';g.fillText(side?'↱':'↰',zx+zw/2,zy+zh*.4);
          g.font='900 15px system-ui';g.fillText(side?'TAP = TURN RIGHT':'TAP = TURN LEFT',zx+zw/2,zy+zh*.72);}}}
      // toasts
      let ty=oy+cs*4;
      for(let k=toasts.length-1;k>=0;k--){
        const t=toasts[k],u=(now-t.at)/1800;if(u>=1){toasts.splice(k,1);continue;}
        g.globalAlpha=Math.min(1,(1-u)*2);g.font='900 '+Math.round(Math.max(15,cs*1.35))+'px system-ui';g.textAlign='center';g.textBaseline='middle';
        g.fillStyle='#000a';const tw=g.measureText(t.t).width+22;rr(g,W/2-tw/2,ty-cs*1.1,tw,cs*2.2,cs);g.fill();g.fillStyle=t.c;g.fillText(t.t,W/2,ty);ty+=cs*2.8;g.globalAlpha=1;
      }
      // countdown / banner
      g.textAlign='center';g.textBaseline='middle';
      if(S.st==='cd'){
        g.fillStyle='rgba(7,7,15,.45)';g.fillRect(ox,oy+ah*.38,aw,cs*9);
        g.fillStyle='#ffd23f';g.font='900 '+Math.round(cs*1.9)+'px system-ui';g.fillText('ROUND '+S.mr+' / '+NMINI,W/2,oy+ah*.38+cs*2.2);
        if(S.mr>1){const f=Math.max(1,Math.ceil(S.cd/.67)),u=(S.cd%.67)/.67;g.save();g.translate(W/2,oy+ah*.38+cs*6);g.scale(1+(1-u)*.4,1+(1-u)*.4);g.fillStyle='#fff';g.font='900 '+Math.round(cs*4)+'px system-ui';g.fillText(String(f),0,0);g.restore();}
        else{g.fillStyle='#fff';g.font='800 '+Math.round(cs*1.2)+'px system-ui';g.fillText('Get ready…',W/2,oy+ah*.38+cs*6);}
      }else if(S.st==='run'&&S.mt<.45&&S.mr>1){g.fillStyle='rgba(82,255,122,'+(1-S.mt/.45)+')';g.font='900 '+Math.round(cs*5)+'px system-ui';g.fillText('GO!',W/2,oy+ah*.4);}
      else if(S.st==='end'||S.st==='over'){
        const w=S.win,nm=w>=0?(c.pl(S.ids[w])?c.pl(S.ids[w]).n:'?'):'';
        g.fillStyle='rgba(7,7,15,.7)';g.fillRect(ox,oy+ah*.34,aw,cs*13);
        const fin=S.mr>=NMINI;
        g.fillStyle=w>=0?c.col(S.ids[w]):'#ffd23f';g.font='900 '+Math.round(cs*1.8)+'px system-ui';
        g.fillText(w>=0?'🏁 '+nm+' wins!':'💥 Nobody wins!',W/2,oy+ah*.34+cs*2.2);
        g.fillStyle='#cfcff0';g.font='800 '+Math.round(cs*1.1)+'px system-ui';g.fillText(fin?'Final round done':'Round '+S.mr+' done',W/2,oy+ah*.34+cs*4.4);
        const n=S.bk.length;
        g.font='800 '+Math.round(cs*1.05)+'px system-ui';
        for(let i=0;i<n;i++){const p=c.pl(S.ids[i]);g.fillStyle=c.col(S.ids[i]);g.textAlign='left';g.fillText((p?p.n:'?').slice(0,8),ox+aw*.22,oy+ah*.34+cs*(7+i*1.9));g.textAlign='right';g.fillText('+'+(S.mlast?S.mlast[i]:0),ox+aw*.78,oy+ah*.34+cs*(7+i*1.9));}
        g.textAlign='center';
      }
      // arena warnings
      if(S.st==='run'){
        let msg='',col='#ffd23f';
        if(S.sh>0){msg='⚠ ARENA SHRINKING';col='#ff6b6b';}else if(S.shT<4){msg='Walls close in '+Math.ceil(S.shT)+'s';}
        if(msg){g.fillStyle=col;g.font='900 '+Math.round(Math.max(12,cs*1.0))+'px system-ui';g.textAlign='center';g.fillText(msg,W/2,oy+ah+HUD*.12+2);}
      }
      // HUD: score chips
      const n=S.bk.length,cw=Math.min(112,(W-12-(n-1)*6)/n),tot=cw*n+(n-1)*6;let hx=(W-tot)/2;const hy=oy+ah+HUD*.3;
      for(let i=0;i<n;i++){
        const p=c.pl(S.ids[i]),col=c.col(S.ids[i]),b=S.bk[i];
        g.globalAlpha=b.a||S.st==='cd'?1:.55;
        g.fillStyle='#171734';rr(g,hx,hy,cw,HUD*.62,10);g.fill();g.fillStyle=col;g.fillRect(hx+6,hy+HUD*.62-4,cw-12,3);
        g.fillStyle='#fff';g.font='800 12px system-ui';g.textAlign='left';g.textBaseline='middle';
        g.fillText(((p?p.n:'?').slice(0,6)+(i===mi?' ★':'')),hx+8,hy+12);
        g.font='900 22px system-ui';g.textAlign='right';g.fillStyle=col;g.fillText(String(S.tot[i]),hx+cw-8,hy+14);
        for(let r=0;r<NMINI;r++){
          const px0=hx+8+r*24,v=S.mpts[i][r];
          g.fillStyle=v===undefined?'#ffffff18':'#ffffff30';rr(g,px0,hy+HUD*.62-24,20,15,4);g.fill();
          if(v!==undefined){g.fillStyle='#fff';g.font='800 11px system-ui';g.textAlign='center';g.fillText(String(v),px0+10,hy+HUD*.62-16);}
        }
        g.globalAlpha=1;hx+=cw+6;
      }
    }

    return{
      mount(r){
        root=r;
        if(!document.getElementById('st-tron')){const st=document.createElement('style');st.id='st-tron';st.textContent='.tr-zone{position:absolute;inset:0;touch-action:none;z-index:2}';document.head.append(st);}
        cvo=mkCanvas(root);
        zone=document.createElement('div');zone.className='tr-zone';root.append(zone);
        zone.addEventListener('pointerdown',e=>{e.preventDefault();const rc=zone.getBoundingClientRect();tap(e.clientX<rc.left+rc.width/2?-1:1);});
        keyH=e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowLeft'||e.key==='a'){e.preventDefault();tap(-1);}else if(e.key==='ArrowRight'||e.key==='d'){e.preventDefault();tap(1);}};
        document.addEventListener('keydown',keyH);
      },
      start(){started=true;pingT=null;},
      update(s,R){
        const now=performance.now();
        let o=null;
        if(S&&mi>=0&&S.bk[mi]&&S.bk[mi].a&&S.st==='run'){const bp=bikePos(mi,now);o=posAt(bp.P,bp.s);}
        prev=S;S=s;recvT=now;mi=S.ids.indexOf(c.me());
        onState(now);
        if(o&&prev&&prev.mr===S.mr&&mi>=0&&S.bk[mi].a&&S.st==='run'){
          const bp=bikePos(mi,now),nw=posAt(bp.P,bp.s);
          errX+=o.x-nw.x;errY+=o.y-nw.y;if(Math.hypot(errX,errY)>3)errX=errY=0;
        }
        if(R&&R.ph!=='play')draw(now,.016);
      },
      frame(rem){
        const now=performance.now(),dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
        if(S&&started&&c.R().ph==='play'&&pingT===null&&now-pingAt>700&&mi>=0&&!isH()){pingAt=now;pingT=now;pingId=(pingId+1)&0xffff;c.act({k:'p',id:pingId});}
        draw(now,dt);
      },
      event(m){},
      stop(){started=false;if(keyH)document.removeEventListener('keydown',keyH);}
    };
  }
};
})();
