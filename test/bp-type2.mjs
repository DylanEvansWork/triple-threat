import {launchParty,sleep} from './harness.mjs';
const party=await launchParty({n:3,only:'bombparty',rounds:5});
await party.start();await party.waitPhase('play');await sleep(1200);
const st=await party.state();const hi=st.S.cur,pg=party.pages[hi];
// 1) auto-focus on turn start, no click: just type
console.log('active on turn start:',await pg.evaluate(()=>document.activeElement.tagName));
await pg.keyboard.type('abc',{delay:40});await sleep(200);
console.log('typed without clicking ->',JSON.stringify(await pg.evaluate(()=>document.querySelector('.bp input').value)));
// 2) blur it, then just start typing again (laptop case)
await pg.evaluate(()=>{document.querySelector('.bp input').value='';document.activeElement.blur();});
await pg.keyboard.type('xyz',{delay:40});await sleep(200);
console.log('typed after blur ->',JSON.stringify(await pg.evaluate(()=>document.querySelector('.bp input').value)));
// 3) tap empty area -> focuses (gesture path for iPhone)
await pg.evaluate(()=>{document.querySelector('.bp input').value='';document.activeElement.blur();});
await pg.touchscreen.tap(200,150);await sleep(200);
console.log('after tapping the screen, focused:',await pg.evaluate(()=>document.activeElement.tagName));
// non-holder must not be able to type
const other=party.pages[(hi+1)%3];await other.keyboard.type('qqq');
console.log('non-holder input value:',JSON.stringify(await other.evaluate(()=>document.querySelector('.bp input').value)));
console.log('errors:',party.errors);
await party.close();
