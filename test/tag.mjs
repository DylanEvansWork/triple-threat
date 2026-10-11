// node test/tag.mjs <n=3> [dc]   (dc = player 2 leaves mid-round, possibly while cat)
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, dc=process.argv.includes('dc');
const party=await launchParty({n,only:'tag',rounds:5});
await party.start();
await party.pages[1].waitForFunction(()=>R&&R.ph!=='lobby',null,{timeout:20000});
await party.shot(`test/out/tag${n}-intro.png`,1);
await party.waitPhase('play',30000);
for(const p of party.pages)await p.waitForFunction(()=>R&&R.ph==='play'&&window.__ttTag&&window.__ttTag.ok);
// bots: grid-pathfinding AI. Cat chases the nearest runner by path; runners run to the cell they can reach before the cat that is farthest from it, sprinting when it gets close.
const skill=[0.8,0.6,0.4,0.5];
for(let i=0;i<n;i++)await party.pages[i].evaluate(sk=>{
  const G=2,CW=window.__ttTag.AW*G,CH=window.__ttTag.AH*G,D=window.__ttTag;
  const blocked=new Uint8Array(CW*CH);
  for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const x=(i+.5)/G,y=(j+.5)/G;let b=x<.55||x>D.AW-.55||y<.55||y>D.AH-.55;
    for(const o of D.OBS)if(x>o[0]-.55&&x<o[2]+.55&&y>o[1]-.55&&y<o[3]+.55)b=true;blocked[j*CW+i]=b?1:0;}
  const cell=(x,y)=>[Math.max(0,Math.min(CW-1,Math.floor(x*G))),Math.max(0,Math.min(CH-1,Math.floor(y*G)))];
  const bfs=(x,y)=>{const dist=new Int16Array(CW*CH).fill(-1),par=new Int32Array(CW*CH).fill(-1),[ci,cj]=cell(x,y),q=[cj*CW+ci];dist[q[0]]=0;
    for(let h=0;h<q.length;h++){const c=q[h],cx=c%CW,cy=(c/CW)|0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=CW||ny>=CH)continue;const k=ny*CW+nx;if(dist[k]>=0||blocked[k])continue;
        if(dx&&dy&&(blocked[cy*CW+nx]||blocked[ny*CW+cx]))continue;dist[k]=dist[c]+1;par[k]=c;q.push(k);}}
    return{dist,par};};
  const stepToward=(from,tgt,me)=>{let c=tgt;const p=from.par;let guard=0;const path=[];while(c>=0&&guard++<2000){path.push(c);c=p[c];}path.reverse();
    const k=path[Math.min(path.length-1,3)];if(k===undefined)return[0,0];const x=((k%CW)+.5)/G,y=(((k/CW)|0)+.5)/G,dx=x-me.x,dy=y-me.y,l=Math.hypot(dx,dy)||1;return[dx/l,dy/l];};
  let goal=null,goalAt=0;
  window.__bot=setInterval(()=>{
    if(!D.ok||R.ph!=='play')return;
    const me=D.pos.find(p=>p.id===D.me),cat=D.pos.find(p=>p.id===D.cat);if(!me||!cat||D.stun>0){D.setInput(0,0,0);return;}
    const fm=bfs(me.x,me.y);let dir=[0,0],spr=false;
    if(cat.id===me.id){
      let best=null,bd=1e9;for(const p of D.pos){if(p.id===me.id)continue;const [ci,cj]=cell(p.x,p.y),d=fm.dist[cj*CW+ci];if(d>=0&&d<bd){bd=d;best=[ci,cj];}}
      if(!best)return;dir=stepToward(fm,best[1]*CW+best[0],me);spr=bd<14&&D.st>0.35;
    }else{
      const fc=bfs(cat.x,cat.y),[mi,mj]=cell(me.x,me.y),dcMe=fc.dist[mj*CW+mi];
      if(!goal||performance.now()-goalAt>700||fm.dist[goal]<=1){
        let best=-1,bv=-1e9;for(let k=0;k<CW*CH;k++){const dm=fm.dist[k],dc=fc.dist[k];if(dm<0||dc<0||dm>16)continue;
          let v=dc-dm*0.6;if(dm>=dc)v-=30;v+=Math.random()*(1-sk)*14;if(v>bv){bv=v;best=k;}}
        goal=best;goalAt=performance.now();}
      if(goal>=0)dir=stepToward(fm,goal,me);
      spr=dcMe>=0&&dcMe<9&&D.st>0.3&&Math.random()<sk+.15;
    }
    D.setInput(dir[0],dir[1],spr);
  },60);
},skill[i]);
await sleep(4500);
await party.shot(`test/out/tag${n}-play-a.png`,1);
await party.shot(`test/out/tag${n}-play-host.png`,0);
if(dc&&n>=3){
  await sleep(9000);
  const wasCat=await party.host.evaluate(()=>R.S.cat===2);console.log('player 2 leaves (cat:',wasCat,')');
  await party.pages[2].close();await party.host.evaluate(()=>{const p=H.players[2];if(p.conn&&p.conn.close)p.conn.close();p.aw=true;bc();});
}
await sleep(12000);
await party.shot(`test/out/tag${n}-play-b.png`,1);
await party.waitPhase('result',90000);
await party.shot(`test/out/tag${n}-result.png`,0);
const st=await party.state();
console.log('t',st.S.t.toFixed(1),'tags',st.S.tags,'sc',JSON.stringify(st.S.sc),'cat',st.S.cat);
console.log('RESULT',JSON.stringify(st.res.rows));
if(st.res.rows.length!==n)throw new Error('rows!=n');
if(!st.res.rows.some(r=>r.rank===0))throw new Error('no winner');
if(Object.keys(st.S).some(k=>k[0]==='_'))throw new Error('private leak');
console.log('errors:',party.errors);
if(party.errors.length)process.exitCode=1;
await party.close();
