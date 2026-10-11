// Sumo Slingshot (turn-based, simultaneous planning): PLAN (aim + lock in) -> everybody launches at once -> floor drops -> repeat.
GAMES.sumo=(function(){
  const PR=0.115,            // puck radius (platform radius = 1)
        K=1.2,C=0.35,        // slide friction: dv/dt = -(K*v + C)
        VMAX=1.55,           // launch speed at full power
        VCAP=2.4,            // absolute speed cap
        REST=0.9,            // collision restitution (equal masses)
        PLAN=[6,6,5,5,5,4],  // plan seconds per turn (last value repeats)
        GO_MAX=5,            // hard cap on a resolve (everything is stopped after this)
        DROP_T=1.5,          // floor-drop pause
        STAGES=[0.88,0.76,0.65,0.55,0.46,0.38,0.31,0.25,0.2,0.15,0.1], // floor radius after each turn
        FALLT=1.1,           // fall animation length (s)
        MAXDRAG=120,         // px of drag for full power
        PULL=64;             // px the slingshot band stretches at full power
  const cl=(x,a,b)=>Math.max(a,Math.min(b,x));
  const FALLS=['%s fell off! 🫠','%s took a swim 🏊','%s discovered gravity 🍎','%s went skydiving 🪂','%s ran out of floor','%s got launched into orbit 🚀','%s is gone. Bye 👋','%s slipped on nothing'];
  function fric(p,h,m){
    const s=Math.hypot(p.vx,p.vy);if(s<1e-6)return;
    const s2=Math.max(0,s*Math.exp(-K*(m||1)*h)-C*(m||1)*h),f=s2/s;p.vx*=f;p.vy*=f;
  }
  const planTime=turn=>PLAN[Math.min(PLAN.length,turn)-1];
  // ---- host helpers ----
  const PG={
    go(H,S){
      for(const p of S.pk){const mv=S._mv[p.id];if(p.a&&mv){p.vx=mv.dx*mv.p*VMAX;p.vy=mv.dy*mv.p*VMAX;}}
      S.ph='go';S.gt=0;S.pt=0;H.emit({k:'go'});
    },
    fall(H,S,p,tt){p.a=0;p.f=0.001;S._out[p.id]={turn:S.turn,t:tt!=null?tt:S.t};H.emit({k:'fall',id:p.id,m:Math.floor(Math.random()*FALLS.length)});},
    sim(H,S,dt){
      const act=S.pk.filter(p=>p.a);
      let vm=0;act.forEach(p=>{vm=Math.max(vm,Math.hypot(p.vx,p.vy));});
      const n=Math.max(4,Math.ceil(vm*dt/(PR*0.35))),h=dt/n,fm=S.gt>3.2?3:1;
      for(let i=0;i<n;i++){
        for(const p of act){if(!p.a)continue;p.x+=p.vx*h;p.y+=p.vy*h;fric(p,h,fm);}
        for(let a=0;a<act.length;a++)for(let b=a+1;b<act.length;b++){
          const A=act[a],B=act[b];if(!A.a||!B.a)continue;
          const dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy);
          if(d>=2*PR)continue;
          let nx,ny;if(d<1e-6){const an=Math.random()*6.283;nx=Math.cos(an);ny=Math.sin(an);}else{nx=dx/d;ny=dy/d;}
          const ov=2*PR-d;
          A.x-=nx*ov/2;A.y-=ny*ov/2;B.x+=nx*ov/2;B.y+=ny*ov/2;
          const vn=(A.vx-B.vx)*nx+(A.vy-B.vy)*ny;
          if(vn>0){
            const j=(1+REST)/2*vn;A.vx-=j*nx;A.vy-=j*ny;B.vx+=j*nx;B.vy+=j*ny;
            const key=A.id+'-'+B.id;
            if(vn>0.3&&(S.t-(S._hitT[key]||-9))>0.12){S._hitT[key]=S.t;H.emit({k:'hit',x:(A.x+B.x)/2,y:(A.y+B.y)/2,v:+vn.toFixed(2),a:A.id,b:B.id});}
          }
        }
        for(const p of act)if(p.a&&Math.hypot(p.x,p.y)>S.R)PG.fall(H,S,p);
      }
      for(const p of act){if(!p.a)continue;const s=Math.hypot(p.vx,p.vy);if(s>VCAP){p.vx*=VCAP/s;p.vy*=VCAP/s;}}
    },
    endGo(H,S){
      S.ph='drop';S.dt=DROP_T;S.R=S.nR;
      for(const p of S.pk)if(p.a){p.vx=p.vy=0;if(Math.hypot(p.x,p.y)>S.R)PG.fall(H,S,p,S.t-(Math.hypot(p.x,p.y)-S.R)*4);}
      H.emit({k:'drop',r:S.R});
    },
    next(H,S){
      S.turn++;S.ph='plan';S.pl=S.pt=planTime(S.turn);S.lk={};S._mv={};S.gt=0;
      let nr=STAGES[Math.min(STAGES.length-1,S.turn-1)];
      if(S.t>95)nr=0.1;                       // safety: late rounds collapse fast so they always end
      S.nR=Math.max(0.06,Math.min(nr,S.R-0.015));
    }
  };
  return{
    name:'Sumo Slingshot',emoji:'🥊',tag:'Plan your shot, lock in, everyone launches at once.',
    min:2,max:4,
    rules:[
      ['🎯','Each turn you get a few seconds to PLAN. Press anywhere and drag BACK on your puck like a slingshot. Further pull = harder launch.'],
      ['🔒','Tap LOCK IN when you are happy (it locks itself when time runs out). Everyone sees WHO is locked, but not what they picked.'],
      ['💥','Then ALL pucks launch at the same moment and slide into each other. There is no landing preview, so guess the distance!'],
      ['🕳️','The red outer ring of the floor drops after every turn. Be inside it, or fall.'],
      ['👑','Slide off the edge and you are out. Last puck standing wins. Predict where the others will go!']
    ],
    ctrl:'Drag back on your puck to aim, then tap 🔒 LOCK IN.',
    win:'Last puck standing wins. Knocked off in the same resolve = a tie.',
    dur:120,hz:20,

    // ---------------- host ----------------
    init(H){
      const ps=H.players,n=ps.length,rot=Math.random()*6.283,pk=[],out={};
      ps.forEach((p,i)=>{
        const a=rot+6.283*i/n;
        pk.push({id:p.id,x:+(Math.cos(a)*0.5).toFixed(3),y:+(Math.sin(a)*0.5).toFixed(3),vx:0,vy:0,a:p.aw?0:1,f:0,g:p.aw?1:0});
        if(p.aw)out[p.id]={turn:0,t:-1};
      });
      return{R:1,nR:STAGES[0],ph:'plan',turn:1,pt:PLAN[0],pl:PLAN[0],dt:0,gt:0,pk,lk:{},tk:0,win:-1,_out:out,_mv:{},_hitT:{}};
    },
    tick(H,S,dt){
      if(S.over)return;
      S.tk++;
      for(const pk of S.pk){
        const pl=H.players.find(p=>p.id===pk.id);
        if(pl&&pl.aw&&(pk.a||!pk.g)){if(pk.a)S._out[pk.id]={turn:S.turn,t:S.t,aw:1};pk.a=0;pk.g=1;delete S._mv[pk.id];}
        if(!pk.a&&!pk.g&&pk.f>0){pk.f+=dt;pk.x+=pk.vx*dt;pk.y+=pk.vy*dt;fric(pk,dt);}
      }
      const alive=S.pk.filter(p=>p.a);
      if(S.ph==='plan'){
        S.pt=Math.max(0,S.pt-dt);
        if(alive.length&&alive.every(p=>S.lk[p.id])&&S.pt>0.6)S.pt=0.6;   // everyone locked: short beat, then go
        if(S.pt<=0)PG.go(H,S);
      }else if(S.ph==='go'){
        PG.sim(H,S,dt);S.gt+=dt;
        const live=S.pk.filter(p=>p.a);
        if(S.gt>0.6&&live.every(p=>Math.hypot(p.vx,p.vy)<0.04))PG.endGo(H,S);
        else if(S.gt>GO_MAX){live.forEach(p=>{p.vx=p.vy=0;});PG.endGo(H,S);}
      }else if(S.ph==='drop'){
        S.dt-=dt;if(S.dt<=0)PG.next(H,S);
      }
      for(const p of S.pk){
        p.x=Math.round(p.x*1e4)/1e4;p.y=Math.round(p.y*1e4)/1e4;p.vx=Math.round(p.vx*1e3)/1e3;p.vy=Math.round(p.vy*1e3)/1e3;
      }
      const al=S.pk.filter(p=>p.a);
      if(al.length===0||(al.length===1&&S.ph!=='go')){S.over=true;S.hold=2.4;S.win=al.length?al[0].id:-1;}
    },
    act(H,S,pid,m){
      if(!m||S.over||S.ph!=='plan')return;
      const pk=S.pk.find(p=>p.id===pid);if(!pk||!pk.a||S.lk[pid])return;
      if(m.k!=='A'&&m.k!=='K')return;
      if(m.dx!==undefined||m.k==='A'){
        const dx=+m.dx,dy=+m.dy,pw=+m.p;
        if(!isFinite(dx)||!isFinite(dy)||!isFinite(pw))return;
        const l=Math.hypot(dx,dy),p=cl(pw,0,1);
        if(l<1e-6||p<0.05)delete S._mv[pid];else S._mv[pid]={dx:dx/l,dy:dy/l,p};
      }
      if(m.k==='K'){S.lk[pid]=1;H.emit({k:'lock',id:pid});}
    },
    score(H,S){
      const n=H.players.length,al=S.pk.filter(p=>p.a).map(p=>p.id),rows=[];
      al.forEach(id=>rows.push({id,rank:0,label:al.length===1?'🏆 last puck standing':'still standing'}));
      const dead=H.players.filter(p=>!al.includes(p.id)).map(p=>{const o=S._out[p.id]||{turn:0,t:-2};return{id:p.id,turn:o.turn,t:o.t};});
      dead.sort((a,b)=>(b.turn-a.turn)||(b.t-a.t));
      let rank=al.length,gi=0;
      dead.forEach((d,i)=>{
        if(i>0){const q=dead[i-1];if(!(q.turn===d.turn&&q.t-d.t<0.3)){rank=al.length+i;}}
        const pl=H.players.find(p=>p.id===d.id);
        rows.push({id:d.id,rank,label:(pl&&pl.aw)?'left':(d.turn===0?'—':'fell off (turn '+d.turn+')')});
      });
      rows.forEach(r=>{const p=H.players.find(q=>q.id===r.id);r.pts=(p&&p.aw)?0:Math.max(0,n-r.rank);});
      return rows;
    },

    // ---------------- client ----------------
    mk(c){
      let S=null,root,cvo,g,btn,running=false,snapAt=performance.now(),lastFrame=performance.now();
      const rs={};                    // per-puck render state
      let drag=null,aim=null,lastAimSent=0,shake=0,parts=[],toasts=[],hinted=false,lastTurn=0,lastPh='',lastLk=0;
      let prevR=1,dropAnim=null,over=false,vig=0;
      const dbg=window.__ttSumo={};
      const mePk=()=>S&&S.pk.find(p=>p.id===c.me());
      const canAim=()=>S&&S.ph==='plan'&&running&&c.R().ph==='play'&&!S.over&&(()=>{const m=mePk();return m&&m.a&&!S.lk[c.me()];})();
      function css(){
        if(document.getElementById('st-sumo'))return;
        const st=document.createElement('style');st.id='st-sumo';
        st.textContent='.sumo-lock{position:absolute;left:14px;right:14px;bottom:12px;height:58px;border-radius:18px;border:0;z-index:6;font:900 20px system-ui,sans-serif;color:#2a1700;background:linear-gradient(180deg,#ffd23f,#ff9f1c);box-shadow:0 5px 0 #a86300;touch-action:none;-webkit-user-select:none;user-select:none}'
          +'.sumo-lock:active{transform:translateY(3px);box-shadow:0 2px 0 #a86300}'
          +'.sumo-lock.off{background:#2a2a58;color:#cfcff0;box-shadow:0 5px 0 #14142f;opacity:.75}'
          +'.sumo-lock.done{background:linear-gradient(180deg,#52ff7a,#27c457);color:#06240f;box-shadow:0 5px 0 #14753a}';
        document.head.append(st);
      }
      function lay(){const W=cvo.W,H=cvo.H,sc=Math.max(40,Math.min(W/2-10,(H-56-104)/2));return{W,H,sc,cx:W/2,cy:54+(H-54-104)/2+4};}
      function sparks(x,y,col,n,sp){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(0.3+Math.random())*sp;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,col,r:1.5+Math.random()*2.2});}}
      function toast(t,col){toasts.push({t,col,e:performance.now()+2300});if(toasts.length>3)toasts.shift();}
      function stepSim(s,e){let t=0;while(t<e){const h=Math.min(1/60,e-t);s.x+=s.vx*h;s.y+=s.vy*h;fric(s,h);t+=h;}}
      function sendAim(final){
        if(!canAim())return;
        const now=performance.now();if(!final&&now-lastAimSent<45)return;lastAimSent=now;
        c.act(aim?{k:'A',dx:aim.dx,dy:aim.dy,p:aim.p}:{k:'A',dx:0,dy:0,p:0});
      }
      function press(e){
        if(drag||!canAim())return;
        const r=root.getBoundingClientRect();if(e.clientY-r.top<46)return;   // ignore presses that start on the HUD strip
        drag={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,passed:false};hinted=true;
        try{root.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();
      }
      function updAim(){
        if(!drag)return;
        const dx=drag.x0-drag.x,dy=drag.y0-drag.y,len=Math.hypot(dx,dy);
        if(len>=18){drag.passed=true;aim={dx:+(dx/len).toFixed(3),dy:+(dy/len).toFixed(3),p:+cl((len-12)/(MAXDRAG-12),0,1).toFixed(3)};sendAim(false);}
        else if(drag.passed){aim=null;sendAim(false);}   // dragged back to the puck = cancel
      }
      function move(e){if(drag&&e.pointerId===drag.id){drag.x=e.clientX;drag.y=e.clientY;updAim();e.preventDefault();}}
      function release(e,cancel){
        if(!drag||e.pointerId!==drag.id)return;
        if(!cancel){drag.x=e.clientX||drag.x;drag.y=e.clientY||drag.y;updAim();}
        drag=null;sendAim(true);
      }
      function lockNow(){
        if(!canAim())return;
        c.act(aim?{k:'K',dx:aim.dx,dy:aim.dy,p:aim.p}:{k:'K'});
        beep(660,.08,'triangle',.1);buzz(15);
      }
      function drawPuck(p,r,L,now,mine){
        const x=L.cx+r.sim.x*L.sc,y=L.cy+r.sim.y*L.sc;let rad=PR*L.sc,alpha=1,yo=0;
        if(p.g)return;
        if(!p.a){const f=Math.max(0.001,(p.f||0.001)+(r.fAdd||0));if(f>FALLT)return;const q=f/FALLT;rad*=1-q*0.75;alpha=1-q*q;yo=q*q*70;}
        const col=c.col(p.id);
        g.save();g.globalAlpha=alpha;g.translate(x,y+yo);
        if(p.a){g.fillStyle='#0006';g.beginPath();g.ellipse(2,rad*0.42,rad*1.0,rad*0.8,0,0,6.283);g.fill();}
        const gr=g.createRadialGradient(-rad*.3,-rad*.35,rad*.1,0,0,rad);gr.addColorStop(0,'#ffffffcc');gr.addColorStop(.25,col);gr.addColorStop(1,col);
        g.fillStyle=col;g.beginPath();g.arc(0,0,rad,0,6.283);g.fill();
        g.fillStyle=gr;g.globalAlpha=alpha*.55;g.beginPath();g.arc(0,0,rad,0,6.283);g.fill();g.globalAlpha=alpha;
        g.lineWidth=Math.max(2,rad*.16);g.strokeStyle='#00000055';g.beginPath();g.arc(0,0,rad*.98,0,6.283);g.stroke();
        g.strokeStyle='#ffffff66';g.lineWidth=2;g.beginPath();g.arc(0,0,rad*.62,0,6.283);g.stroke();
        if(mine){g.strokeStyle='#fff';g.lineWidth=2.5;g.beginPath();g.arc(0,0,rad+3,0,6.283);g.stroke();}
        g.restore();
        if(p.a){
          const pl=c.pl(p.id);let nm=mine?'YOU':(pl?pl.n:'?');if(nm.length>8)nm=nm.slice(0,7)+'…';
          g.font='800 11px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='#000a';g.strokeText(nm,x,y-rad-9);g.fillStyle='#fff';g.fillText(nm,x,y-rad-9);
          if(S.ph==='plan'){g.font='14px system-ui,sans-serif';g.fillText(S.lk[p.id]?'🔒':'💭',x,y-rad-23);}
        }
      }
      function drawAim(x,y,rad,now){
        let ax=0,ay=0,pw=0;
        if(aim){ax=aim.dx;ay=aim.dy;pw=aim.p;}else return;
        const col=pw<.5?'#52ff7a':(pw<.85?'#ffd23f':'#ff5060'),back=rad+pw*PULL;
        const px=x-ax*back,py=y-ay*back,nx=-ay,ny=ax;
        // stretched band (behind the puck) - shows pull only, never where you will land
        g.fillStyle=col;g.globalAlpha=.25;g.beginPath();g.moveTo(x+nx*rad*.8,y+ny*rad*.8);g.lineTo(px,py);g.lineTo(x-nx*rad*.8,y-ny*rad*.8);g.closePath();g.fill();g.globalAlpha=1;
        g.strokeStyle=col;g.lineWidth=4;g.lineCap='round';
        g.beginPath();g.moveTo(x+nx*rad*.8,y+ny*rad*.8);g.lineTo(px,py);g.lineTo(x-nx*rad*.8,y-ny*rad*.8);g.stroke();
        g.fillStyle=col;g.beginPath();g.arc(px,py,6,0,6.283);g.fill();
        // fixed-size direction chevron in front (size does not depend on power)
        const hx=x+ax*(rad+10),hy=y+ay*(rad+10);g.beginPath();g.moveTo(hx+ax*10,hy+ay*10);g.lineTo(hx-ay*8-ax*3,hy+ax*8-ay*3);g.lineTo(hx+ay*8-ax*3,hy-ax*8-ay*3);g.closePath();g.fill();
        if(drag){g.strokeStyle='#ffffff55';g.lineWidth=2;const r0=root.getBoundingClientRect();g.beginPath();g.arc(drag.x-r0.left,drag.y-r0.top,14,0,6.283);g.stroke();}
      }
      function draw(dt,now){
        const L=lay(),W=L.W,Hh=L.H,cx=L.cx,cy=L.cy,sc=L.sc;
        g.clearRect(0,0,W,Hh);g.fillStyle='#0b0b17';g.fillRect(0,0,W,Hh);
        if(!S)return;
        g.save();
        if(shake>0.1){g.translate((Math.random()-.5)*shake*2,(Math.random()-.5)*shake*2);shake*=Math.pow(0.003,dt);}
        g.fillStyle='#ffffff14';for(let i=0;i<26;i++){const sx=(i*97.3)%W,sy=(i*53.7+now*0.004*(1+i%3))%Hh;g.fillRect(sx,sy,2,2);}
        const R=S.R,tele=S.ph!=='drop'&&S.nR<R-0.001;
        const disc=(rad,off,fill,stroke)=>{g.beginPath();g.arc(cx,cy+off,rad*sc,0,6.283);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=3;g.stroke();}};
        if(dropAnim){
          const q=(now-dropAnim.t0)/900;
          if(q>=1)dropAnim=null;else{g.save();g.globalAlpha=1-q;g.translate(0,q*q*120);g.beginPath();g.arc(cx,cy,dropAnim.r0*sc,0,Math.PI*2);g.arc(cx,cy,dropAnim.r1*sc,0,Math.PI*2);g.fillStyle='#7a3347';g.fill('evenodd');g.restore();}
        }
        disc(R,10,'#05050c');
        const pg=g.createRadialGradient(cx,cy,sc*0.05,cx,cy,R*sc);pg.addColorStop(0,'#2a2a5a');pg.addColorStop(1,'#1b1b3e');
        disc(R,0,pg,'#8d8dc9');
        g.save();g.beginPath();g.arc(cx,cy,R*sc,0,6.283);g.clip();
        g.strokeStyle='#ffffff10';g.lineWidth=2;for(let k=1;k<=5;k++){g.beginPath();g.arc(cx,cy,sc*k*0.2,0,6.283);g.stroke();}
        g.beginPath();g.moveTo(cx-R*sc,cy);g.lineTo(cx+R*sc,cy);g.moveTo(cx,cy-R*sc);g.lineTo(cx,cy+R*sc);g.stroke();
        if(tele){   // this ring drops when the turn ends
          const fl=0.28+0.14*Math.sin(now/130)+(S.ph==='go'?0.08:0);
          g.beginPath();g.arc(cx,cy,R*sc,0,Math.PI*2);g.arc(cx,cy,S.nR*sc,0,Math.PI*2);g.fillStyle='rgba(255,50,70,'+fl+')';g.fill('evenodd');
          g.strokeStyle='#ff5060';g.lineWidth=3;g.setLineDash([10,8]);g.beginPath();g.arc(cx,cy,S.nR*sc,0,6.283);g.stroke();g.setLineDash([]);
        }
        g.restore();
        // edge danger glow around my puck
        const mp=mePk();
        if(mp&&mp.a&&rs[mp.id]){
          const q=rs[mp.id].sim,dist=Math.hypot(q.x,q.y),lim=tele?S.nR:R,dg=cl(1-(lim-dist)/0.3,0,1);
          vig+=(dg-vig)*Math.min(1,dt*10);
          if(vig>0.02){const ang=Math.atan2(q.y,q.x);g.save();g.lineWidth=8;g.strokeStyle='rgba(255,60,70,'+(0.8*vig)+')';g.shadowColor='#ff3040';g.shadowBlur=22*vig;g.beginPath();g.arc(cx,cy,lim*sc,ang-0.6,ang+0.6);g.stroke();g.restore();}
        }else vig*=0.9;
        for(const p of S.pk){const r=rs[p.id];if(!r||!p.a)continue;drawPuck(p,r,L,now,p.id===c.me());}
        for(const p of S.pk){const r=rs[p.id];if(!r||p.a)continue;drawPuck(p,r,L,now,p.id===c.me());}
        // my slingshot band (plan only)
        if(mp&&mp.a&&rs[mp.id]&&S.ph==='plan'){const q=rs[mp.id].sim;drawAim(cx+q.x*sc,cy+q.y*sc,PR*sc,now);}
        for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.93;p.vy*=.93;p.l-=dt*2.4;if(p.l<=0){parts.splice(i,1);continue;}g.globalAlpha=p.l;g.fillStyle=p.col;g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill();}
        g.globalAlpha=1;
        g.restore();
        // ---- HUD (in-canvas top strip) ----
        g.textBaseline='middle';
        const left=S.ph==='plan'?Math.max(0,S.pt-(now-snapAt)/1000):0;
        const alive=S.pk.filter(p=>p.a),nl=alive.filter(p=>S.lk[p.id]).length;
        g.textAlign='left';g.font='900 14px system-ui,sans-serif';g.fillStyle='#cfcff0';g.fillText('TURN '+S.turn,12,15);
        g.textAlign='right';g.fillStyle=nl===alive.length&&alive.length?'#52ff7a':'#cfcff0';g.fillText('🔒 '+nl+'/'+alive.length,W-12,15);
        g.textAlign='center';
        let txt='',col='#fff';
        if(S.over){txt=S.win>=0?(S.win===c.me()?'👑 YOU WIN!':'👑 '+((c.pl(S.win)||{}).n||'?')+' WINS!'):'💥 Everybody fell!';col=S.win>=0?c.col(S.win):'#fff';g.font='900 20px system-ui,sans-serif';}
        else if(S.ph==='plan'){txt=(mp&&mp.a)?(S.lk[c.me()]?'LOCKED IN ✅':'PLAN YOUR MOVE '+Math.ceil(left)+'s'):'Spectating…';col=left<2&&!(S.lk[c.me()])?'#ff5060':'#ffd23f';g.font='900 16px system-ui,sans-serif';}
        else if(S.ph==='go'){txt='💥 GO!';col='#ff9f1c';g.font='900 18px system-ui,sans-serif';}
        else{txt='🕳️ FLOOR DROPS!';col='#ff5060';g.font='900 16px system-ui,sans-serif';}
        g.fillStyle=col;g.fillText(txt,W/2,15);
        if(S.ph==='plan'&&!S.over){ // timer bar
          const q=cl(left/(S.pl||6),0,1);g.fillStyle='#ffffff18';g.fillRect(12,30,W-24,7);g.fillStyle=q>.35?'#52ff7a':(q>.15?'#ffd23f':'#ff5060');g.fillRect(12,30,(W-24)*q,7);
        }
        // toasts under the HUD
        let ty=58;for(let i=0;i<toasts.length;i++){const t=toasts[i];if(now>t.e){toasts.splice(i,1);i--;continue;}
          g.globalAlpha=Math.min(1,(t.e-now)/400);g.font='800 15px system-ui,sans-serif';g.lineWidth=4;g.strokeStyle='#000c';g.strokeText(t.t,W/2,ty);g.fillStyle=t.col;g.fillText(t.t,W/2,ty);ty+=21;}
        g.globalAlpha=1;
        // power meter above the lock button
        if(mp&&mp.a&&S.ph==='plan'&&!S.over){
          const bw=Math.min(260,W-90),bx=(W-bw)/2,by=Hh-96;
          const pw=aim?aim.p:0;
          g.fillStyle='#ffffff18';g.fillRect(bx,by,bw,9);
          if(aim){g.fillStyle=pw<.5?'#52ff7a':(pw<.85?'#ffd23f':'#ff5060');g.fillRect(bx,by,bw*pw,9);}
          g.font='800 12px system-ui,sans-serif';g.textAlign='center';g.fillStyle=aim?'#fff':'#9a9ac4';
          g.fillText(aim?'POWER '+Math.round(pw*100)+'%':(S.lk[c.me()]?'waiting for the others…':'drag back anywhere to aim'),W/2,by-10);
          // in the drop zone: nag
          if(tele&&rs[mp.id]){const q=rs[mp.id].sim;if(Math.hypot(q.x,q.y)>S.nR-0.02){g.globalAlpha=.6+.4*Math.sin(now/110);g.font='900 15px system-ui,sans-serif';g.fillStyle='#ff5060';g.fillText('⚠ You are in the red ring! Move in!',W/2,Hh-124);g.globalAlpha=1;}}
        }
        if(running&&!hinted&&S.turn===1&&S.ph==='plan'&&mp&&mp.a&&!S.over){
          g.globalAlpha=.6+.4*Math.sin(now/220);g.font='800 14px system-ui,sans-serif';g.fillStyle='#fff';g.textAlign='center';
          g.fillText('Press, drag BACK like a slingshot, then 🔒 LOCK IN',W/2,Hh-124);g.globalAlpha=1;
        }
        if(vig>0.05){const vg=g.createRadialGradient(W/2,Hh/2,Math.min(W,Hh)*.3,W/2,Hh/2,Math.max(W,Hh)*.7);vg.addColorStop(0,'rgba(255,0,40,0)');vg.addColorStop(1,'rgba(255,0,40,'+(0.22*vig)+')');g.fillStyle=vg;g.fillRect(0,0,W,Hh);}
      }
      function btnState(){
        if(!btn||!S)return;
        const mp=mePk();let t,cls='sumo-lock';
        if(S.over)t='🏁 Round over';
        else if(!mp||!mp.a){t='☠️ You are out. Watching…';cls+=' off';}
        else if(S.ph==='plan'){if(S.lk[c.me()]){t='✅ LOCKED — waiting…';cls+=' done';}else t='🔒 LOCK IN';}
        else if(S.ph==='go'){t='💥 Everyone goes!';cls+=' off';}
        else{t='🕳️ Floor dropping…';cls+=' off';}
        if(btn.className!==cls)btn.className=cls;if(btn.textContent!==t)btn.textContent=t;
      }
      return{
        mount(r){
          root=r;css();root.style.touchAction='none';cvo=mkCanvas(root);g=cvo.g;
          root.addEventListener('pointerdown',press);root.addEventListener('pointermove',move);
          root.addEventListener('pointerup',e=>release(e,false));root.addEventListener('pointercancel',e=>release(e,true));
          btn=E('button','sumo-lock','🔒 LOCK IN');btn.setAttribute('aria-label','lock in');root.append(btn);
          btn.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();lockNow();});
        },
        start(){running=true;},
        stop(){running=false;window.__ttSumo={};},
        update(s,R){
          const now=performance.now();S=s;snapAt=now;
          if(s.R<prevR-0.001){dropAnim={r0:prevR,r1:s.R,t0:now};}
          prevR=s.R;
          if(s.turn!==lastTurn){
            if(lastTurn&&s.turn>1){aim=null;drag=null;if(running)toast('TURN '+s.turn,'#ffd23f');}
            lastTurn=s.turn;
          }
          const nlk=Object.keys(s.lk).length;
          if(nlk>lastLk&&!s.lk[c.me()]&&running)beep(900,.04,'square',.05);
          lastLk=nlk;
          for(const p of s.pk){
            let r=rs[p.id];const sn={x:p.x,y:p.y,vx:p.vx,vy:p.vy,at:now};
            if(!r){rs[p.id]={s:sn,off:{x:0,y:0},sim:{x:p.x,y:p.y,vx:p.vx,vy:p.vy},fAdd:0};continue;}
            const dd=Math.hypot(r.sim.x-p.x,r.sim.y-p.y);
            r.off=dd<0.5?{x:r.sim.x-p.x,y:r.sim.y-p.y}:{x:0,y:0};r.s=sn;r.fAdd=0;
          }
          if(s.over&&!over){over=true;if(s.win===c.me())sfx.win();else sfx.boom();}
          if(lastPh!==s.ph){lastPh=s.ph;}
        },
        event(m){
          if(!cvo)return;const L=lay();
          if(m.k==='hit'){
            const x=L.cx+m.x*L.sc,y=L.cy+m.y*L.sc,big=m.v>1.0;
            sparks(x,y,'#ffe9a8',6+Math.round(m.v*7),120+m.v*80);
            shake=Math.max(shake,Math.min(11,m.v*4));
            beep(110+m.v*50,.07,'square',Math.min(.2,.05+m.v*.05),-40);
            if(m.a===c.me()||m.b===c.me())buzz(big?[25,20,35]:16);
          }else if(m.k==='fall'){
            const pl=c.pl(m.id),nm=m.id===c.me()?'You':(pl?pl.n:'?');
            toast(FALLS[m.m%FALLS.length].replace('%s',nm),c.col(m.id));
            if(m.id===c.me()){sfx.bad();buzz([60,40,120]);}else beep(520,.5,'sine',.09,-420);
            const r=rs[m.id];if(r){sparks(L.cx+r.sim.x*L.sc,L.cy+r.sim.y*L.sc,c.col(m.id),14,150);}
          }else if(m.k==='drop'){sfx.boom();buzz(40);shake=Math.max(shake,8);}
          else if(m.k==='go'){beep(180,.35,'sawtooth',.09,500);buzz(30);shake=Math.max(shake,3);}
        },
        frame(rem){
          if(!S||!cvo||cvo.W<10)return;
          const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
          for(const p of S.pk){
            const r=rs[p.id];if(!r||p.g)continue;
            const e=Math.min(.3,(now-r.s.at)/1000),sim={x:r.s.x,y:r.s.y,vx:r.s.vx,vy:r.s.vy};
            if(p.a||p.f>0)stepSim(sim,e);
            const k=Math.exp(-e*9);r.sim=sim;r.sim.x+=r.off.x*k;r.sim.y+=r.off.y*k;
            r.fAdd=p.a?0:e;
          }
          const L=lay(),mp=mePk(),rc=root.getBoundingClientRect(),bc=btn.getBoundingClientRect();
          dbg.ok=true;dbg.me=c.me();dbg.sc=L.sc;dbg.ph=S.ph;dbg.turn=S.turn;dbg.alive=mp?!!mp.a:false;dbg.locked=!!S.lk[c.me()];dbg.R=S.R;dbg.aim=aim;
          dbg.btn={x:bc.left+bc.width/2,y:bc.top+bc.height/2};
          dbg.pucks=S.pk.map(p=>({id:p.id,a:p.a,x:rc.left+L.cx+(rs[p.id]?rs[p.id].sim.x:p.x)*L.sc,y:rc.top+L.cy+(rs[p.id]?rs[p.id].sim.y:p.y)*L.sc}));
          btnState();
          draw(dt,now);
        }
      };
    }
  };
})();
