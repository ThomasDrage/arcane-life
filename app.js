import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, linkWithPopup } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDatabase, ref, get, set, update, onValue, runTransaction, onDisconnect, serverTimestamp, push } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';
const $ = id => document.getElementById(id);
const msg = s => $('message').textContent = s;
const configured = firebaseConfig?.apiKey && !String(firebaseConfig.apiKey).includes('REPLACE');
const app = configured ? initializeApp(firebaseConfig) : null, auth = app ? getAuth(app) : null, db = app ? getDatabase(app) : null;
let uid, code, unsubscribe, room, busy = false, demoMode = false;
let previousLife = {};
let eventBusy = false;
const THEMES={white:['#f7d991','#b88945','☼'],blue:['#77cfff','#2377ba','💧'],black:['#d5a3ff','#6635a2','☠'],red:['#ff9470','#b73a24','🔥'],green:['#8fe2a2','#267d52','🌳']};
const defaults=()=>({poison:0,experience:0,energy:0,rad:0,tickets:0,commanderDamage:{},theme:'white',customCounters:{},wallpaper:null,commanderSlots:1});
const slug=s=>s.trim().replace(/[.#$\[\]/]/g,'').slice(0,32);
let profileUnsub=null, resultsUnsub=null, searchTimer=null;
function self(){return room?.players?.[uid]||{};}
async function writeSelf(field,value){if(demoMode){room.players[uid][field]=value;render();return;}try{await set(ref(db,`rooms/${code}/players/${uid}/${field}`),value)}catch(e){msg(e.message)}}
async function adjustCounter(field,delta){const current=Number(self()[field]||0);if(demoMode){await writeSelf(field,Math.max(0,current+delta));return;}try{await runTransaction(ref(db,`rooms/${code}/players/${uid}/${field}`),v=>Math.max(0,Number(v||0)+delta))}catch(e){msg(e.message)}}
async function adjustCommander(source,delta){const current=Number(self().commanderDamage?.[source]||0);const value=Math.max(0,current+delta);if(demoMode){self().commanderDamage??={};self().commanderDamage[source]=value;render();return;}try{await runTransaction(ref(db,`rooms/${code}/players/${uid}/commanderDamage/${source}`),v=>Math.max(0,Number(v||0)+delta))}catch(e){msg(e.message)}}
// Shared, append-only event entries. These are informational; the counter transaction remains authoritative.
async function logEvent(kind, detail){
 if(!room||!uid)return;
 const entry={actor:uid,name:String(self().name||'Planeswalker').slice(0,24),kind,detail:String(detail).slice(0,120),at:Date.now()};
 if(demoMode){room.events??={};room.events['e'+Date.now()+Math.random().toString(36).slice(2,7)]=entry;renderActivity();return;}
 try{await set(push(ref(db,`rooms/${code}/events`)),entry)}catch(e){msg('Change saved, but activity log failed: '+e.message)}
}
function renderActivity(){
 if(!room)return;
 const entries=Object.values(room.events||{}).filter(e=>e&&typeof e.detail==='string').sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,80);
 const holder=$('activity-log');holder.replaceChildren();
 const visible=$('show-all-events').checked?entries:entries.filter(e=>e.actor===uid);
 if(!visible.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='No activity yet. Life changes, turns and dice rolls will appear here.';holder.append(empty)}
 for(const e of visible){const item=document.createElement('div');item.className='activity-item';item.textContent=`${e.name||'Player'} · ${e.detail}`;const t=document.createElement('time');t.textContent=new Date(e.at||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});item.append(t);holder.append(item)}
 $('clear-local-events').hidden=!demoMode;
}
function renderUtilities(){
 if(!room)return;
 const order=Object.keys(room.players||{});const n=Math.max(1,Number(room.turnNumber)||1);$('turn-number').textContent=n;
 $('turn-player').textContent=order.length?`${room.players[order[(n-1)%order.length]].name}'s turn`:'Waiting for players';
 $('next-turn').disabled=$('previous-turn').disabled=(!demoMode&&room.host!==uid)||!!room.finished;
 renderActivity();
}
async function changeTurn(delta){
 if(!room||room.finished||(!demoMode&&room.host!==uid))return;
 const current=Math.max(1,Number(room.turnNumber)||1),next=Math.max(1,current+delta);if(next===current)return;
 if(demoMode){room.turnNumber=next;renderUtilities()}else{try{await runTransaction(ref(db,`rooms/${code}/turnNumber`),v=>Math.max(1,Number(v||1)+delta))}catch(e){return msg(e.message)}}
 await logEvent('turn',`Turn ${next} ${delta>0?'began':'restored'}`);
}
function randomInt(max){const limit=4294967296-(4294967296%max),a=new Uint32Array(1);do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%max}
async function chance(coin){if(!room)return;const sides=Number($('dice-sides').value),result=coin?(randomInt(2)?'Heads':'Tails'):String(randomInt(sides)+1);const label=coin?`Coin: ${result}`:`D${sides}: ${result}`;$('chance-result').textContent=result;$('chance-result').classList.remove('roll');void $('chance-result').offsetWidth;$('chance-result').classList.add('roll');await logEvent('chance',label)}
$('next-turn').onclick=()=>changeTurn(1);$('previous-turn').onclick=()=>changeTurn(-1);$('roll-dice').onclick=()=>chance(false);$('flip-coin').onclick=()=>chance(true);$('show-all-events').onchange=renderActivity;$('clear-local-events').onclick=()=>{if(demoMode&&room){room.events={};renderActivity()}};
function renderExtras(){
 const me=self(),theme=THEMES[me.theme]||THEMES.white;
 document.documentElement.style.setProperty('--mana-accent',theme[0]);document.documentElement.style.setProperty('--mana-glow',theme[1]);
 const themes=$('themes');themes.replaceChildren();
 for(const [key,[color,,symbol]] of Object.entries(THEMES)){const b=document.createElement('button');b.className='theme-choice'+((me.theme||'white')===key?' chosen':'');b.style.setProperty('--choice-color',color);b.textContent=symbol+' '+key;b.onclick=()=>writeSelf('theme',key);themes.append(b)}
 for(const field of ['poison','experience','energy','rad','tickets']){$(field).textContent=me[field]||0;$(field).classList.toggle('danger-value',field==='poison'&&Number(me[field]||0)>=10)}
 renderCustomCounters();
 const list=$('commander-counters');list.replaceChildren();
 const opponents=Object.entries(room.players||{}).filter(([id])=>id!==uid);
 if(!opponents.length){const hint=document.createElement('p');hint.className='hint';hint.textContent='Commander damage options appear when opponents join.';list.append(hint)}
 for(const [id,player] of opponents){
  const slots=Math.min(2,Math.max(1,Number(player.commanderSlots||1)));
  for(let slot=1;slot<=slots;slot++){
   const source=id+'__'+slot;const val=Number(me.commanderDamage?.[source]||0);
   const row=document.createElement('div');row.className='commander-row';
   const name=document.createElement('span');name.textContent=player.name+(slots===2?' · Commander '+slot:' · Commander');
   const count=document.createElement('strong');count.textContent=val;if(val>=21)count.className='danger-value';
   const minus=document.createElement('button');minus.textContent='−1';minus.onclick=()=>adjustCommander(source,-1);
   const plus=document.createElement('button');plus.textContent='+1';plus.onclick=()=>adjustCommander(source,1);
   row.append(name,count,minus,plus);list.append(row);
  }
 }
 const slotButton=document.createElement('button');slotButton.className='secondary small';slotButton.textContent=Number(me.commanderSlots||1)===2?'My commanders: 2 (partners)':'My commanders: 1 · Enable partners';
 slotButton.onclick=()=>writeSelf('commanderSlots',Number(me.commanderSlots||1)===2?1:2);list.append(slotButton);
 const winners=$('winner-select');const old=winners.value;winners.replaceChildren();for(const [id,p] of Object.entries(room.players||{})){const opt=document.createElement('option');opt.value=id;opt.textContent=p.name;winners.append(opt)}if([...winners.options].some(o=>o.value===old))winners.value=old;
 $('finish-game').hidden=!demoMode&&room.host!==uid;
 $('winner-select').hidden=$('finish-game').hidden;
 $('game-finished').textContent=room.finished?('Game finished · Winner: '+(room.players?.[room.winner]?.name||'Unknown')):'';
 $('finish-game').disabled=!!room.finished;

}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), x => alphabet[x % alphabet.length]).join('');
const stored = () => { try { return JSON.parse(localStorage.getItem('mtg-room') || 'null'); } catch { return null; } };
function saveRoom(c){localStorage.setItem('mtg-room',JSON.stringify({code:c}));}
function playerName(){return $('name').value.trim().slice(0,24) || 'Planeswalker';}
function setBusy(v){busy=v;$('create').disabled=v;$('join').disabled=v;}
async function ensureAuth(){if(!auth)throw Error('Configure Firebase to use live multiplayer. You can use Preview instead.');if(uid)return uid; const credential=await signInAnonymously(auth);uid=credential.user.uid;return uid;}
async function create(){if(busy)return;setBusy(true);msg('');try{await ensureAuth();let c;for(let i=0;i<8;i++){c=makeCode();if(!(await get(ref(db,`rooms/${c}`))).exists())break;}if((await get(ref(db,`rooms/${c}`))).exists())throw Error('Could not generate a free code. Try again.');const life=Number($('starting').value);await set(ref(db,`rooms/${c}`),{host:uid,startingLife:life,createdAt:serverTimestamp(),turnNumber:1,players:{[uid]:{name:playerName(),life,online:true,...defaults()}}});enter(c);}catch(e){msg(e.message)}finally{setBusy(false)}}
async function join(c){if(busy)return;setBusy(true);msg('');try{await ensureAuth();c=c.trim().toUpperCase();if(!/^[A-Z2-9]{6}$/.test(c))throw Error('Enter a valid six-character code.');const snap=await get(ref(db,`rooms/${c}`));if(!snap.exists())throw Error('Game not found.');const data=snap.val();if(!data.players?.[uid])await set(ref(db,`rooms/${c}/players/${uid}`),{name:playerName(),life:data.startingLife,online:true,...defaults()});else await update(ref(db,`rooms/${c}/players/${uid}`),{online:true});enter(c);}catch(e){msg(e.message)}finally{setBusy(false)}}
function enter(c){if(unsubscribe)unsubscribe();code=c;saveRoom(c);$('setup').hidden=true;$('game').hidden=false;$('roomcode').textContent=c;const presence=ref(db,`rooms/${c}/players/${uid}/online`);onDisconnect(presence).set(false).catch(console.error);unsubscribe=onValue(ref(db,`rooms/${c}`),snap=>{if(!snap.exists()){msg('Game closed.');leave();return;}room=snap.val();render();},err=>msg(err.message));}
function render(){
 const players=room.players||{};
 $('status').textContent=demoMode?'✧ Interactive preview · local only':`${Object.values(players).filter(p=>p.online).length} online · ${Object.keys(players).length} players`;
 $('reset').hidden=demoMode?false:room.host!==uid;
 $('focus').hidden=false;
 $('focuslife').textContent=players[uid]?.life??room.startingLife;document.querySelector('.focus-ring').classList.remove('burst');void document.querySelector('.focus-ring').offsetWidth;document.querySelector('.focus-ring').classList.add('burst');
 renderExtras();
 renderUtilities();
 const holder=$('players');holder.replaceChildren();
 const palette=[['#efbe67','#f4a84266'],['#68caff','#2586d766'],['#c28aff','#8c45d766'],['#ff8568','#d34a3266'],['#81dca6','#2f9d6866']];
 for(const [i,[id,p]] of Object.entries(players).entries()){
  const card=document.createElement('article');card.className='player'+(id===uid?' mine':'');
  const [accent,glow]=THEMES[p.theme||'']||palette[i%palette.length];card.style.setProperty('--accent',accent);card.style.setProperty('--glow',glow);
  if(p.wallpaper?.url&&/^https:\/\/cards\.scryfall\.io\//.test(p.wallpaper.url)){card.style.backgroundImage=`linear-gradient(90deg,#0b0917dc,#0b091770),url(\"${p.wallpaper.url}\")`;card.classList.add('art-card')}
  const head=document.createElement('div');head.className='playerhead';const name=document.createElement('h3');name.textContent=p.name;
  const tag=document.createElement('span');tag.className='tag';tag.textContent=id===uid?'✦ YOU':p.online?'● ONLINE':'○ OFFLINE';head.append(name,tag);
  const life=document.createElement('div');life.className='life';life.textContent=p.life;card.append(head,life);const stats=document.createElement('div');stats.className='player-stats';stats.textContent=`☠ ${p.poison||0}  ✦ ${p.experience||0}  ⚡ ${p.energy||0}`;card.append(stats);
  if(previousLife[id]!==undefined&&previousLife[id]!==p.life){card.classList.add('changed');card.classList.add(p.life>previousLife[id]?'gain':'loss');}
  previousLife[id]=p.life;holder.append(card);
 }
}
async function changeLife(delta){if(room?.finished)return msg('Game has finished.');if(demoMode){room.players[uid].life+=delta;render();await logEvent('life',`Life ${delta>0?'+':''}${delta} → ${room.players[uid].life}`);return;}try{const result=await runTransaction(ref(db,`rooms/${code}/players/${uid}/life`),value=>typeof value==='number'?value+delta:undefined);if(result.committed)await logEvent('life',`Life ${delta>0?'+':''}${delta} → ${result.snapshot.val()}`);}catch(e){msg(e.message)}}
async function reset(){if(!room||(room.host!==uid&&!demoMode))return;if(!confirm('Reset all life totals?'))return;if(demoMode){Object.values(room.players).forEach(p=>{p.life=room.startingLife;p.poison=0;p.experience=0;p.energy=0;p.rad=0;p.tickets=0;p.commanderDamage={};Object.keys(p.customCounters||{}).forEach(k=>p.customCounters[k].value=0)});render();return;}try{const updates={};for(const id of Object.keys(room.players||{})){updates[`players/${id}/life`]=room.startingLife;updates[`players/${id}/poison`]=0;updates[`players/${id}/experience`]=0;updates[`players/${id}/energy`]=0;updates[`players/${id}/rad`]=0;updates[`players/${id}/tickets`]=0;updates[`players/${id}/commanderDamage`]=null;}await update(ref(db,`rooms/${code}`),updates);}catch(e){msg(e.message)}}
function leave(){demoMode=false;previousLife={};$('focus').hidden=true;if(unsubscribe){unsubscribe();unsubscribe=null;}localStorage.removeItem('mtg-room');code=null;room=null;$('setup').hidden=false;$('game').hidden=true;}
$('demo').onclick=()=>{demoMode=true;uid='demo-me';code='K7M2Q8';room={host:uid,turnNumber:1,events:{},startingLife:Number($('starting').value),players:{'demo-me':{name:playerName(),life:Number($('starting').value),online:true,...defaults()},'demo-2':{name:'Player 2',life:36,online:true,...defaults()},'demo-3':{name:'Player 3',life:28,online:true,...defaults()},'demo-4':{name:'Player 4',life:40,online:true,...defaults()}}};$('setup').hidden=true;$('game').hidden=false;$('roomcode').textContent=code;render();};
document.querySelectorAll('[data-counter]').forEach(b=>b.onclick=()=>adjustCounter(b.dataset.counter,Number(b.dataset.step)));
document.querySelectorAll('[data-delta]').forEach(b=>b.onclick=()=>changeLife(Number(b.dataset.delta)));
$('create').onclick=create;$('join').onclick=()=>join($('code').value);$('reset').onclick=reset;$('leave').onclick=async()=>{const old=code;const wasDemo=demoMode;leave();if(old&&uid&&!wasDemo&&db)try{await set(ref(db,`rooms/${old}/players/${uid}/online`),false)}catch(e){msg(e.message)}};$('copy').onclick=async()=>{if(demoMode){msg('Preview code is illustrative; create a game after Firebase setup.');return;}try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}?game=${code}`);$('copy').textContent='Copied!';}catch{msg('Share this game code: '+code)}};
if(auth){onAuthStateChanged(auth,user=>{if(uid!==user?.uid)recordedRooms.clear();uid=user?.uid;renderAccount(user);if(user){const c=new URLSearchParams(location.search).get('game')||stored()?.code;if(c&& !code){$('code').value=c;join(c);}}});ensureAuth().catch(e=>msg('Firebase setup needed: '+e.message));}

// Account identity: anonymous play remains available; linking a guest account retains its UID.
async function googleLogin(){if(!auth)return msg('Configure Firebase before using Google sign-in.');try{const provider=new GoogleAuthProvider();if(auth.currentUser?.isAnonymous)await linkWithPopup(auth.currentUser,provider);else await signInWithPopup(auth,provider)}catch(e){if(e.code==='auth/credential-already-in-use'){msg('This Google account already exists. Leave the current room, then sign in again to use it.');}else if(e.code==='auth/popup-blocked')msg('Allow pop-ups for this site and try again.');else msg(e.message)}}
function renderAccount(user){const signed=user&&!user.isAnonymous;$('account-status').textContent=signed?('Signed in: '+(user.displayName||user.email||'Planeswalker')):'Guest mode · sign in to save game history';$('google-signin').hidden=!!signed;$('google-signout').hidden=!signed;if(profileUnsub){profileUnsub();profileUnsub=null;}$('career-stats').hidden=!signed;if(resultsUnsub){resultsUnsub();resultsUnsub=null;}$('profile-history').hidden=!signed;if(signed&&db){resultsUnsub=onValue(ref(db,`profiles/${user.uid}/results`),snap=>{const holder=$('profile-results');holder.replaceChildren();const games=Object.entries(snap.val()||{}).sort((a,b)=>(b[1].recordedAt||0)-(a[1].recordedAt||0)).slice(0,30);if(!games.length)holder.textContent='No finished games recorded yet.';for(const [game,v] of games){const el=document.createElement('div');el.className='activity-item';el.textContent=`${game} · ${v.won?'Victory':'Defeat'} · ${new Date(v.recordedAt||0).toLocaleDateString()}`;holder.append(el)}})}if(signed&&db){profileUnsub=onValue(ref(db,`profiles/${user.uid}/stats`),snap=>{const v=snap.val()||{};$('career-stats').textContent=`Games ${v.games||0} · Wins ${v.wins||0} · Losses ${v.losses||0}`;});}}
$('google-signin').onclick=googleLogin;
$('google-signout').onclick=async()=>{if(code&&!demoMode){msg('Leave the current game before signing out.');return;}try{await signOut(auth);uid=null;await ensureAuth()}catch(e){msg(e.message)}};
// Custom counters are per-player. Keys are generated locally and cannot contain Firebase path separators.
function renderCustomCounters(){const holder=$('custom-counters');holder.replaceChildren();for(const [id,item] of Object.entries(self().customCounters||{})){const tile=document.createElement('div');tile.className='counter-tile';const name=document.createElement('span');name.textContent=item.name;const value=document.createElement('strong');value.textContent=item.value||0;const controls=document.createElement('div');controls.className='mini-controls';for(const delta of [-1,1]){const b=document.createElement('button');b.textContent=delta<0?'−':'+';b.onclick=()=>adjustCustom(id,delta);controls.append(b)}const del=document.createElement('button');del.className='ghost small';del.textContent='Remove';del.onclick=()=>removeCustom(id);tile.append(name,value,controls,del);holder.append(tile)}}
async function adjustCustom(id,delta){if(demoMode){const c=self().customCounters?.[id];if(c){c.value=Math.max(0,(c.value||0)+delta);render()}return}try{await runTransaction(ref(db,`rooms/${code}/players/${uid}/customCounters/${id}/value`),v=>Math.max(0,Number(v||0)+delta))}catch(e){msg(e.message)}}
async function removeCustom(id){if(demoMode){delete self().customCounters[id];render()}else try{await set(ref(db,`rooms/${code}/players/${uid}/customCounters/${id}`),null)}catch(e){msg(e.message)}}
$('add-counter').onclick=async()=>{const name=slug($('custom-counter-name').value);if(!name)return msg('Enter a counter name.');if(Object.keys(self().customCounters||{}).length>=12)return msg('Maximum 12 custom counters.');const id='c'+Math.random().toString(36).slice(2,10);if(demoMode){self().customCounters??={};self().customCounters[id]={name,value:0};render()}else try{await set(ref(db,`rooms/${code}/players/${uid}/customCounters/${id}`),{name,value:0})}catch(e){msg(e.message)}$('custom-counter-name').value=''};
// Scryfall search uses a user-initiated request, capped to 12 results; no API key required.
$('art-search-button').onclick=searchArt;
$('art-query').addEventListener('keydown',e=>{if(e.key==='Enter')searchArt()});
async function searchArt(){const q=$('art-query').value.trim();if(q.length<2)return msg('Enter at least two letters.');const holder=$('art-results');holder.textContent='Searching Scryfall…';try{const url='https://api.scryfall.com/cards/search?q='+encodeURIComponent('type:legendary (type:creature or type:planeswalker) '+q)+'&unique=cards';const res=await fetch(url);if(!res.ok)throw Error(res.status===404?'No matching legendary cards found.':'Scryfall request failed.');const data=await res.json();holder.replaceChildren();for(const card of data.data.slice(0,12)){const art=card.image_uris?.art_crop||card.card_faces?.find(f=>f.image_uris)?.image_uris?.art_crop;if(!art)continue;const btn=document.createElement('button');btn.className='art-option';const img=document.createElement('img');img.src=art;img.alt=card.name;img.loading='lazy';const label=document.createElement('span');label.textContent=card.name;btn.append(img,label);btn.onclick=()=>writeSelf('wallpaper',{name:card.name,url:art});holder.append(btn)}if(!holder.childElementCount)holder.textContent='No usable artwork found.'}catch(e){holder.textContent=e.message}}
$('clear-art').onclick=()=>writeSelf('wallpaper',null);
// Game history: each player can record their own finished room once; host chooses the winner.
$('finish-game').onclick=async()=>{if(!room||room.finished)return;const winner=$('winner-select').value;if(!winner)return;if(!confirm('Finish this game and record '+room.players[winner].name+' as winner?'))return;if(demoMode){room.finished=true;room.winner=winner;render();await logEvent('game',`Game finished · Winner: ${room.players[winner].name}`);return}if(room.host!==uid)return;try{await update(ref(db,`rooms/${code}`),{finished:true,winner});await logEvent('game',`Game finished · Winner: ${room.players[winner].name}`);msg('Game finished. Signed-in players can save this result to their profile.')}catch(e){msg(e.message)}};
const recordedRooms=new Set();
async function recordResult(){if(recordedRooms.has(code))return;if(demoMode||!auth?.currentUser||auth.currentUser.isAnonymous||!room?.finished)return;const key=code;recordedRooms.add(key);const entry=ref(db,`profiles/${uid}/results/${key}`);try{const result=await runTransaction(entry,v=>v||{winner:room.winner,won:room.winner===uid,recordedAt:Date.now()});if(result.committed){const snap=await get(ref(db,`profiles/${uid}/results`));const vals=Object.values(snap.val()||{});await set(ref(db,`profiles/${uid}/stats`),{games:vals.length,wins:vals.filter(x=>x.won).length,losses:vals.filter(x=>!x.won).length})}}catch(e){recordedRooms.delete(key);msg('Could not save result: '+e.message)}}
const originalRender=render;render=function(){originalRender();if(room?.finished)recordResult()};
