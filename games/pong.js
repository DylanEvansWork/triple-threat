// Triangle Pong: n-sided Pong (triangle for 3 players). Host runs the ball; each client rotates the arena so its own edge is at the bottom.
GAMES.pong=(function(){
  const BR=0.055,        // ball radius (arena circumradius = 1)
        TH=0.04,         // paddle thickness
        SP0=0.75,        // serve speed
        SPCAP=2.4,       // max ball speed
        SERVE=1.2,       // serve countdown (s)
        LIVES=3,
        MAXANG=1.12;     // max outgoing angle off the normal (rad)
  const geoCache={};
  function geo(N){
    if(geoCache[N])return geoCache[N];
    const L=2*Math.sin(Math.PI/N),a=Math.cos(Math.PI/N),ph=0.13*L,e=[];
    for(let k=0;k<N;k++){
      const phi=2*Math.PI*k/N+Math.PI/N,ox=Math.cos(phi),oy=Math.sin(phi);
      e.push({phi,ox,oy,mx:a*ox,my:a*oy,tx:Math.sin(phi),ty:-Math.cos(phi)});
    }
    return geoCache[N]={N,L,a,ph,rng:L/2-ph,e};
  }
  const cl=(x,a,b)=>Math.max(a,Math.min(b,x));
  // Shared ball physics (host: authoritative with callbacks; client: visual prediction). Returns the edge index of a goal, else -1.
  function stepBall(b,dt,G,alive,pu,cb){
    let sp0=Math.hypot(b.vx,b.vy);if(sp0<1e-6)return -1;
    const n=Math.max(1,Math.ceil(sp0*dt/(BR*0.5))),h=dt/n;
    for(let i=0;i<n;i++){
      b.x+=b.vx*h;b.y+=b.vy*h;
      for(let k=0;k<G.N;k++){
        const e=G.e[k],vo=b.vx*e.ox+b.vy*e.oy;if(vo<=0)continue;
        const dx=b.x-e.mx,dy=b.y-e.my,d=dx*e.ox+dy*e.oy;
        if(d+BR<-TH)continue;
        if(alive[k]){
          const s=dx*e.tx+dy*e.ty,off=(s-pu[k]*G.rng)/G.ph;
          if(d<=0&&Math.abs(off)<=1+BR*0.8/G.ph){
            const o=cl(off,-1,1),sp=Math.hypot(b.vx,b.vy),spd=Math.min(b.cap||SPCAP,sp*1.08+0.015);
            const rx=b.vx-2*vo*e.ox,ry=b.vy-2*vo*e.oy;                 // specular reflection
            const th0=Math.atan2(rx*e.tx+ry*e.ty,-(rx*e.ox+ry*e.oy));  // angle off inward normal
            const th=cl(th0*0.5+o*0.95,-MAXANG,MAXANG);
            b.vx=spd*(-e.ox*Math.cos(th)+e.tx*Math.sin(th));b.vy=spd*(-e.oy*Math.cos(th)+e.ty*Math.sin(th));
            const fix=d+TH+BR;b.x-=e.ox*fix;b.y-=e.oy*fix;
            if(cb&&cb.hit)cb.hit(k,o,spd);
            break;
          }else if(d>0){if(cb&&cb.goal)cb.goal(k);return k;}
        }else if(d+BR>=0){
          b.vx-=2*vo*e.ox;b.vy-=2*vo*e.oy;b.x-=e.ox*(d+BR);b.y-=e.oy*(d+BR);
          if(cb&&cb.wall)cb.wall(k);
          break;
        }
      }
    }
    return -1;
  }

  // host helpers
  const PG={
    elim(H,S,pid){if(S.out.indexOf(pid)<0)S.out.push(pid);S.lv[pid]=0;},
    check(H,S){
      const alive=H.players.filter(p=>S.lv[p.id]>0);
      if(alive.length<=1){S.over=true;S.hold=2.2;S.win=alive.length?alive[0].id:-1;S.b.vx=S.b.vy=0;return true;}
      return false;
    },
    serve(H,S){
      const G=geo(S.N),al=[];S.ord.forEach((id,k)=>{if(id>=0&&S.lv[id]>0)al.push(k);});
      if(!al.length)return;
      const k=al[Math.floor(Math.random()*al.length)],e=G.e[k],a=Math.atan2(e.oy,e.ox)+(Math.random()-.5)*0.7;
      S.sp=SP0;S.b={x:0,y:0,vx:Math.cos(a)*SP0,vy:Math.sin(a)*SP0};S.sv=SERVE;S.bc=-1;
      H.emit({k:'serve'});
    }
  };

  return{
    name:'Triangle Pong',emoji:'🏓',tag:'Three-sided Pong. Guard your edge or lose your lives.',
    min:2,max:4,
    rules:[
      ['📐','The arena has one edge per player. Your screen is rotated so YOUR edge is always at the bottom.'],
      ['👆','Drag a finger left and right anywhere on the screen to slide your paddle along your edge.'],
      ['🏓','The ball speeds up with every paddle hit. Hit it off the paddle’s end to steer it at someone.'],
      ['❤️','Ball crosses your edge = lose a life (you get 3). Out? Your edge becomes a solid wall.'],
      ['👑','Last player standing wins. The ball takes the colour of whoever touched it last.']
    ],
    ctrl:'Drag anywhere sideways to slide your paddle.',
    win:'Outlast everyone: more lives left (then more goals scored) beats less. Out first = last place.',
    dur:100,hz:20,

    // ---------------- host ----------------
    init(H){
      const ps=H.players,n=Math.max(3,ps.length),ord=[],lv={},kills={},saves={};
      for(let k=0;k<n;k++)ord.push(k<ps.length?ps[k].id:-1);
      ps.forEach(p=>{lv[p.id]=p.aw?0:LIVES;kills[p.id]=0;saves[p.id]=0;});
      const out=ps.filter(p=>p.aw).map(p=>p.id);
      return{N:n,ord,lv,pu:ord.map(()=>0),b:{x:0,y:0,vx:0,vy:0},bc:-1,sv:SERVE,sp:SP0,out,win:-1,
             _kills:kills,_saves:saves,_conceded:{}};
    },
    begin(H,S){PG.serve(H,S);},
    tick(H,S,dt){
      if(S.over)return;
      const G=geo(S.N);
      for(const p of H.players)if(p.aw&&S.lv[p.id]>0)PG.elim(H,S,p.id);
      if(PG.check(H,S))return;
      if(S.sv>0){S.sv-=dt;if(S.sv>0)return;S.sv=0;}
      const alive=S.ord.map(id=>id>=0&&S.lv[id]>0);
      const cb={
        hit(k,o,spd){const pid=S.ord[k];S.bc=pid;S.sp=spd;S._saves[pid]=(S._saves[pid]||0)+1;H.emit({k:'hit',e:k,x:S.b.x,y:S.b.y,sp:spd,who:pid});},
        wall(k){H.emit({k:'wall',e:k});},
        goal(k){
          const pid=S.ord[k];S.lv[pid]--;S._conceded[pid]=(S._conceded[pid]||0)+1;
          const by=S.bc;if(by>=0&&by!==pid)S._kills[by]=(S._kills[by]||0)+1;
          H.emit({k:'goal',e:k,who:pid,by:by,lv:S.lv[pid]});
          if(S.lv[pid]<=0)PG.elim(H,S,pid);
        }
      };
      S.b.cap=Math.round((SPCAP+Math.max(0,S.t-50)*0.03)*100)/100; // overtime: speed cap creeps up after 50 s so rounds end
      const g=stepBall(S.b,dt,G,alive,S.pu,cb);
      if(g>=0){S.b.vx=S.b.vy=0;S.b.x=S.b.y=0;S.bc=-1;if(!PG.check(H,S))PG.serve(H,S);}
      S.b.x=Math.round(S.b.x*1e4)/1e4;S.b.y=Math.round(S.b.y*1e4)/1e4;
    },
    act(H,S,pid,m){
      if(m&&m.k==='ping'){H.emit({k:'pong',ts:+m.ts||0},pid);return;}
      if(!m||m.k!=='p'||S.over)return;
      const k=S.ord.indexOf(pid);if(k<0||!(S.lv[pid]>0))return;
      const u=+m.u;if(!isFinite(u))return;
      S.pu[k]=Math.round(cl(u,-1,1)*1e3)/1e3;
    },
    score(H,S){
      const n=H.players.length;
      const alive=H.players.filter(p=>S.lv[p.id]>0);
      const key=p=>[S.lv[p.id],S._kills[p.id]||0,S._saves[p.id]||0];
      alive.sort((a,b)=>{const x=key(a),y=key(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return y[i]-x[i];return 0;});
      const rows=[];let rk=0;
      alive.forEach((p,i)=>{
        if(i>0){const x=key(alive[i-1]),y=key(p);if(x[0]!==y[0]||x[1]!==y[1]||x[2]!==y[2])rk=i;}
        rows.push({id:p.id,rank:rk,label:(rk===0&&alive.length>=1&&S.win===p.id?'🏆 ':'')+S.lv[p.id]+(S.lv[p.id]===1?' life':' lives')+' left'});
      });
      const base=alive.length;
      for(let i=S.out.length-1;i>=0;i--){const id=S.out[i];if(rows.some(r=>r.id===id))continue;rows.push({id,rank:base+(S.out.length-1-i),label:'knocked out'});}
      rows.forEach(r=>{const p=H.players.find(q=>q.id===r.id);r.pts=(p&&p.aw)?0:Math.max(0,n-r.rank);if(p&&p.aw)r.label='left';});
      return rows;
    },

    // ---------------- client ----------------
    mk(c){
      let S=null,root,cvo,g,me=-1,running=false,sendT=0;
      let rv={vx:0,vy:0},rtt=0,pingT=0,myU=0,dirty=false,drag=null,pr=[],snap=null,snapId=0,off={x:0,y:0},rp={x:0,y:0,ok:false},trail=[];
      let parts=[],flash=[],shake=0,msg='',msgT=0,msgCol='#fff',bigMsg='',bigT=0,hintT=0,lastLocalHit=0,hitFired={},lastFrame=performance.now(),overShown=false;
      let V=null;const dbg=window.__ttPong={};
      const edgeOf=pid=>S?S.ord.indexOf(pid):-1;
      function view(){
        const N=S.N,G=geo(N),W=cvo.W,Hh=cvo.H;
        const mk=Math.max(0,edgeOf(c.me())),al=Math.PI/2-G.e[mk].phi,ca=Math.cos(al),sa=Math.sin(al);
        let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
        for(let k=0;k<N;k++){const th=2*Math.PI*k/N,x=Math.cos(th),y=Math.sin(th),rx=x*ca-y*sa,ry=x*sa+y*ca;x0=Math.min(x0,rx);x1=Math.max(x1,rx);y0=Math.min(y0,ry);y1=Math.max(y1,ry);}
        const MX=N<=3?24:42,TOP=58,BOT=78,aw=W-2*MX,ah=Math.max(60,Hh-TOP-BOT),sc=Math.min(aw/(x1-x0),ah/(y1-y0));
        const ox=W/2-(x0+x1)/2*sc,oy=TOP+ah/2-(y0+y1)/2*sc;
        V={G,N,sc,ca,sa,ox,oy,mk,W,H:Hh,P:(x,y)=>[ox+(x*ca-y*sa)*sc,oy+(x*sa+y*ca)*sc],D:(x,y)=>[x*ca-y*sa,x*sa+y*ca]};
        return V;
      }
      function sparks(x,y,col,n,sp){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(0.3+Math.random())*sp;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,col,r:1.5+Math.random()*2});}}
      function say(t,col,ms){msg=t;msgCol=col||'#fff';msgT=performance.now()+(ms||1800);}
      function onHit(k,x,y,sp,who,local){
        if(!V)return;const [sx,sy]=V.P(x,y);
        flash[k]=1;sparks(sx,sy,c.col(who),8+Math.round(sp*4),120+sp*60);
        const mine=k===V.mk;beep(240+sp*170,.06,'square',mine?.11:.06);if(mine)buzz(18);
        shake=Math.max(shake,1+sp);
      }
      function onGoal(m){
        if(!V)return;const k=m.e,G=V.G,e=G.e[k],[sx,sy]=V.P(e.mx,e.my);
        const mine=k===V.mk;
        sparks(sx,sy,c.col(m.who),26,220);flash[k]=-1;shake=mine?10:5;
        if(mine){sfx.bad();buzz([50,30,90]);}else beep(130,.25,'sawtooth',.09,-70);
        const who=c.pl(m.who),by=m.by>=0&&m.by!==m.who?c.pl(m.by):null;
        const nm=who?(m.who===c.me()?'You':who.n):'?';
        say(by?(by.n+' scored on '+nm+'!'):(nm+(m.who===c.me()?' let one in!':' lost a life!')),by?c.col(m.by):'#ff6b6b',2000);
        if(m.lv<=0){bigMsg=(m.who===c.me()?'YOU’RE OUT':nm+' IS OUT')+' 💀';bigT=performance.now()+1600;}
        trail.length=0;rp.ok=false;
      }
      function aim(){ // used by bots/tests: u that would catch the ball
        if(!S||!V)return 0;const G=V.G,e=G.e[V.mk],b=snap?{x:rp.x,y:rp.y,vx:rv.vx,vy:rv.vy}:S.b;   // rendered (latency-led) ball
        const vo=b.vx*e.ox+b.vy*e.oy;let x=b.x,y=b.y;
        if(vo>0.01){const t=(e.mx*e.ox+e.my*e.oy-(b.x*e.ox+b.y*e.oy))/vo;x=b.x+b.vx*t;y=b.y+b.vy*t;}
        const s=(x-e.mx)*e.tx+(y-e.my)*e.ty;return cl(s/G.rng,-1,1);
      }
      function press(e){
        if(drag)return;if(c.R().ph!=='play')return;
        drag={id:e.pointerId,x:e.clientX,u:myU};try{root.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();hintT=1;
      }
      function move(e){
        if(!drag||e.pointerId!==drag.id||!V)return;
        const travel=V.G.rng*2*V.sc,du=(e.clientX-drag.x)/travel*2*1.5; // 1.5x gain: a short swipe covers the whole edge
        const u=cl(drag.u+du,-1,1);
        if(u!==myU){myU=u;dirty=true;}
        e.preventDefault();
      }
      function release(e){if(drag&&e.pointerId===drag.id)drag=null;}
      function sendNow(){
        if(!dirty||c.R().ph!=='play')return;dirty=false;c.act({k:'p',u:Math.round(myU*1e3)/1e3});
      }
      function draw(dt,now){
        const W=cvo.W,Hh=cvo.H;g.clearRect(0,0,W,Hh);g.fillStyle='#0b0b17';g.fillRect(0,0,W,Hh);
        if(!S||W<10)return;
        const v=view(),G=v.G,N=v.N,P=v.P;
        g.save();
        if(shake>0.05){g.translate((Math.random()-.5)*shake*2,(Math.random()-.5)*shake*2);shake*=Math.pow(0.002,dt);}
        // arena fill
        g.beginPath();for(let k=0;k<N;k++){const th=2*Math.PI*k/N,[x,y]=P(Math.cos(th),Math.sin(th));k?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();
        g.fillStyle='#12122b';g.fill();
        g.save();g.clip();
        const [cx,cy]=P(0,0);const gr=g.createRadialGradient(cx,cy,5,cx,cy,v.sc*1.1);gr.addColorStop(0,'#1d1d45');gr.addColorStop(1,'#0e0e22');g.fillStyle=gr;g.fillRect(0,0,W,Hh);
        g.strokeStyle='#ffffff10';g.lineWidth=2;g.beginPath();g.arc(cx,cy,v.sc*G.a*0.42,0,6.283);g.stroke();
        g.restore();
        const alive=S.ord.map(id=>id>=0&&S.lv[id]>0);
        // edges
        for(let k=0;k<N;k++){
          const e=G.e[k],th0=2*Math.PI*k/N,th1=2*Math.PI*(k+1)/N,[x0,y0]=P(Math.cos(th0),Math.sin(th0)),[x1,y1]=P(Math.cos(th1),Math.sin(th1));
          const pid=S.ord[k],col=pid>=0?c.col(pid):'#888';
          g.lineCap='round';
          if(alive[k]){
            const f=flash[k]||0;
            g.strokeStyle=f<0?'#ff4d4d':col;g.globalAlpha=0.35+Math.abs(f)*0.5;g.lineWidth=4+Math.abs(f)*5;
            g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();g.globalAlpha=1;
          }else{
            g.strokeStyle=(flash[k]||0)<0?'#ff6b6b':'#6d6d96';g.lineWidth=9;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();
            g.strokeStyle='#2c2c52';g.lineWidth=3;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();
          }
          if(flash[k]>0)flash[k]=Math.max(0,flash[k]-dt*4);else if(flash[k]<0)flash[k]=Math.min(0,flash[k]+dt*2);
        }
        // paddles
        for(let k=0;k<N;k++){
          if(!alive[k])continue;
          const e=G.e[k],pid=S.ord[k],mine=pid===c.me(),u=mine?myU:pr[k]||0,pos=u*G.rng;
          const cxw=e.mx+e.tx*pos-e.ox*TH/2,cyw=e.my+e.ty*pos-e.oy*TH/2;
          const [ax,ay]=P(cxw-e.tx*G.ph,cyw-e.ty*G.ph),[bx,by]=P(cxw+e.tx*G.ph,cyw+e.ty*G.ph);
          g.lineCap='round';
          g.strokeStyle=c.col(pid);g.shadowColor=c.col(pid);g.shadowBlur=mine?14:6;g.lineWidth=Math.max(7,TH*v.sc*1.25);
          g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();
          const f=flash[k]||0;if(f>0){g.strokeStyle='#fff';g.globalAlpha=Math.min(1,f);g.shadowBlur=18;g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();g.globalAlpha=1;}
          g.shadowBlur=0;
        }
        // labels + lives
        g.textAlign='center';g.textBaseline='middle';
        for(let k=0;k<N;k++){
          const pid=S.ord[k];if(pid<0)continue;const e=G.e[k],[mx,my]=P(e.mx,e.my),[dx,dy]=v.D(e.ox,e.oy),[tx,ty]=v.D(e.tx,e.ty);
          const col=c.col(pid),lv=S.lv[pid]||0,mine=pid===c.me();
          let sg=1;{const tx0=mx+dx*40;if(tx0<30||tx0>W-30)sg=-1;}
          for(let i=0;i<LIVES;i++){
            const px=mx+sg*dx*17+tx*(i-1)*14,py=my+sg*dy*17+ty*(i-1)*14;
            g.beginPath();g.arc(px,py,5,0,6.283);
            if(i<lv){g.fillStyle=col;g.shadowColor=col;g.shadowBlur=6;g.fill();g.shadowBlur=0;}else{g.strokeStyle=col;g.globalAlpha=.4;g.lineWidth=1.5;g.stroke();g.globalAlpha=1;}
          }
          const p=c.pl(pid);let nm=p?p.n:'?';if(nm.length>9)nm=nm.slice(0,8)+'…';if(mine)nm='YOU';
          let lx=mx+sg*dx*38,ly=my+sg*dy*38;lx=cl(lx,34,W-34);ly=cl(ly,12,Hh-10);
          g.font='800 '+(mine?15:13)+'px system-ui,sans-serif';g.globalAlpha=sg<0?.8:1;g.fillStyle=lv>0?col:'#77779a';
          g.fillText((lv>0?'':'💀 ')+nm,lx,ly);g.globalAlpha=1;
        }
        // ball
        const bcol=S.bc>=0?c.col(S.bc):'#ffffff';
        const bpx=P(rp.x,rp.y),bsx=bpx[0],bsy=bpx[1],brad=Math.max(5,BR*v.sc);
        if(S.sv>0){
          const a=(S.sv/SERVE),pulse=1+Math.sin(now/70)*.08;
          g.strokeStyle='#ffffff66';g.lineWidth=3;g.beginPath();g.arc(cx,cy,brad*(1.8+a*3),0,6.283);g.stroke();
          const [dx,dy]=v.D(S.b.vx,S.b.vy),dl=Math.hypot(dx,dy)||1;
          g.strokeStyle='#ffffffaa';g.lineWidth=3;g.beginPath();g.moveTo(cx+dx/dl*brad*2.2,cy+dy/dl*brad*2.2);g.lineTo(cx+dx/dl*brad*4.5,cy+dy/dl*brad*4.5);g.stroke();
          g.fillStyle='#fff';g.beginPath();g.arc(cx+dx/dl*brad*5.2,cy+dy/dl*brad*5.2,brad*.5,0,6.283);g.fill();
          g.fillStyle='#fff';g.shadowColor='#fff';g.shadowBlur=16;g.beginPath();g.arc(cx,cy,brad*pulse,0,6.283);g.fill();g.shadowBlur=0;
        }else{
          const spr=cl((Math.hypot(S.b.vx,S.b.vy)-SP0)/(SPCAP-SP0),0,1);
          // trail
          for(let i=0;i<trail.length;i++){
            const t=trail[i],age=(now-t.t)/1000,fa=1-age/(0.16+0.26*spr);if(fa<=0)continue;
            g.globalAlpha=fa*(0.35+0.4*spr);g.fillStyle=t.col;g.beginPath();g.arc(t.x,t.y,brad*(0.35+0.65*fa),0,6.283);g.fill();
          }
          g.globalAlpha=1;
          g.fillStyle=bcol;g.shadowColor=bcol;g.shadowBlur=10+spr*14;g.beginPath();g.arc(bsx,bsy,brad,0,6.283);g.fill();g.shadowBlur=0;
          g.fillStyle='#ffffff88';g.beginPath();g.arc(bsx-brad*.3,bsy-brad*.3,brad*.35,0,6.283);g.fill();
        }
        // sparks
        for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=0.94;p.vy*=0.94;p.l-=dt*2.2;if(p.l<=0){parts.splice(i,1);continue;}g.globalAlpha=p.l;g.fillStyle=p.col;g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill();}
        g.globalAlpha=1;
        g.restore();
        // messages
        if(now<msgT){g.font='800 15px system-ui,sans-serif';g.textAlign='center';g.fillStyle=msgCol;g.globalAlpha=Math.min(1,(msgT-now)/300);g.fillText(msg,W/2,24);g.globalAlpha=1;}
        if(S.sv>0&&S.t>0&&running){g.font='900 18px system-ui,sans-serif';g.fillStyle='#ffffffcc';g.fillText('Ball incoming…',W/2,48);}
        if(now<bigT){g.font='900 30px system-ui,sans-serif';g.fillStyle='#fff';g.shadowColor='#000';g.shadowBlur=10;g.globalAlpha=Math.min(1,(bigT-now)/300);g.fillText(bigMsg,W/2,cy);g.shadowBlur=0;g.globalAlpha=1;}
        if(S.over&&S.win>=0){g.font='900 34px system-ui,sans-serif';g.fillStyle=c.col(S.win);g.shadowColor='#000';g.shadowBlur=12;g.fillText((S.win===c.me()?'YOU WIN!':(c.pl(S.win)?c.pl(S.win).n:'?')+' WINS!'),W/2,cy);g.shadowBlur=0;}
        // my-edge drag hint
        if(running&&!hintT&&S.t<8){
          const a=0.55+0.45*Math.sin(now/220),by=Hh-18;g.globalAlpha=a;g.fillStyle='#fff';g.font='800 15px system-ui,sans-serif';
          g.fillText('◀   drag anywhere to slide   ▶',W/2,by);g.globalAlpha=1;
        }
      }
      return{
        mount(r){
          root=r;root.style.touchAction='none';cvo=mkCanvas(root);g=cvo.g;
          root.addEventListener('pointerdown',press);root.addEventListener('pointermove',move);
          root.addEventListener('pointerup',release);root.addEventListener('pointercancel',release);
        },
        start(){
          running=true;sendT=setInterval(sendNow,30);pingT=setInterval(()=>{if(c.R().ph==='play')c.act({k:'ping',ts:performance.now()});},1000);
          dirty=true;sendNow();
        },
        stop(){running=false;clearInterval(sendT);clearInterval(pingT);window.__ttPong={};},
        update(s,R){
          const first=!S;S=s;
          if(first){me=edgeOf(c.me());pr=s.pu.slice();myU=s.pu[me]||0;}
          for(let k=0;k<s.N;k++)if(pr[k]===undefined)pr[k]=s.pu[k]||0;
          const prev=snap;snap={x:s.b.x,y:s.b.y,vx:s.b.vx,vy:s.b.vy,cap:s.b.cap,at:performance.now(),id:++snapId};
          let t0={x:s.b.x,y:s.b.y};
          if(s.sv<=0){const ld=Math.min(.4,rtt/1000*0.9);if(ld>0){const sm={x:s.b.x,y:s.b.y,vx:s.b.vx,vy:s.b.vy,cap:s.b.cap},G0=geo(s.N);stepBall(sm,ld,G0,s.ord.map(id=>id>=0&&s.lv[id]>0),s.ord.map((id,k)=>id===c.me()?myU:pr[k]));t0=sm;}}
          if(rp.ok&&s.sv<=0&&prev&&Math.hypot(rp.x-t0.x,rp.y-t0.y)<0.45){off={x:rp.x-t0.x,y:rp.y-t0.y};}else{off={x:0,y:0};rp.x=t0.x;rp.y=t0.y;}
          rp.ok=true;
          if(s.over&&!overShown){overShown=true;if(s.win===c.me())sfx.win();else sfx.boom();}
        },
        event(m){
          if(m.k==='hit'){if(m.e===(V&&V.mk)&&performance.now()-lastLocalHit<260+rtt)return;onHit(m.e,m.x,m.y,m.sp,m.who,false);}
          else if(m.k==='pong'){const d=performance.now()-m.ts;if(d>=0&&d<3000)rtt=rtt?rtt*.7+d*.3:d;}
          else if(m.k==='goal')onGoal(m);
          else if(m.k==='wall'){beep(180,.04,'triangle',.05);}
          else if(m.k==='serve'){trail.length=0;rp.ok=false;}
        },
        frame(rem){
          const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
          if(!S||!cvo||cvo.W<10)return;
          const v=view(),G=v.G;
          // smooth other paddles
          for(let k=0;k<S.N;k++){const pid=S.ord[k];if(pid===c.me())continue;pr[k]=pr[k]+((S.pu[k]||0)-pr[k])*Math.min(1,dt*20);}
          // ball: re-run host physics forward from the latest snapshot, then blend out the small correction
          if(S.sv>0||!snap){rp.x=S.b.x;rp.y=S.b.y;}
          else{
            const el=Math.min(.3,(now-snap.at)/1000)+Math.min(.4,rtt/1000*0.9),sim={x:snap.x,y:snap.y,vx:snap.vx,vy:snap.vy,cap:snap.cap};
            const alive=S.ord.map(id=>id>=0&&S.lv[id]>0),pu=S.ord.map((id,k)=>id===c.me()?myU:pr[k]);
            stepBall(sim,el,G,alive,pu,{hit(k,o,spd){
              if(k===v.mk&&!hitFired[snap.id]){hitFired[snap.id]=1;lastLocalHit=now;onHit(k,sim.x,sim.y,spd,c.me(),true);}
            }});
            rv.vx=sim.vx;rv.vy=sim.vy;const kd=Math.exp(-Math.min(.3,(now-snap.at)/1000)*9);rp.x=sim.x+off.x*kd;rp.y=sim.y+off.y*kd;
          }
          if(S.sv<=0&&running){const [sx,sy]=v.P(rp.x,rp.y);trail.push({x:sx,y:sy,t:now,col:S.bc>=0?c.col(S.bc):'#ffffff'});if(trail.length>26)trail.shift();}
          else trail.length=0;
          // debug hook for the bot tests
          dbg.u=myU;dbg.pxPerU=G.rng*v.sc/1.5;dbg.aim=aim;dbg.edge=v.mk;dbg.ok=true;
          draw(dt,now);
        }
      };
    }
  };
})();
