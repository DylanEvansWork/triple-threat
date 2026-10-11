// Shared helpers for test/bt-stress.mjs (bots, latency, fuzz, invariant watchers, metrics)
import {sleep} from './harness.mjs';

// ------------------------------------------------------------------ latency (ordered, with jitter) -- run on a page
export async function lag(page,{host=false,idx=0,ms=75,jit=40}){
  await page.evaluate(({host,idx,ms,jit})=>{
    const wrap=c=>{if(!c||c.__lag===ms+'/'+jit)return;const o=c.__orig||(c.__orig=c.send.bind(c));let last=0;c.__lag=ms+'/'+jit;
      c.send=d=>{const t=Math.max(last,performance.now()+ms+Math.random()*jit);last=t;setTimeout(()=>o(d),Math.max(0,t-performance.now()));};};
    if(host)wrap(H.players[idx].conn);else wrap(hostConn);
  },{host,idx,ms,jit});
}

// ------------------------------------------------------------------ watchers
export async function watch(page,game){
  await page.evaluate(game=>{
    window.__viol=[];window.__pay=[];window.__fr=[];window.__up=[];
    const V=window.__viol;
    // payload size per broadcast (host-side view of the public state ~ what each client receives)
    if(isHost)setInterval(()=>{if(R&&R.ph==='play')window.__pay.push(JSON.stringify(R).length);},100);
    // frame + update cost
    const hook=()=>{if(!cur||cur.__hooked)return;cur.__hooked=1;
      const f=cur.frame;if(f)cur.frame=function(r){const t=performance.now();f.call(this,r);window.__fr.push(performance.now()-t);};
      const u=cur.update;cur.update=function(a,b){const t=performance.now();u.call(this,a,b);window.__up.push(performance.now()-t);};};
    setInterval(hook,200);
    if(!isHost)return;
    const seen=new Map();
    setInterval(()=>{
      const S=H&&H.S;if(!S||H.g!==game||H.ph!=='play')return;
      const now=performance.now(),push=(...a)=>{if(V.length<60)V.push(a);};
      if(game==='bomber'){
        const GW=9,GH=11;
        S._p.forEach((p,i)=>{
          if(![p.x,p.y,p.sp,p.nb,p.rg].every(Number.isFinite)||p.x<-.01||p.y<-.01||p.x>GW-.99||p.y>GH-.99)push('badpos',i,p.x,p.y);
          if(p.alive!==(p.dt==null))push('alive/dt',i,p.alive,p.dt);
          if(p.alive&&!S.over){
            const g=S._g[Math.round(p.y)*GW+Math.round(p.x)];if(g!==0)push('insolid',i,g,p.x,p.y,S.t);
            let hit=false;for(const [k] of S._fm){if(Math.abs(p.x-k%GW)<.4&&Math.abs(p.y-Math.floor(k/GW))<.4)hit=true;}
            const key='f'+i;if(hit){if(!seen.has(key))seen.set(key,now);else if(now-seen.get(key)>260)push('aliveInFlame',i,p.x,p.y,S.t);}else seen.delete(key);
          }
          const used=S._b.filter(b=>b.o===i).length;if(used>p.nb)push('overBombs',i,used,p.nb);
        });
        const tiles=new Set();for(const b of S._b){const k=b.x+','+b.y;if(tiles.has(k))push('dupBomb',k);tiles.add(k);if(S._g[b.y*GW+b.x]!==0)push('bombInSolid',k,S._g[b.y*GW+b.x]);}
        for(const [k] of S._fm){const g=S._g[k];if(g===1||g===3)push('flameInSolid',k%GW,Math.floor(k/GW),g);}
      }else if(game==='tron'){
        const TW=28,heads=new Set();
        S._b.forEach((b,i)=>{
          if(!b.pts.every(Number.isFinite)||b.q.length>2)push('bad',i,b.q.length);
          if(b.alive){const hk=b.x+','+b.y;if(heads.has(hk))push('sameHead',hk);heads.add(hk);if(S._g[b.y*TW+b.x]!==i)push('headNotMarked',i,b.x,b.y);
            let len=0;for(let j=2;j<b.pts.length;j+=2)len+=Math.abs(b.pts[j]-b.pts[j-2])+Math.abs(b.pts[j+1]-b.pts[j-1]);if(len!==b.k)push('pathLen',i,len,b.k);}
        });
      }
    },25);
  },game);
}
export async function metrics(pages){
  const out=[];
  for(const p of pages){
    try{out.push(await p.evaluate(()=>{
      const st=a=>a.length?{n:a.length,avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3),max:+Math.max(...a).toFixed(2)}:null;
      return{frame:st(window.__fr||[]),update:st(window.__up||[]),payload:st(window.__pay||[])};}));}catch(e){out.push(null);}
  }
  return out;
}
export const violations=page=>page.evaluate(()=>window.__viol||[]);

