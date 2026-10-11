// node test/bomber.mjs <n=3> [mode]   mode: play (default) | sd (fast-forward to sudden death) | dc (a player disconnects mid-round) | touch (real pointer joystick)
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, mode=process.argv[3]||'play';
const party=await launchParty({n,only:'bomber',rounds:5});
const fail=m=>{console.log('FAIL:',m);process.exitCode=1;};

// ---- in-page bot: reads R.S, drives the game exactly like a human would (arrow keys + space) ----
const BOT=(aggr)=>{
  const GW=9,GH=11,DIRS=[[0,-1],[1,0],[0,1],[-1,0]],KEY=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'];
  let held=-1,lastBomb=0;
  const key=(t,k)=>document.dispatchEvent(new KeyboardEvent(t,{key:k,bubbles:true}));
  const hold=d=>{if(d===held)return;if(held>=0)key('keyup',KEY[held]);held=d;if(d>=0)key('keydown',KEY[d]);};
  const inb=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH;
  window.__bot=setInterval(()=>{
    try{
      const S=R&&R.S;if(!S||R.ph!=='play'||!S.pl)return;
      const mi=S.ids.indexOf(myPid),me=S.pl[mi];if(!me||!me.a){hold(-1);return;}
      const tx=Math.round(me.x),ty=Math.round(me.y),g=S.g;
      const bombs=S.b.map(b=>({x:b[0],y:b[1],t:b[2],r:b[3]}));
      const cell=(x,y)=>g[y*GW+x];
      const bombAt=(x,y,bs)=>bs.find(b=>b.x===x&&b.y===y);
      const danger=(bs)=>{ // tile -> earliest hit time
        const d=new Map(),set=(x,y,t)=>{const k=x+','+y;if(!d.has(k)||d.get(k)>t)d.set(k,t);};
        for(const f of S.f)set(f[0],f[1],0);
        let ch=true;const T=bs.map(b=>b.t);
        for(let it=0;it<4&&ch;it++){ch=false;
          bs.forEach((b,i)=>{
            const hits=[[b.x,b.y]];
            for(const [dx,dy] of DIRS)for(let k=1;k<=b.r;k++){const x=b.x+dx*k,y=b.y+dy*k;if(!inb(x,y)||cell(x,y)==='#'||cell(x,y)==='s')break;hits.push([x,y]);if(cell(x,y)==='c')break;const o=bombAt(x,y,bs);if(o){const j=bs.indexOf(o);if(T[j]>T[i]+.01){T[j]=T[i];ch=true;}break;}}
            hits.forEach(([x,y])=>set(x,y,T[i]));
          });}
        return d;};
      const sdCells=new Set(S.sd.map(s=>s[0]+','+s[1]));
      const pass=(x,y,bs)=>inb(x,y)&&cell(x,y)==='.'&&!sdCells.has(x+','+y)&&(!bombAt(x,y,bs)||(x===tx&&y===ty));
      const sp=me.sp;
      // bfs from my tile; returns {first dir, dist} to nearest tile satisfying goal; avoids tiles dangerous at arrival
      const bfs=(bs,dg,goal)=>{
        const q=[[tx,ty,0,-1]],seen=new Set([tx+','+ty]);
        while(q.length){const [x,y,d,f]=q.shift();
          if(goal(x,y,d)&&d>0)return {f,d};
          if(goal(x,y,d)&&d===0)return {f:-1,d:0};
          for(let k=0;k<4;k++){const nx=x+DIRS[k][0],ny=y+DIRS[k][1],key=nx+','+ny;if(seen.has(key)||!pass(nx,ny,bs))continue;
            const arr=(d+1)/sp,dt=dg.get(key);
            if(dt!==undefined&&arr>dt-.25&&arr<dt+.8)continue; // would walk into a blast
            seen.add(key);q.push([nx,ny,d+1,f<0?k:f]);}
        }return null;};
      const dg=danger(bombs),here=dg.get(tx+','+ty);
      const inDanger=here!==undefined&&here<2.6;
      if(inDanger||cell(tx,ty)==='s'){
        const r=bfs(bombs,dg,(x,y)=>!dg.has(x+','+y)&&!sdCells.has(x+','+y));
        if(r)hold(r.f);else hold(-1);return;
      }
      // want to bomb?
      const now=performance.now();
      const enemies=S.pl.filter((p,i)=>i!==mi&&p.a);
      if(aggr&&me.u<me.nb&&!bombAt(tx,ty,bombs)&&now-lastBomb>700){
        const inBlast=(bx,by,rg)=>{const hs=[];for(const [dx,dy] of DIRS)for(let k=1;k<=rg;k++){const x=bx+dx*k,y=by+dy*k;if(!inb(x,y)||cell(x,y)==='#'||cell(x,y)==='s')break;hs.push([x,y,cell(x,y)]);if(cell(x,y)==='c')break;}return hs;};
        const hs=inBlast(tx,ty,me.rg);
        const useful=hs.some(h=>h[2]==='c')||hs.some(h=>enemies.some(e=>Math.round(e.x)===h[0]&&Math.round(e.y)===h[1]));
        if(useful){
          const nb=bombs.concat([{x:tx,y:ty,t:2.2,r:me.rg}]),ndg=danger(nb);
          const r=bfs(nb,ndg,(x,y)=>!ndg.has(x+','+y));
          if(r&&r.d<=7){lastBomb=now;key('keydown',' ');key('keyup',' ');hold(r.f);return;}
        }
      }
      // wander: head to a tile from which a bomb would be useful, else toward the nearest enemy
      let tgt=bfs(bombs,dg,(x,y)=>{if(dg.has(x+','+y))return false;for(const [dx,dy] of DIRS)for(let k=1;k<=me.rg;k++){const xx=x+dx*k,yy=y+dy*k;if(!inb(xx,yy)||cell(xx,yy)==='#'||cell(xx,yy)==='s')break;if(cell(xx,yy)==='c')return !!aggr;if(enemies.some(e=>Math.round(e.x)===xx&&Math.round(e.y)===yy))return !!aggr;}return false;});
      if(!aggr)tgt=bfs(bombs,dg,(x,y)=>x===4&&y===5);
      if(tgt&&tgt.d>0)hold(tgt.f);else hold(-1);
    }catch(e){console.error('bot',e);}
  },70);
};

