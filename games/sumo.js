// Sumo Slingshot: heavy pucks on a shrinking floating platform. Drag back + release to launch. Last puck standing wins.
GAMES.sumo=(function(){
  const PR=0.115,            // puck radius (platform radius = 1)
        K=1.2,C=0.35,       // slide friction: dv/dt = -(K*v + C)
        VMAX=1.45,         // launch speed at full power
        VCAP=2.2,          // absolute speed cap
        REST=0.9,          // collision restitution (equal masses)
        CD=1.1,            // launch cooldown (s)
        T0=15,DT=10,WARN=2.5,   // first floor drop at 15 s, then every 10 s, warned 2.5 s ahead
        STAGES=[0.8,0.62,0.47,0.35,0.26,0.19,0.13],
        FALLT=1.1,         // fall animation length (s)
        MAXDRAG=120;       // px of drag for full power
  const cl=(x,a,b)=>Math.max(a,Math.min(b,x));
  const FALLS=['%s fell off! 🫠','%s took a swim 🏊','%s discovered gravity 🍎','%s went skydiving 🪂','%s ran out of floor','%s got launched into orbit 🚀','%s is gone. Bye 👋','%s slipped on nothing'];
  // distance a puck slides after being given speed v0 (used for the aim preview)
  function slideDist(v0){const a=C/K;if(v0<=0)return 0;const t=Math.log((v0+a)/a)/K;return (v0+a)*(1-Math.exp(-K*t))/K-a*t;}
  function fric(p,h){
    const s=Math.hypot(p.vx,p.vy);if(s<1e-6)return;
    const s2=Math.max(0,s*Math.exp(-K*h)-C*h),f=s2/s;p.vx*=f;p.vy*=f;
  }
  return{
    name:'Sumo Slingshot',emoji:'🥊',tag:'Sling your puck, bonk the others off the floating platform.',
    min:2,max:4,
    rules:[
      ['🎯','You are a heavy puck. Press anywhere and drag BACK like a slingshot. Let go to launch the other way.'],
      ['💪','The further you drag, the harder you launch. You can see an aim line and a power meter.'],
      ['⏱️','After a launch your puck needs about a second to recharge (the ring around it). No spamming.'],
      ['🕳️','The red outer ring of the floor drops away every few seconds, so the platform keeps shrinking.'],
      ['👑','Slide off the edge and you are out. Last puck on the platform wins.']
    ],
    ctrl:'Press anywhere, drag back, release to launch the opposite way.',
    win:'Last puck standing wins. Knocked off at the same moment = a tie.',
    dur:90,hz:20,

    // ---------------- host ----------------
    init(H){
      const ps=H.players,n=ps.length,rot=Math.random()*6.283,pk=[],out={};
      ps.forEach((p,i)=>{
        const a=rot+6.283*i/n;
        pk.push({id:p.id,x:+(Math.cos(a)*0.5).toFixed(3),y:+(Math.sin(a)*0.5).toFixed(3),vx:0,vy:0,a:p.aw?0:1,f:0,cd:0.4,g:p.aw?1:0});
        if(p.aw)out[p.id]=-1;
      });
      return{R:1,nR:1,w:0,st:0,pk,tk:0,win:-1,_out:out,_hitT:{}};
    },
    tick(H,S,dt){
      if(S.over)return;
      S.tk++;
      for(const pk of S.pk){
        const pl=H.players.find(p=>p.id===pk.id);
        if(pl&&pl.aw&&pk.a){pk.a=0;pk.g=1;S._out[pk.id]=S.tk;}
        if(pk.cd>0)pk.cd=Math.max(0,pk.cd-dt);
      }
      // floor schedule
      if(S.st<STAGES.length){
        const at=T0+S.st*DT;
        if(S.t>=at-WARN){S.nR=STAGES[S.st];S.w=Math.max(0,at-S.t);}
        if(S.t>=at){S.R=STAGES[S.st];S.st++;S.w=0;S.nR=S.st<STAGES.length?S.R:S.R;H.emit({k:'drop',r:S.R});}
      }
      // physics (sub-stepped)
      const act=S.pk.filter(p=>p.a);
      let vm=0;act.forEach(p=>{vm=Math.max(vm,Math.hypot(p.vx,p.vy));});
      const n=Math.max(4,Math.ceil(vm*dt/(PR*0.35))),h=dt/n;
      for(let i=0;i<n;i++){
        for(const p of act){p.x+=p.vx*h;p.y+=p.vy*h;fric(p,h);}
        for(let a=0;a<act.length;a++)for(let b=a+1;b<act.length;b++){
          const A=act[a],B=act[b],dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy);
          if(d>=2*PR||d<1e-6)continue;
          const nx=dx/d,ny=dy/d,ov=2*PR-d;
          A.x-=nx*ov/2;A.y-=ny*ov/2;B.x+=nx*ov/2;B.y+=ny*ov/2;
          const vn=(A.vx-B.vx)*nx+(A.vy-B.vy)*ny;
          if(vn>0){
            const j=(1+REST)/2*vn;A.vx-=j*nx;A.vy-=j*ny;B.vx+=j*nx;B.vy+=j*ny;
            const key=A.id+'-'+B.id;
            if(vn>0.35&&(S.t-(S._hitT[key]||-9))>0.12){S._hitT[key]=S.t;H.emit({k:'hit',x:(A.x+B.x)/2,y:(A.y+B.y)/2,v:+vn.toFixed(2),a:A.id,b:B.id});}
          }
        }
      }
      for(const p of S.pk){
        if(p.a){
          const s=Math.hypot(p.vx,p.vy);if(s>VCAP){p.vx*=VCAP/s;p.vy*=VCAP/s;}
          if(Math.hypot(p.x,p.y)>S.R){p.a=0;p.f=0.001;S._out[p.id]=S.tk;H.emit({k:'fall',id:p.id,m:Math.floor(Math.random()*FALLS.length)});}
        }else if(!p.g&&p.f>0){p.x+=p.vx*dt;p.y+=p.vy*dt;fric(p,dt);p.f+=dt;}
        p.x=Math.round(p.x*1e4)/1e4;p.y=Math.round(p.y*1e4)/1e4;p.vx=Math.round(p.vx*1e3)/1e3;p.vy=Math.round(p.vy*1e3)/1e3;
      }
      const alive=S.pk.filter(p=>p.a);
      if(alive.length<=1){S.over=true;S.hold=2.2;S.win=alive.length?alive[0].id:-1;}
    },
    act(H,S,pid,m){
      if(m.k!=='L'||S.over)return;
      const pk=S.pk.find(p=>p.id===pid);if(!pk||!pk.a||pk.cd>0.15)return;
      let dx=+m.dx,dy=+m.dy,pw=+m.p;if(!isFinite(dx)||!isFinite(dy)||!isFinite(pw))return;
      const l=Math.hypot(dx,dy);if(l<1e-6)return;pw=cl(pw,0,1);if(pw<0.05)return;
      pk.vx+=dx/l*pw*VMAX;pk.vy+=dy/l*pw*VMAX;
      const s=Math.hypot(pk.vx,pk.vy);if(s>VCAP){pk.vx*=VCAP/s;pk.vy*=VCAP/s;}
      pk.cd=CD;H.emit({k:'launch',id:pid,p:+pw.toFixed(2)});
    },
    score(H,S){
      const n=H.players.length,al=S.pk.filter(p=>p.a).map(p=>p.id);
      const rows=[];let rank=0;
      if(al.length){al.forEach(id=>rows.push({id,rank:0,label:al.length===1?'🏆 last on the floor':'still standing'}));rank=al.length;}
      const dead=H.players.filter(p=>!al.includes(p.id)).map(p=>({id:p.id,tk:S._out[p.id]!=null?S._out[p.id]:-1}));
      dead.sort((a,b)=>b.tk-a.tk);
      dead.forEach((d,i)=>{
        if(i>0&&dead[i-1].tk!==d.tk)rank=al.length+i;
        else if(i===0)rank=al.length;
        const pl=H.players.find(p=>p.id===d.id);
        rows.push({id:d.id,rank,label:(pl&&pl.aw)?'left':(d.tk<0?'—':'fell off')});
      });
      rows.forEach(r=>{const p=H.players.find(q=>q.id===r.id);r.pts=(p&&p.aw)?0:Math.max(0,n-r.rank);});
      return rows;
    },

    // ---------------- client ----------------
    mk(c){
      let S=null,root,cvo,g,running=false;
      const rs={};                    // per-puck render state
      let drag=null,pendingUntil=0,lastFrame=performance.now(),shake=0,parts=[],toasts=[],flashCd=0,hinted=false,launched=0;
      let prevR=1,dropAnim=null,lastW=-1,over=false,cdLocalEnd=0,vig=0;
      const dbg=window.__ttSumo={};
      const mePk=()=>S&&S.pk.find(p=>p.id===c.me());
      function lay(){const W=cvo.W,H=cvo.H,sc=Math.max(40,Math.min(W/2-10,(H-70)/2));return{W,H,sc,cx:W/2,cy:H/2+8};}
      function sparks(x,y,col,n,sp){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(0.3+Math.random())*sp;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,col,r:1.5+Math.random()*2.2});}}
      function toast(t,col){toasts.push({t,col,e:performance.now()+2300});if(toasts.length>3)toasts.shift();}
      function stepSim(s,e){let t=0;while(t<e){const h=Math.min(1/60,e-t);s.x+=s.vx*h;s.y+=s.vy*h;fric(s,h);t+=h;}}
      function press(e){
        if(drag||!S||c.R().ph!=='play')return;
        const m=mePk();if(!m||!m.a)return;
        const r=root.getBoundingClientRect();if(e.clientY-r.top<34)return;   // ignore presses that start on the HUD strip
        drag={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY};hinted=true;
        try{root.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();
      }
      function move(e){if(drag&&e.pointerId===drag.id){drag.x=e.clientX;drag.y=e.clientY;e.preventDefault();}}
      function drop(e,cancel){
        if(!drag||e.pointerId!==drag.id)return;
        const d=drag;drag=null;if(cancel||!S||c.R().ph!=='play')return;
        const dx=d.x0-d.x,dy=d.y0-d.y,len=Math.hypot(dx,dy);
        if(len<18)return;
        const m=mePk();if(!m||!m.a)return;
        const pw=cl((len-12)/(MAXDRAG-12),0,1),now=performance.now();
        if(now<cdLocalEnd-60){flashCd=1;buzz(12);beep(200,.05,'square',.05);return;}
        cdLocalEnd=now+CD*1000;launched++;
        c.act({k:'L',dx:+(dx/len).toFixed(3),dy:+(dy/len).toFixed(3),p:+pw.toFixed(3)});
        // predict locally so it feels instant; ignore my puck's snapshot until the host confirms (or 400 ms)
        const r=rs[c.me()];if(r){const L=r.sim;r.s={x:L.x,y:L.y,vx:L.vx+dx/len*pw*VMAX,vy:L.vy+dy/len*pw*VMAX,at:now};r.off={x:0,y:0};pendingUntil=now+400;}
        beep(220+pw*300,.12,'sawtooth',.07,200);buzz(10+pw*20);
        const L=lay(),p=r&&r.sim;if(p)sparks(L.cx+p.x*L.sc,L.cy+p.y*L.sc,'#ffffffaa',6,60);
      }
      function puckColor(id){return c.col(id);}
      function drawPuck(p,r,L,now,mine){
        const x=L.cx+r.sim.x*L.sc,y=L.cy+r.sim.y*L.sc;let rad=PR*L.sc,alpha=1,yo=0;
        let f=0;
        if(!p.a){f=Math.max(0.001,(p.f||0.001)+(r.fAdd||0));if(f>FALLT)return;const q=f/FALLT;rad*=1-q*0.75;alpha=1-q*q;yo=q*q*70;}
        if(p.g)return;
        const col=puckColor(p.id);
        g.save();g.globalAlpha=alpha;g.translate(x,y+yo);
        // shadow
        if(p.a){g.fillStyle='#0006';g.beginPath();g.ellipse(2,rad*0.42,rad*1.0,rad*0.8,0,0,6.283);g.fill();}
        // body
        const gr=g.createRadialGradient(-rad*.3,-rad*.35,rad*.1,0,0,rad);gr.addColorStop(0,'#ffffffcc');gr.addColorStop(.25,col);gr.addColorStop(1,col);
        g.fillStyle=col;g.beginPath();g.arc(0,0,rad,0,6.283);g.fill();
        g.fillStyle=gr;g.globalAlpha=alpha*.55;g.beginPath();g.arc(0,0,rad,0,6.283);g.fill();g.globalAlpha=alpha;
        g.lineWidth=Math.max(2,rad*.16);g.strokeStyle='#00000055';g.beginPath();g.arc(0,0,rad*.98,0,6.283);g.stroke();
        g.strokeStyle='#ffffff66';g.lineWidth=2;g.beginPath();g.arc(0,0,rad*.62,0,6.283);g.stroke();
        if(mine){g.strokeStyle='#fff';g.lineWidth=2.5;g.beginPath();g.arc(0,0,rad+3,0,6.283);g.stroke();}
        g.restore();
        // name
        if(p.a){const pl=c.pl(p.id);let nm=mine?'YOU':(pl?pl.n:'?');if(nm.length>8)nm=nm.slice(0,7)+'…';
          g.font='800 11px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='#000a';g.strokeText(nm,x,y-rad-9);g.fillStyle='#fff';g.fillText(nm,x,y-rad-9);}
      }
      function draw(dt,now){
        const L=lay(),W=L.W,Hh=L.H,cx=L.cx,cy=L.cy,sc=L.sc;
        g.clearRect(0,0,W,Hh);g.fillStyle='#0b0b17';g.fillRect(0,0,W,Hh);
        if(!S)return;
        g.save();
        if(shake>0.1){g.translate((Math.random()-.5)*shake*2,(Math.random()-.5)*shake*2);shake*=Math.pow(0.003,dt);}
        // void stars
        g.fillStyle='#ffffff14';for(let i=0;i<26;i++){const sx=(i*97.3)%W,sy=(i*53.7+now*0.004*(1+i%3))%Hh;g.fillRect(sx,sy,2,2);}
        const R=S.R,R0=1;
        // platform shadow + body
        const drawDisc=(rad,off,fill,stroke)=>{g.beginPath();g.arc(cx,cy+off,rad*sc,0,6.283);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=3;g.stroke();}};
        // dropping outer ring animation
        if(dropAnim){
          const q=(now-dropAnim.t0)/900;
          if(q>=1)dropAnim=null;else{
            g.save();g.globalAlpha=1-q;g.translate(0,q*q*120);g.beginPath();g.arc(cx,cy,dropAnim.r0*sc,0,6.283);g.arc(cx,cy,dropAnim.r1*sc,0,6.283,true);g.fillStyle='#5a2a3c';g.fill('evenodd');g.restore();
          }
        }
        drawDisc(R,10,'#05050c');
        const pg=g.createRadialGradient(cx,cy,sc*0.05,cx,cy,R*sc);pg.addColorStop(0,'#2a2a5a');pg.addColorStop(1,'#1b1b3e');
        drawDisc(R,0,pg,'#8d8dc9');
        g.save();g.beginPath();g.arc(cx,cy,R*sc,0,6.283);g.clip();
        g.strokeStyle='#ffffff10';g.lineWidth=2;for(let k=1;k<=4;k++){g.beginPath();g.arc(cx,cy,sc*k*0.2,0,6.283);g.stroke();}
        g.beginPath();g.moveTo(cx-R*sc,cy);g.lineTo(cx+R*sc,cy);g.moveTo(cx,cy-R*sc);g.lineTo(cx,cy+R*sc);g.stroke();
        // warning zone
        if(S.w>0&&S.nR<R-0.001){
          const fl=0.35+0.3*Math.sin(now/90);
          g.beginPath();g.arc(cx,cy,R*sc,0,6.283);g.arc(cx,cy,S.nR*sc,0,6.283,true);g.fillStyle='rgba(255,50,70,'+fl+')';g.fill('evenodd');
          g.strokeStyle='#ff5060';g.lineWidth=3;g.setLineDash([10,8]);g.beginPath();g.arc(cx,cy,S.nR*sc,0,6.283);g.stroke();g.setLineDash([]);
        }
        g.restore();
        // edge danger glow around my puck
        const mp=mePk();
        if(mp&&mp.a&&rs[mp.id]){
          const q=rs[mp.id].sim,dist=Math.hypot(q.x,q.y),dg=cl(1-(R-dist)/0.32,0,1);
          vig+=(dg-vig)*Math.min(1,dt*10);
          if(vig>0.02){
            const ang=Math.atan2(q.y,q.x);g.save();g.lineWidth=8;g.strokeStyle='rgba(255,60,70,'+(0.8*vig)+')';g.shadowColor='#ff3040';g.shadowBlur=22*vig;
            g.beginPath();g.arc(cx,cy,R*sc,ang-0.6,ang+0.6);g.stroke();g.restore();
          }
        }else vig*=0.9;
        // pucks: alive first, falling on top
        for(const p of S.pk){const r=rs[p.id];if(!r||!p.a)continue;drawPuck(p,r,L,now,p.id===c.me());}
        for(const p of S.pk){const r=rs[p.id];if(!r||p.a)continue;drawPuck(p,r,L,now,p.id===c.me());}
        // cooldown ring on my puck
        if(mp&&mp.a&&rs[mp.id]){
          const q=rs[mp.id].sim,x=cx+q.x*sc,y=cy+q.y*sc,rr=PR*sc+7,rem=Math.max(0,(cdLocalEnd-now)/1000),pr=1-cl(rem/CD,0,1);
          g.lineWidth=4;g.strokeStyle='#ffffff25';g.beginPath();g.arc(x,y,rr,0,6.283);g.stroke();
          if(pr<1){g.strokeStyle=flashCd>0?'#ff5060':'#ffd23f';g.beginPath();g.arc(x,y,rr,-Math.PI/2,-Math.PI/2+6.283*pr);g.stroke();}
          else{g.strokeStyle='#52ff7a';g.globalAlpha=.5+.3*Math.sin(now/160);g.beginPath();g.arc(x,y,rr,0,6.283);g.stroke();g.globalAlpha=1;}
          if(flashCd>0)flashCd=Math.max(0,flashCd-dt*3);
          // aim UI
          if(drag){
            const dx=drag.x0-drag.x,dy=drag.y0-drag.y,len=Math.hypot(dx,dy),pw=cl((len-12)/(MAXDRAG-12),0,1);
            const r0=root.getBoundingClientRect(),ax=drag.x0-r0.left,ay=drag.y0-r0.top,fx=drag.x-r0.left,fy=drag.y-r0.top;
            // sling band
            g.strokeStyle='#ffffff40';g.lineWidth=3;g.beginPath();g.moveTo(ax,ay);g.lineTo(fx,fy);g.stroke();
            g.fillStyle='#ffffff30';g.beginPath();g.arc(ax,ay,7,0,6.283);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(fx,fy,9,0,6.283);g.fill();
            if(len>=18){
              const ux=dx/len,uy=dy/len,dist=slideDist(pw*VMAX)*sc,col=pw<.5?'#52ff7a':(pw<.85?'#ffd23f':'#ff5060');
              g.strokeStyle=col;g.lineWidth=4;g.setLineDash([2,9]);g.lineCap='round';
              g.beginPath();g.moveTo(x+ux*(PR*sc+4),y+uy*(PR*sc+4));g.lineTo(x+ux*dist,y+uy*dist);g.stroke();g.setLineDash([]);
              g.globalAlpha=.55;g.beginPath();g.arc(x+ux*dist,y+uy*dist,PR*sc,0,6.283);g.strokeStyle=col;g.lineWidth=3;g.stroke();g.globalAlpha=1;
              // arrow head
              const hx=x+ux*(PR*sc+22+pw*30),hy=y+uy*(PR*sc+22+pw*30);g.fillStyle=col;g.beginPath();g.moveTo(hx+ux*12,hy+uy*12);g.lineTo(hx-uy*8,hy+ux*8);g.lineTo(hx+uy*8,hy-ux*8);g.closePath();g.fill();
              // power bar
              const bw=Math.min(240,W-80),bx=(W-bw)/2,by=Hh-26;
              g.fillStyle='#ffffff18';g.fillRect(bx,by,bw,10);g.fillStyle=col;g.fillRect(bx,by,bw*pw,10);
              g.font='800 12px system-ui,sans-serif';g.textAlign='center';g.fillStyle='#fff';g.fillText('POWER '+Math.round(pw*100)+'%'+(rem>0?'  (recharging…)':''),W/2,by-9);
            }
          }
        }
        // particles
        for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.93;p.vy*=.93;p.l-=dt*2.4;if(p.l<=0){parts.splice(i,1);continue;}g.globalAlpha=p.l;g.fillStyle=p.col;g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill();}
        g.globalAlpha=1;
        g.restore();
        // HUD (in-canvas, top strip)
        g.textAlign='center';g.textBaseline='middle';
        const nxt=S.st<STAGES.length?(T0+S.st*DT-S.t):0;
        let txt='',col='#cfcff0';
        if(S.over){txt=S.win>=0?(S.win===c.me()?'👑 YOU WIN!':'👑 '+((c.pl(S.win)||{}).n||'?')+' WINS!'):'💥 Everybody fell!';col=S.win>=0?c.col(S.win):'#fff';}
        else if(S.w>0){txt='⚠ FLOOR DROPS IN '+Math.ceil(S.w);col=Math.sin(now/90)>0?'#ff5060':'#ffd23f';}
        else if(S.st<STAGES.length&&S.t<T0)txt='Floor starts shrinking in '+Math.max(1,Math.ceil(nxt-WARN)||1)+'s';
        else if(S.st>=STAGES.length)txt='Final floor!';
        else txt='Floor shrinks again in '+Math.max(1,Math.ceil(nxt-WARN))+'s';
        g.font='800 '+(S.over?22:14)+'px system-ui,sans-serif';g.fillStyle=col;g.fillText(txt,W/2,17);
        // toasts
        let ty=Hh-70;for(let i=toasts.length-1;i>=0;i--){const t=toasts[i];if(now>t.e){toasts.splice(i,1);continue;}
          g.globalAlpha=Math.min(1,(t.e-now)/400);g.font='800 16px system-ui,sans-serif';g.lineWidth=4;g.strokeStyle='#000c';g.strokeText(t.t,W/2,ty);g.fillStyle=t.col;g.fillText(t.t,W/2,ty);ty-=22;}
        g.globalAlpha=1;
        // first-time hint
        if(running&&!hinted&&S.t<12&&mp&&mp.a){
          g.globalAlpha=.6+.4*Math.sin(now/220);g.font='800 15px system-ui,sans-serif';g.fillStyle='#fff';
          g.fillText('Press anywhere, drag BACK, let go to launch',W/2,Hh-36);g.globalAlpha=1;
        }
        // danger vignette
        if(vig>0.05){const vg=g.createRadialGradient(W/2,Hh/2,Math.min(W,Hh)*.3,W/2,Hh/2,Math.max(W,Hh)*.7);vg.addColorStop(0,'rgba(255,0,40,0)');vg.addColorStop(1,'rgba(255,0,40,'+(0.25*vig)+')');g.fillStyle=vg;g.fillRect(0,0,W,Hh);}
      }
      return{
        mount(r){
          root=r;root.style.touchAction='none';cvo=mkCanvas(root);g=cvo.g;
          root.addEventListener('pointerdown',press);root.addEventListener('pointermove',move);
          root.addEventListener('pointerup',e=>drop(e,false));root.addEventListener('pointercancel',e=>drop(e,true));
        },
        start(){running=true;},
        stop(){running=false;window.__ttSumo={};},
        update(s,R){
          const first=!S;S=s;const now=performance.now();
          if(s.R<prevR-0.001){dropAnim={r0:prevR,r1:s.R,t0:now};shake=Math.max(shake,7);}
          prevR=s.R;
          if(s.w>0){const w=Math.ceil(s.w);if(w!==lastW&&running){lastW=w;beep(w===1?900:700,.08,'square',.08);}}else lastW=-1;
          for(const p of s.pk){
            let r=rs[p.id];
            const sn={x:p.x,y:p.y,vx:p.vx,vy:p.vy,at:now};
            if(!r){r=rs[p.id]={s:sn,off:{x:0,y:0},sim:{x:p.x,y:p.y,vx:p.vx,vy:p.vy},fAdd:0};continue;}
            if(p.id===c.me()&&now<pendingUntil&&p.cd<CD-0.5)continue;     // my predicted launch not confirmed yet
            const dd=Math.hypot(r.sim.x-p.x,r.sim.y-p.y);
            r.off=dd<0.5?{x:r.sim.x-p.x,y:r.sim.y-p.y}:{x:0,y:0};
            r.s=sn;r.fAdd=0;
            if(p.id===c.me()){const rem=p.cd*1000;if(now+rem>cdLocalEnd+120)cdLocalEnd=now+rem;}
          }
          if(s.over&&!over){over=true;if(s.win===c.me())sfx.win();else sfx.boom();}
        },
        event(m){
          if(!cvo)return;const L=lay();
          if(m.k==='hit'){
            const x=L.cx+m.x*L.sc,y=L.cy+m.y*L.sc,big=m.v>1.2;
            sparks(x,y,'#ffe9a8',6+Math.round(m.v*6),120+m.v*80);
            shake=Math.max(shake,Math.min(11,m.v*3.2));
            beep(110+m.v*50,.07,'square',Math.min(.2,.05+m.v*.04),-40);
            if(m.a===c.me()||m.b===c.me())buzz(big?[25,20,35]:16);
          }
          else if(m.k==='fall'){
            const pl=c.pl(m.id),nm=m.id===c.me()?'You':(pl?pl.n:'?');
            toast(FALLS[m.m%FALLS.length].replace('%s',nm),c.col(m.id));
            if(m.id===c.me()){sfx.bad();buzz([60,40,120]);}else beep(520,.5,'sine',.09,-420);
            const r=rs[m.id];if(r){const x=L.cx+r.sim.x*L.sc,y=L.cy+r.sim.y*L.sc;sparks(x,y,c.col(m.id),14,150);}
          }
          else if(m.k==='drop'){sfx.boom();buzz(40);}
          else if(m.k==='launch'){
            if(m.id===c.me())return;
            beep(200+m.p*250,.1,'sawtooth',.035,160);
          }
        },
        frame(rem){
          if(!S||!cvo||cvo.W<10)return;
          const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
          for(const p of S.pk){
            const r=rs[p.id];if(!r)continue;
            if(p.g)continue;
            const e=Math.min(.3,(now-r.s.at)/1000),sim={x:r.s.x,y:r.s.y,vx:r.s.vx,vy:r.s.vy};
            if(p.a||p.f>0)stepSim(sim,e);
            const k=Math.exp(-e*9);r.sim=sim;r.sim.x+=r.off.x*k;r.sim.y+=r.off.y*k;
            r.fAdd=p.a?0:e;
          }
          // test hook
          const L=lay(),mp=mePk(),rc=root.getBoundingClientRect();
          dbg.ok=true;dbg.me=c.me();dbg.sc=L.sc;dbg.ready=now>cdLocalEnd;dbg.launched=launched;dbg.alive=mp?!!mp.a:false;
          dbg.pucks=S.pk.map(p=>({id:p.id,a:p.a,x:rc.left+L.cx+(rs[p.id]?rs[p.id].sim.x:p.x)*L.sc,y:rc.top+L.cy+(rs[p.id]?rs[p.id].sim.y:p.y)*L.sc}));
          dbg.R=S.R;
          draw(dt,now);
        }
      };
    }
  };
})();
