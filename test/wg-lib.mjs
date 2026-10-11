// Word-games stress launcher: like harness.launchParty but with artificial network latency (per phone), reload/rejoin, viewport options.
import {chromium} from 'playwright-core';
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
import {serve,sleep} from './harness.mjs';
export {sleep};
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// wraps the mock Peer so every conn.send is delayed (order preserved) by window.__lat = {base,jit} ms
const LAT=`(()=>{
 window.__lat={base:0,jit:0};
 let _P;
 const patch=c=>{ if(c.__p)return c; c.__p=1; const o=c.send.bind(c); let last=0;
  c.send=d=>{const L=window.__lat; if(!L.base&&!L.jit)return o(d); const now=performance.now(); const t=Math.max(last+1,now+L.base+Math.random()*L.jit); last=t; setTimeout(()=>o(d),Math.max(0,t-now));};
  return c;};
 Object.defineProperty(window,'Peer',{configurable:true,get(){return _P;},set(v){
  _P=class extends v{
   on(ev,f){ if(ev==='connection')return super.on(ev,conn=>f(patch(conn))); return super.on(ev,f);}
   connect(...a){return patch(super.connect(...a));}
  };}});
})();`;

export async function launchStress(o={}){
  const n=o.n||3,names=o.names||['Dyl','Sam','Jo','Kai'];
  const server=await serve();
  const browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await browser.newContext({viewport:o.viewport||{width:390,height:844},deviceScaleFactor:o.dpr||1,hasTouch:true,isMobile:true});
  const mock=fs.readFileSync(path.join(ROOT,'test/mockpeer.js'),'utf8');
  await ctx.route('**/peerjs.min.js',r=>r.fulfill({contentType:'application/javascript',body:mock+'\n'}));
  await ctx.addInitScript(LAT);
  const errors=[],pages=[];
  const wire=(p,i)=>{
    p.on('pageerror',e=>errors.push(`[${names[i]}] pageerror: ${e.message}`));
    p.on('console',m=>{if(m.type()==='error'&&!/vibrate|Failed to load resource/i.test(m.text()))errors.push(`[${names[i]}] console.error: ${m.text()}`);});
  };
  const url=i=>`${server.url}/index.html?key=k${i}&only=${o.only}&autoready=1`;
  for(let i=0;i<n;i++){const p=await ctx.newPage();wire(p,i);await p.goto(url(i),{waitUntil:'load'});pages.push(p);}
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
    async latency(i,base,jit){await pages[i].evaluate(([b,j])=>{window.__lat={base:b,jit:j};},[base,jit]);},
    async start(){await host.click('#start');},
    async waitPhase(ph,timeout=60000){await host.waitForFunction(p=>R&&R.ph===p,ph,{timeout});},
    state:()=>host.evaluate(()=>R),
    // reload a CLIENT page and rejoin with the same ?key= (what a player does after the browser kills the tab)
    async reload(i){
      const p=pages[i];await p.evaluate(()=>{try{hostConn.close();}catch(e){}}).catch(()=>{});await sleep(150);await p.goto(url(i),{waitUntil:'load'});
      await p.fill('#name',names[i]);await p.fill('#code',code);await p.click('#join');
      await p.waitForFunction(()=>R&&R.ph,null,{timeout:10000});
    },
    // transient network drop: close the data channel, the engine's own rejoin logic should bring the player back
    async blip(i){await pages[i].evaluate(()=>{hostConn.close();});},
    // player leaves for good: tell the host the channel closed (the mock doesn't emit it on page close), then close the page
    async drop(i){await pages[i].evaluate(()=>{try{lostHost=()=>{};hostConn.close();}catch(e){}}).catch(()=>{});await sleep(100);await pages[i].close().catch(()=>{});},
    async shot(file,i=0){fs.mkdirSync(path.dirname(file),{recursive:true});await pages[i].screenshot({path:file});return file;},
    async close(){await browser.close();server.close();}
  };
  return party;
}
