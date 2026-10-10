// Hot Cat: tag where the CAT's time is the bad time. Touch a runner and you swap roles; the old cat is stunned.
GAMES.tag=(function(){
  const AW=12,AH=17,           // arena size in world units
        PR=0.42,               // player radius
        TAGR=0.96,             // centre distance for a tag
        V_RUN=4.0,V_RUNS=5.8,  // runner walk / sprint
        V_CAT=3.9,V_CATS=6.8,  // cat walk / sprint
        BOOST=1.3,BOOST_T=2.0, // speed multiplier + duration for a freshly-tagged cat
        STUN=1.2,NOTAG=2.0,    // old cat frozen for 1.2 s, can't be re-tagged-back for 2 s
        START_STUN=2.0,        // the first cat is asleep for 2 s so runners can scatter
        ST_DRAIN=0.42,ST_DRAIN_CAT=0.3,ST_REGEN=0.15,ST_DELAY=0.5,ST_LOCK=0.3,
        DUR=60;
  // symmetric obstacle layout [x0,y0,x1,y1]
  const OBS=[
    [4.8,7.3,7.2,9.7],
    [2.0,3.0,4.2,4.2],[7.8,3.0,10.0,4.2],[2.0,12.8,4.2,14.0],[7.8,12.8,10.0,14.0],
    [0,7.6,1.6,9.4],[10.4,7.6,12,9.4],
    [5.2,1.4,6.8,2.6],[5.2,14.4,6.8,15.6]
  ];
  const SPAWN=[[1.6,1.6],[10.4,15.4],[10.4,1.6],[1.6,15.4]];
  const cl=(x,a,b)=>Math.max(a,Math.min(b,x));
  function resolve(p){
    p.x=cl(p.x,PR,AW-PR);p.y=cl(p.y,PR,AH-PR);
    for(const o of OBS){
      const qx=cl(p.x,o[0],o[2]),qy=cl(p.y,o[1],o[3]);let dx=p.x-qx,dy=p.y-qy,d=Math.hypot(dx,dy);
      if(d>=PR)continue;
      if(d<1e-6){ // centre inside the box: push out through the nearest side
        const l=p.x-o[0],r=o[2]-p.x,t=p.y-o[1],b=o[3]-p.y,m=Math.min(l,r,t,b);
        if(m===l)p.x=o[0]-PR;else if(m===r)p.x=o[2]+PR;else if(m===t)p.y=o[1]-PR;else p.y=o[3]+PR;
      }else{p.x=qx+dx/d*PR;p.y=qy+dy/d*PR;}
    }
  }
  function speedOf(isCat,sprint,boost){return (isCat?(sprint?V_CATS:V_CAT):(sprint?V_RUNS:V_RUN))*(boost>0?BOOST:1);}
  // shared movement step (host: authoritative, client: prediction of own player)
  function move(p,ix,iy,spd,dt){
    const l=Math.hypot(ix,iy);if(l>1){ix/=l;iy/=l;}
    const x0=p.x,y0=p.y;
    for(let i=0;i<2;i++){p.x+=ix*spd*dt/2;p.y+=iy*spd*dt/2;resolve(p);}
    p.vx=(p.x-x0)/dt;p.vy=(p.y-y0)/dt;
  }
  // stamina rules (shared). sd = seconds since last sprint
  function stam(p,want,dt,sdRef,isCat){
    if(want&&!p.lk&&p.st>0){p.st-=(isCat?ST_DRAIN_CAT:ST_DRAIN)*dt;sdRef.v=0;if(p.st<=0){p.st=0;p.lk=1;}return true;}
    sdRef.v+=dt;
    if(sdRef.v>ST_DELAY){p.st=Math.min(1,p.st+ST_REGEN*dt);}
    if(p.lk&&p.st>=ST_LOCK)p.lk=0;
    return false;
  }
  function pubPlayer(p){return{id:p.id,x:+p.x.toFixed(2),y:+p.y.toFixed(2),vx:+p.vx.toFixed(2),vy:+p.vy.toFixed(2),st:+p.st.toFixed(2),lk:p.lk,z:+Math.max(0,p.z).toFixed(2),b:+Math.max(0,p.b).toFixed(2)};}

  return{
    name:'Hot Cat',emoji:'🐱',tag:'Don’t be the cat. Tag someone to dump it on them.',
    min:2,max:4,
    rules:[
      ['🐱','One player is the CAT. The cat glows and chases everybody else around the arena.'],
      ['🔄','When the cat touches a runner, you swap: the runner becomes the cat, and the old cat is frozen for a moment.'],
      ['💨','Hold the 💨 button to sprint. Stamina is limited and refills slowly, so save it for the escape.'],
      ['🧱','Use the walls and blocks to dodge round. The cat is a bit slower than runners, but corners are deadly.'],
      ['⏱️','Only time spent NOT being the cat counts. Least cat time wins.']
    ],
    ctrl:'Drag anywhere to move. Hold 💨 to sprint.',
    win:'Score = seconds you spent as a runner (not the cat). Most wins.',
    dur:DUR,hz:20,better:'high',fmt:v=>v.toFixed(1)+'s safe',

    // ---------------- host ----------------
    init(H){
      const ps=H.players,sp=shuffle(SPAWN.slice()),pp={},sc={},inp={};
      ps.forEach((p,i)=>{pp[p.id]={id:p.id,x:sp[i%4][0],y:sp[i%4][1],vx:0,vy:0,st:1,lk:0,z:0,b:0};sc[p.id]=0;inp[p.id]={x:0,y:0,s:0};});
      const live=ps.filter(p=>!p.aw),cat=(live.length?pick(live):ps[0]).id;
      pp[cat].z=START_STUN;
      const S={cat,sc,p:ps.map(p=>pubPlayer(pp[p.id])),_pp:pp,_in:inp,_sd:{},_noTag:{},tags:0};
      return S;
    },
    tick(H,S,dt){
      if(S.over)return;
      const pl=H.players,pp=S._pp;
      // away players: drop the cat to someone else, freeze them
      for(const p of pl){
        if(p.aw&&S.cat===p.id){const live=pl.filter(q=>!q.aw);if(live.length>1){const nc=pick(live.filter(q=>q.id!==p.id));S.cat=nc.id;pp[nc.id].b=BOOST_T;pp[nc.id].z=0;H.emit({k:'tag',from:p.id,to:nc.id,x:pp[nc.id].x,y:pp[nc.id].y});}}
      }
      for(const p of pl){
        const q=pp[p.id],inp=S._in[p.id];
        if(p.aw){q.vx=q.vy=0;continue;}
        const isCat=S.cat===p.id;
        if(q.z>0){q.z-=dt;q.vx=q.vy=0;const r=S._sd[p.id]||(S._sd[p.id]={v:0});stam(q,false,dt,r,isCat);}
        else{
          const r=S._sd[p.id]||(S._sd[p.id]={v:0}),moving=Math.hypot(inp.x,inp.y)>0.15;
          const spr=stam(q,inp.s&&moving,dt,r,isCat);
          move(q,inp.x,inp.y,speedOf(isCat,spr,q.b),dt);
        }
        if(q.b>0)q.b-=dt;
        if(!isCat)S.sc[p.id]=Math.round((S.sc[p.id]+dt)*1000)/1000;
      }
      // light separation between runners so nobody stacks
      for(let i=0;i<pl.length;i++)for(let j=i+1;j<pl.length;j++){
        const a=pl[i],b=pl[j];if(a.aw||b.aw||a.id===S.cat||b.id===S.cat)continue;
        const A=pp[a.id],B=pp[b.id],dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy);
        if(d>1e-6&&d<PR*2){const o=(PR*2-d)/2;A.x-=dx/d*o;A.y-=dy/d*o;B.x+=dx/d*o;B.y+=dy/d*o;resolve(A);resolve(B);}
      }
      // tag check
      const cat=pp[S.cat];
      if(cat&&!(cat.z>0)){
        let best=null,bd=TAGR;
        for(const p of pl){
          if(p.aw||p.id===S.cat)continue;if((S._noTag[p.id]||0)>S.t)continue;
          const q=pp[p.id],d=Math.hypot(q.x-cat.x,q.y-cat.y);if(d<bd){bd=d;best=p;}
        }
        if(best){
          const old=S.cat,nq=pp[best.id];
          S.cat=best.id;cat.z=STUN;cat.b=0;S._noTag[old]=S.t+NOTAG;
          nq.b=BOOST_T;nq.st=1;nq.lk=0;nq.z=0;S.tags++;
          H.emit({k:'tag',from:old,to:best.id,x:nq.x,y:nq.y});
        }
      }
      S.p=pl.map(p=>pubPlayer(pp[p.id]));
    },
    act(H,S,pid,m){
      if(m.k!=='i'||S.over)return;
      const x=+m.x,y=+m.y;if(!isFinite(x)||!isFinite(y))return;
      const l=Math.hypot(x,y),k=l>1?1/l:1;
      S._in[pid]={x:x*k,y:y*k,s:m.s?1:0};
    },
    val(S,id){return Math.round((S.sc[id]||0)*10)/10;},

    // ---------------- client ----------------
    mk(c){
      let S=null,root,cvo,g,btn,joy,running=false,sendT=0,lastFrame=performance.now(),styleOn=false;
      let jx=0,jy=0,sprintHeld=false,keySpr=false,lastSent='',lastSentAt=0;
      const rs={};                        // render states for other players
      let me=null;                        // locally predicted self {x,y,vx,vy,st,lk}
      const sdRef={v:1};
      let parts=[],shake=0,flash=0,bannerT=0,bannerTxt='',catSince=0,hintUntil=0,lastCat=-1,wasStun=false,stunT=0;
      const dbg=window.__ttTag={};
      function css(){
        if(document.getElementById('st-tag'))return;
        const st=document.createElement('style');st.id='st-tag';
        st.textContent='.tag-spr{position:absolute;right:14px;bottom:14px;width:84px;height:84px;border-radius:50%;border:0;touch-action:none;z-index:6;display:flex;align-items:center;justify-content:center;font-size:36px;color:#fff;background:conic-gradient(var(--c,#52ff7a) calc(var(--p,100)*1%),#2a2a55 0);-webkit-user-select:none;user-select:none;box-shadow:0 4px 0 #0008}'
          +'.tag-spr i{position:absolute;inset:8px;border-radius:50%;background:#171734;display:flex;align-items:center;justify-content:center;font-style:normal}'
          +'.tag-spr.on i{background:#2d5a3a}.tag-spr.lk{--c:#ff5060}.tag-spr.lk i{background:#3a1a24;opacity:.8}';
        document.head.append(st);
      }
      const L=()=>{const W=cvo.W,Hh=cvo.H,s=Math.max(10,Math.min((W-12)/AW,(Hh-60-100)/AH));return{W,H:Hh,s,ox:(W-AW*s)/2,oy:56+((Hh-56-96)-AH*s)/2};};
      function sparks(x,y,col,n,sp){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(0.3+Math.random())*sp;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,col,r:2+Math.random()*2.5});}}
      const myRole=()=>S&&S.cat===c.me();
      function inputNow(){
        let x=jx,y=jy;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}
        return{x,y,s:(sprintHeld||keySpr)?1:0};
      }
      function sendNow(force){
        if(!running||c.R().ph!=='play')return;
        const i=inputNow(),key=i.x.toFixed(2)+','+i.y.toFixed(2)+','+i.s,now=performance.now();
        if(key===lastSent&&!force&&now-lastSentAt<250)return;
        lastSent=key;lastSentAt=now;c.act({k:'i',x:+i.x.toFixed(2),y:+i.y.toFixed(2),s:i.s});
      }
      function drawPlayer(x,y,col,p,isMe,isCat,now,s,name){
        const r=PR*s;
        g.save();g.translate(x,y);
        const stunned=p&&p.z>0;
        if(isCat){ // hot glow
          const pulse=.6+.4*Math.sin(now/110);
          const gr=g.createRadialGradient(0,0,r*.5,0,0,r*3);gr.addColorStop(0,'rgba(255,120,30,'+(0.55*pulse)+')');gr.addColorStop(1,'rgba(255,60,0,0)');
          g.fillStyle=gr;g.beginPath();g.arc(0,0,r*3,0,6.283);g.fill();
        }
        g.fillStyle='#0006';g.beginPath();g.ellipse(0,r*.55,r*.95,r*.55,0,0,6.283);g.fill();
        if(isCat){ // ears (drawn behind the body, with an orange outline so they pop on any colour)
          g.lineJoin='round';g.lineWidth=Math.max(2,r*.2);g.strokeStyle='#ff8a1c';g.fillStyle=col;
          for(const sx of [-1,1]){g.beginPath();g.moveTo(sx*r*1.05,-r*.05);g.lineTo(sx*r*.85,-r*1.7);g.lineTo(sx*r*.0,-r*.8);g.closePath();g.stroke();g.fill();}
          g.fillStyle='#ff9ab8';
          for(const sx of [-1,1]){g.beginPath();g.moveTo(sx*r*.88,-r*.3);g.lineTo(sx*r*.78,-r*1.25);g.lineTo(sx*r*.25,-r*.7);g.closePath();g.fill();}
        }
        g.globalAlpha=stunned?.6:1;
        g.fillStyle=col;g.beginPath();g.arc(0,0,r,0,6.283);g.fill();
        g.lineWidth=Math.max(2,r*.18);g.strokeStyle=isCat?'#ff8a1c':'#00000055';g.stroke();
        if(isMe){g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.arc(0,0,r+3,0,6.283);g.stroke();}
        // face
        g.fillStyle='#111';
        if(stunned){g.font='800 '+Math.round(r*1.1)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('××',0,-r*.05);}
        else{g.beginPath();g.arc(-r*.34,-r*.1,r*.16,0,6.283);g.arc(r*.34,-r*.1,r*.16,0,6.283);g.fill();
          if(isCat){g.strokeStyle='#111';g.lineWidth=1.5;g.beginPath();g.moveTo(-r*.2,r*.28);g.lineTo(0,r*.4);g.lineTo(r*.2,r*.28);g.stroke();}}
        g.globalAlpha=1;
        if(stunned){const a=now/200;g.font=Math.round(r*.9)+'px system-ui';g.textAlign='center';for(let i=0;i<3;i++){g.fillText('⭐',Math.cos(a+i*2.1)*r*1.1,-r*1.5+Math.sin(a+i*2.1)*r*.3);}}
        else if(isCat){g.font=Math.round(r*1.25)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('🐱',0,-r*2.3);}
        if(p&&p.b>0&&isCat){g.strokeStyle='#ffd23f';g.lineWidth=2;g.setLineDash([4,4]);g.beginPath();g.arc(0,0,r*1.5,now/150,now/150+5);g.stroke();g.setLineDash([]);}
        g.restore();
        g.font='800 11px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='#000b';
        const nm=isMe?'YOU':(name.length>8?name.slice(0,7)+'…':name);
        const ny=y+r+11;g.strokeText(nm,x,ny);g.fillStyle='#fff';g.fillText(nm,x,ny);
      }
      function draw(dt,now){
        const l=L(),W=l.W,Hh=l.H,s=l.s,ox=l.ox,oy=l.oy;
        g.clearRect(0,0,W,Hh);g.fillStyle='#0b0b17';g.fillRect(0,0,W,Hh);
        if(!S)return;
        g.save();
        if(shake>.1){g.translate((Math.random()-.5)*shake*2,(Math.random()-.5)*shake*2);shake*=Math.pow(.003,dt);}
        // floor
        g.fillStyle='#161634';g.fillRect(ox,oy,AW*s,AH*s);
        g.fillStyle='#1b1b3d';for(let i=0;i<AW;i++)for(let j=0;j<AH;j++)if((i+j)%2===0)g.fillRect(ox+i*s,oy+j*s,s,s);
        // cat danger tint when I'm a runner and the cat is close
        const cp=S.p.find(q=>q.id===S.cat);
        // obstacles
        for(const o of OBS){
          const x=ox+o[0]*s,y=oy+o[1]*s,w=(o[2]-o[0])*s,h=(o[3]-o[1])*s;
          g.fillStyle='#05050e';g.fillRect(x+3,y+5,w,h);
          g.fillStyle='#3b3b78';g.fillRect(x,y,w,h);
          g.fillStyle='#55559e';g.fillRect(x,y,w,Math.min(5,h));
          g.strokeStyle='#8888d0';g.lineWidth=1.5;g.strokeRect(x+.5,y+.5,w-1,h-1);
        }
        g.strokeStyle='#7a7ac0';g.lineWidth=4;g.strokeRect(ox-2,oy-2,AW*s+4,AH*s+4);
        // players (me predicted, others extrapolated); draw by y for pseudo depth
        const draws=[];
        for(const p of S.p){
          const pl=c.pl(p.id);if(pl&&pl.aw)continue;
          let x,y;
          if(p.id===c.me()&&me){x=me.x;y=me.y;}else{const r=rs[p.id];if(!r)continue;x=r.x;y=r.y;}
          draws.push({p,x,y,pl});
        }
        draws.sort((a,b)=>a.y-b.y);
        for(const d of draws){
          const mine=d.p.id===c.me();
          const pp=mine?Object.assign({},d.p,{z:stunT>0?stunT:0}):d.p;
          drawPlayer(ox+d.x*s,oy+d.y*s,c.col(d.p.id),pp,mine,d.p.id===S.cat,now,s,d.pl?d.pl.n:'?');
        }
        for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.93;p.vy*=.93;p.l-=dt*2.2;if(p.l<=0){parts.splice(i,1);continue;}g.globalAlpha=p.l;g.fillStyle=p.col;g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill();}
        g.globalAlpha=1;
        g.restore();
        // ---- top: per-player time bars ----
        const n=S.p.length,gap=6,cw=(W-gap*(n+1))/n;
        S.p.forEach((p,i)=>{
          const x=gap+i*(cw+gap),y=6,pl=c.pl(p.id),isCat=p.id===S.cat,col=c.col(p.id),v=S.sc[p.id]||0;
          g.fillStyle='#171734';g.beginPath();g.roundRect?g.roundRect(x,y,cw,40,9):g.rect(x,y,cw,40);g.fill();
          if(isCat){g.strokeStyle='#ff8a1c';g.lineWidth=2;g.stroke();}
          g.font='800 12px system-ui,sans-serif';g.textAlign='left';g.textBaseline='middle';g.fillStyle=col;
          let nm=(isCat?'🐱 ':'')+(p.id===c.me()?'You':(pl?pl.n:'?'));if(nm.length>9)nm=nm.slice(0,8)+'…';
          g.fillText(nm,x+7,y+11);
          g.textAlign='right';g.fillStyle='#fff';g.fillText(v.toFixed(1)+'s',x+cw-7,y+11);
          g.fillStyle='#ffffff18';g.fillRect(x+7,y+24,cw-14,8);g.fillStyle=col;g.fillRect(x+7,y+24,(cw-14)*cl(v/DUR,0,1),8);
        });
        // ---- banner ----
        g.textAlign='center';g.textBaseline='middle';
        const iAmCat=myRole();
        if(S.over){
          const w=S.p.slice().sort((a,b)=>(S.sc[b.id]||0)-(S.sc[a.id]||0))[0];
          g.font='900 26px system-ui,sans-serif';g.fillStyle='#fff';g.fillText('⏱️ Time!',W/2,oy+AH*s/2);
        }else if(now<bannerT){
          const q=(bannerT-now)/1300;g.globalAlpha=Math.min(1,q*2);g.font='900 '+Math.round(26+10*q)+'px system-ui,sans-serif';
          g.lineWidth=5;g.strokeStyle='#000c';g.strokeText(bannerTxt,W/2,oy+AH*s*.5);g.fillStyle='#ffb347';g.fillText(bannerTxt,W/2,oy+AH*s*.5);g.globalAlpha=1;
        }
        if(!S.over){
          let msg='',col='#ffffff';
          if(stunT>0){msg='😵 STUNNED '+stunT.toFixed(1);col='#ffd23f';}
          else if(iAmCat){msg=(cp&&cp.z>0&&S.t<4)?'🐱 YOU ARE THE CAT (waking up…)':'🐱 YOU ARE THE CAT! Tag someone!';col='#ffb347';}
          else{const cn=c.pl(S.cat);msg='Run from '+(cn?cn.n:'the cat')+' 🐱';col='#cfcff0';}
          const my=oy+AH*s+20;
          g.font='900 '+(iAmCat?19:15)+'px system-ui,sans-serif';
          if(iAmCat){const tw=g.measureText(msg).width+30,pulse=.7+.3*Math.sin(now/140);g.fillStyle='rgba(255,110,20,'+(0.22*pulse+.12)+')';g.beginPath();g.roundRect?g.roundRect(W/2-tw/2,my-17,tw,34,14):g.rect(W/2-tw/2,my-17,tw,34);g.fill();}
          g.fillStyle=col;g.fillText(msg,W/2,my);
        }
        // hint
        if(running&&now<hintUntil&&S.t<5){g.globalAlpha=.6+.4*Math.sin(now/200);g.font='800 14px system-ui,sans-serif';g.fillStyle='#fff';g.fillText('Drag anywhere to move  ·  hold 💨 to sprint',W/2,oy+AH*s*.5+40);g.globalAlpha=1;}
        if(flash>0){g.fillStyle='rgba(255,140,30,'+flash*.35+')';g.fillRect(0,0,W,Hh);flash=Math.max(0,flash-dt*3);}
      }
      return{
        mount(r){
          root=r;css();root.style.touchAction='none';cvo=mkCanvas(root);g=cvo.g;
          joy=Joy(root,(x,y)=>{jx=x;jy=y;},{radius:50});
          btn=E('button','tag-spr','<i>💨</i>');btn.setAttribute('aria-label','sprint');root.append(btn);
          const on=e=>{e.stopPropagation();e.preventDefault();sprintHeld=true;btn.classList.add('on');try{btn.setPointerCapture(e.pointerId);}catch(x){}sendNow(true);};
          const off=e=>{e.stopPropagation();sprintHeld=false;btn.classList.remove('on');sendNow(true);};
          btn.addEventListener('pointerdown',on);btn.addEventListener('pointerup',off);btn.addEventListener('pointercancel',off);btn.addEventListener('lostpointercapture',off);
          this._k1=e=>{if(e.code==='Space'||e.key==='Shift'){keySpr=true;}};this._k2=e=>{if(e.code==='Space'||e.key==='Shift'){keySpr=false;}};
          document.addEventListener('keydown',this._k1);document.addEventListener('keyup',this._k2);
        },
        start(){running=true;hintUntil=performance.now()+5000;sendT=setInterval(()=>sendNow(false),30);},
        stop(){running=false;clearInterval(sendT);if(joy)joy.destroy();document.removeEventListener('keydown',this._k1);document.removeEventListener('keyup',this._k2);window.__ttTag={};},
        update(s,R){
          const now=performance.now();S=s;
          for(const p of s.p){
            if(p.id===c.me()){
              if(!me)me={x:p.x,y:p.y,vx:0,vy:0,st:p.st,lk:p.lk};
              else{
                const dx=p.x-me.x,dy=p.y-me.y,d=Math.hypot(dx,dy);
                if(d>2.5||p.z>0&&d>0.05){me.x=p.x;me.y=p.y;}else if(d>1.0){me.x+=dx*.15;me.y+=dy*.15;}
                if(!(sprintHeld||keySpr))me.st=p.st;else me.st=Math.min(me.st,p.st+0.15);me.lk=p.lk;
              }
              if(p.z>0){stunT=p.z;if(!wasStun){wasStun=true;}}else{stunT=0;wasStun=false;}
            }else{
              let r=rs[p.id];
              if(!r){r=rs[p.id]={x:p.x,y:p.y,s:{x:p.x,y:p.y,vx:p.vx,vy:p.vy,at:now},off:{x:0,y:0}};}
              else{const d=Math.hypot(r.x-p.x,r.y-p.y);r.off=d<1.5?{x:r.x-p.x,y:r.y-p.y}:{x:0,y:0};r.s={x:p.x,y:p.y,vx:p.vx,vy:p.vy,at:now};}
            }
          }
          if(lastCat!==s.cat){
            if(lastCat!==-1&&s.cat===c.me()){bannerTxt='YOU ARE THE CAT! 🐱';bannerT=now+1300;}
            lastCat=s.cat;
          }
        },
        event(m){
          if(!cvo)return;const l=L(),mine=c.me();
          if(m.k==='tag'){
            const x=l.ox+m.x*l.s,y=l.oy+m.y*l.s;
            sparks(x,y,'#ffb347',22,200);sparks(x,y,c.col(m.to),12,150);shake=Math.max(shake,7);
            const ft=c.pl(m.from),tt=c.pl(m.to);
            if(m.to===mine){sfx.bad();buzz([60,40,100]);flash=1;bannerTxt='YOU ARE THE CAT! 🐱';bannerT=performance.now()+1300;}
            else if(m.from===mine){beep(520,.15,'triangle',.1,300);buzz(30);}
            else beep(300,.12,'square',.08,-100);
            if(m.from===mine){bannerTxt='Tagged '+(tt?tt.n:'?')+'! 😼';bannerT=performance.now()+900;}
            if(m.from===mine&&m.to!==mine)stunT=Math.max(stunT,STUN);
            if(m.to===mine&&me){me.st=1;me.lk=0;}
          }
        },
        frame(rem){
          if(!S||!cvo||cvo.W<10)return;
          const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
          const mp=S.p.find(p=>p.id===c.me());
          // local prediction of me
          if(me&&mp&&running&&c.R().ph==='play'){
            const iAmCat=S.cat===c.me(),inp=inputNow();
            if(stunT>0){stunT=Math.max(0,stunT-dt);me.vx=me.vy=0;stam(me,false,dt,sdRef,iAmCat);}
            else if(S.t<0.01&&false){}
            else{
              const moving=Math.hypot(inp.x,inp.y)>.15,spr=stam(me,inp.s&&moving,dt,sdRef,iAmCat);
              move(me,inp.x,inp.y,speedOf(iAmCat,spr,mp.b),dt);
              if(mp.b>0)mp.b-=dt;
            }
            if(me.st<=0)me.lk=1;
          }
          // others: extrapolate + decaying correction
          for(const id in rs){
            const r=rs[id],e=Math.min(.25,(now-r.s.at)/1000),k=Math.exp(-e*9);
            r.x=r.s.x+r.s.vx*e+r.off.x*k;r.y=r.s.y+r.s.vy*e+r.off.y*k;
          }
          // sprint button ring
          if(btn&&me){btn.style.setProperty('--p',Math.round(cl(me.st,0,1)*100));btn.classList.toggle('lk',!!me.lk);}
          // hook for bots
          const l=L();dbg.ok=true;dbg.me=c.me();dbg.cat=S.cat;dbg.OBS=OBS;dbg.AW=AW;dbg.AH=AH;dbg.st=me?me.st:1;dbg.stun=stunT;
          dbg.pos=S.p.map(p=>({id:p.id,x:p.id===c.me()&&me?me.x:(rs[p.id]?rs[p.id].x:p.x),y:p.id===c.me()&&me?me.y:(rs[p.id]?rs[p.id].y:p.y),z:p.z}));
          dbg.setInput=(x,y,s)=>{jx=x;jy=y;sprintHeld=!!s;};
          draw(dt,now);
        }
      };
    }
  };
})();
