// Offline end-to-end harness: static server + system Chrome (playwright-core) + in-page fake PeerJS.
// Usage:  import {launchParty} from './harness.mjs';  const party = await launchParty({n:3, only:'shotgun'});
import {chromium} from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME={'.html':'text/html','.js':'application/javascript','.txt':'text/plain','.json':'application/json','.css':'text/css'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export {sleep};

export function serve(){
  return new Promise(res=>{
    const srv=http.createServer((rq,rs)=>{
      let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
      const f=path.join(ROOT,p);
      if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);rs.end('nf');return;}
      rs.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});rs.end(fs.readFileSync(f));
    }).listen(0,'127.0.0.1',()=>res({url:'http://127.0.0.1:'+srv.address().port,close:()=>srv.close()}));
  });
}

// n players (page 0 = host). opts: only ('key' or 'a,b'), rounds (5|8|12), names, viewport, headless, autoready (default true)
export async function launchParty(o={}){
  const n=o.n||3,names=o.names||['Dyl','Sam','Jo','Kai'],autoready=o.autoready!==false;
  const server=await serve();
  const browser=await chromium.launch({executablePath:CHROME,headless:o.headless!==false,args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await browser.newContext({viewport:o.viewport||{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const mock=fs.readFileSync(path.join(ROOT,'test/mockpeer.js'),'utf8');
  await ctx.route('**/peerjs.min.js',r=>r.fulfill({contentType:'application/javascript',body:mock}));
  const errors=[],pages=[];
  for(let i=0;i<n;i++){
    const p=await ctx.newPage();
    p.on('pageerror',e=>errors.push(`[${names[i]}] pageerror: ${e.message}`));
    p.on('console',m=>{if(m.type()==='error'&&!/vibrate|Failed to load resource/i.test(m.text()))errors.push(`[${names[i]}] console.error: ${m.text()}`);});
    const q=`key=k${i}`+(o.only?`&only=${o.only}`:'')+(autoready?'&autoready=1':'');
    await p.goto(`${server.url}/index.html?${q}`,{waitUntil:'load'});
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
  if(o.rounds)await host.click(`#rounds button[data-n="${o.rounds}"]`);
  const party={n,server,browser,ctx,pages,host,clients:pages.slice(1),code,errors,names,
    // start the game (host clicks Start). With autoready every client taps "ready" itself.
    async start(){await host.click('#start');},
    phase:()=>host.evaluate(()=>R&&R.ph),
    async waitPhase(ph,timeout=60000){await host.waitForFunction(p=>R&&R.ph===p,ph,{timeout});},
    state:()=>host.evaluate(()=>R),                 // the host's view of the public room state
    async shot(file,i=0){fs.mkdirSync(path.dirname(file),{recursive:true});await pages[i].screenshot({path:file});return file;},
    async shotAll(dir,tag){fs.mkdirSync(dir,{recursive:true});for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:path.join(dir,`${tag}-${names[i]}.png`)});},
    async close(){await browser.close();server.close();}
  };
  return party;
}
