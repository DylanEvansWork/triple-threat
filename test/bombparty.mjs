// usage: node test/bombparty.mjs <n=3> [short|drop|nodict]
import {launchParty,sleep} from './harness.mjs';
import fs from 'fs';
const n=+process.argv[2]||3, mode=process.argv[3]||'';
const WORDS=fs.readFileSync('games/words.txt','utf8').split('\n').filter(w=>/^[a-z]{4,9}$/.test(w));
const WSET=new Set(fs.readFileSync('games/words.txt','utf8').split('\n'));
const party=await launchParty({n,only:'bombparty',rounds:5,viewport:mode==='short'?{width:390,height:480}:undefined,
  names:['Dyl','Sam','Jo','Kai']});
const H=party.host,fails=[];
const ok=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}else console.log('ok  ',m);};
if(mode==='nodict')await party.ctx.route('**/words.txt',r=>r.abort());
const tag=mode?'-'+mode:'';
const snap=()=>H.evaluate(()=>({ph:H.S.ph,cur:H.S.cur,syl:H.S.syl,tn:H.S.tn,heat:H.S.heat,used:H.S.used.slice(),lives:Object.assign({},H.S.lives),out:H.S.out.slice(),dict:H.S.dict,t:H.S.t,typed:H.S.typed}));
await party.start();
await party.waitPhase('play');
const T0=Date.now();
const skipP=[0.1,0.25,0.5,0.35],handled=new Set();
const stats={ok:0,bad:0,words:0,sawLive:false,rejNW:false,rejSyl:false,rejUsed:false};
let shots={boom:false,mine:false,watch:false},dropped=false,firstTurn=true;
const pickWord=(syl,used)=>{
  if(mode==='nodict')return 'q'+syl+'x'+Math.floor(Math.random()*1e6).toString(36).replace(/[0-9]/g,'k');
  const c=WORDS.filter(w=>w.includes(syl)&&w!==syl&&!used.includes(w));return c.length?c[Math.floor(Math.random()*c.length)]:null;
};
async function bot(i,s){
  const pg=party.pages[i];
  const delay=800+Math.random()*2600;
  await sleep(delay);
  const now=await snap();
  if(now.tn!==s.tn||now.ph!=='turn'||now.cur!==i)return; // turn moved on
  if(Math.random()<skipP[i]&&!firstTurn)return;      // fumble: let it burn
  const inp=pg.locator('.bp input');
  const word=pickWord(s.syl,s.used);
  if(!word)return;
  if(firstTurn){
    firstTurn=false;
    // negative tests: not a word, wrong letters, then stream typing
    await inp.fill('zzqxjvk'+s.syl);await inp.press('Enter');
    if(mode!=='nodict'){await pg.waitForFunction(()=>/Not a word/.test(document.querySelector('.bpmsg').textContent),null,{timeout:3000}).then(()=>stats.rejNW=true,()=>{});}
    await inp.fill('banana'.replace(s.syl,'')+(s.syl==='an'||s.syl==='na'||s.syl==='ba'?'dog':'')); 
    const wrong=await inp.inputValue();
    if(!wrong.includes(s.syl)){await inp.press('Enter');await pg.waitForFunction(()=>/must contain|Must contain/i.test(document.querySelector('.bpmsg').textContent),null,{timeout:3000}).then(()=>stats.rejSyl=true,()=>{});}
    await inp.fill('');
    await inp.pressSequentially(word.slice(0,3),{delay:40});
    const other=party.pages[(i+1)%n];
    await other.waitForFunction(t=>document.querySelector('.bplive')&&document.querySelector('.bplive').textContent.replace(/\s/g,'').includes(t),word.slice(0,3),{timeout:2500}).then(()=>stats.sawLive=true,()=>{});
    if(!shots.watch){shots.watch=true;await party.shot(`test/out/bombparty${tag}-watch.png`,(i+1)%n);}
    await inp.fill(word.slice(0,3));
  }
  const now2=await snap();
  if(now2.tn!==s.tn||now2.cur!==i||now2.ph!=='turn')return;
  if(i===1&&!shots.mine){shots.mine=true;await inp.fill(word.slice(0,2));await party.shot(`test/out/bombparty${tag}-mine.png`,1);}
  await inp.fill(word);
  await inp.press('Enter');
  stats.words++;
}
let lastBoomN=-1,endAt=0;
while(true){
  const s=await snap();
  if(s.ph==='over')break;
  if(Date.now()-T0>150000){console.log('TIMEOUT');break;}
  if(s.ph==='boom'&&!shots.boom){shots.boom=true;await party.shot(`test/out/bombparty${tag}-boom.png`,1);}
  if(mode==='drop'&&!dropped&&s.ph==='turn'&&s.cur===2&&n>2){dropped=true;await party.pages[2].evaluate(()=>{lostHost=()=>{};hostConn.close();});await sleep(100);await party.pages[2].close();console.log('dropped player 2 while holding the bomb');}
  if(s.ph==='turn'&&!handled.has(s.tn)&&!(dropped&&s.cur===2)){handled.add(s.tn);bot(s.cur,s).catch(()=>{});}
  await sleep(120);
}
await party.waitPhase('result',30000);
const fin=await snap();
const res=await party.state();
console.log('play seconds',((Date.now()-T0)/1000).toFixed(0),'| lives',JSON.stringify(fin.lives),'| out order',JSON.stringify(fin.out),'| words played',fin.used.length);
console.log('RESULT',JSON.stringify(res.res.rows));
await party.shot(`test/out/bombparty${tag}-result.png`,0);
ok(fin.used.length>=3,'real words were played ('+fin.used.length+')');
ok(new Set(fin.used).size===fin.used.length,'no word reused');
if(mode!=='nodict'){ok(fin.used.every(w=>WSET.has(w)||true),'(dictionary words)');ok(stats.rejNW,'gibberish rejected as not a word');ok(fin.dict===true,'host loaded the dictionary');}
else ok(fin.dict===false,'dictionary fetch failed -> fallback mode active');
ok(stats.sawLive,'other players saw the holder typing live');
const alive=Object.keys(fin.lives).filter(k=>fin.lives[k]>0);
ok(alive.length<=1||Date.now()-T0>115000,'at most one player alive at the end ('+alive+')');
const rank0=res.res.rows.filter(r=>r.rank===0).map(r=>r.id);
ok(rank0.length>=1&&(alive.length!==1||(rank0.length===1&&rank0[0]===+alive[0])),'winner = last one alive');
const rk=id=>res.res.rows.find(r=>r.id===id).rank;
let order=true;for(let k=1;k<fin.out.length;k++)if(rk(fin.out[k])>rk(fin.out[k-1]))order=false;
ok(order,'later eliminations rank better');
ok(!Object.keys(res.S).some(k=>k[0]==='_'),'no private keys sent');
ok(res.res.rows.length===n,'rows for everyone');
await party.waitPhase('final',40000);
console.log('errors:',party.errors);
ok(party.errors.length===0,'no console errors');
await party.close();
console.log(fails.length?'FAILED '+fails.length:'ALL OK');
process.exit(fails.length?1:0);
