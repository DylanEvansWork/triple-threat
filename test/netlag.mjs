// Artificial network latency for the offline harness. The fake PeerJS rides on BroadcastChannel; we delay outgoing
// messages per destination (keeping order, like a reliable data channel).
//   await installLag(party,[[150,60],[300,120]])   // one-way [base,jitter] ms for client 1, client 2, ...
export async function installLag(party,cfgs){
  const ids=[null];
  for(let i=1;i<party.pages.length;i++)ids.push(await party.pages[i].evaluate(()=>peer&&peer.id));
  const to={};for(let i=1;i<ids.length;i++)to[ids[i]]=cfgs[i-1]||[0,0];
  const patch=()=>{
    if(window.__lagOn)return;window.__lagOn=true;
    const orig=BroadcastChannel.prototype.postMessage,last={};
    BroadcastChannel.prototype.postMessage=function(m){
      const c=(window.__lagTo&&m&&window.__lagTo[m.to])||window.__lagSelf;
      if(!c||!m)return orig.call(this,m);
      const now=performance.now(),key=(m.to||'')+'|'+(m.cid||''),at=Math.max(now+c[0]+Math.random()*c[1],(last[key]||0)+0.2);last[key]=at;
      setTimeout(()=>orig.call(this,m),Math.max(0,at-now));
    };
  };
  await party.pages[0].evaluate(patch);await party.pages[0].evaluate(t=>{window.__lagTo=t;},to);
  for(let i=1;i<party.pages.length;i++){await party.pages[i].evaluate(patch);await party.pages[i].evaluate(c=>{window.__lagSelf=c;},cfgs[i-1]||[0,0]);}
}