// ------------------------------------------------------------------ fuzz (host page): malformed / out-of-phase act messages
export async function fuzz(page,game,count=300){
  return page.evaluate(({game,count})=>{
    const G=GAMES[game],errs=[],t0=performance.now();
    const V=[NaN,Infinity,-Infinity,1e9,-1e9,1e-9,'a','3','',null,undefined,{},[],[1,2],true,false,0,-1,1,2,3,3.7,9,27,40,'__proto__',{x:1},()=>1];
    const pv=()=>V[Math.floor(Math.random()*V.length)];
    const keys=['k','x','y','f','m','n','r','at','seq','id','d','t'];
    const ks=game==='bomber'?['mv','bomb','x',undefined,null,5]:['t','p','x',undefined,null,5];
    for(let i=0;i<count;i++){
      const m={t:'act'};
      for(const k of keys)if(Math.random()<.5)m[k]=pv();
      m.k=ks[Math.floor(Math.random()*ks.length)];
      const pid=Math.random()<.9?H.players[Math.floor(Math.random()*H.players.length)].id:Math.floor(Math.random()*20)-3;
      try{if(Math.random()<.5)G.act(H,H.S,pid,m);else hostHandle(pid,m);}catch(e){errs.push(String(e&&e.message||e));}
    }
    // also totally weird shapes
    for(const m of [{},{t:'act'},{t:'act',k:'bomb'},{t:'act',k:'mv',x:'1e999',y:-5},{t:'bogus'},{t:'done',v:'x'},{t:'prog',v:1}]){
      try{hostHandle(H.players[0].id,m);}catch(e){errs.push(String(e&&e.message||e));}
    }
    return{errs:[...new Set(errs)],ms:+(performance.now()-t0).toFixed(1)};
  },{game,count});
}

