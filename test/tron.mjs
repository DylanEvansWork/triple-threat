// node test/tron.mjs <n=3> [mode]   mode: play (default) | lag (140ms RTT on player 1) | dc (a player disconnects mid-round)
import {launchParty,sleep} from './harness.mjs';
const n=+process.argv[2]||3, mode=process.argv[3]||'play';
const party=await launchParty({n,only:'tron',rounds:5});
const fail=m=>{console.log('FAIL:',m);process.exitCode=1;};

// in-page bot: looks ahead on the real state and taps the left/right half of the screen like a human (with reaction delay)
const BOT=(skill)=>{
  const TW=28,TH=40,DX=[0,1,0,-1],DY=[-1,0,1,0];
  let lastTap=0,lastMr=-1;
  setInterval(()=>{
    try{
      const S=R&&R.S;if(!S||R.ph!=='play'||!S.bk||S.st!=='run')return;
      const mi=S.ids.indexOf(myPid),b=S.bk[mi];if(!b||!b.a)return;
      const occ=new Set();
      S.bk.forEach(k=>{for(let j=2;j<k.p.length;j+=2){let x=k.p[j-2],y=k.p[j-1];const X=k.p[j],Y=k.p[j+1],sx=Math.sign(X-x),sy=Math.sign(Y-y);occ.add(x+','+y);while(x!==X||y!==Y){x+=sx;y+=sy;occ.add(x+','+y);}}occ.add(k.p[k.p.length-2]+','+k.p[k.p.length-1]);});
      const free=(x,y)=>x>=0&&y>=0&&x<TW&&y<TH&&Math.min(x,y,TW-1-x,TH-1-y)>=S.sh&&!occ.has(x+','+y);
      const run=(x,y,d,max)=>{let k=0;while(k<max&&free(x+DX[d]*(k+1),y+DY[d]*(k+1)))k++;return k;};
      const hx=b.p[b.p.length-2],hy=b.p[b.p.length-1];
      const look=Math.ceil(S.sp*(.28+Math.random()*.1*skill))+1;   // react ~280ms ahead
      const ahead=run(hx,hy,b.d,look);
      const now=performance.now();
      if(ahead<look&&now-lastTap>330){
        const L=run(hx,hy,(b.d+3)&3,30),Rr=run(hx,hy,(b.d+1)&3,30);
        const side=L===Rr?(Math.random()<.5?-1:1):(L>Rr?-1:1);
        if(Math.max(L,Rr)>0||true){lastTap=now;const z=document.querySelector('.tr-zone').getBoundingClientRect();
          document.querySelector('.tr-zone').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:side<0?z.left+z.width*.25:z.left+z.width*.75,clientY:z.top+z.height*.5}));}
      }else if(Math.random()<.01*skill&&now-lastTap>600){ // occasional wiggle
        lastTap=now;const z=document.querySelector('.tr-zone');const r=z.getBoundingClientRect();
        z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:Math.random()<.5?r.left+10:r.right-10,clientY:r.top+200}));
      }
    }catch(e){console.error('bot',e);}
  },60);
};

await party.start();
await party.waitPhase('play',30000);
if(mode==='lag'){ // 70 ms each way for player 1 (RTT 140 ms) to exercise turn scheduling + reconcile
  await party.pages[1].evaluate(()=>{const o=hostConn.send.bind(hostConn);hostConn.send=d=>setTimeout(()=>o(d),70);});
  await party.host.evaluate(()=>{const c=H.players[1].conn,o=c.send.bind(c);c.send=d=>setTimeout(()=>o(d),70);});
}
for(const p of party.pages)await p.evaluate(BOT,1);
const t0=Date.now();let dcDone=false;const seen={};let lastMr=0;
while(true){
  const ph=await party.phase();if(ph!=='play')break;
  const st=await party.state();const S=st.S;
  const tag=S.mr+S.st;
  if(S.st==='cd'&&!seen['cd'+S.mr]){seen['cd'+S.mr]=1;await sleep(150);await party.shot(`test/out/tron-cd${S.mr}-n${n}.png`,1);}
  if(S.st==='run'&&S.mt>6&&!seen['run'+S.mr]){seen['run'+S.mr]=1;await party.shot(`test/out/tron-run${S.mr}-n${n}.png`,1);if(S.mr===1)await party.shot(`test/out/tron-run1-host-n${n}.png`,0);}
  if(S.st==='run'&&S.mt>13&&!seen['late'+S.mr]){seen['late'+S.mr]=1;await party.shot(`test/out/tron-late${S.mr}-n${n}.png`,1);}
  if(S.st==='end'&&!seen['end'+S.mr]){seen['end'+S.mr]=1;await sleep(500);await party.shot(`test/out/tron-end${S.mr}-n${n}.png`,1);}
  if(mode==='dc'&&!dcDone&&S.mr===2&&S.st==='run'&&S.mt>2){dcDone=true;await party.pages[n-1].close();await party.host.evaluate(()=>{const p=H.players[H.players.length-1];p.aw=true;p.conn=null;});console.log('closed last player mid mini-round 2');}
  await sleep(120);
  if(Date.now()-t0>170000){fail('did not finish');break;}
}
await party.waitPhase('result',20000);
await sleep(500);
await party.shot(`test/out/tron-result-n${n}.png`,0);
const st=await party.state();
const hs=await party.host.evaluate(()=>({t:H.S.t,mr:H.S.mr,over:H.S.over,mpts:H.S.mpts,tot:H.S._tot,surv:H.S._surv.map(v=>Math.round(v)),late:H.S._late||0,applied:H.S._ap||0}));
console.log('TIME',((Date.now()-t0)/1000).toFixed(1),'rows',JSON.stringify(st.res.rows));
console.log('host',JSON.stringify(hs));
if(hs.mr!==3||!hs.over)fail('did not play 3 mini-rounds');
if(st.res.rows.length!==n)fail('rows');
if(hs.t>=110)fail('too long');
if(hs.mpts.some(m=>m.length!==3))fail('mini points missing');
if(mode!=='dc'){const sum=hs.tot.reduce((a,b)=>a+b,0);if(sum<3)fail('points sum low '+sum);}
console.log('lag mode late turns:',hs.late,'of',hs.applied);
console.log('errors:',party.errors);
if(party.errors.length)process.exitCode=1;
await party.close();
