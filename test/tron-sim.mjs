// Offline Light Cycles balance simulator (no browser): runs the real host code with human-like bots.
//   node test/tron-sim.mjs [n=3] [games=60] ["SP0=7,SP1=11,SP_T=20"]   -> per-mini-round duration stats
import fs from 'fs';import vm from 'vm';
const n=+process.argv[2]||3,games=+process.argv[3]||60,over=process.argv[4]||'';
let src=fs.readFileSync(new URL('../games/tron.js',import.meta.url),'utf8');
if(over)for(const kv of over.split(',')){const [k,v]=kv.split('=');src=src.replace(new RegExp('\\b'+k+'=[^,;]+'),k+'='+v);}
const TW=28,TH=40,DX=[0,1,0,-1],DY=[-1,0,1,0];
function load(){const sb={GAMES:{},clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),console};vm.createContext(sb);vm.runInContext(src,sb);return sb.GAMES.tron;}
const G=load();
const rnd=(a,b)=>a+Math.random()*(b-a);
// human model: sees trouble `horizon` seconds ahead, then needs react..react+spread seconds to tap; sometimes picks the worse side
function mkBrain(skill){return{pend:null,seq:0,skill};}
function sim(){
  const H={players:Array.from({length:n},(_,i)=>({id:i,aw:false}))};
  const S=G.init(H);S.t=0;G.begin&&G.begin(H,S);
  const brains=H.players.map((p,i)=>({pend:null,seq:0,react:rnd(.18,.34),sloppy:rnd(.05,.22),hz:rnd(.45,.7)}));
  const minis=[];let lastMt=0,guard=0;
  while(!S.over&&guard++<20000){
    S.t+=.05;
    if(S.st==='run'){
      S._b.forEach((b,i)=>{
        if(!b.alive)return;const br=brains[i];
        const free=(x,y)=>x>=0&&y>=0&&x<TW&&y<TH&&S._g[y*TW+x]===-1;
        const run=(d,max)=>{let k=0;while(k<max&&free(b.x+DX[d]*(k+1),b.y+DY[d]*(k+1)))k++;return k;};
        const space=d=>{const q=[[b.x+DX[d],b.y+DY[d]]],seen=new Set();let c=0;while(q.length&&c<100){const [x,y]=q.shift();const k=y*TW+x;if(seen.has(k)||!free(x,y))continue;seen.add(k);c++;q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}return c;};
        const look=Math.ceil(S.sp*br.hz)+1;if(process.env.DBG&&S.t<4&&i===0&&Math.round(S.t*20)%10===0)console.log(S.t.toFixed(2),look,run(b.d,look),b.x,b.y,b.d,br.pend,b.q.length);
        if(!br.pend&&b.q.length===0&&run(b.d,look)<look){
          const delay=br.react+Math.random()*.1;br.pend={t:S.t+delay};
        }
        if(br.pend&&S.t>=br.pend.t){
          br.pend=null;
          const L=space((b.d+3)&3),R=space((b.d+1)&3);let side=L>R?-1:1;if(Math.random()<br.sloppy)side=-side;
          G.act(H,S,i,{t:'act',k:'t',r:side,at:b.k,seq:++br.seq});if(process.env.DBG)console.log('tap',i,S.t.toFixed(2),side,b.q.length,b.k);
        }
      });
    }
    const before=S.st;G.tick(H,S,.05);
    if(before==='run'&&S.st==='end')minis.push(S.mt);
  }
  return{minis,tot:S._tot};
}
const all=[];for(let g=0;g<games;g++)all.push(...sim().minis);
all.sort((a,b)=>a-b);
const avg=all.reduce((a,b)=>a+b,0)/all.length,q=p=>all[Math.floor(p*(all.length-1))];
console.log(`n=${n} ${over||'(default)'}  mini-rounds=${all.length}  avg=${avg.toFixed(1)}s  p10=${q(.1).toFixed(1)} p50=${q(.5).toFixed(1)} p90=${q(.9).toFixed(1)}  frac<10s=${(all.filter(x=>x<10).length/all.length*100).toFixed(0)}%  frac>=15s=${(all.filter(x=>x>=15).length/all.length*100).toFixed(0)}%`);
if(process.env.DBG){const H={players:[{id:0},{id:1}]};const S=G.init(H);S.st='run';const b=S._b[0];console.log(S.sp,b.x,b.alive,S._g instanceof Int8Array,S._g[6*TW+4]);}
