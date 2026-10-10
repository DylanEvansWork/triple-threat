# Triple Threat — engine contract (read this fully before writing a game)

Triple Threat is a party pack for **2–4 players (target: exactly 3)**, each on their **own phone, portrait**, joined by a party code.
One phone is the **host** and runs the authoritative game simulation; the others are thin clients (PeerJS data channels, no server).
`index.html` is the engine (lobby, rules screen, betting, countdown, scoring, results, final podium). **Do not edit `index.html`.**
Each game is ONE file `games/<key>.js` that registers `GAMES.<key> = {...}`. Plain classic-script JS, no modules, no build step, no libraries.
Globals you can use: `GAMES E esc $ COLORS clamp rnd pick shuffle lerp mulberry sfx beep buzz audio liveRow Joy mkCanvas plOf colOf remNow`.
If you need extra top-level state/helpers in your file, wrap them in an IIFE or prefix names with your game key — all game files share one global scope.
A template that exercises the API is `games/example.js` (run it: `node test/example.mjs 3`).

## Round lifecycle (engine-driven)
`intro` (rules card, everyone taps READY, optional winner bet) → `count` (3-2-1, your game DOM is mounted behind it) → `play` → `result` (ranking + points) → next round.
During `play` the host calls `tick` every 50 ms and broadcasts public state `S` (every 100 ms, or every 50 ms if `hz:20`). Each client's `update(S,R)` is called on every broadcast.
The round ends when: `S.over` is set (after `S.hold` seconds, default 1.5, so your end animation can play) · or `S.t >= dur` · or (if `S.res` exists) every non-away player has reported via `c.done(v)` (+`grace` seconds max, default 3).
Points: engine ranks players with `val`/`better` (default) or your `score()` override, then awards `n - rank` points (ties share the better rank). Bets add +2/−1 on top. You never touch points yourself unless you use `score()`.

## Game definition
```js
GAMES.key = {
  name:'Shotgun', emoji:'🔫', tag:'One-line pitch shown under the title',
  min:2, max:4,                 // supported player counts (the engine only queues the game when n is inside)
  rules:[ ['🎯','Step text'], ... ],   // 3–5 steps, SHOWN BEFORE THE GAME. Plain words, short sentences, a touch of humour. Must fully explain the game to a first-timer.
  ctrl:'What your thumbs do',   // one line
  win:'How you score / win',    // one line
  dur:60,                       // max play seconds (hard cap)
  hz:10|20,                     // broadcast rate during play (20 for real-time action games)
  better:'high'|'low', fmt:v=>'12 pts',   // for default ranking
  nobet:true,                   // optional: no betting screen (co-op games)
  grace:3, hidden:true,         // optional

  // ---------------- HOST (authoritative; runs only on the host phone) ----------------
  init(H)            // -> S. H.players = [{id,name,ci,aw}], aw = disconnected ("away"). Build the public state S (JSON-serialisable).
                     //    Keys of S starting with '_' are PRIVATE to the host (never sent). S._priv = {[pid]: any} is sent ONLY to that player (client reads c.priv()).
                     //    Include `res:{}` in S if clients report results themselves with c.done(v); `prog:{}` if clients stream progress with c.prog(v).
  begin(H,S)         // optional: called once when the countdown ends (S.t = 0 here)
  tick(H,S,dt)       // optional: every 50 ms during play; S.t (seconds since play started) is advanced by the engine before the call
  act(H,S,pid,m)     // optional: a player's c.act({...}) arrives as m (m.t==='act' + your fields). Validate everything; players can be early/late/spam.
  val(S,id)          // number|null for default ranking (null = no result = last)
  score(H,S)         // OPTIONAL override: return [{id,rank,pts,label}] for EVERY player in H.players (rank 0 = winner; same rank = tie). Use for co-op / custom points.
  // H.emit(msg)  -> send a custom event to every client;  H.emit(msg,pid) -> to one client (client gets it in mk().event(msg)). Use for transient things (shots, reveals, drawing strokes, sounds).

  // ---------------- CLIENT (runs on every phone, including the host's own) ----------------
  mk(c){ return {
    mount(root),         // build your DOM inside `root` (an absolutely positioned full-size box). Called at intro, before the rules are dismissed. Don't start anything yet.
    start(),             // play begins (countdown over). Start timers/input here.
    update(S,R),         // new public state S (R = full room state: R.pl players, R.ph phase, R.priv private state, R.rem seconds left in phase)
    frame(rem),          // optional: every requestAnimationFrame during intro/count/play (rem = seconds left in play). Draw / interpolate here.
    event(m),            // optional: custom event from H.emit
    stop()               // round over / leaving: clear timers, remove document listeners (Joy.destroy())
  }}
}
```
Client context `c`: `c.R()` room state · `c.rt()` performance.now() of last broadcast · `c.t()` estimated play time (s) · `c.me()` my player id · `c.pl(id)` {id,n,ci,sc,aw} · `c.col(id)` colour · `c.priv()` my private state ·
`c.act(msg)` → host's `act(H,S,pid,{t:'act',...msg})` · `c.done(v)` report a number once (needs `S.res`) · `c.prog(v)` stream progress (needs `S.prog`).
Player colours: `COLORS[p.ci]`. Always show names with `textContent` (never innerHTML) — names are user input.

