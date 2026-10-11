// Stress-test helpers shared by splitsteal/simon/duel stress tests: launch with latency+jitter, time warp, reload/rejoin, host fuzzing, overflow + payload checks.
import {chromium} from 'playwright-core';
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
import {serve,sleep} from './harness.mjs';
export {sleep};
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// o: n, only, viewport, warp (game clock speed-up, >1 only for soak runs), lat: [[base,jitter] per player index] (ms, applied to messages each way, order preserved)
export async function launch(o={}){
  const n=o.n||3,names=['Dyl','Sam','Jo','Kai'],K=o.warp||1;
  const server=await serve();
  const browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await browser.newContext({viewport:o.viewport||{width:390,height:844},deviceScaleFactor:o.dpr||2,hasTouch:true,isMobile:true});
  const mock=fs.readFileSync(path.join(ROOT,'test/mockpeer.js'),'utf8');
  await ctx.route('**/peerjs.min.js',r=>r.fulfill({contentType:'application/javascript',body:mock}));
  const errors=[],pages=[];
  const init=cfg=>{
    if(cfg.K!==1){const r=performance.now.bind(performance);performance.now=()=>r()*cfg.K;}
    window.__maxR=0;
    if(cfg.lat){
      const wrap=(conn,l)=>{
        const key=l[0]+'/'+l[1];if(!conn||conn.__w===key)return;conn.__w=key;
        const orig=conn.__o||(conn.__o=conn.send.bind(conn));let last=0;
        conn.send=d=>{const t=Date.now()+l[0]+Math.random()*l[1];const rel=Math.max(last+1,t);last=rel;setTimeout(()=>orig(d),Math.max(0,rel-Date.now()));};
      };
      setInterval(()=>{try{
        if(typeof isHost!=='undefined'&&isHost&&H){H.players.forEach(p=>wrap(p.conn,cfg.lat[p.id]||[0,0]));}
        else if(typeof hostConn!=='undefined'&&hostConn){wrap(hostConn,cfg.lat[cfg.me]||[0,0]);}
      }catch(e){}},50);
    }
    setInterval(()=>{try{if(R){const l=JSON.stringify(R).length;if(l>window.__maxR)window.__maxR=l;}}catch(e){}},50);
  };
  for(let i=0;i<n;i++){
    const p=await ctx.newPage();
    await p.addInitScript(init,{K,lat:o.lat||null,me:i});
    p.on('pageerror',e=>errors.push(`[${names[i]}] pageerror: ${e.message}`));
    p.on('console',m=>{if(m.type()==='error'&&!/vibrate|Failed to load resource/i.test(m.text()))errors.push(`[${names[i]}] console.error: ${m.text()}`);});
    await p.goto(`${server.url}/index.html?key=k${i}&only=${o.only}&autoready=1`,{waitUntil:'load'});
    pages.push(p);
  }
  const host=pages[0];
  await host.fill('#name',names[0]);await host.click('#create');
  await host.waitForFunction(()=>R&&R.ph==='lobby'&&R.code,null,{timeout:10000});
  const code=await host.evaluate(()=>partyCode);
  for(let i=1;i<n;i++){
    await pages[i].fill('#name',names[i]);await pages[i].fill('#code',code);await pages[i].click('#join');
    await pages[i].waitForFunction(()=>R&&R.ph==='lobby',null,{timeout:10000});
  }
  await host.waitForFunction(k=>R.pl.length===k,n,{timeout:10000});
  const party={n,server,browser,ctx,pages,host,code,errors,names,
    async start(){await host.click('#start');},
    phase:()=>host.evaluate(()=>R&&R.ph),
    async waitPhase(ph,timeout=60000){await host.waitForFunction(p=>R&&R.ph===p,ph,{timeout});},
    state:()=>host.evaluate(()=>R),
    async shot(file,i=0){fs.mkdirSync(path.dirname(file),{recursive:true});await pages[i].screenshot({path:file});return file;},
    // reload a client page (same ?key=) and rejoin through the normal join form -> engine re-attaches the same player
    async reload(i){
      const p=pages[i];await p.reload({waitUntil:'load'});
      await p.fill('#name',names[i]);await p.fill('#code',code);await p.click('#join');
      await p.waitForFunction(()=>R&&R.ph!=='lobby'&&R.ph!=='menu',null,{timeout:10000});
    },
    // drop + auto-reconnect (engine's own rejoin) without reloading
    async blip(i){await pages[i].evaluate(()=>{hostConn.close();});},
    // fuzz the host with random/malformed/out-of-phase act (and other) messages for `ms`
    fuzz(ms,rate=40){
      return host.evaluate(([ms,rate])=>new Promise(res=>{
        const junk=[null,undefined,NaN,-1,0,1,2,3,4,5,99,1e9,-1e9,'a','',{},[],true,false,'__proto__','S','T','constructor',Infinity,{x:1},[1,2],1.5,'1','0'];
        const keys=['k','i','c','o','e','ms','f','s','v','p','idx','tx','to','n'];
        const kinds=['chat','pick','lock','rdy','tap','add','h','r','decoy','p','rtt','unhold','fire','x',undefined,5,null];
        const rj=a=>a[Math.floor(Math.random()*a.length)];
        const t0=Date.now();
        const iv=setInterval(()=>{
          for(let q=0;q<Math.ceil(rate/20);q++){
            const m={};if(Math.random()<.9)m.t=Math.random()<.9?'act':rj(['done','prog','bet','ready','skip','again','start','rounds','games','emo','hb','x']);
            m.k=rj(kinds);const nk=Math.floor(Math.random()*5);for(let j=0;j<nk;j++)m[rj(keys)]=rj(junk);
            if(Math.random()<.3)m.i=Math.floor(Math.random()*5)-1;if(Math.random()<.2)m.c=rj(['S','T']);if(Math.random()<.2)m.o=Math.floor(Math.random()*5);
            if(m.t==='start'||m.t==='again'||m.t==='skip'||m.t==='games'||m.t==='rounds'||m.t==='ready'||m.t==='done'||m.t==='prog'||m.t==='bet')continue;   // engine messages are not the game's responsibility
            try{hostHandle(Math.floor(Math.random()*6)-1,m);}catch(e){console.error('FUZZ THROW '+e.message);}
          }
          if(Date.now()-t0>ms){clearInterval(iv);res(true);}
        },20);
      }),[ms,rate]);
    },
    maxPayload:()=>host.evaluate(()=>window.__maxR),
    // elements of the game box that stick out of it (layout overflow)
    overflow:i=>pages[i].evaluate(()=>{
      const root=document.querySelector('#gbox');if(!root)return[];const rr=root.getBoundingClientRect(),bad=[];
      root.querySelectorAll('*').forEach(e=>{
        const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return;
        if(e.closest('.ss-flash,.sm-fl,.dl-fl'))return;if(e.getAnimations&&e.getAnimations().length)return;
        if(r.right>rr.right+4||r.left<rr.left-4||r.bottom>rr.bottom+4||r.top<rr.top-4)bad.push((e.className||e.tagName)+' '+[r.left,r.top,r.right,r.bottom].map(Math.round));
      });
      return bad.slice(0,6);
    }),
    async close(){await browser.close();server.close();}
  };
  return party;
}
export function mk(){let fail=0;const ok=(c,m)=>{if(!c){console.log('  FAIL:',m);fail++;}else console.log('  ok:',m);};return{ok,get fail(){return fail;}};}
export const rnd=(a,b)=>a+Math.random()*(b-a);
export const ev=(p,sel,type,extra={})=>p.evaluate(([sel,type,extra])=>{const e=document.querySelector(sel);if(!e)return false;e.dispatchEvent(new PointerEvent(type,Object.assign({bubbles:true,cancelable:true,pointerId:1,isPrimary:true},extra)));return true;},[sel,type,extra]);