// ------------------------------------------------------------------ bomber bots (page side)
// opts: {aggr:1|0, ptr:bool (drive through the pointer joystick+bomb button instead of keys), tick:ms between decisions,
//        mistake:prob of a random wrong move, kind:'smart'|'idle'|'spam'}
export const BOMBER_BOT=(opts)=>{
  const o=Object.assign({aggr:1,ptr:false,tick:70,mistake:0,kind:'smart'},opts||{});
  const GW=9,GH=11,DIRS=[[0,-1],[1,0],[0,1],[-1,0]],KEY=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'];
  const joy=()=>document.querySelector('.bm-joy'),bz=()=>document.querySelector('.bm-bz');
  const PE=(t,x,y,id,extra)=>new PointerEvent(t,Object.assign({bubbles:true,cancelable:true,pointerId:id,clientX:x,clientY:y,isPrimary:id===7,pointerType:'touch'},extra||{}));
  let held=-1,lastBomb=0,down=false,cx=0,cy=0;
  const key=(t,k)=>document.dispatchEvent(new KeyboardEvent(t,{key:k,bubbles:true}));
  const hold=d=>{
    if(!o.ptr){if(d===held)return;if(held>=0)key('keyup',KEY[held]);held=d;if(d>=0)key('keydown',KEY[d]);return;}
    const z=joy();if(!z)return;const r=z.getBoundingClientRect();
    if(d<0){if(down){z.dispatchEvent(PE('pointerup',cx,cy,7));down=false;}held=-1;return;}
    if(!down){cx=r.left+r.width*.5;cy=r.top+r.height*.5;z.dispatchEvent(PE('pointerdown',cx,cy,7));down=true;}
    z.dispatchEvent(PE('pointermove',cx+DIRS[d][0]*38,cy+DIRS[d][1]*38,7));held=d;
  };
  const bomb=()=>{if(!o.ptr){key('keydown',' ');key('keyup',' ');return;}const b=bz();if(!b)return;const r=b.getBoundingClientRect();b.dispatchEvent(PE('pointerdown',r.left+r.width*.6,r.top+r.height*.7,8));setTimeout(()=>b.dispatchEvent(PE('pointerup',r.left+r.width*.6,r.top+r.height*.7,8)),40);};
  const inb=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH;
  if(o.kind==='idle')return;
  if(o.kind==='spam'){
    // chaotic human: random drags incl. leaving the screen, pointercancel, 2nd finger, bomb mashing, key mashing
    window.__bot=setInterval(()=>{
      if(R.ph!=='play')return;
      const z=joy(),b=bz();if(!z||!b)return;const r=z.getBoundingClientRect(),q=Math.random();
      if(q<.15){z.dispatchEvent(PE('pointerdown',r.left+Math.random()*r.width,r.top+Math.random()*r.height,7));}
      else if(q<.5){z.dispatchEvent(PE('pointermove',(Math.random()*3-1)*600,(Math.random()*3-1)*900,7));}
      else if(q<.58){z.dispatchEvent(PE('pointercancel',0,0,7));}
      else if(q<.66){z.dispatchEvent(PE('pointerdown',r.left+30,r.top+30,9));z.dispatchEvent(PE('pointermove',r.left+90,r.top+30,9));z.dispatchEvent(PE('pointerup',0,0,9));}
      else if(q<.72){z.dispatchEvent(PE('pointerup',0,0,7));}
      else if(q<.95){const rb=b.getBoundingClientRect();b.dispatchEvent(PE('pointerdown',rb.left+20,rb.top+30,8));if(Math.random()<.5)b.dispatchEvent(PE('pointerup',rb.left+20,rb.top+30,8));else b.dispatchEvent(PE('pointercancel',0,0,8));}
      else{key('keydown',KEY[Math.floor(Math.random()*4)]);key('keydown',' ');key('keyup',' ');}
    },35);
    return;
  }
  window.__bot=setInterval(()=>{
    try{
      const S=R&&R.S;if(!S||R.ph!=='play'||!S.pl)return;
      const mi=S.ids.indexOf(myPid),me=S.pl[mi];if(!me||!me.a){hold(-1);return;}
      if(Math.random()<o.mistake){hold(Math.floor(Math.random()*5)-1);if(Math.random()<.3)bomb();return;}
      const tx=Math.round(me.x),ty=Math.round(me.y),g=S.g;
      const bombs=S.b.map(b=>({x:b[0],y:b[1],t:b[2],r:b[3]}));
      const cell=(x,y)=>g[y*GW+x];
      const bombAt=(x,y,bs)=>bs.find(b=>b.x===x&&b.y===y);
      const danger=(bs)=>{
        const d=new Map(),set=(x,y,t)=>{const k=x+','+y;if(!d.has(k)||d.get(k)>t)d.set(k,t);};
        for(const f of S.f)set(f[0],f[1],0);
        let ch=true;const T=bs.map(b=>b.t);
        for(let it=0;it<4&&ch;it++){ch=false;
          bs.forEach((b,i)=>{
            const hits=[[b.x,b.y]];
            for(const [dx,dy] of DIRS)for(let k=1;k<=b.r;k++){const x=b.x+dx*k,y=b.y+dy*k;if(!inb(x,y)||cell(x,y)==='#'||cell(x,y)==='s')break;hits.push([x,y]);if(cell(x,y)==='c')break;const ob=bombAt(x,y,bs);if(ob){const j=bs.indexOf(ob);if(T[j]>T[i]+.01){T[j]=T[i];ch=true;}break;}}
            hits.forEach(([x,y])=>set(x,y,T[i]));
          });}
        return d;};
      const sdCells=new Set(S.sd.map(s=>s[0]+','+s[1]));
      const pass=(x,y,bs)=>inb(x,y)&&cell(x,y)==='.'&&!sdCells.has(x+','+y)&&(!bombAt(x,y,bs)||(x===tx&&y===ty));
      const sp=me.sp;
      const bfs=(bs,dg,goal)=>{
        const q=[[tx,ty,0,-1]],seen=new Set([tx+','+ty]);
        while(q.length){const [x,y,d,f]=q.shift();
          if(goal(x,y,d)&&d>0)return {f,d};
          if(goal(x,y,d)&&d===0)return {f:-1,d:0};
          for(let k=0;k<4;k++){const nx=x+DIRS[k][0],ny=y+DIRS[k][1],kk=nx+','+ny;if(seen.has(kk)||!pass(nx,ny,bs))continue;
            const arr=(d+1)/sp,dt=dg.get(kk);
            if(dt!==undefined&&arr>dt-.25&&arr<dt+.8)continue;
            seen.add(kk);q.push([nx,ny,d+1,f<0?k:f]);}
        }return null;};
      const dg=danger(bombs),here=dg.get(tx+','+ty);
      const inDanger=here!==undefined&&here<2.6;
      if(inDanger||cell(tx,ty)==='s'){
        const r=bfs(bombs,dg,(x,y)=>!dg.has(x+','+y)&&!sdCells.has(x+','+y));
        if(r)hold(r.f);else hold(-1);return;
      }
      const now=performance.now();
      const enemies=S.pl.filter((p,i)=>i!==mi&&p.a);
      if(o.aggr&&me.u<me.nb&&!bombAt(tx,ty,bombs)&&now-lastBomb>700){
        const inBlast=(bx,by,rg)=>{const hs=[];for(const [dx,dy] of DIRS)for(let k=1;k<=rg;k++){const x=bx+dx*k,y=by+dy*k;if(!inb(x,y)||cell(x,y)==='#'||cell(x,y)==='s')break;hs.push([x,y,cell(x,y)]);if(cell(x,y)==='c')break;}return hs;};
        const hs=inBlast(tx,ty,me.rg);
        const useful=hs.some(h=>h[2]==='c')||hs.some(h=>enemies.some(e=>Math.round(e.x)===h[0]&&Math.round(e.y)===h[1]));
        if(useful){
          const nb=bombs.concat([{x:tx,y:ty,t:2.2,r:me.rg}]),ndg=danger(nb);
          const r=bfs(nb,ndg,(x,y)=>!ndg.has(x+','+y));
          if(r&&r.d<=7){lastBomb=now;bomb();hold(r.f);return;}
        }
      }
      let tgt=bfs(bombs,dg,(x,y)=>{if(dg.has(x+','+y))return false;for(const [dx,dy] of DIRS)for(let k=1;k<=me.rg;k++){const xx=x+dx*k,yy=y+dy*k;if(!inb(xx,yy)||cell(xx,yy)==='#'||cell(xx,yy)==='s')break;if(cell(xx,yy)==='c')return !!o.aggr;if(enemies.some(e=>Math.round(e.x)===xx&&Math.round(e.y)===yy))return !!o.aggr;}return false;});
      if(!o.aggr)tgt=bfs(bombs,dg,(x,y)=>x===4&&y===5);
      if(tgt&&tgt.d>0)hold(tgt.f);else hold(-1);
    }catch(e){console.error('bot',e);}
  },o.tick);
};