## Helpers
* `Joy(el, cb, {radius})` — floating virtual joystick inside `el`: `cb(x,y)` with x,y ∈ [−1,1], (0,0) on release. Also reads arrow keys/WASD (handy for desktop testing). Returns `{get(),destroy()}`. Call `destroy()` in `stop()`.
* `mkCanvas(root)` → `{cv,g,W,H,dpr}` full-size DPR-aware canvas; draw in CSS pixels; `W/H` auto-update on resize.
* `liveRow(fmt)` → `{el,set(S)}` strip showing each player's `S.prog[id]`.
* `sfx.tap/tick/go/good/bad/boom/win/count`, `beep(freq,dur,type,vol,slide)`, `buzz(ms|[pattern])` haptics. Sound only plays after the first tap anywhere (engine handles it).
* `mulberry(seed)` seeded RNG (host sends a `seed` in S when all clients must generate the same thing).
* Existing CSS you may reuse: `.fill` (centred absolute column), `.huge`, `.sub`, `.live`, `.page`, `.shake`, `.cv`. Add your own styles by injecting ONE `<style>` (id = `st-<key>`, create it once) with class names prefixed by your game key.

## Hard requirements (quality bar)
1. **Mobile portrait first.** Design for 360–430 px wide × ~560–760 px tall play area (the engine HUD already uses ~50 px at the top). Must not break at 320 px wide. No page scrolling inside play. Touch targets ≥ 48 px. Use `pointerdown`/`pointermove`/`pointerup` (not `click`, not hover). Add `touch-action:none` on surfaces you drag on.
2. **Authoritative host, snappy clients.** Anything with hidden info or fairness stakes is simulated/checked on the host. Real-time games: send inputs often but throttled (≈30 ms), host sims at 20 Hz, clients interpolate/smooth positions each frame so motion looks fluid; predict your own controlled thing locally where it matters.
3. **Don't leak secrets**: hidden info goes in `_`-prefixed keys or `S._priv`. Nobody should be able to read an opponent's dice/word/role from `R.S`.
4. **Handle weirdness**: 2, 3 and 4 players; a player going `aw` mid-round (treat as eliminated/skipped, never wait on them forever); ties; spamming taps; actions arriving in the wrong phase; `update()` being called during intro/count before `start()`.
5. **Skill & fun**: every game needs real decisions or real skill, a clear way for players to affect each other, tension, and a moment worth screaming about. Tune numbers by actually playing (bot-play it, watch screenshots), not by guessing.
6. **Explain it well.** The rules card is the only tutorial. Write 3–5 numbered-feeling steps a 12-year-old gets in 20 seconds. In-game, show short contextual hints ("Your turn!", "Tap a dot to shoot it").
7. Round length: aim for 45–90 s of play (hard max `dur` ≤ 150). Finite: every path must end by `dur`.
8. Visual polish: dark theme consistent with the app (bg `#0b0b17`, panels `#171734`), player colours from `COLORS`, juicy feedback (sound, haptics `buzz`, shake, flashes), big readable text. No external assets/CDNs: draw with canvas/DOM/emoji.
9. No `alert/confirm/prompt`, no `localStorage`, no network, no libraries. Text inputs: put them near the top of the screen (the phone keyboard covers the bottom half); `font-size ≥ 16px` (iOS zooms otherwise); `autocomplete=off autocapitalize=off autocorrect=off spellcheck=false`; dismiss keyboard on submit.
10. Clean up in `stop()`: timers, intervals, `Joy.destroy()`, document-level listeners.

## Testing (required — do not hand in untested code)
Offline end-to-end harness (system Chrome via playwright-core, fake PeerJS in-page, mobile viewport 390×844): see `test/harness.mjs` and `test/example.mjs`.
```js
import {launchParty,sleep} from './harness.mjs';
const party = await launchParty({n:3, only:'mykey', rounds:5});   // page0 = host. `only` forces just your game.
await party.start();                 // host taps Start; clients auto-tap READY (autoready) so the rules screen is skipped quickly
await party.waitPhase('play');       // also: 'intro' 'count' 'result' 'final'
// drive each phone: party.pages[i].evaluate(()=>...)  /  .mouse / .touchscreen / dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,...}))
await party.shot('test/out/mykey-play.png', 1);    // screenshot of phone 1 → then LOOK at it with the Read tool
const st = await party.state();      // st.res.rows = ranking/points after the round, st.S = public state
console.log(party.errors);           // page errors / console errors collected from all phones (must be empty)
await party.close();
```
Page-side globals you can `evaluate`: `R` (room state), `cur` (your running client object), `GAMES`, and on the host `H` (the authoritative room: `H.S` includes your private `_` keys — handy for asserting).
Write `test/<key>.mjs` for each game with **scripted bots that really play** (not just idle), run it for n = 2, 3 and 4 (`node test/<key>.mjs 3`), assert the round finishes, ranks/points are sane, no errors, and **take screenshots at several key moments and inspect them** (layout overflow, clipped text, unreadable colours, wrong orientation). Also test: a player closing their page mid-round (`party.pages[2].close()`) must not hang the round.
Run tests with the Bash tool using `dangerouslyDisableSandbox:true` if Chrome fails to launch in the sandbox. Keep each run under ~2 minutes.

## Deliverable
`games/<key>.js` (+ any data file under `games/` if truly needed), `test/<key>.mjs`. Final message: what you built, rules text as shown to players, tuning decisions, known issues, anything the engine should add. Don't touch other games' files, `index.html`, or `ENGINE.md`.
