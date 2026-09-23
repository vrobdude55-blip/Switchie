
const socket=io({autoConnect:true});
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let actionStatus='',actionStatusTimer=null;
let state=null,playerId=localStorage.getItem('switchiePlayerId')||'',roomCode=localStorage.getItem('switchieRoomCode')||'',chatMode='room',privateMessages=[],lastDrawnKey='',drawAnimating=false,toastTimer;
let mode='idle',uiOwnIndex=null,uiTargetPlayer=null,throwCardIndex=null,ringTimer=null,drawTimer=null;
const suitMap={S:'♠',H:'♥',D:'♦',C:'♣'};
function suit(s){return suitMap[s]||s}function isRed(s){return s==='H'||s==='D'}
function card(c,back=false,cls=''){if(back||!c)return `<div class="card back ${cls}"></div>`;return `<div class="card face ${isRed(c.s)?'red':''} ${cls}"><div class="corner">${esc(c.r)}<br>${suit(c.s)}</div><div class="suit">${suit(c.s)}</div><div class="corner rot">${esc(c.r)}<br>${suit(c.s)}</div></div>`}
function toast(msg){clearTimeout(toastTimer);$('toast').textContent=msg;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function showModal(html){$('modalHost').innerHTML=html;$('modalHost').classList.add('open')}
function closeModal(){$('modalHost').classList.remove('open');$('modalHost').innerHTML=''}
function players(){return state?.players||[]}
function mine(){return players().find(p=>p.id===state?.playerId)}
function myTurn(){return !!state&&state.started&&state.turn===players().findIndex(p=>p.id===state.playerId)&&!state.ended}
function turnPlayer(){return players()[state?.turn]}
function activeName(){const p=turnPlayer();return p?p.name:'—'}
const SPECIAL=new Set(['8','9','10','J','Q','K']);

function resetUiMode(){mode='idle';uiOwnIndex=null;uiTargetPlayer=null;throwCardIndex=null}

function renderOpponents(){
  const ps=players().filter(p=>p.id!==state.playerId);
  $('topOpps').innerHTML=ps.slice(0,3).map(p=>{
    const n=Math.min(p.handCount,8);
    const backs=Array.from({length:n},(_,i)=>{
      const pickable=(mode==='pickOppCard' && uiTargetPlayer===p.id);
      return `<div class="miniBack ${pickable?'pickable':''}" data-pid="${esc(p.id)}" data-idx="${i}"></div>`;
    }).join('');
    return `<div class="opp ${players()[state.turn]?.id===p.id?'active':''}" data-pid="${esc(p.id)}">
      <div class="oppHead"><div class="identity"><div class="avatar"></div><div><div class="name">${esc(p.name)}${p.ai?' (AI)':''}</div><div class="cardsCount">${p.handCount} cards</div></div></div><div class="statusText ${p.ai?'ai':''}">${p.ai?'AI READY':p.connected?'CONNECTED':'DISCONNECTED'}</div></div>
      <div class="miniHand">${backs}</div>
    </div>`;
  }).join('');
  $('topOpps').querySelectorAll('.opp').forEach(el=>{
    el.onclick=(e)=>{ if(mode==='pickOpponent'){ e.stopPropagation(); chooseOpponent(el.dataset.pid); } };
  });
  $('topOpps').querySelectorAll('.miniBack').forEach(el=>{
    el.onclick=(e)=>{ if(mode==='pickOppCard' && uiTargetPlayer===el.dataset.pid){ e.stopPropagation(); chooseOppCard(Number(el.dataset.idx)); } };
  });
}
function renderDeck(){
  const count=state?.started?Math.max(0,state.deckCount||0):52;
  $('deck').innerHTML=`${card(null,true)}${count>20?card(null,true):''}${count>10?card(null,true):''}`;
  $('deckCount').textContent=state?.started?`${count} cards left`:'52 cards ready';
  $('pile').innerHTML=state?.pileTop?`${card(state.pileTop)}`:card(null,true);
  const canDraw=myTurn()&&!state?.drawn&&mode==='idle'&&!state?.ended;
  $('deck').classList.toggle('canDraw',!!canDraw);
}
function renderThrowRing(){
  const ring=$('throwRing');
  if(ringTimer){clearInterval(ringTimer);ringTimer=null}
  if(!state?.throwOpen||!state?.throwUntil){ring.classList.remove('show');return}
  ring.classList.add('show');
  const tick=()=>{
    const remain=Math.max(0,state.throwUntil-Date.now());
    const secs=Math.ceil(remain/1000);
    ring.style.setProperty('--pct',Math.max(0,(remain/8000)*100));
    $('throwRingNum').textContent=secs;
    if(remain<=0){ring.classList.remove('show');clearInterval(ringTimer);ringTimer=null}
  };
  tick();ringTimer=setInterval(tick,120);
}
function renderDrawTimer(){
  const el=$('drawTimer');
  if(drawTimer){clearInterval(drawTimer);drawTimer=null}
  if(!state?.drawPendingPlayerId||!state?.drawDeadline||!state?.drawPhase){el.classList.remove('show');return}
  el.classList.add('show'); el.classList.toggle('waiting',state.drawPhase==='waiting'); el.classList.toggle('decision',state.drawPhase==='decision');
  const tick=()=>{
    const remain=Math.max(0,state.drawDeadline-Date.now());
    const secs=Math.ceil(remain/1000);
    $('drawTimerNum').textContent=String(secs);
    const minePending=state.drawPendingPlayerId===state.playerId;
    if(state.drawPhase==='waiting') $('drawTimerLabel').textContent=minePending?'SECONDS TO DRAW':'DRAW CARD';
    else $('drawTimerLabel').textContent=minePending?'SECONDS TO DECIDE':'DECISION TIMER';
    el.classList.toggle('urgent',secs<=5);
    if(remain<=0){el.classList.remove('show');clearInterval(drawTimer);drawTimer=null}
  };
  tick();drawTimer=setInterval(tick,100);
}
function canInitiateThrow(){ return (myTurn()&&!state?.drawn) || !!state?.throwOpen || (!!state?.drawPendingPlayerId && state.drawPendingPlayerId!==state.playerId); }
function renderHand(){
  const me=mine();const n=me?.handCount||0;
  $('youCount').textContent=`${n} cards`;
  const throwable = canInitiateThrow() && mode==='idle';
  const pickingReplace = mode==='pickReplace';
  const pickingOwn = mode==='pickOwnForAbility';
  $('hand').innerHTML=Array.from({length:n},(_,i)=>{
    const cls=[ (pickingReplace||pickingOwn)?'pickable':(throwable?'throwable':'') ].filter(Boolean).join(' ');
    return `<div class="slot ${cls}" data-i="${i}">${card(null,true)}<div class="slotNum">${i+1}</div></div>`;
  }).join('');
  $('hand').querySelectorAll('.slot').forEach(el=>el.onclick=(e)=>{
    e.stopPropagation();
    const i=Number(el.dataset.i);
    handSlotClick(i);
  });
}
function handSlotClick(i){
  if(mode==='pickReplace'){ socket.emit('replace',{index:i}); resetUiMode(); render(); return; }
  if(mode==='pickOwnForAbility'){
    const c=state?.drawn || (state?.abilityPending ? {r:state.abilityPending.rank} : null); if(!c) return;
    if(['8','9','10'].includes(c.r)){ socket.emit('abilityLookOwn',{index:i}); resetUiMode(); render(); return; }
    uiOwnIndex=i; mode='pickOpponent'; render(); return;
  }
  if(mode==='idle' && canInitiateThrow()){ throwCardIndex=i; mode='pickThrow'; render(); return; }
  if(mode==='idle'){ toast("You can't throw right now — wait for your turn or the throw window."); }
}
function chooseOpponent(pid){ uiTargetPlayer=pid; mode='pickOppCard'; render(); }
function chooseOppCard(idx){
  const c=state?.drawn || (state?.abilityPending ? {r:state.abilityPending.rank} : null); if(!c||uiOwnIndex===null||!uiTargetPlayer) return;
  if(c.r==='J') socket.emit('abilityJack',{ownIndex:uiOwnIndex,targetId:uiTargetPlayer,targetIndex:idx});
  else socket.emit('abilityViewPair',{ownIndex:uiOwnIndex,targetId:uiTargetPlayer,targetIndex:idx});
  resetUiMode(); render();
}
function activeAbilityRank(){return state?.drawn?.r || state?.abilityPending?.rank || null}
function abilityCopy(r){
  const copy={
    '8':'Look at one of your hidden cards. Choose a position and it is revealed for 4 seconds.',
    '9':'Look at one of your hidden cards. Choose a position and it is revealed for 4 seconds.',
    '10':'Look at one of your hidden cards. Choose a position and it is revealed for 4 seconds.',
    'J':'Blindly switch one of your cards with another player — neither of you sees it.',
    'Q':"Look at one of your cards and one opponent's card. Both flip open for 4 seconds.",
    'K':"Look at one of your cards and one opponent's card, then optionally switch those exact cards."
  };
  return copy[r]||'Play the drawn card directly or replace a hidden position.';
}
function renderAbility(){
  const c=state?.drawn || (state?.abilityPending ? {r:state.abilityPending.rank,s:'S'} : null);
  if(c){$('abilityCard').innerHTML=card(c,false,'small');$('abilityText').textContent=abilityCopy(c.r)}
  else{$('abilityCard').innerHTML=card(null,true,'small');$('abilityText').textContent='Draw a special card to reveal its ability.'}
}
function renderLog(){$('log').innerHTML=(state?.logs||[]).map(x=>`<div class="logLine">${esc(x)}</div>`).join('')}
function formatTime(iso){try{return new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}catch{return ''}}
function renderChat(){const roomMsgs=(state?.chat||[]).filter(m=>m.kind==='room');let html='';if(chatMode==='room'){html=roomMsgs.slice().reverse().map(m=>`<div class="msg"><div class="avatar"></div><div><div class="msgMeta">${esc(m.from)} · ${formatTime(m.time)}</div><div class="bubble">${esc(m.text)}</div></div></div>`).join('')}else{html=privateMessages.slice(-30).map(m=>`<div class="msg"><div class="avatar"></div><div><div class="msgMeta">${esc(m.from)} · ${formatTime(m.time)}</div><div class="bubble private">${esc(m.text)}</div></div></div>`).join('')}$('chatMessages').innerHTML=html||`<div class="msgMeta" style="padding:12px 2px">${chatMode==='room'?'No messages yet.':'Private messages will appear here.'}</div>`;$('privateRow').style.display=chatMode==='private'?'flex':'none';$('roomTab').classList.toggle('active',chatMode==='room');$('privateTab').classList.toggle('active',chatMode==='private');const opts=players().filter(p=>p.id!==state?.playerId&&!p.ai);$('privateTo').innerHTML=opts.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')||'<option>No friends online</option>'}

function statusText(){
  if(actionStatus) return actionStatus;
  if(!state?.started) return state?.playerId===state?.hostId?'Add AI Player or invite a friend, then press Start Game.':'Waiting for the host to start the game.';
  if(state.ended) return 'The hand is over.';
  if(mode==='pickThrow') return 'Confirm the card you want to throw.';
  if(mode==='drawnMenu') return 'Use its ability, replace a face-down card, or discard it.';
  if(state.drawPhase==='waiting') return `${activeName()} is drawing a card.`;
  if(state.drawPhase==='decision' && state.drawPendingPlayerId && state.drawPendingPlayerId!==state.playerId) return `${activeName()} is deciding — only matching hidden-card throws are allowed.`;
  if(mode==='pickReplace') return 'Click one of your face-down cards to replace.';
  if(mode==='pickOwnForAbility') return 'Click one of your face-down cards.';
  if(mode==='pickOpponent') return 'Click an opponent to target.';
  if(mode==='pickOppCard') return "Click one of their face-down cards.";
  if(state.throwOpen) return 'Throw your cards';
  return myTurn()?'Click the draw pile, or click a face-down card of yours to throw a match.':`${activeName()} is taking the turn.`;
}
function renderCenterAction(){
  const el=$('centerAction');
  const drawn=state?.drawn;
  const ability=state?.abilityPending;
  el.classList.remove('drawnMode');
  if(mode==='pickThrow' && throwCardIndex!==null){
    el.classList.remove('hidden');
    el.innerHTML=`<div class="caCardWrap">${card(null,true)}</div><div class="caSide"><div class="caPrompt">Throw this face-down card if you think it matches the discard pile?</div><div class="caButtons"><button id="caThrowGo" class="goldBtn">→ Throw this card</button><button id="caCancel" class="ghost">Cancel</button></div><div class="caCancelHint">Or click anywhere on the green felt to cancel.</div></div>`;
    $('caThrowGo').onclick=()=>{socket.emit('throw',{index:throwCardIndex});animateThrowFlourish();resetUiMode();render()}; $('caCancel').onclick=()=>{resetUiMode();render()}; return;
  }
  if(drawn && ['drawnMenu','pickReplace','pickOwnForAbility','pickOpponent','pickOppCard'].includes(mode)){
    el.classList.remove('hidden'); el.classList.add('drawnMode');
    const special=SPECIAL.has(drawn.r); let prompt='Choose what to do with this card.';
    if(mode==='pickReplace') prompt='Click one of your face-down cards to swap it in.';
    if(mode==='pickOwnForAbility') prompt=drawn.r==='J'?'Click one of your face-down cards to offer for the blind switch.':'Click one of your face-down cards to look at.';
    if(mode==='pickOpponent') prompt='Click an opponent above to target.';
    if(mode==='pickOppCard') prompt='Click one of their face-down cards above.';
    const buttons=mode==='drawnMenu'?`<div class="caButtons">${special?'<button id="caAbility" class="goldBtn">★ Use Ability</button>':''}<button id="caReplace">⇄ Replace Face-Down Card</button><button id="caDiscard" class="primary">▢ Discard</button></div>`:'';
    el.innerHTML=`<div class="caCardWrap">${card(drawn,false)}</div><div class="caSide"><div class="caPrompt">${prompt}</div>${buttons}<div class="caCancelHint">Click anywhere on the green felt to go back.</div></div>`;
    if(mode==='drawnMenu'){
      if($('caAbility')) $('caAbility').onclick=()=>{socket.emit('beginAbility');mode='pickOwnForAbility';render()};
      $('caReplace').onclick=()=>{mode='pickReplace';render()}; $('caDiscard').onclick=()=>{socket.emit('discardDrawn');resetUiMode();render()};
    }
    return;
  }
  if(ability && ['pickOwnForAbility','pickOpponent','pickOppCard'].includes(mode)){
    el.classList.remove('hidden'); el.classList.add('drawnMode');
    let prompt=ability.rank==='J'?'Choose your hidden card, then an opponent card to switch blindly.':'Choose your hidden card.';
    if(mode==='pickOpponent') prompt='Choose an opponent to target.';
    if(mode==='pickOppCard') prompt='Choose the opponent card to inspect.';
    el.innerHTML=`<div class="caCardWrap">${card({r:ability.rank,s:'S'},false)}</div><div class="caSide"><div class="caPrompt"><strong>Using ${esc(ability.rank)} ability</strong><br>${prompt}</div><div class="caCancelHint">The ability card is already in the discard pile.</div></div>`;
    return;
  }
  el.classList.add('hidden'); el.innerHTML='';
}
function render(){
  if(!state)return;
  $('lobby').style.display='none';$('game').style.display='block';$('roomCode').textContent=state.code;
  $('statusPill').textContent=statusText();
  $('roomTitle').textContent=state.title&&state.title!==state.code?state.title:'Private Table';
  renderOpponents();renderDeck();renderHand();renderAbility();renderLog();renderChat();renderCenterAction();renderThrowRing();renderDrawTimer();
  const canKnock=myTurn()&&!state.drawn&&!state.knocked&&!state.ended&&mode==='idle';
  $('knockBtn').disabled=!canKnock;
  if(state.ended)showEnd();
}
function showEnd(){if($('modalHost').classList.contains('open'))return;const scores=state.scores?state.scores.map(s=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #fff1"><span>${esc(s.name)}</span><strong>${s.score}</strong></div>`).join(''):'';showModal(`<div class="modal"><div class="modalTitle">${esc(state.winner||'Game Over')} wins</div><div class="modalSub">${state.scores?'Final scores':'The game ended because a player emptied their hand.'}</div>${scores}<div class="choices" style="margin-top:14px"><button id="closeEnd" class="primary">Back to Room</button></div></div>`);$('closeEnd').onclick=closeModal}
function animateDraw(){
  if(drawAnimating||!state?.drawn)return;
  const src=document.querySelector('#deck .card:last-child'),target=$('centerAction');
  if(!src||!target){mode='drawnMenu';render();return}
  drawAnimating=true;
  target.classList.add('drawTransitHide');
  const a=src.getBoundingClientRect(),b=target.getBoundingClientRect(),el=document.createElement('div');
  el.className='fly smoothDraw';el.innerHTML=card(null,true);
  const bx=b.left+b.width/2-36, by=b.top+b.height*.12;
  el.style.left=a.left+'px';el.style.top=a.top+'px';
  el.style.setProperty('--tx',(bx-a.left)+'px');el.style.setProperty('--ty',(by-a.top)+'px');
  el.style.setProperty('--dx',((bx-a.left)*.42)+'px');el.style.setProperty('--dy',((by-a.top)-75)+'px');
  document.body.appendChild(el);
  setTimeout(()=>{el.remove();drawAnimating=false;target.classList.remove('drawTransitHide');mode='drawnMenu';render();target.classList.add('actionPing');setTimeout(()=>target.classList.remove('actionPing'),700)},1080);
}
function actionPointForPlayer(actorId){
  if(actorId===state?.playerId){
    const slot=document.querySelector('#hand .slot:last-child');
    return slot || $('centerAction');
  }
  return document.querySelector(`.opp[data-pid="${CSS.escape(actorId||'')}"] .miniBack:last-child`) || document.querySelector(`.opp[data-pid="${CSS.escape(actorId||'')}"]`) || $('topOpps');
}
function animateRemoteAction(a){
  if(!a||a.actorId===state?.playerId)return;
  const src= a.type==='draw' ? document.querySelector('#deck .card:last-child') : actionPointForPlayer(a.actorId);
  const dst= a.type==='draw' ? $('centerAction') : $('pile');
  if(!src||!dst)return;
  const s=src.getBoundingClientRect(),d=dst.getBoundingClientRect();
  const el=document.createElement('div');el.className='fly remoteAction';el.innerHTML=card(null,true);
  el.style.left=s.left+'px';el.style.top=s.top+'px';
  const tx=d.left+d.width/2-36-s.left,ty=d.top+d.height/2-50-s.top;
  el.style.setProperty('--tx',tx+'px');el.style.setProperty('--ty',ty+'px');el.style.setProperty('--dx',(tx*.48)+'px');el.style.setProperty('--dy',(ty-55)+'px');
  document.body.appendChild(el);
  if(a.type==='draw'){
    setTimeout(()=>{
      el.remove();
      const mid=document.createElement('div');mid.className='fly remoteAction';mid.innerHTML=card(null,true);mid.style.left=(d.left+d.width/2-36)+'px';mid.style.top=(d.top+d.height*.18)+'px';
      const pile=$('pile').getBoundingClientRect();const tx2=pile.left+pile.width/2-36-(d.left+d.width/2-36),ty2=pile.top+pile.height/2-50-(d.top+d.height*.18);
      mid.style.setProperty('--tx',tx2+'px');mid.style.setProperty('--ty',ty2+'px');mid.style.setProperty('--dx',(tx2*.45)+'px');mid.style.setProperty('--dy',(ty2-35)+'px');document.body.appendChild(mid);setTimeout(()=>mid.remove(),820);
    },1050);
  } else setTimeout(()=>el.remove(),820);
}
function animateThrowFlourish(){
  if(throwCardIndex===null)return;
  const src=$('centerAction'),dst=$('pile');
  if(!src||!dst)return;
  const a=src.getBoundingClientRect(),b=dst.getBoundingClientRect(),el=document.createElement('div');
  el.className='fly';el.innerHTML=card(null,true);
  el.style.left=a.left+'px';el.style.top=a.top+'px';
  el.style.setProperty('--tx',(b.left-a.left)+'px');el.style.setProperty('--ty',(b.top-a.top)+'px');
  el.style.setProperty('--dx',((b.left-a.left)*.5)+'px');el.style.setProperty('--dy',((b.top-a.top)-45)+'px');
  document.body.appendChild(el);setTimeout(()=>el.remove(),760);
  $('pile').classList.add('pop');setTimeout(()=>$('pile').classList.remove('pop'),450);
}
function revealCard(title,cards,canSwitch=false){const html=cards.map(x=>`<div><div class="revealMeta">${esc(x.owner)} · position ${x.index+1}</div><div class="flipWrap"><div class="flipInner"><div class="flipFace">${card(null,true)}</div><div class="flipFace flipFront">${card(x.card,false)}</div></div></div></div>`).join('');showModal(`<div class="modal"><div class="modalTitle">${esc(title)}</div><div class="modalSub">The selected card${cards.length>1?'s are':' is'} revealed for 4 seconds.</div><div class="revealGrid">${html}</div><div class="timerBar"></div></div>`);setTimeout(()=>{if(canSwitch){showModal(`<div class="modal"><div class="modalTitle">Switch the exact two cards?</div><div class="modalSub">Only the two cards you just inspected may be switched.</div><div class="choices"><button id="keepKing">Keep</button><button id="switchKing" class="goldBtn">Switch</button></div></div>`);$('keepKing').onclick=()=>{closeModal();socket.emit('kingChoice',{switchCards:false})};$('switchKing').onclick=()=>{closeModal();socket.emit('kingChoice',{switchCards:true})}}else closeModal()},4000)}
function howToPlay(){
  showModal(`<div class="modal rulesModal"><button id="rulesClose" class="modalClose" aria-label="Close rules">×</button><div class="modalTitle">How to Play Switchie</div><div class="modalSub">Hidden cards. Big moves.</div><div class="rulesGrid">
    <div class="ruleBlock"><h3>Setup</h3><p>Everyone starts with 4 cards face down. Positions stay fixed and you normally cannot look at your own hidden cards.</p></div>
    <div class="ruleBlock"><h3>Your Turn</h3><p>Draw the top card and look at it. Then either discard it, or replace one hidden card in that exact position. The old card goes to the discard pile.</p></div>
    <div class="ruleBlock"><h3>Throwing</h3><p>If a hidden card matches the discard pile by rank, throw it onto the pile. A successful throw removes that card permanently.</p><p>If the throw is wrong, the thrown card is revealed and you take both the thrown card and the previous top card.</p></div>
    <div class="ruleBlock"><h3>30-Second Decision</h3><p>After drawing, you have 30 seconds to decide. If time expires, the drawn card is automatically discarded and the turn advances.</p></div>
    <div class="ruleBlock"><h3>Throw While Someone Decides</h3><p>While another player has a drawn card, other players may only throw a hidden card that matches the current discard pile. No other actions are available to them.</p></div>
    <div class="ruleBlock"><h3>Knock</h3><p>If you believe your total is 4 points or fewer, you may knock. Your turn is skipped, everyone else gets one final turn, then all remaining cards are revealed and the lowest score wins.</p></div>
    <div class="ruleBlock"><h3>Card Values</h3><p>A = 1 · 2–10 = face value · J = 11 · Q = 12 · K = 13. The King of Diamonds is −1 while face down.</p></div>
    <div class="ruleBlock"><h3>Special Abilities</h3><ul><li>8 / 9 / 10: look at one of your cards.</li><li>J: blindly switch one of your cards with another player.</li><li>Q: look at one of yours and one opponent's card.</li><li>K: look at one of yours and one opponent's card, then optionally switch those exact two cards.</li></ul><p>Abilities only activate when the special card is drawn and played directly onto the pile.</p></div>
  </div></div>`);
  $('rulesClose').onclick=closeModal;
}

function roomSettings(){
  const host=state?.playerId===state?.hostId;
  showModal(`<div class="modal"><div class="modalTitle">Room Settings</div><div class="modalSub">${host?'Edit your private table before the game starts.':'Only the host can edit room settings.'}</div><div style="display:grid;gap:8px"><input id="roomTitleInput" class="field" maxlength="32" value="${esc(state?.title&&state.title!==state.code?state.title:'Private Table')}" placeholder="Room name"><button id="saveRoomSettings" class="goldBtn" ${host&&!state.started?'':'disabled'}>Save Room Settings</button><button id="settingsAddAi" ${host&&!state.started?'':'disabled'}>Add AI Player</button><button id="settingsStart" class="primary" ${host&&!state.started&&players().length>=2?'':'disabled'}>Start Game</button></div></div>`);
  if($('saveRoomSettings'))$('saveRoomSettings').onclick=()=>{socket.emit('roomSettings',{roomTitle:$('roomTitleInput').value});closeModal()};
  if($('settingsAddAi'))$('settingsAddAi').onclick=()=>{socket.emit('addAI');closeModal()};
  if($('settingsStart'))$('settingsStart').onclick=()=>{socket.emit('start');closeModal()};
}
function leaveRoom(){
  showModal(`<div class="modal"><div class="modalTitle">Leave Room?</div><div class="modalSub">You can rejoin later with the room code if the room still exists.</div><div class="choices"><button id="cancelLeave">Cancel</button><button id="confirmLeave" class="danger">Leave Room</button></div></div>`);
  $('cancelLeave').onclick=closeModal;
  $('confirmLeave').onclick=()=>{socket.emit('leaveRoom');closeModal();state=null;resetUiMode();localStorage.removeItem('switchiePlayerId');localStorage.removeItem('switchieRoomCode');$('game').style.display='none';$('lobby').style.display='grid'};
}
function sendChat(){const text=$('chatInput').value.trim();if(!text)return;if(chatMode==='room')socket.emit('sendChat',{text});else{const toId=$('privateTo').value;if(!toId)return toast('Choose a player for private chat.');socket.emit('sendPrivateChat',{toId,text})}$('chatInput').value=''}
$('create').onclick=()=>socket.emit('create',{name:$('name').value.trim()||'Player'});
$('join').onclick=()=>socket.emit('join',{name:$('name').value.trim()||'Player',code:$('code').value.trim().toUpperCase(),playerId});
$('deck').onclick=()=>{ if(myTurn()&&!state?.drawn&&mode==='idle'&&!state?.ended){ socket.emit('draw'); } };
$('knockBtn').onclick=()=>socket.emit('knock');
$('sendChat').onclick=sendChat;$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat()});
$('roomTab').onclick=()=>{chatMode='room';renderChat()};$('privateTab').onclick=()=>{chatMode='private';renderChat()};
$('copy').onclick=async()=>{if(!state?.code)return;const url=`${location.origin}/?room=${state.code}`;try{await navigator.clipboard.writeText(url);toast('Private room invite copied.')}catch{toast(url)}};
$('invite').onclick=()=>$('copy').click();
$('addAi').onclick=()=>{if(state?.playerId===state?.hostId&&!state.started)socket.emit('addAI');else toast('Only the host can add AI before the game starts.')};
$('startGame').onclick=()=>{if(state?.playerId!==state?.hostId)return toast('Only the host can start the game.');socket.emit('start')};
$('settings').onclick=roomSettings;$('howToPlay').onclick=howToPlay;$('leaveRoom').onclick=leaveRoom;
$('newGame').onclick=()=>{state=null;resetUiMode();closeModal();localStorage.removeItem('switchiePlayerId');localStorage.removeItem('switchieRoomCode');$('game').style.display='none';$('lobby').style.display='grid';$('name').focus()};
document.querySelector('.feltWrap').addEventListener('click',()=>{ if(mode==='idle')return; if(state?.drawn && ['pickReplace','pickOwnForAbility','pickOpponent','pickOppCard'].includes(mode)){ mode='drawnMenu'; uiOwnIndex=null; uiTargetPlayer=null; } else { resetUiMode(); } render(); });
document.querySelector('.stage').addEventListener('click',(e)=>{ if(e.target.classList.contains('stage')||e.target.classList.contains('piles')||e.target.id==='statusPill'){ if(mode==='idle')return; if(state?.drawn && ['pickReplace','pickOwnForAbility','pickOpponent','pickOppCard'].includes(mode)){ mode='drawnMenu'; uiOwnIndex=null; uiTargetPlayer=null; } else { resetUiMode(); } render(); } });
socket.on('joined',x=>{playerId=x.playerId;roomCode=x.code;localStorage.setItem('switchiePlayerId',playerId);localStorage.setItem('switchieRoomCode',roomCode);$('code').value=x.code;toast(`Private room ${x.code} ready.`)});
socket.on('state',x=>{
  if(!x||!Array.isArray(x.players)){toast('Invalid game state received. Reconnecting…');return}
  const prevTurn=state?state.turn:null;
  state=x;
  if(!state.drawn && !state.abilityPending && ['drawnMenu','pickReplace','pickOwnForAbility','pickOpponent','pickOppCard'].includes(mode)) resetUiMode();
  if(!myTurn() && mode!=='idle' && mode!=='pickThrow') resetUiMode();
  const next=state.drawn?state.drawn.r+state.drawn.s:'';
  if(state.started&&state.drawn&&next!==lastDrawnKey&&myTurn()){
    lastDrawnKey=next;render();
    setTimeout(()=>{if(state?.drawn&&state.drawn.r+state.drawn.s===next)animateDraw()},90);
  }else{
    if(!state.drawn)lastDrawnKey='';
    render();
  }
});
socket.on('gameAction',a=>{ if(a?.status){actionStatus=a.status;clearTimeout(actionStatusTimer);actionStatusTimer=setTimeout(()=>{actionStatus='';render()},2600)} animateRemoteAction(a); render(); });
socket.on('privateChat',m=>{privateMessages.push(m);if(chatMode==='private')renderChat();toast(`Private message from ${m.from}`)});
socket.on('errorMsg',x=>toast(x));
socket.on('disconnect',()=>toast('Connection lost · reconnecting…'));
socket.on('connect',()=>{const q=new URLSearchParams(location.search).get('room');const code=(q||roomCode||'').toUpperCase();if(code&&playerId)socket.emit('join',{name:$('name').value.trim()||'Player',code,playerId})});
socket.on('reveal',x=>revealCard(x.kind==='own'?'Your card':x.kind==='king'?'King · cards revealed':'Queen · cards revealed',x.cards,!!x.canSwitch));
socket.on('publicReveal',x=>{showModal(`<div class="modal"><div class="modalTitle">Wrong throw</div><div class="modalSub">${esc(x.name)} threw a non-matching card. Everyone sees the reveal.</div><div class="revealGrid">${card(x.thrown,false,'cardEnter')}${card(x.pile,false,'cardEnter')}</div><div class="timerBar"></div></div>`);setTimeout(closeModal,4000)});
if(new URLSearchParams(location.search).get('room'))$('code').value=new URLSearchParams(location.search).get('room').toUpperCase();