// ------------------------------------------------------------------ tron bots (page side)
// opts: {kind:'smart'|'idle'|'spam', react: seconds of look-ahead, mistake: prob per decision of a wrong tap, tick: ms}
export const TRON_BOT=(opts)=>{
  const o=Object.assign({kind:'smart',react:.28,mistake:0,tick:60},opts||{});
  const TW=28,TH=40,DX=[0,1,0,-1],DY=[-1,0,1,0];
  const zone=()=>document.querySelector('.tr-zone');
  const tapAt=(side,id)=>{const z=zone();if(!z)return;const r=z.getBoundingClientRect();
    z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:id||1,pointerType:'touch',clientX:side<0?r.left+r.width*(.1+Math.random()*.35):r.left+r.width*(.55+Math.random()*.35),clientY:r.top+r.height*Math.random()}));};
  if(o.kind==='idle')return;
  if(o.kind==='spam'){
    window.__bot=setInterval(()=>{
      if(R.ph!=='play')return;const z=zone();if(!z)return;const q=Math.random();
      if(q<.7)tapAt(Math.random()<.5?-1:1,Math.floor(Math.random()*4));
      else if(q<.8){z.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1}));}
      else if(q<.9){document.dispatchEvent(new KeyboardEvent('keydown',{key:Math.random()<.5?'ArrowLeft':'ArrowRight',bubbles:true}));}
      else{z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:5,clientX:-100,clientY:-100}));z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:6,clientX:9999,clientY:9999}));}
    },25);
    return;
  }
  let lastTap=0;
  window.__bot=setInterval(()=>{
    try{
      const S=R&&R.S;if(!S||R.ph!=='play'||!S.bk||S.st!=='run')return;
      const mi=S.ids.indexOf(myPid),b=S.bk[mi];if(!b||!b.a)return;
      const occ=new Set();
      S.bk.forEach(k=>{for(let j=2;j<k.p.length;j+=2){let x=k.p[j-2],y=k.p[j-1];const X=k.p[j],Y=k.p[j+1],sx=Math.sign(X-x),sy=Math.sign(Y-y);occ.add(x+','+y);while(x!==X||y!==Y){x+=sx;y+=sy;occ.add(x+','+y);}}occ.add(k.p[k.p.length-2]+','+k.p[k.p.length-1]);});
      const free=(x,y)=>x>=0&&y>=0&&x<TW&&y<TH&&Math.min(x,y,TW-1-x,TH-1-y)>=S.sh&&!occ.has(x+','+y);
      const run=(x,y,d,max)=>{let k=0;while(k<max&&free(x+DX[d]*(k+1),y+DY[d]*(k+1)))k++;return k;};
      // flood-fill-ish space estimate (bounded) so the bot prefers open areas
      const space=(x,y,d)=>{const q=[[x+DX[d],y+DY[d]]],seen=new Set();let n=0;while(q.length&&n<120){const [a,bb]=q.shift();const k=a+','+bb;if(seen.has(k)||!free(a,bb))continue;seen.add(k);n++;for(let e=0;e<4;e++)q.push([a+DX[e],bb+DY[e]]);}return n;};
      const hx=b.p[b.p.length-2],hy=b.p[b.p.length-1];
      const look=Math.ceil(S.sp*(o.react+Math.random()*.08))+1;
      const ahead=run(hx,hy,b.d,look),now=performance.now();
      if(now-lastTap<300)return;
      if(Math.random()<o.mistake*.25){lastTap=now;tapAt(Math.random()<.5?-1:1);return;}
      if(ahead<look){
        const Ls=space(hx,hy,(b.d+3)&3),Rs=space(hx,hy,(b.d+1)&3);
        lastTap=now;tapAt(Ls===Rs?(Math.random()<.5?-1:1):(Ls>Rs?-1:1));
      }else if(Math.random()<.015){lastTap=now;const Ls=space(hx,hy,(b.d+3)&3),Rs=space(hx,hy,(b.d+1)&3);if(Math.max(Ls,Rs)>40)tapAt(Ls>Rs?-1:1);}
    }catch(e){console.error('bot',e);}
  },o.tick);
};

