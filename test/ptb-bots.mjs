// Page-side scripted bots for pong / sumo / tag (ptb = pong, tag, sumo "bots"). Prefixed so other agents' helper files don't collide.
//   installBots(page,'pong'|'sumo'|'tag',{skill:0..1,mode:'normal'|'idle'|'spam'|'jitter'})
export async function installBots(page,key,o={}){
  const opt=Object.assign({skill:0.6,mode:'normal'},o);
  await page.evaluate(({key,opt})=>{
    clearInterval(window.__bot);
    const box=()=>document.querySelector('#gbox');
    const pe=(t,x,y,id)=>box().dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,isPrimary:id===7}));
    const R_=()=>R;
    if(opt.mode==='spam'){
      window.__bot=setInterval(()=>{
        const r=Math.random(),id=[1,4,7,10][Math.floor(Math.random()*4)],x=Math.random()*390,y=60+Math.random()*700;
        if(r<.3)pe('pointerdown',x,y,id);else if(r<.65)pe('pointermove',x,y,id);else if(r<.85)pe('pointerup',x,y,id);else pe('pointercancel',x,y,id);
        const lk=document.querySelector('.sumo-lock,.tag-spr');
        if(lk&&Math.random()<.2)lk.dispatchEvent(new PointerEvent(Math.random()<.5?'pointerdown':'pointerup',{bubbles:true,cancelable:true,pointerId:20}));
        const d=window.__ttTag;if(d&&d.setInput&&Math.random()<.3)d.setInput(Math.random()*2-1,Math.random()*2-1,Math.random()<.5);
      },25);
      return;
    }
    if(opt.mode==='idle')return;
    if(key==='pong'){
      let cx=195,down=false,bias=0,last=performance.now();const hist=[];
      const sk={sp:2+opt.skill*1.6,err:0.7-opt.skill*0.5};
      window.__bot=setInterval(()=>{
        const d=window.__ttPong;if(!d||!d.aim||!R_()||R_().ph!=='play')return;
        const now=performance.now(),dt=(now-last)/1000;last=now;
        if(Math.random()<0.04)bias=(Math.random()*2-1)*sk.err;
        hist.push(d.aim());if(hist.length>5)hist.shift();
        let tgt=Math.max(-1,Math.min(1,hist[0]+bias));
        if(opt.mode==='jitter')tgt=Math.max(-1,Math.min(1,tgt+(Math.random()*2-1)*1.2));
        const du=Math.max(-sk.sp*dt,Math.min(sk.sp*dt,tgt-d.u));
        if(!down){pe('pointerdown',cx,500,7);down=true;}
        let nx=cx+du*d.pxPerU;
        if(nx<12||nx>378){pe('pointerup',cx,500,7);cx=195;pe('pointerdown',cx,500,7);nx=cx+du*d.pxPerU;}
        cx=nx;pe('pointermove',cx,500,7);
        if(opt.mode==='jitter'&&Math.random()<.1){pe('pointercancel',cx,500,7);down=false;}
      },30);
      return;
    }
    if(key==='sumo'){
      let turnSeen=-1,planAt=0,acted=false,busy=false;
      const VM=1.55,K=1.2,C=0.35,a=C/K;
      const slide=v0=>{if(v0<=0)return 0;const t=Math.log((v0+a)/a)/K;return (v0+a)*(1-Math.exp(-K*t))/K-a*t;};
      const powerFor=dist=>{let lo=0,hi=1;for(let i=0;i<20;i++){const m=(lo+hi)/2;if(slide(m*VM)<dist)lo=m;else hi=m;}return lo;};
      window.__bot=setInterval(async()=>{
        const d=window.__ttSumo;if(busy||!d||!d.ok||!R_()||R_().ph!=='play'||d.ph!=='plan'||!d.alive||d.locked)return;
        if(d.turn!==turnSeen){turnSeen=d.turn;planAt=performance.now()+300+Math.random()*(opt.delay||2500);acted=false;}
        if(acted||performance.now()<planAt)return;
        acted=true;busy=true;
        const me=d.pucks.find(p=>p.id===d.me),en=d.pucks.filter(p=>p.a&&p.id!==d.me);
        if(me&&en.length){
          en.sort((a_,b_)=>Math.hypot(a_.x-me.x,a_.y-me.y)-Math.hypot(b_.x-me.x,b_.y-me.y));
          const t=en[Math.random()<.25?en.length-1:0],dx=t.x-me.x,dy=t.y-me.y,dist=Math.hypot(dx,dy)/d.sc;
          const ang=Math.atan2(dy,dx)+(Math.random()*2-1)*(0.5-opt.skill*0.4);
          let pw=powerFor(dist*(1.1+Math.random()*.5));pw=Math.max(.2,Math.min(1,pw*(.85+Math.random()*.4)));
          if(opt.mode==='jitter')pw=Math.random();
          const len=12+pw*108,sx=me.x,sy=me.y;
          pe('pointerdown',sx,sy,7);
          for(let k=1;k<=4;k++){pe('pointermove',sx-Math.cos(ang)*len*k/4,sy-Math.sin(ang)*len*k/4,7);await new Promise(r=>setTimeout(r,20));}
          if(opt.mode==='jitter'){pe('pointermove',sx+Math.random()*200-100,sy+Math.random()*200-100,7);pe('pointermove',sx-Math.cos(ang)*len,sy-Math.sin(ang)*len,7);}
          pe('pointerup',sx-Math.cos(ang)*len,sy-Math.sin(ang)*len,7);
          if(Math.random()<.7){await new Promise(r=>setTimeout(r,150+Math.random()*600));const b=document.querySelector('.sumo-lock');if(b)b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:9}));}
        }
        busy=false;
      },80);
      return;
    }
    if(key==='tag'){
      const D=()=>window.__ttTag;
      let grid=null,goal=null,goalAt=0;const G=2;
      const build=()=>{const d=D();const CW=d.AW*G,CH=d.AH*G,blocked=new Uint8Array(CW*CH);
        for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const x=(i+.5)/G,y=(j+.5)/G;let b=x<.55||x>d.AW-.55||y<.55||y>d.AH-.55;
          for(const o of d.OBS)if(x>o[0]-.55&&x<o[2]+.55&&y>o[1]-.55&&y<o[3]+.55)b=true;blocked[j*CW+i]=b?1:0;}
        return{CW,CH,blocked};};
      const cell=(x,y)=>[Math.max(0,Math.min(grid.CW-1,Math.floor(x*G))),Math.max(0,Math.min(grid.CH-1,Math.floor(y*G)))];
      const bfs=(x,y)=>{const {CW,CH,blocked}=grid,dist=new Int16Array(CW*CH).fill(-1),par=new Int32Array(CW*CH).fill(-1),[ci,cj]=cell(x,y),q=[cj*CW+ci];dist[q[0]]=0;
        for(let h=0;h<q.length;h++){const c=q[h],cx=c%CW,cy=(c/CW)|0;
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=CW||ny>=CH)continue;const k=ny*CW+nx;if(dist[k]>=0||blocked[k])continue;
            if(dx&&dy&&(blocked[cy*CW+nx]||blocked[ny*CW+cx]))continue;dist[k]=dist[c]+1;par[k]=c;q.push(k);}}
        return{dist,par};};
      const stepToward=(from,tgt,me)=>{const {CW}=grid;let c=tgt,guard=0;const path=[];while(c>=0&&guard++<2000){path.push(c);c=from.par[c];}path.reverse();
        const k=path[Math.min(path.length-1,3)];if(k===undefined)return[0,0];const x=((k%CW)+.5)/G,y=(((k/CW)|0)+.5)/G,dx=x-me.x,dy=y-me.y,l=Math.hypot(dx,dy)||1;return[dx/l,dy/l];};
      window.__bot=setInterval(()=>{
        const d=D();if(!d||!d.ok||!R_()||R_().ph!=='play')return;if(!grid)grid=build();
        const me=d.pos.find(p=>p.id===d.me),cat=d.pos.find(p=>p.id===d.cat);if(!me||!cat||d.stun>0){d.setInput(0,0,0);return;}
        const fm=bfs(me.x,me.y),{CW,CH}=grid;let dir=[0,0],spr=false;
        if(cat.id===me.id){
          let best=null,bd=1e9;for(const p of d.pos){if(p.id===me.id)continue;const [ci,cj]=cell(p.x,p.y),dd=fm.dist[cj*CW+ci];if(dd>=0&&dd<bd){bd=dd;best=[ci,cj];}}
          if(!best)return;dir=stepToward(fm,best[1]*CW+best[0],me);spr=bd<14&&d.st>0.35;
        }else{
          const fc=bfs(cat.x,cat.y),[mi,mj]=cell(me.x,me.y),dcMe=fc.dist[mj*CW+mi];
          if(goal===null||performance.now()-goalAt>700||fm.dist[goal]<=1){
            let best=-1,bv=-1e9;for(let k=0;k<CW*CH;k++){const dm=fm.dist[k],dc=fc.dist[k];if(dm<0||dc<0||dm>16)continue;
              let v=dc-dm*0.6;if(dm>=dc)v-=30;v+=Math.random()*(1-opt.skill)*14;if(v>bv){bv=v;best=k;}}
            goal=best;goalAt=performance.now();}
          if(goal>=0)dir=stepToward(fm,goal,me);
          spr=dcMe>=0&&dcMe<9&&d.st>0.3&&Math.random()<opt.skill+.15;
        }
        if(opt.mode==='jitter'){dir=[dir[0]+(Math.random()*2-1)*1.2,dir[1]+(Math.random()*2-1)*1.2];}
        d.setInput(dir[0],dir[1],spr);
      },60);
    }
  },{key,opt});
}
