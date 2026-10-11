// Page-side bot drivers (injected with page.evaluate). They re-read `cur` every tick so they survive round changes.
// Each takes a config object and installs window.__bot (an interval). All input goes through real PointerEvents on the game's own surfaces.

export function spyBot(cfg){
  const mode=cfg.mode||'human',cheat=cfg.cheat||0;
  let a=Math.random()*6.28,down=false,idleUntil=0,nextShot=performance.now()+3500+Math.random()*3000,fieldDown=0;
  window.__st={shots:0,presses:0,cancels:0};
  const ev=(el,t,x,y,id)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:id,clientX:x,clientY:y,isPrimary:id===77}));
  window.__bot=setInterval(()=>{
    const d=typeof cur!=='undefined'&&cur&&cur.dbg;if(!d||!d.joy||typeof R==='undefined'||!R||R.ph!=='play')return;
    const now=performance.now();
    if(mode==='idle')return;
    const j=d.joy,r=j.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    if(mode==='spam'){
      // jittery joystick, rapid taps everywhere (incl. dead space + on the strip), multi-touch, random pointercancel
      if(!down){ev(j,'pointerdown',cx,cy,77);down=true;}
      a+=(Math.random()-.5)*3;ev(j,'pointermove',cx+Math.cos(a)*50,cy+Math.sin(a)*50,77);
      if(Math.random()<.02){ev(j,Math.random()<.5?'pointerup':'pointercancel',cx,cy,77);down=false;}
      for(let k=0;k<2;k++)if(Math.random()<.5){
        const f=d.field,fr=f.getBoundingClientRect(),x=fr.left+Math.random()*fr.width,y=fr.top+Math.random()*fr.height,id=5+k;
        ev(f,'pointerdown',x,y,id);window.__st.presses++;
        if(Math.random()<.15){ev(f,'pointercancel',x,y,id);window.__st.cancels++;}else{ev(f,'pointermove',x+5,y+5,id);ev(f,'pointerup',x,y,id);}
      }
      return;
    }
    // human-ish: wanders, stops to think, shoots now and then (while still holding the joystick = two thumbs)
    if(now<idleUntil){if(down){ev(j,'pointerup',cx,cy,77);down=false;}}
    else{
      if(!down){ev(j,'pointerdown',cx,cy,77);down=true;}
      a+=(Math.random()-.5)*.5;const m=25+Math.random()*30;ev(j,'pointermove',cx+Math.cos(a)*m,cy+Math.sin(a)*m,77);
      if(Math.random()<.012)idleUntil=now+500+Math.random()*2500;
    }
    if(now>nextShot){
      nextShot=now+1300+Math.random()*3500;
      const dots=d.dots(),me=(R.priv&&R.priv.me);const tg=dots.filter(o=>o.id!==me);
      if(tg.length){
        let t=tg[Math.floor(Math.random()*tg.length)];
        if(cheat&&window.__players&&Math.random()<cheat){const pl=tg.filter(o=>window.__players.includes(o.id));if(pl.length)t=pl[0];}
        const p=d.w2c(t.x+(Math.random()-.5)*3,t.y+(Math.random()-.5)*3),f=d.field;
        ev(f,'pointerdown',p.x,p.y,9);ev(f,'pointermove',p.x+1,p.y+1,9);setTimeout(()=>{ev(f,'pointerup',p.x,p.y,9);},30+Math.random()*120);window.__st.shots++;
      }
    }
  },60);
}

