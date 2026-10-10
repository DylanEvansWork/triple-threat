// ITEM RUNNER — client-side side-scroller lanes from a shared seed, sabotage items, first to the line wins.
(function(){
'use strict';
const LEN=620,SPEED=13,V0=52,GR=150,GHOLD=70,HOLDMAX=.3,COYOTE=.1,BUF=.12,STUN=.9,BOOST=1.5,BOOSTM=1.55,FOG=2.5;
const VIEW=70,RUNX=14;               // lane shows 70 units, runner sits 14 units from the left
const ITEMS={wall:{e:'🧱',n:'WALL'},fog:{e:'🌫️',n:'FOG'},boost:{e:'⚡',n:'BOOST'},shield:{e:'🛡️',n:'SHIELD'}};
const r1=v=>Math.round(v*10)/10;

function genTrack(seed){
  const r=mulberry(seed),obs=[],boxes=[];let x=46,id=0;
  while(x<LEN-34){
    const t=r(),o={id:id++,x:r1(x),hit:false};
    if(t<.42){o.k='low';o.w=3;o.h=3.5;}
    else if(t<.64){o.k='tall';o.w=3;o.h=8;}
    else{o.k='gap';o.w=r1(6+r()*4);o.h=0;}
    obs.push(o);x+=o.w+21+r()*15;
  }
  for(let k=1;k<=8;k++){
    let bx=40+k*68+(r()-.5)*24;const roll=r();
    for(let g=0;g<10;g++){if(obs.some(o=>bx>o.x-9&&bx<o.x+o.w+9))bx+=4;else break;}
    boxes.push({x:r1(bx),roll,got:false});
  }
  return{obs,boxes};
}
const inGap=(track,x)=>track.obs.some(o=>o.k==='gap'&&x>o.x&&x<o.x+o.w);

GAMES.runner={
  name:'Item Runner',emoji:'🏃',tag:'Race, grab item boxes, sabotage the rest.',
  min:2,max:4,
  rules:[
    ['👆','TAP to jump. HOLD a bit longer to jump higher. Hop over blocks, leap across gaps.'],
    ['💥','Hit an obstacle and you stumble for 1 second. Everyone gets the exact same track.'],
    ['🎁','Run through item boxes to grab an item, then smack the big button: 🧱 wall drops in front of a rival, 🌫️ fog blinds the leader, ⚡ boost speeds you up, 🛡️ shield blocks one hit.'],
    ['🎯','Walls hit the runner right ahead of you (or behind, if you lead). Tap a rival\'s strip to pick another target.'],
    ['🏁','First to the finish line wins. Others are ranked by finish order, then by distance.']],
  ctrl:'Tap the lane to jump (hold = higher). Big button bottom-right = use item. Tap a rival strip to aim sabotage.',
  win:'Finish first. Rank = finish order, unfinished runners by distance.',
  dur:75,hz:10,better:'high',
  fmt:v=>v>=50000?((100000-v)/100).toFixed(1)+'s':Math.round(v)+' m',
  dbg:{genTrack,LEN},

  // ================= HOST =================
  init(H){
    const pos={};H.players.forEach(p=>{pos[p.id]={x:0,y:0,v:SPEED,f:0,w:[]};});
    return{seed:1+Math.floor(Math.random()*1e9),len:LEN,pos,fin:{},endAt:0,_lastItem:{}};
  },
  tick(H,S,dt){
    if(S.over)return;
    const act=H.players.filter(p=>!p.aw);
    if(S.endAt&&S.t>=S.endAt){S.over=true;S.hold=1.5;return;}
    if(act.length&&act.every(p=>S.fin[p.id]!=null)){S.over=true;S.hold=2.2;return;}
    if(!act.length){S.over=true;}
  },
  act(H,S,pid,m){
    const P=S.pos[pid];if(!P||S.over)return;
    if(m.k==='p'){
      if(S.fin[pid]!=null)return;
      const x=+m.x,y=+m.y,v=+m.v,f=+m.f|0;if(!isFinite(x)||!isFinite(y)||!isFinite(v))return;
      P.x=Math.max(P.x,clamp(r1(x),0,LEN));P.y=clamp(r1(y),-10,40);P.v=clamp(v,0,40);P.f=f&31;
      P.w=Array.isArray(m.w)?m.w.slice(0,3).map(q=>+q).filter(q=>isFinite(q)).map(r1):[];
    }else if(m.k==='fin'){
      if(S.fin[pid]!=null)return;
      let ft=+m.ft;if(!isFinite(ft))ft=S.t;ft=clamp(ft,LEN/(SPEED*BOOSTM)-.5,S.t+.6);
      S.fin[pid]=Math.round(ft*100)/100;P.x=LEN;
      if(!S.endAt)S.endAt=S.t+8;
    }else if(m.k==='item'){
      if(m.i!=='wall'&&m.i!=='fog')return;
      const to=+m.to,tp=H.players.find(p=>p.id===to);
      if(!tp||tp.aw||to===pid||S.fin[to]!=null||S.fin[pid]!=null)return;
      if(S.t-(S._lastItem[pid]||-9)<.7)return;S._lastItem[pid]=S.t;
      H.emit({e:'it',i:m.i,from:pid,to});
    }
  },
  val(S,id){
    if(S.fin[id]!=null)return Math.round(100000-S.fin[id]*100);
    const P=S.pos[id];return P?Math.round(P.x):null;
  },

  // ================= CLIENT =================
  mk(c){
    let cvh,g,root0,itemB,itemE,itemN,tgtT,banner,touch,strips;
    let S=null,track=null,seed=0,tm=0,started=false,lastTs=performance.now(),acc=0,joyHint=true;
    const me0={x:0,y:0,vy:0,air:false,coy:0,buf:0,hold:false,holdT:0,stun:0,boost:0,shield:false,fog:0,fin:false,ft:0,item:null,jumps:0,hits:0,t:0};
    const sim=me0;let walls=[];let pressed=false,sel=null,downs=new Set(),shakeT=0,parts=[],toasts=[];
    const others={};            // pid -> {x,y,f,w,v,ts,dx,dy}
    const L={s:1,main:null,strips:[],race:null,lastKey:''};
    const col=id=>c.col(id);
    function style(){
      if(document.getElementById('st-runner'))return;const s=document.createElement('style');s.id='st-runner';
      s.textContent=`
.run-touch{position:absolute;left:0;right:0;bottom:0;touch-action:none}
.run-strips{position:absolute;left:0;right:0;top:0;touch-action:none}
.run-item{position:absolute;right:12px;width:96px;height:96px;border-radius:50%;border:4px solid #ffffff40;background:#171734ee;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none;box-shadow:0 6px 0 #0a0a1f;z-index:3}
.run-item .e{font-size:44px;line-height:1}.run-item .n{font-size:12px;font-weight:900;letter-spacing:1px;margin-top:3px;color:#cfcff0}
.run-item.has{border-color:#ffd23f;background:linear-gradient(180deg,#3a3a82,#23234a);animation:runpulse .6s infinite alternate}
.run-item.has:active{transform:translateY(3px);box-shadow:0 2px 0 #0a0a1f}
@keyframes runpulse{from{box-shadow:0 6px 0 #0a0a1f,0 0 0 0 #ffd23f66}to{box-shadow:0 6px 0 #0a0a1f,0 0 22px 4px #ffd23f88}}
.run-tgt{position:absolute;right:8px;width:112px;text-align:center;font-size:12px;font-weight:900;color:#ffd23f;text-shadow:0 1px 4px #000;pointer-events:none;z-index:3}
.run-ban{position:absolute;left:12px;right:12px;text-align:center;font-weight:900;font-size:26px;padding:10px;border-radius:16px;background:#0b0b17ee;border:2px solid #ffd23f;display:none;pointer-events:none;z-index:4}
.run-ban small{display:block;font-size:13px;font-weight:700;color:#cfcff0}
.run-toast{position:absolute;left:8px;right:120px;font-size:13px;font-weight:800;display:flex;flex-direction:column;gap:3px;pointer-events:none;z-index:3}
.run-toast div{background:#0b0b17dd;border-left:4px solid var(--c);border-radius:8px;padding:3px 8px;width:fit-content;animation:spyin .25s}
@keyframes spyin{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
`;document.head.append(s);
    }
    function layout(){
      const W=cvh.W,H=cvh.H,key=W+'x'+H+'x'+Object.keys(others).length;if(key===L.lastKey)return;L.lastKey=key;
      L.s=W/VIEW;
      const ids=c.R().pl.filter(p=>p.id!==c.me()).map(p=>p.id),m=Math.max(1,ids.length);
      const sh=Math.min(118,(H-Math.round(H*.55)-26-(m+1)*5)/m);
      const topH=26+5+m*(sh+5),mainH=H-topH;
      L.race={x:0,y:2,w:W,h:22};
      L.strips=ids.map((id,i)=>({id,x:0,y:26+5+i*(sh+5),w:W,h:sh}));
      L.main={x:0,y:topH,w:W,h:mainH};
      touch.style.height=mainH+'px';strips.style.height=topH+'px';
      itemB.style.bottom='16px';tgtT.style.bottom='116px';banner.style.top=(topH+mainH*.28)+'px';
    }
    const rankOf=()=>{let r=0;for(const id in others){const o=others[id];if(o.live&&o.dx>sim.x)r++;}return r;};
    const cands=()=>c.R().pl.filter(p=>p.id!==c.me()&&!p.aw&&!(S&&S.fin[p.id]!=null));
    function autoTarget(kind){
      const cs=cands();if(!cs.length)return null;
      if(sel!=null&&cs.some(p=>p.id===sel))return sel;
      const xs=cs.map(p=>({id:p.id,x:others[p.id]?others[p.id].dx:0}));
      if(kind==='fog'){xs.sort((a,b)=>b.x-a.x);return xs[0].id;}
      const ahead=xs.filter(o=>o.x>sim.x).sort((a,b)=>a.x-b.x);
      if(ahead.length)return ahead[0].id;
      xs.sort((a,b)=>b.x-a.x);return xs[0].id;
    }
    function pickItem(roll){
      const n=c.R().pl.length,r=n>1?rankOf()/(n-1):0;
      const w=[['wall',.30],['fog',.14+.06*r],['boost',.18+.17*r],['shield',.38-.23*r]];
      let a=0;for(const q of w){a+=q[1];if(roll<a)return q[0];}return'shield';
    }
    function toast(txt,id){const d=document.createElement('div');d.style.setProperty('--c',id!=null?col(id):'#ffd23f');d.textContent=txt;toasts.push(d);const tw=root0.querySelector('.run-toast');tw.append(d);while(tw.children.length>3)tw.firstChild.remove();setTimeout(()=>d.remove(),2600);}
    function jump(){
      sim.air=true;sim.vy=V0;sim.y=Math.max(0,sim.y);sim.coy=0;sim.buf=0;sim.holdT=0;sim.jumps++;joyHint=false;beep(620,.09,'square',.05,320);
    }
    function hurt(why){
      if(sim.shield){sim.shield=false;toast('🛡️ Shield blocked it!');sfx.good();buzz(15);return false;}
      sim.stun=STUN;sim.hits++;shakeT=.25;sfx.bad();buzz([30,20,50]);
      for(let i=0;i<8;i++)parts.push({x:sim.x,y:sim.y+2,vx:rnd(-8,8),vy:rnd(4,16),l:.5,t:0,col:'#ffd23f'});
      return true;
    }
    function step(dt){
      if(sim.fin)return;
      sim.t+=dt;
      if(sim.stun>0)sim.stun-=dt;if(sim.boost>0)sim.boost-=dt;if(sim.fog>0)sim.fog-=dt;
      const mul=(sim.stun>0?.25:1)*(sim.boost>0?BOOSTM:1);
      sim.x+=SPEED*mul*dt;
      const supported=!inGap(track,sim.x);
      if(!sim.air){sim.coy=COYOTE;if(!supported){sim.air=true;sim.vy=0;}}
      else sim.coy-=dt;
      if(sim.buf>0)sim.buf-=dt;
      if(pressed){pressed=false;if(!sim.air||sim.coy>0){jump();}else sim.buf=BUF;}
      else if(sim.buf>0&&(!sim.air||sim.coy>0)){jump();}
      if(sim.air){
        let gg=GR;if(sim.hold&&sim.vy>0&&sim.holdT<HOLDMAX){gg=GHOLD;sim.holdT+=dt;}
        sim.vy-=gg*dt;sim.y+=sim.vy*dt;
        if(sim.y<=0&&supported&&sim.vy<=0){sim.y=0;sim.vy=0;sim.air=false;sim.coy=COYOTE;if(sim.buf>0){jump();}}
        if(sim.y<-6&&!supported){ // fell in a pit: pop out the far side, stumble
          const g2=track.obs.find(o=>o.k==='gap'&&sim.x>o.x&&sim.x<o.x+o.w);
          if(g2)sim.x=g2.x+g2.w+1.5;sim.y=0;sim.vy=0;sim.air=false;hurt('pit');
        }
      }
      // obstacles
      for(const o of track.obs){
        if(o.k==='gap'||o.hit)continue;
        if(sim.x+1>o.x&&sim.x-1<o.x+o.w&&sim.y<o.h-.6){o.hit=true;hurt(o.k);}
      }
      for(const o of walls){if(o.hit)continue;if(sim.x+1>o.x&&sim.x-1<o.x+o.w&&sim.y<o.h-.6){o.hit=true;hurt('wall');}}
      // item boxes
      for(const b of track.boxes){
        if(b.got)continue;
        if(sim.x+1>b.x-1.6&&sim.x-1<b.x+1.6&&sim.y<8){
          b.got=true;
          if(!sim.item){sim.item=pickItem(b.roll);sfx.good();buzz(12);toast(ITEMS[sim.item].e+' '+ITEMS[sim.item].n+'!');updItem();}
          else{toast('Hands full — box wasted');}
        }
      }
      if(sim.x>=LEN){sim.x=LEN;sim.fin=true;sim.ft=c.t();c.act({k:'fin',ft:+sim.ft.toFixed(2)});sfx.win();buzz([60,40,60]);showFinish();}
    }
    function showFinish(){banner.style.display='block';banner.innerHTML='🏁 FINISHED!<small>waiting for the others…</small>';}
    function updItem(){
      const it=sim.item;itemE.textContent=it?ITEMS[it].e:'📦';itemN.textContent=it?ITEMS[it].n:'NO ITEM';
      itemB.className='run-item'+(it?' has':'');itemE.style.opacity=it?1:.25;
    }
    function useItem(){
      const it=sim.item;if(!it||sim.fin||!started||c.R().ph!=='play')return;
      if(it==='boost'){sim.boost=BOOST;sfx.go();buzz(25);for(let i=0;i<10;i++)parts.push({x:sim.x-1,y:1.5,vx:rnd(-14,-4),vy:rnd(-2,4),l:.5,t:0,col:'#ffd23f'});}
      else if(it==='shield'){sim.shield=true;sfx.good();}
      else{
        const to=autoTarget(it);if(to==null){toast('Nobody to hit!');return;}
        c.act({k:'item',i:it,to});sel=null;sfx.tap();buzz(20);
      }
      sim.item=null;updItem();
    }
    function ev(m){
      if(!m||m.e!=='it')return;
      const f=c.pl(m.from),t=c.pl(m.to);
      toast((f?f.n:'?')+' '+ITEMS[m.i].e+' → '+(t?t.n:'?'),m.from);
      if(m.to===c.me()&&!sim.fin){
        if(sim.shield){sim.shield=false;toast('🛡️ Shield blocked '+(f?f.n:'')+'!');sfx.good();buzz(15);return;}
        if(m.i==='wall'){walls.push({x:r1(sim.x+17),w:3,h:5,hit:false,from:m.from});sfx.bad();buzz([30,30,30]);shakeT=.2;}
        else{sim.fog=FOG;sfx.bad();buzz([20,20]);}
      }else if(m.to!==c.me())sfx.tick();
    }

    // ---------------- drawing ----------------
    function drawLane(r,ent,isMe,pid){
      const s=L.s,gOff=isMe?r.h*.36:16,gy=r.y+r.h-gOff,camX=ent.x-RUNX,px=u=>r.x+(u-camX)*s;
      g.save();g.beginPath();g.rect(r.x,r.y,r.w,r.h);g.clip();
      const sg=g.createLinearGradient(0,r.y,0,r.y+r.h);sg.addColorStop(0,isMe?'#171742':'#10102a');sg.addColorStop(1,isMe?'#2b2060':'#1a1a44');g.fillStyle=sg;g.fillRect(r.x,r.y,r.w,r.h);
      // parallax hills
      g.fillStyle=isMe?'#201a52':'#161638';g.beginPath();g.moveTo(r.x,gy);
      for(let x=0;x<=r.w;x+=8){const wx=x/s+camX*.45;g.lineTo(r.x+x,gy-(10+8*Math.sin(wx*.11)+5*Math.sin(wx*.27))*(isMe?3.2:1.4));}
      g.lineTo(r.x+r.w,gy);g.fill();
      if(isMe){g.fillStyle='#ffffff10';for(let k=0;k<7;k++){const cx=((k*97-camX*s*.2)%(r.w+160)+(r.w+160))%(r.w+160)-80;g.beginPath();g.ellipse(r.x+cx,r.y+40+k*29%110,46,12,0,0,6.283);g.fill();}}
      // ground, with pits
      g.fillStyle='#2c7a4b';g.fillRect(r.x,gy,r.w,r.y+r.h-gy);g.fillStyle='#5fe08a';g.fillRect(r.x,gy,r.w,3);g.fillStyle='#00000026';for(let u=Math.floor(camX/6)*6;px(u)<r.w;u+=6){g.fillRect(px(u),gy+6,s*1.6,isMe?7:3);}
      g.fillStyle='#09091a';
      for(const o of track.obs){if(o.k!=='gap')continue;const a=px(o.x),b=px(o.x+o.w);if(b<r.x||a>r.x+r.w)continue;g.fillRect(a,gy,b-a,r.y+r.h-gy);g.fillStyle='#5fe08a';g.fillRect(a-1,gy,2,6);g.fillRect(b-1,gy,2,6);g.fillStyle='#09091a';}
      // finish line
      const fx=px(LEN);if(fx>-20&&fx<r.w+20){for(let i=0;i<10;i++){g.fillStyle=i%2?'#fff':'#111';g.fillRect(fx,gy-i*(s*1.6),s*1.2,s*1.6);g.fillStyle=i%2?'#111':'#fff';g.fillRect(fx+s*1.2,gy-i*(s*1.6),s*1.2,s*1.6);}g.fillStyle='#ffd23f';g.font='900 '+(s*3)+'px system-ui';g.textAlign='left';g.fillText('FINISH',fx+s*3,gy-s*10);}
      // obstacles
      for(const o of track.obs){
        if(o.k==='gap')continue;const a=px(o.x);if(a>r.w+30||a<-60)continue;const w=o.w*s,h=o.h*s;
        g.fillStyle=o.k==='low'?'#ff9f1c':'#ff3d81';g.strokeStyle='#0b0b17';g.lineWidth=2;
        g.beginPath();g.roundRect?g.roundRect(a,gy-h,w,h,4):g.rect(a,gy-h,w,h);g.fill();g.stroke();
        g.fillStyle='#00000030';g.fillRect(a+2,gy-h+2,w*.35,h-4);
      }
      const dyn=isMe?walls.map(q=>q.x):(ent.w||[]);
      for(const wx of dyn){const a=px(wx);if(a>r.w+30||a<-60)continue;const w=3*s,h=5*s;g.fillStyle='#e5484d';g.strokeStyle='#fff';g.lineWidth=2;g.fillRect(a,gy-h,w,h);g.strokeRect(a,gy-h,w,h);
        g.strokeStyle='#ffffff90';g.beginPath();for(let k=1;k<4;k++){g.moveTo(a,gy-h+k*h/4);g.lineTo(a+w,gy-h+k*h/4);}g.stroke();}
      // item boxes
      for(const b of track.boxes){
        if(isMe&&b.got)continue;const a=px(b.x);if(a>r.w+30||a<-40)continue;
        const bob=Math.sin(performance.now()/260+b.x)*s*.4,sz=3.2*s;g.save();g.shadowColor='#ffd23f';g.shadowBlur=10;g.fillStyle='#ffd23f';g.beginPath();g.roundRect?g.roundRect(a-sz/2,gy-4.2*s-sz/2+bob,sz,sz,6):g.rect(a-sz/2,gy-4.2*s-sz/2+bob,sz,sz);g.fill();g.restore();
        g.fillStyle='#5a3a00';g.font='900 '+(sz*.7)+'px system-ui';g.textAlign='center';g.fillText('?',a,gy-4.2*s+sz*.25+bob);
      }
      // runner
      const rx=px(ent.x),ry=gy-ent.y*s,cc=col(pid),stun=isMe?sim.stun>0:(ent.f&1),boost=isMe?sim.boost>0:(ent.f&2),shield=isMe?sim.shield:(ent.f&4);
      const bw=2.4*s,bh=3.4*s,wob=stun?Math.sin(performance.now()/40)*3:0;
      if(boost){g.fillStyle='#ffb13d';g.beginPath();g.moveTo(rx-bw/2,ry-bh*.5);g.lineTo(rx-bw/2-s*4,ry-bh*.35);g.lineTo(rx-bw/2,ry-bh*.2);g.fill();}
      const air=ent.y>.2,leg=air?0:Math.sin(ent.x*2.4)*s*.9;
      g.fillStyle='#0b0b17';g.fillRect(rx-bw*.3+leg-2,ry-s*.9,4,s*.9);g.fillRect(rx+bw*.1-leg-2,ry-s*.9,4,s*.9);
      g.fillStyle=cc;g.strokeStyle='#0b0b17';g.lineWidth=2;g.beginPath();g.roundRect?g.roundRect(rx-bw/2+wob,ry-bh,bw,bh-s*.8,6):g.rect(rx-bw/2+wob,ry-bh,bw,bh-s*.8);g.fill();g.stroke();
      g.fillStyle='#fff';g.beginPath();g.arc(rx+bw*.18+wob,ry-bh*.68,s*.45,0,6.283);g.fill();g.fillStyle='#0b0b17';g.beginPath();g.arc(rx+bw*.3+wob,ry-bh*.68,s*.2,0,6.283);g.fill();
      if(stun){g.font='900 '+(s*1.5)+'px system-ui';g.textAlign='center';g.fillStyle='#ffd23f';g.fillText('★',rx-s+Math.sin(performance.now()/90)*s,ry-bh-s*.4);g.fillText('★',rx+s,ry-bh-s*.2);}
      if(shield){g.strokeStyle='#19d3ff';g.lineWidth=3;g.fillStyle='#19d3ff25';g.beginPath();g.arc(rx,ry-bh*.5,bh*.78,0,6.283);g.fill();g.stroke();}
      if(isMe){for(const p of parts){g.globalAlpha=Math.max(0,1-p.t/p.l);g.fillStyle=p.col;g.fillRect(px(p.x)-2,gy-p.y*s-2,4,4);}g.globalAlpha=1;}
      // fog
      const fog=isMe?sim.fog>0:(ent.f&8);
      if(fog){
        const fa=Math.min(1,isMe?sim.fog/.4:1);g.globalAlpha=.9*fa;
        const fg=g.createLinearGradient(rx+s*7,0,rx+s*13,0);fg.addColorStop(0,'#9a9ac800');fg.addColorStop(.5,'#9a9ac8');fg.addColorStop(1,'#b9b9dc');g.fillStyle=fg;g.fillRect(rx+s*7,r.y,r.w-(rx+s*7-r.x),r.h);
        g.fillStyle='#c9c9ea';const tt=performance.now()/700;for(let i=0;i<9;i++){g.beginPath();g.arc(rx+s*13+((i*53+tt*40)%(r.w)),r.y+(i*37%r.h),s*(3+i%3),0,6.283);g.fill();}
        g.globalAlpha=1;
      }
      g.restore();
    }
    function draw(dt){
      const W=cvh.W,H=cvh.H;layout();g.setTransform(cvh.dpr,0,0,cvh.dpr,0,0);g.clearRect(0,0,W,H);g.fillStyle='#0b0b17';g.fillRect(0,0,W,H);
      if(!track||!c.R())return;
      let sx=0,sy=0;if(shakeT>0){shakeT-=dt;sx=(Math.random()-.5)*6;sy=(Math.random()-.5)*6;}
      // others: smooth toward extrapolated position
      for(const id in others){const o=others[id];const age=Math.min(.35,(performance.now()-o.ts)/1000);const tx=o.x+o.v*age;if(!o.live){o.dx=tx;o.dy=o.y;o.live=true;}else{o.dx+=(tx-o.dx)*Math.min(1,dt*10);o.dy+=(o.y-o.dy)*Math.min(1,dt*18);}}
      for(const p of parts){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=30*dt;}parts=parts.filter(p=>p.t<p.l);
      g.save();g.translate(sx,sy);
      // race bar
      const rb=L.race;g.fillStyle='#171734';g.fillRect(8,rb.y+8,W-16,6);g.fillStyle='#ffd23f';g.fillRect(W-8-3,rb.y+3,3,16);
      const order=c.R().pl.map(p=>({id:p.id,x:p.id===c.me()?sim.x:(others[p.id]?others[p.id].dx:0)}));
      for(const o of order){const xx=8+(W-16)*clamp(o.x/LEN,0,1);g.fillStyle=col(o.id);g.beginPath();g.arc(xx,rb.y+11,o.id===c.me()?7:5,0,6.283);g.fill();if(o.id===c.me()){g.strokeStyle='#fff';g.lineWidth=2;g.stroke();}}
      // strips
      for(const sr of L.strips){
        const o=others[sr.id]||{dx:0,dy:0,f:0,w:[]},p=c.pl(sr.id);
        drawLane(sr,{x:o.dx,y:o.dy,f:o.f,w:o.w},false,sr.id);
        g.save();g.strokeStyle=col(sr.id);g.lineWidth=sel===sr.id?6:3;g.strokeRect(sr.x+(sel===sr.id?3:1.5),sr.y+(sel===sr.id?3:1.5),sr.w-(sel===sr.id?6:3),sr.h-(sel===sr.id?6:3));
        g.font='900 13px system-ui';g.textAlign='left';const fin=S&&S.fin[sr.id]!=null,lab=(p?p.n:'?')+(p&&p.aw?' (left)':fin?' 🏁':'');g.fillStyle='#0b0b17cc';g.fillRect(sr.x+6,sr.y+5,g.measureText(lab).width+12,20);g.fillStyle=col(sr.id);g.fillText(lab,sr.x+12,sr.y+20);
        g.textAlign='right';g.fillStyle='#fff';g.font='900 13px system-ui';g.fillText(Math.round(o.dx)+'m',sr.x+sr.w-8,sr.y+20);
        if(sel===sr.id&&sim.item&&(sim.item==='wall'||sim.item==='fog')){g.fillStyle='#ffd23f';g.fillText('🎯 TARGET',sr.x+sr.w-52,sr.y+sr.h-8);}
        g.restore();
      }
      drawLane(L.main,{x:sim.x,y:sim.y,f:0,w:[]},true,c.me());
      const m=L.main;
      g.fillStyle='#0b0b17aa';g.fillRect(m.x+8,m.y+8,92,40);g.fillStyle='#fff';g.font='900 24px system-ui';g.textAlign='left';
      const rk=sim.fin?(S?Object.keys(S.fin).sort((a,b)=>S.fin[a]-S.fin[b]).indexOf(String(c.me())):0):rankOf();
      g.fillText(['1st','2nd','3rd','4th'][Math.max(0,rk)]||'',m.x+14,m.y+38);
      g.font='800 13px system-ui';g.textAlign='right';g.fillStyle='#cfcff0';g.fillText(Math.max(0,Math.round(LEN-sim.x))+'m to go',m.x+m.w-10,m.y+22);
      if(joyHint&&started){g.fillStyle='#fff';g.globalAlpha=.8;g.font='900 20px system-ui';g.textAlign='center';g.fillText('TAP = jump · HOLD = higher',m.x+m.w/2-30,m.y+m.h*.3);g.globalAlpha=1;}
      if(sim.stun>0){g.fillStyle='#ff3d8140';g.fillRect(m.x,m.y,m.w,m.h);}
      g.restore();
    }

    return{
      dbg:{sim,get track(){return track;},walls:()=>walls,get touch(){return touch;},get item(){return itemB;},strips:()=>L.strips,others:()=>others,rank:rankOf},
      mount(root){
        style();root0=root;cvh=mkCanvas(root);g=cvh.g;cvh.cv.style.pointerEvents='none';
        strips=E('div','run-strips');touch=E('div','run-touch');
        itemB=E('div','run-item','<div class="e">📦</div><div class="n">NO ITEM</div>');itemE=itemB.firstChild;itemN=itemB.lastChild;
        tgtT=E('div','run-tgt');banner=E('div','run-ban');const tw=E('div','run-toast');tw.style.bottom='16px';
        root.append(strips,touch,tw,itemB,tgtT,banner);
        const down=e=>{if(!started||sim.fin||c.R().ph!=='play')return;e.preventDefault();downs.add(e.pointerId);pressed=true;sim.hold=true;try{touch.setPointerCapture(e.pointerId);}catch(x){}};
        const up=e=>{downs.delete(e.pointerId);if(!downs.size)sim.hold=false;};
        touch.addEventListener('pointerdown',down);touch.addEventListener('pointerup',up);touch.addEventListener('pointercancel',up);touch.addEventListener('lostpointercapture',up);
        itemB.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();useItem();});
        strips.addEventListener('pointerdown',e=>{
          const r=strips.getBoundingClientRect(),y=e.clientY-r.top;
          const sr=L.strips.find(q=>y>=q.y&&y<q.y+q.h);if(!sr)return;
          if(cands().some(p=>p.id===sr.id)){sel=sel===sr.id?null:sr.id;sfx.tap();}
        });
        layout();updItem();
      },
      start(){started=true;lastTs=performance.now();
        tm=setInterval(()=>{if(c.R().ph!=='play'||!track)return;
          const f=(sim.stun>0?1:0)|(sim.boost>0?2:0)|(sim.shield?4:0)|(sim.fog>0?8:0);
          c.act({k:'p',x:+sim.x.toFixed(1),y:+sim.y.toFixed(1),v:+(SPEED*(sim.stun>0?.25:1)*(sim.boost>0?BOOSTM:1)).toFixed(1),f,w:walls.filter(q=>!q.hit&&q.x>sim.x-4).map(q=>q.x)});},100);
      },
      update(S_,R){
        S=S_;
        if(S.seed&&S.seed!==seed){seed=S.seed;track=genTrack(seed);}
        const now=performance.now();
        for(const p of R.pl){if(p.id===c.me())continue;const q=S.pos[p.id];if(!q)continue;let o=others[p.id];if(!o){o=others[p.id]={dx:q.x,dy:q.y,live:false};}o.x=q.x;o.y=q.y;o.v=S.fin[p.id]!=null||p.aw?0:q.v;o.f=q.f;o.w=q.w||[];o.ts=now;}
        if(sim.fin&&S.fin){const ids=Object.keys(S.fin).sort((a,b)=>S.fin[a]-S.fin[b]);const rk=ids.indexOf(String(c.me()));
          banner.innerHTML='🏁 '+['1st place!','2nd place','3rd place','4th place'][rk]+(S.endAt&&!S.over?'<small>others have '+Math.max(0,Math.ceil(S.endAt-c.t()))+'s to finish</small>':'');}
        else if(S.endAt&&!sim.fin){banner.style.display='block';banner.style.borderColor='#ff3d81';banner.innerHTML='🏁 Someone finished!<small>'+Math.max(0,Math.ceil(S.endAt-c.t()))+'s left — RUN!</small>';}
        const cs=cands();tgtT.textContent=(sim.item==='wall'||sim.item==='fog')&&cs.length>1?(sel!=null?'→ '+(c.pl(sel)||{n:''}).n:'tap a lane to aim'):'';
        if(R.ph!=='play'||!started)draw(.016);
      },
      frame(rem){
        const now=performance.now(),dt=Math.min(.05,(now-lastTs)/1000);lastTs=now;
        if(started&&track&&c.R().ph==='play'){acc+=dt;while(acc>=1/60){step(1/60);acc-=1/60;}}
        draw(dt);
      },
      event:ev,
      stop(){clearInterval(tm);}
    };
  }
};
})();
