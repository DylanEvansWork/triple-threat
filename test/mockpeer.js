// In-page fake PeerJS (same API surface the game uses) over BroadcastChannel. Works across pages of one browser context.
(function(){
  const bc=new BroadcastChannel('mockpeer'),peers=new Map();
  const rid=()=>Math.random().toString(36).slice(2,10);
  class Conn{
    constructor(peer,remote,cid){this.peer=peer;this.peerId=remote;this.cid=cid;this.open=false;this.h={};}
    on(ev,f){(this.h[ev]=this.h[ev]||[]).push(f);return this;}
    emit(ev,a){(this.h[ev]||[]).forEach(f=>{try{f(a);}catch(e){console.error(e);}});}
    send(d){if(!this.open)return;bc.postMessage({k:'data',to:this.peerId,cid:this.cid,d:JSON.parse(JSON.stringify(d))});}
    close(){if(!this.open)return;this.open=false;bc.postMessage({k:'close',to:this.peerId,cid:this.cid});this.emit('close');}
  }
  class Peer{
    constructor(id){this.id=id||('p'+rid());this.h={};this.conns={};this.dead=false;peers.set(this.id,this);setTimeout(()=>this.emit('open',this.id),5);}
    on(ev,f){(this.h[ev]=this.h[ev]||[]).push(f);return this;}
    emit(ev,a){(this.h[ev]||[]).forEach(f=>{try{f(a);}catch(e){console.error(e);}});}
    connect(id){
      const c=new Conn(this,id,rid());this.conns[c.cid]=c;
      c.timer=setTimeout(()=>{if(!c.open)this.emit('error',{type:'peer-unavailable'});},1500);
      bc.postMessage({k:'conn',to:id,from:this.id,cid:c.cid});return c;
    }
    destroy(){this.dead=true;for(const k in this.conns)this.conns[k].close();peers.delete(this.id);}
  }
  bc.onmessage=ev=>{
    const m=ev.data,p=peers.get(m.to);
    if(m.k==='conn'){
      if(!p||p.dead)return;
      const c=new Conn(p,m.from,m.cid);p.conns[m.cid]=c;c.open=true;
      bc.postMessage({k:'ack',to:m.from,cid:m.cid});
      p.emit('connection',c);setTimeout(()=>c.emit('open'),0);return;
    }
    if(!p)return;const c=p.conns[m.cid];if(!c)return;
    if(m.k==='ack'){clearTimeout(c.timer);c.open=true;c.emit('open');}
    else if(m.k==='data'){c.emit('data',m.d);}
    else if(m.k==='close'){if(c.open){c.open=false;c.emit('close');}}
  };
  window.Peer=Peer;
})();