export function runnerBot(cfg){
  const mode=cfg.mode||'human',skill=cfg.skill==null?.85:cfg.skill;
  let plan=new Map(),holdUntil=0,downAt=0,lastTrack=null;
  window.__st={jumps:0,items:0,spam:0};
  const ev=(el,t,id,x,y)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:id,clientX:x==null?50:x,clientY:y==null?50:y,isPrimary:true}));
  window.__bot=setInterval(()=>{
    const d=typeof cur!=='undefined'&&cur&&cur.dbg;if(!d||!d.touch||typeof R==='undefined'||!R||R.ph!=='play')return;
    const T=d.touch,s=d.sim,tr=d.track;if(!tr||s.fin)return;
    if(tr!==lastTrack){lastTrack=tr;plan=new Map();downAt=0;}
    const now=performance.now();
    if(mode==='idle')return;
    if(mode==='spam'){   // hammer jump, item and strips; random cancels; multi-touch
      if(Math.random()<.3){const id=30+Math.floor(Math.random()*3);ev(T,'pointerdown',id);window.__st.spam++;setTimeout(()=>ev(T,Math.random()<.2?'pointercancel':'pointerup',id),Math.random()*350);}
      if(Math.random()<.1){ev(d.item,'pointerdown',44);ev(d.item,'pointerup',44);window.__st.items++;}
      if(Math.random()<.05){const st=document.querySelector('.run-strips'),r=st.getBoundingClientRect();ev(st,'pointerdown',45,r.left+60,r.top+20+Math.random()*200);}
      return;}
    if(downAt&&now>=holdUntil){ev(T,'pointerup',11);downAt=0;}
    if(s.item&&Math.random()<.05){ev(d.item,'pointerdown',12);ev(d.item,'pointerup',12);window.__st.items++;}
    if(downAt)return;
    const spd=13*(s.stun>0?.25:1)*(s.boost>0?1.55:1);
    const list=[...tr.obs.filter(o=>!o.hit&&o.x+o.w>s.x-1),...d.walls().filter(o=>!o.hit&&o.x+o.w>s.x-1)].sort((a,b)=>a.x-b.x);
    const o=list[0];if(!o)return;
    if(!plan.has(o))plan.set(o,{ok:Math.random()<skill,jit:(Math.random()-.5)*.1});
    const pl=plan.get(o);if(!pl.ok)return;
    const tf=(o.x-1-s.x)/spd,tg=(o.x-s.x)/spd;let go=false,hold=70;
    if(o.k==='gap'){const hi=o.w>7;const air=hi?.96:.69;go=tg<=(air-o.w/13)/2+pl.jit;hold=hi?330:60;}
    else if(o.k==='tall'){go=tf<=.3+pl.jit;hold=330;}else go=tf<=.15+pl.jit;
    if(go&&(!s.air||s.coy>0)){ev(T,'pointerdown',11);downAt=now;holdUntil=now+hold;window.__st.jumps++;}
  },16);
}

export function artBot(cfg){
  const mode=cfg.mode||'human',sl=cfg.noise==null?.9:cfg.noise;
  let ph='idle',tA=0,tP=0,tmo=0;window.__st={shots:0,presses:0,solveMs:0};
  const ev=(t,id)=>cur.dbg.touch.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:id||21,clientX:100,clientY:200,isPrimary:true}));
  const solve=()=>{
    const D=GAMES.artillery.dbg,d=cur.dbg,S=R.S,me=myPid,tk=S.tk,mine=tk[me];const foes=Object.keys(tk).filter(k=>+k!==me&&tk[k].a);if(!foes.length)return null;
    const f=tk[foes[Math.floor(Math.random()*foes.length)]],T0=d.dT();
    const tanks=Object.keys(tk).map(k=>({p:+k,x:tk[k].x,y:tk[k].y,a:tk[k].a}));
    let best=null;
    for(let a=14;a<=166;a+=3)for(let pw=14;pw<=100;pw+=4){const r=D.flight(T0,S.wind,mine.x,mine.y,a,pw,tanks,me);if(!r)continue;const dist=Math.hypot(r.x-f.x,r.y-(f.y+1.5));if(!best||dist<best.d)best={a,pw,d:dist};}
    return best;
  };
  window.__bot=setInterval(()=>{
    const d=typeof cur!=='undefined'&&cur&&cur.dbg;if(!d||!d.touch||typeof R==='undefined'||!R||R.ph!=='play')return;
    const S=R.S;if(!S||S.over)return;const mine=S.tk[myPid];if(!mine)return;const now=performance.now();
    if(mode==='idle')return;
    if(mode==='spam'){if(Math.random()<.25){const id=21+Math.floor(Math.random()*3);ev('pointerdown',id);window.__st.presses++;setTimeout(()=>ev(Math.random()<.25?'pointercancel':'pointerup',id),Math.random()*500);}return;}
    if(!mine.a){ph='idle';return;}
    if(ph==='idle'){if(d.reloading())return;const t0=performance.now(),b=solve();window.__st.solveMs+=performance.now()-t0;if(!b)return;
      tA=Math.max(16,Math.min(164,b.a+(Math.random()-.5)*2*10*sl));tP=Math.max(14,Math.min(100,b.pw+(Math.random()-.5)*2*14*sl));ph='wait';tmo=now+4000;}
    else if(ph==='wait'){if(Math.abs(d.angle()-tA)<2.6){ev('pointerdown');window.__st.presses++;ph='charge';tmo=now+3000;}else if(now>tmo)ph='idle';}
    else if(ph==='charge'){if(d.power()>=tP){ev('pointerup');window.__st.shots++;ph='idle';}else if(now>tmo){ev('pointerup');ph='idle';}}
  },6);
}