await party.start();
await party.waitPhase('play',30000);
const aggr=mode==='sd'?0:1;
for(const [i,p] of party.pages.entries())if(!(mode==='touch'&&i===1))await p.evaluate(BOT,aggr);
await sleep(2500);
await party.shot('test/out/bomber-start.png',1);
if(mode==='touch'){
  // drive page 1 with a real pointer joystick drag + a tap on the bomb zone (no keyboard, no bot)
  const before=await party.state();
  await party.pages[1].evaluate(async()=>{
    const z=document.querySelector('.bm-joy'),r=z.getBoundingClientRect(),wait=ms=>new Promise(r=>setTimeout(r,ms));
    const ev=(t,x,y)=>z.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:7,clientX:x,clientY:y,isPrimary:true}));
    const cx=r.left+r.width*.5,cy=r.top+r.height*.5;
    ev('pointerdown',cx,cy);for(let i=1;i<=14;i++){ev('pointermove',cx,cy-i*3);await wait(50);}   // up
    const b=document.querySelector('.bm-bz');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:8}));
    b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:8}));
    for(let i=1;i<=30;i++){ev('pointermove',cx-i*2,cy-42+i*1.2);await wait(50);}                    // left (slightly up-biased = diagonal stick)
    ev('pointerup',cx,cy);
  });
  const st=await party.state();
  console.log('touch: bombs',JSON.stringify(st.S.b),'me',JSON.stringify(st.S.pl[1]),'start',JSON.stringify(before.S.pl[1]));
  if(!st.S.b.some(b=>b[4]===1)&&st.S.pl[1].a)fail('touch bomb never appeared');
  if(Math.hypot(st.S.pl[1].x-before.S.pl[1].x,st.S.pl[1].y-before.S.pl[1].y)<2)fail('touch joystick did not move the player');
  await party.shot('test/out/bomber-touch.png',1);
}
let shots=0,dead=false,blast=false;
const t0=Date.now();let dcDone=false;
while(true){
  const ph=await party.phase();
  if(ph!=='play')break;
  const st=await party.state();
  const T=st.S&&st.S.t||0;
  if(mode==='sd'&&!st.S.sdFF&&T>8){await party.host.evaluate(()=>{H.S.t+=44;H.S.sdFF=1;});console.log('fast-forwarded to sudden death');}
  if(mode==='dc'&&!dcDone&&T>6){dcDone=true;await party.pages[n-1].close();await party.host.evaluate(()=>{const p=H.players[H.players.length-1];p.aw=true;p.conn=null;});console.log('closed page of last player at t='+T.toFixed(1));}
  if(shots===0&&T>12){await party.shot('test/out/bomber-mid.png',1);await party.shot('test/out/bomber-mid-host.png',0);shots++;}
  if(mode==='sd'&&shots===1&&st.S.t>56){await party.shot('test/out/bomber-sd.png',1);shots++;}
  if(shots===1&&T>30&&mode!=='sd'){await party.shot('test/out/bomber-mid2.png',0);shots++;}
  if(st.S.over&&!dead){dead=true;await sleep(500);await party.shot('test/out/bomber-over.png',0);}
  if(st.S.f.length>=6&&!blast){blast=true;await party.shot('test/out/bomber-blast.png',1);}
  await sleep(120);
  if(Date.now()-t0>150000){fail('round did not finish in time');break;}
}
await party.waitPhase('result',20000);
await sleep(600);
await party.shot('test/out/bomber-result.png',0);
const st=await party.state();
console.log('ROUND TIME',(Date.now()-t0)/1000,'s  rows:',JSON.stringify(st.res.rows));
const hs=await party.host.evaluate(()=>({t:H.S.t,over:H.S.over,winner:H.S.winner,p:H.S._p.map(p=>({alive:p.alive,dt:p.dt,sp:p.sp,nb:p.nb,rg:p.rg,rj:p.rj}))}));
console.log('reject log:',JSON.stringify(await party.host.evaluate(()=>H.S._rl)));
console.log('host S:',JSON.stringify(hs));
if(st.res.rows.length!==n)fail('rows!=n');
const sum=st.res.rows.reduce((a,r)=>a+r.pts,0);
if(mode!=='dc'&&sum!==(n*(n+1))/2-0&&sum<=0)fail('points look wrong '+sum);
if(hs.t>=120)fail('hit hard cap');
if(!hs.over&&mode!=='dc')fail('round ended without S.over');
if(mode==='sd'&&hs.t<55)fail('sd not reached');
console.log('errors:',party.errors);
if(party.errors.length)process.exitCode=1;
await party.close();