// ------------------------------------------------------------------ party control helpers
export async function rejoin(party,i){
  const p=party.pages[i];
  await p.reload({waitUntil:'load'});
  await p.fill('#name',party.names[i]);await p.fill('#code',party.code);await p.click('#join');
  await p.waitForFunction(()=>R&&R.ph!=='lobby'&&R.ph!=='menu',null,{timeout:15000});
}
export async function nextRound(party){
  // result -> final -> again -> start
  await party.host.evaluate(()=>{const b=document.querySelector('#rskip');b&&b.click();});
  await party.waitPhase('final',20000);
  await party.host.click('#again');
  await party.host.waitForFunction(()=>R&&R.ph==='lobby',null,{timeout:10000});
  await sleep(300);
  await party.host.waitForFunction(()=>R.pl.length>=2,null,{timeout:10000});
  await party.host.click('#start');
}
export const sanePoints=(rows,n)=>{
  const probs=[];
  if(rows.length!==n)probs.push('rows!=n');
  for(let i=1;i<rows.length;i++)if(rows[i].rank<rows[i-1].rank||rows[i].pts>rows[i-1].pts)probs.push('rows not ordered');
  for(const r of rows){if(!(r.pts>=0&&r.pts<=n))probs.push('pts range '+r.pts);if(typeof r.label!=='string'||/NaN|undefined|null/.test(r.label))probs.push('bad label '+r.label);}
  return probs;
};
