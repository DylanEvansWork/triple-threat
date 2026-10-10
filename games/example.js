// TEMPLATE / smoke-test game (hidden from the picker; only loads with ?only=example). Copy its shape for real games.
GAMES.example={
  name:'Tap Race',emoji:'🧪',tag:'Template game used to test the engine',hidden:true,
  min:2,max:4,
  rules:[['👆','Tap the big button as many times as you can.'],['🔒','You also get a secret number that only you can see.'],['⏱️','You have 6 seconds.']],
  ctrl:'Tap the button.',win:'Most taps wins.',
  dur:6,hz:10,better:'high',fmt:v=>v+' taps',
  // ---- host side ----
  init(H){const priv={};H.players.forEach(p=>priv[p.id]={secret:1+Math.floor(Math.random()*99)});return{taps:{},_priv:priv,_hidden:'never sent to clients'};},
  act(H,S,pid,m){if(m.k==='tap')S.taps[pid]=(S.taps[pid]||0)+1;},
  val(S,id){return S.taps[id]||0;},
  // ---- client side ----
  mk(c){
    let big,info,btn,n=0;
    return{
      mount(root){const f=E('div','fill');info=E('div','sub');big=E('div','huge','0');btn=E('button','mash','TAP');btn.style.cssText='flex:0 0 40%;width:100%';f.append(info,big,btn);root.append(f);
        btn.addEventListener('pointerdown',e=>{e.preventDefault();if(c.R().ph!=='play')return;n++;big.textContent=n;c.act({k:'tap'});});},
      start(){}, stop(){},
      update(S,R){const p=c.priv();info.textContent=p?'Your secret number: '+p.secret:'';},
      // frame(rem){}  // optional: called every animation frame during intro/count/play
      // event(m){}    // optional: custom messages from the host (H.emit)
    };
  }
};
