import express from 'express';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const staticDir = fs.existsSync('dist') ? 'dist' : 'public';
app.use(express.static(staticDir));

const rooms = new Map();
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['S','H','D','C'];
const AI_NAMES = ['Maya','Leo','Sam'];
const specialRanks = new Set(['8','9','10','J','Q','K']);
const roomId = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const token = () => crypto.randomBytes(16).toString('hex');
const sameRank = (a,b) => !!a && !!b && a.r === b.r;
const value = (c, faceDown = true) => c.r === 'A' ? 1 : c.r === 'J' ? 11 : c.r === 'Q' ? 12 : c.r === 'K' ? (c.s === 'D' && faceDown ? -1 : 13) : Number(c.r);
const cardPublic = c => c ? { r:c.r, s:c.s } : null;
const label = c => c ? `${c.r}${c.s}` : '';
const now = () => new Date().toISOString();

function makeDeck(){
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({r,s});
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function shuffle(cards){ for(let i=cards.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]]; } return cards; }
function recycleDiscardIntoDeck(room){
  if(room.deck.length || room.pile.length<=1) return false;
  const top=room.pile.at(-1);
  const recycled=room.pile.slice(0,-1);
  room.pile=[top];
  room.deck=shuffle(recycled);
  log(room,'♻️ Draw pile was empty. The discard pile was shuffled back into the draw pile.');
  return true;
}
function playerById(room,id){ return room.players.find(p=>p.id===id); }
function connectedHumans(room){ return room.players.filter(p=>!p.ai && p.socketId); }
function playerIndex(room,id){ return room.players.findIndex(p=>p.id===id); }
function roomForSocket(socket){ for(const r of rooms.values()) if(r.players.some(p=>p.socketId===socket.id)) return r; return null; }
function log(room,msg){ room.logs.unshift(msg); room.logs = room.logs.slice(0,30); }
function addRoomChat(room,from,text,kind='room',toId=null){
  const msg={id:token(),from,text:String(text||'').trim().slice(0,240),time:now(),kind,toId};
  if(!msg.text) return null;
  room.chat.unshift(msg); room.chat=room.chat.slice(0,80); return msg;
}
function publicState(room, socketId){
  const me = room.players.find(p=>p.socketId===socketId);
  return {
    code: room.code, title: room.title || room.code, hostId: room.hostId, started: room.started, turn: room.turn,
    knocked: room.knocked, finalTurns: room.finalTurns, ended: room.ended,
    winner: room.winner, pileTop: cardPublic(room.pile.at(-1)), deckCount: room.deck.length,
    drawn: me ? cardPublic(room.drawn[me.id]) : null,
    players: room.players.map(p=>({id:p.id,name:p.name,ai:p.ai,connected:p.ai ? true : !!p.socketId,handCount:p.hand.length})) ,
    logs: room.logs.slice(0,24), scores: room.scores || null,
    pendingKing: room.pendingKing?.ownerId === me?.id ? { targetId:room.pendingKing.targetId, ownIndex:room.pendingKing.ownIndex, targetIndex:room.pendingKing.targetIndex } : null,
    throwOpen: !!room.throwOpen, throwUntil: room.throwOpen ? room.throwUntil : 0,
    drawPendingPlayerId: room.drawPendingPlayerId || null, drawPhase: room.drawPhase || null, drawDeadline: room.drawDeadline || 0,
    abilityPending: room.abilityPending?.ownerId === me?.id ? {rank:room.abilityPending.rank,stage:room.abilityPending.stage||'choose'} : null,
    playerId: me?.id || null,
    chat: room.chat.slice(0,50).map(m=>({id:m.id,from:m.from,text:m.text,time:m.time,kind:m.kind,toId:m.toId}))
  };
}
function emitRoom(room){
  for(const p of connectedHumans(room)) io.to(p.socketId).emit('state', publicState(room,p.socketId));
}
function emitAction(room,action){
  for(const p of connectedHumans(room)) io.to(p.socketId).emit('gameAction',action);
}
function createRoom(hostName){
  const code=roomId();
  const host={id:token(),socketId:null,name:String(hostName||'Player').slice(0,20),ai:false,hand:[]};
  const room={code,hostId:host.id,players:[host],deck:[],pile:[],turn:0,started:false,ended:false,knocked:false,finalTurns:0,drawn:{},title:code,logs:['Lobby created. Invite friends or add AI, then start the game.'],scores:null,winner:null,pendingKing:null,chat:[],throwOpen:false,throwUntil:0,throwTimer:null,drawPendingPlayerId:null,drawPhase:null,drawDeadline:0,drawTimer:null,abilityPending:null};
  rooms.set(code,room); return room;
}
function addAI(room){
  if(room.started || room.players.length>=4) return false;
  const n=AI_NAMES.find(x=>!room.players.some(p=>p.name===x)) || `AI ${room.players.length}`;
  room.players.push({id:`ai-${token()}`,socketId:null,name:n,ai:true,hand:[]});
  addRoomChat(room,n,'Good luck!');
  log(room,`${n} joined the room.`);
  return true;
}
function startGame(room){
  if(room.started) return;
  if(room.players.length<2) throw new Error('Add at least one friend or AI before starting.');
  room.deck=makeDeck();
  for(const p of room.players) p.hand=room.deck.splice(0,4);
  room.pile=[room.deck.pop()]; room.turn=0; room.started=true; room.ended=false; room.knocked=false; room.finalTurns=0; room.drawn={}; room.pendingKing=null; room.scores=null; room.winner=null;
  if(room.throwTimer) clearTimeout(room.throwTimer);
  room.throwOpen=false; room.throwUntil=0; room.throwTimer=null;
  clearDrawTimer(room);
  room.logs=['Game started.']; room.chat=[];
  const first=room.players[room.turn];
  if(first?.ai){ setTimeout(()=>{if(!room.ended&&room.turn===playerIndex(room,first.id))aiTurn(room,first,()=>{if(!room.ended)advanceToNext(room)})},900+Math.random()*900); } else startDrawWindow(room,first);
}
const DRAW_WINDOW_MS = 15000;
const DRAW_DECISION_MS = 30000;
const THROW_WINDOW_MS = 8000;
function clearDrawTimer(room){
  if(room.drawTimer) clearTimeout(room.drawTimer);
  room.drawTimer=null; room.drawPendingPlayerId=null; room.drawPhase=null; room.drawDeadline=0;
}
function startDecisionTimer(room,p){
  if(room.drawTimer) clearTimeout(room.drawTimer);
  room.drawPendingPlayerId=p.id; room.drawPhase='decision'; room.drawDeadline=Date.now()+DRAW_DECISION_MS;
  room.drawTimer=setTimeout(()=>{
    room.drawTimer=null;
    if(room.ended || room.drawPendingPlayerId!==p.id || room.drawPhase!=='decision' || !room.drawn[p.id]) return;
    const c=room.drawn[p.id]; room.pile.push(c); delete room.drawn[p.id];
    room.drawPendingPlayerId=null; room.drawPhase=null; room.drawDeadline=0;
    log(room,`⏱️ ${p.name} took too long. The drawn card was discarded automatically.`);
    emitAction(room,{type:'discard',actorId:p.id,actorName:p.name,timeout:true,status:`${p.name} timed out · card discarded`});
    emitRoom(room); finishHumanAction(room);
  },DRAW_DECISION_MS);
  emitRoom(room);
}
function autoDraw(room,p){
  if(room.ended || room.turn!==playerIndex(room,p.id) || room.drawPendingPlayerId!==p.id || room.drawPhase!=='waiting' || room.drawn[p.id]) return;
  recycleDiscardIntoDeck(room); if(!room.deck.length) return;
  const c=room.deck.pop(); room.drawn[p.id]=c;
  log(room,`⏱️ ${p.name} did not draw in time. A card was drawn automatically.`);
  emitAction(room,{type:'draw',actorId:p.id,actorName:p.name,automatic:true,status:`${p.name} · Drawing card automatically`});
  startDecisionTimer(room,p); emitRoom(room);
}
function startDrawWindow(room,p){
  clearDrawTimer(room); room.drawPendingPlayerId=p.id; room.drawPhase='waiting'; room.drawDeadline=Date.now()+DRAW_WINDOW_MS;
  room.drawTimer=setTimeout(()=>autoDraw(room,p),DRAW_WINDOW_MS);
  emitAction(room,{type:'drawWait',actorId:p.id,actorName:p.name,status:`${p.name} · Drawing card`}); emitRoom(room);
}
function beginAbility(room,p,c){
  room.pile.push(c); delete room.drawn[p.id]; clearDrawTimer(room);
  room.abilityPending={ownerId:p.id,rank:c.r,stage:'chooseOwn'};
  emitAction(room,{type:'abilityStart',actorId:p.id,actorName:p.name,ability:c.r,status:`${p.name} Used ${c.r} Ability`});
}

function ensureTurn(room,socket){
  if(!room.started) throw new Error('The game has not started. Add an AI or friend, then press Start Game.');
  const p=room.players.find(x=>x.socketId===socket.id);
  if(!p) throw new Error('You are not in this room.');
  if(room.ended || room.turn!==playerIndex(room,p.id)) throw new Error('It is not your turn.');
  return p;
}
function emptyWin(room){
  const p=room.players.find(x=>x.hand.length===0);
  if(!p) return false;
  room.ended=true; room.winner=p.name; log(room,`🏆 ${p.name} emptied their hand and wins!`); return true;
}
function finishScore(room){
  room.ended=true;
  const scores=room.players.map(p=>({name:p.name,score:p.hand.reduce((a,c)=>a+value(c,true),0)})).sort((a,b)=>a.score-b.score);
  room.scores=scores; room.winner=scores[0]?.name || null;
  log(room,`Final scores: ${scores.map(x=>`${x.name} ${x.score}`).join(' · ')}`);
  log(room,`🏆 ${room.winner} wins on score.`); emitRoom(room);
}
function beginKnock(room,p){
  room.knocked=true; room.finalTurns=room.players.length-1; log(room,`🔔 ${p.name} knocked. Everyone else gets one final turn.`);
}
function randomIndex(n){ return n>0 ? Math.floor(Math.random()*n) : -1; }
// THROW_WINDOW_MS is defined above at 8 seconds
function openThrowWindow(room, cb){
  if(room.throwTimer) clearTimeout(room.throwTimer);
  room.throwOpen = true;
  room.throwUntil = Date.now() + THROW_WINDOW_MS;
  emitRoom(room);
  aiWindowThrows(room);
  room.throwTimer = setTimeout(()=>{
    room.throwOpen = false; room.throwUntil = 0; room.throwTimer = null;
    if(room.ended) return;
    emitRoom(room);
    cb();
  }, THROW_WINDOW_MS);
}
function aiWindowThrows(room){
  const top = room.pile.at(-1);
  for(const ai of room.players.filter(x=>x.ai)){
    if(!room.throwOpen) return;
    const idx = ai.hand.findIndex(c=>sameRank(c,top));
    if(idx<0 || Math.random()<0.5) continue;
    const delay = 700 + Math.random()*4500;
    setTimeout(()=>{
      if(!room.throwOpen || room.ended) return;
      const top2 = room.pile.at(-1);
      const idx2 = ai.hand.findIndex(c=>sameRank(c,top2));
      if(idx2<0) return;
      const c = ai.hand.splice(idx2,1)[0];
      log(room, `⚡ ${ai.name} threw ${label(c)} into the window.`);
      emitAction(room,{type:'throw',actorId:ai.id,actorName:ai.name});
      if(emptyWin(room)) return;
      emitRoom(room);
    }, delay);
  }
}

function aiSay(room,p){
  const lines=['Nice move.','Let’s play!','Interesting…','Your turn.','I’m watching.','Good luck!'];
  if(Math.random()<0.55){ addRoomChat(room,p.name,lines[randomIndex(lines.length)]); }
}
function aiTurn(room,p,done=()=>{}){
  if(room.ended || !p || !p.ai) return done();
  const top=room.pile.at(-1);
  const matchIndex=p.hand.findIndex(c=>sameRank(c,top));
  if(matchIndex>=0){
    const c=p.hand.splice(matchIndex,1)[0];
    log(room,`🤖 ${p.name} correctly threw ${label(c)}.`);
    emitAction(room,{type:'throw',actorId:p.id,actorName:p.name});
    aiSay(room,p); emptyWin(room); return done();
  }
  if(room.knocked && Math.random()<0.18){ beginKnock(room,p); aiSay(room,p); return done(); }
  startDrawWindow(room,p);
  const aiDrawDelay=2200+Math.random()*1800;
  setTimeout(()=>{
    if(room.ended || room.turn!==playerIndex(room,p.id) || room.drawPhase!=='waiting') return done();
    recycleDiscardIntoDeck(room); if(!room.deck.length) return done();
    const drawn=room.deck.pop();
    room.drawn[p.id]=drawn; log(room,`🤖 ${p.name} drew a card.`); emitAction(room,{type:'draw',actorId:p.id,actorName:p.name,status:`${p.name} · Drawing card`}); startDecisionTimer(room,p); emitRoom(room);
    const decisionDelay=2600+Math.random()*2200;
    setTimeout(()=>{
    if(room.ended || room.turn!==playerIndex(room,p.id) || !room.drawn[p.id]) return done();
    if(specialRanks.has(drawn.r)){
      clearDrawTimer(room);
      if(['8','9','10'].includes(drawn.r)){
        const idx=randomIndex(p.hand.length); log(room,`🤖 ${p.name} used ${drawn.r} to look at position ${idx+1}.`); room.pile.push(drawn); delete room.drawn[p.id]; emitAction(room,{type:'ability',actorId:p.id,actorName:p.name,ability:drawn.r,status:`${p.name} Used ${drawn.r} Ability`});
      }else if(drawn.r==='J'){
        const others=room.players.filter(x=>x.id!==p.id && x.hand.length);
        if(others.length){const o=others[randomIndex(others.length)],oi=randomIndex(o.hand.length),pi=randomIndex(p.hand.length); [p.hand[pi],o.hand[oi]]=[o.hand[oi],p.hand[pi]]; log(room,`🤖 ${p.name} used Jack to blindly switch with ${o.name}.`);}
        room.pile.push(drawn); delete room.drawn[p.id]; emitAction(room,{type:'ability',actorId:p.id,actorName:p.name,ability:drawn.r,status:`${p.name} Used ${drawn.r} Ability`});
      }else{
        const others=room.players.filter(x=>x.id!==p.id && x.hand.length);
        if(others.length && p.hand.length){const o=others[randomIndex(others.length)],pi=randomIndex(p.hand.length),oi=randomIndex(o.hand.length); if(drawn.r==='K' && Math.random()<0.5){[p.hand[pi],o.hand[oi]]=[o.hand[oi],p.hand[pi]];log(room,`🤖 ${p.name} used King and switched two inspected cards.`);}else log(room,`🤖 ${p.name} used ${drawn.r} to inspect two cards.`);}
        room.pile.push(drawn); delete room.drawn[p.id]; emitAction(room,{type:'ability',actorId:p.id,actorName:p.name,ability:drawn.r,status:`${p.name} Used ${drawn.r} Ability`});
      }
    }else if(Math.random()<0.62 && p.hand.length){
      const idx=randomIndex(p.hand.length),old=p.hand[idx]; p.hand[idx]=drawn; room.pile.push(old); delete room.drawn[p.id]; clearDrawTimer(room); emitAction(room,{type:'replace',actorId:p.id,actorName:p.name,targetIndex:idx,status:`${p.name} · Replaced a face-down card`}); log(room,`🤖 ${p.name} replaced a card.`);
    }else{
      room.pile.push(drawn); delete room.drawn[p.id]; clearDrawTimer(room); emitAction(room,{type:'discard',actorId:p.id,actorName:p.name,status:`${p.name} · Discarded card`}); log(room,`🤖 ${p.name} discarded a card.`);
    }
    aiSay(room,p); emptyWin(room); emitRoom(room); done();
    },decisionDelay);
  },aiDrawDelay);
}

function advanceToNext(room){
  if(room.ended) return emitRoom(room);
  room.turn=(room.turn+1)%room.players.length;
  const p=room.players[room.turn];
  if(!p.ai){ startDrawWindow(room,p); return; }
  const wasKnocked=room.knocked;
  const thinkDelay=1900+Math.random()*1700;
  setTimeout(()=>{
    if(room.ended || room.turn!==playerIndex(room,p.id)) return;
    aiTurn(room,p,()=>{
      if(room.ended) return emitRoom(room);
      const transitionPause=1100+Math.random()*1000;
      setTimeout(()=>{
        if(room.ended || room.turn!==playerIndex(room,p.id)) return;
        openThrowWindow(room, ()=>{
          if(room.ended) return;
          if(room.knocked && wasKnocked){ room.finalTurns--; if(room.finalTurns<=0) return finishScore(room); }
          advanceToNext(room);
        });
      },transitionPause);
    });
  }, thinkDelay);
}
function finishHumanAction(room){
  if(emptyWin(room)) return emitRoom(room);
  openThrowWindow(room, ()=>{
    if(room.ended) return;
    if(room.knocked){ room.finalTurns--; if(room.finalTurns<=0) return finishScore(room); }
    advanceToNext(room);
  });
}
function finishNewKnock(room){ if(emptyWin(room)) return emitRoom(room); advanceToNext(room); }

io.on('connection', socket=>{
  socket.on('create', ({name='Player'}={})=>{try{const room=createRoom(name);const host=room.players[0];host.socketId=socket.id;socket.join(room.code);socket.data.playerId=host.id;socket.emit('joined',{code:room.code,playerId:host.id});emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('join', ({code,name='Player',playerId}={})=>{try{const room=rooms.get(String(code||'').trim().toUpperCase());if(!room)throw new Error('Room not found.');const reconnect=playerId&&room.players.find(p=>p.id===playerId&&!p.ai);if(reconnect){reconnect.socketId=socket.id;socket.data.playerId=reconnect.id;socket.join(room.code);socket.emit('joined',{code:room.code,playerId:reconnect.id});log(room,`${reconnect.name} reconnected.`);emitRoom(room);return;}if(room.started)throw new Error('That game has already started.');if(room.players.length>=4)throw new Error('Room is full.');const p={id:token(),socketId:socket.id,name:String(name||'Player').slice(0,20),ai:false,hand:[]};room.players.push(p);socket.data.playerId=p.id;socket.join(room.code);socket.emit('joined',{code:room.code,playerId:p.id});log(room,`${p.name} joined the room.`);addRoomChat(room,p.name,'Hello!');emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('addAiPlayer',()=>{try{const room=roomForSocket(socket);if(!room)throw new Error('Join a room first.');if(room.hostId!==socket.data.playerId)throw new Error('Only the host can add AI.');if(!addAI(room))throw new Error('Room is full or game already started.');emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('addAI',()=>{try{const room=roomForSocket(socket);if(!room)throw new Error('Join a room first.');if(room.hostId!==socket.data.playerId)throw new Error('Only the host can add AI.');if(!addAI(room))throw new Error('Room is full or game already started.');emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('start',()=>{try{const room=roomForSocket(socket);if(!room)throw new Error('Join a room first.');if(room.hostId!==socket.data.playerId)throw new Error('Only the host can start.');startGame(room);emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('draw',()=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket);if(room.drawPendingPlayerId!==p.id||room.drawPhase!=='waiting')throw new Error('You cannot draw right now.');if(room.drawn[p.id])throw new Error('You already drew a card.');recycleDiscardIntoDeck(room);if(!room.deck.length)throw new Error('There are no cards left to draw.');room.drawn[p.id]=room.deck.pop();log(room,`${p.name} drew a card.`);emitAction(room,{type:'draw',actorId:p.id,actorName:p.name,status:`${p.name} · Drawing card`});startDecisionTimer(room,p);emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('discardDrawn',()=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket),c=room.drawn[p.id];if(!c)throw new Error('Draw a card first.');room.pile.push(c);delete room.drawn[p.id];clearDrawTimer(room);log(room,`${p.name} played ${label(c)} to the pile.`);emitAction(room,{type:'discard',actorId:p.id,actorName:p.name,status:`${p.name} · Discarded card`});finishHumanAction(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('replace',({index}={})=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket),c=room.drawn[p.id];if(!c)throw new Error('Draw a card first.');if(!Number.isInteger(index)||index<0||index>=p.hand.length)throw new Error('Invalid card position.');const old=p.hand[index];p.hand[index]=c;room.pile.push(old);delete room.drawn[p.id];clearDrawTimer(room);log(room,`${p.name} replaced position ${index+1}.`);emitAction(room,{type:'replace',actorId:p.id,actorName:p.name,targetIndex:index,status:`${p.name} · Replaced a face-down card`});finishHumanAction(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('throw',({index}={})=>{try{
    const room=roomForSocket(socket);
    if(!room) throw new Error('Join a room first.');
    if(!room.started || room.ended) throw new Error('The game is not active.');
    const p=room.players.find(x=>x.socketId===socket.id);
    if(!p) throw new Error('You are not in this room.');
    if(!Number.isInteger(index)||index<0||index>=p.hand.length) throw new Error('Invalid card position.');
    const isMyPrimaryTurn = room.turn===playerIndex(room,p.id) && !room.drawn[p.id];
    const drawPendingForOther = !!room.drawPendingPlayerId && room.drawPendingPlayerId!==p.id && !!room.drawn[room.drawPendingPlayerId];
    if(!isMyPrimaryTurn && !room.throwOpen && !drawPendingForOther) throw new Error('You can only throw on your turn, or throw a matching card while another player is deciding.');
    const c=p.hand[index],top=room.pile.at(-1);
    if(drawPendingForOther && !sameRank(c,top)) throw new Error('Another player is deciding. You may only throw a face-down card that matches the discard pile.');
    if(sameRank(c,top)){
      p.hand.splice(index,1);
      log(room, isMyPrimaryTurn ? `✅ ${p.name} correctly threw ${label(c)} onto ${label(top)}.` : `⚡ ${p.name} threw ${label(c)} into the window onto ${label(top)}.`);
      emitAction(room,{type:'throw',actorId:p.id,actorName:p.name});
      if(emptyWin(room)) return emitRoom(room);
      if(isMyPrimaryTurn) finishHumanAction(room); else emitRoom(room);
    }else{
      p.hand.splice(index,1);p.hand.push(c,top);
      log(room,`❌ ${p.name} made a wrong throw. ${label(c)} was revealed and both cards were taken.`);
      emitAction(room,{type:'wrongThrow',actorId:p.id,actorName:p.name});
      for(const viewer of connectedHumans(room))io.to(viewer.socketId).emit('publicReveal',{name:p.name,thrown:cardPublic(c),pile:cardPublic(top),seconds:4});
      emitRoom(room);
      if(isMyPrimaryTurn) setTimeout(()=>{if(!room.ended&&room.turn===playerIndex(room,p.id))finishHumanAction(room)},4050);
    }
  }catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('knock',()=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket);if(room.drawn[p.id])throw new Error('Finish your drawn card first.');if(room.knocked)throw new Error('Someone already knocked.');beginKnock(room,p);finishNewKnock(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('beginAbility',()=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket),c=room.drawn[p.id];if(!c||!specialRanks.has(c.r))throw new Error('Draw a special card first.');beginAbility(room,p,c);emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('abilityLookOwn',({index}={})=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket),a=room.abilityPending;if(!a||a.ownerId!==p.id||!['8','9','10'].includes(a.rank))throw new Error('Choose an 8, 9 or 10 ability first.');const c={r:a.rank,s:'S'};if(!Number.isInteger(index)||index<0||index>=p.hand.length)throw new Error('Invalid card position.');log(room,`${p.name} used ${c.r} to look at position ${index+1}.`);emitAction(room,{type:'ability',actorId:p.id,actorName:p.name,ability:c.r,status:`${p.name} Used ${c.r} Ability`});a.stage='reveal';socket.emit('reveal',{kind:'own',cards:[{owner:p.name,index,card:cardPublic(p.hand[index])}],seconds:4});emitRoom(room);setTimeout(()=>{if(!room.ended&&room.turn===playerIndex(room,p.id)){room.abilityPending=null;finishHumanAction(room);}},4050);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('abilityJack',({ownIndex,targetId,targetIndex}={})=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket),o=playerById(room,targetId),a=room.abilityPending;if(!a||a.ownerId!==p.id||a.rank!=='J')throw new Error('Choose the Jack ability first.');const c={r:'J',s:'S'};if(!o||o===p||ownIndex<0||targetIndex<0||ownIndex>=p.hand.length||targetIndex>=o.hand.length)throw new Error('Invalid card position.');emitAction(room,{type:'ability',actorId:p.id,actorName:p.name,ability:'J',status:`${p.name} Used Jack Ability`});[p.hand[ownIndex],o.hand[targetIndex]]=[o.hand[targetIndex],p.hand[ownIndex]];log(room,`${p.name} used Jack to blindly switch with ${o.name}.`);room.abilityPending=null;finishHumanAction(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('abilityViewPair',({ownIndex,targetId,targetIndex}={})=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket),o=playerById(room,targetId),a=room.abilityPending;if(!a||a.ownerId!==p.id||!['Q','K'].includes(a.rank))throw new Error('Choose the Queen or King ability first.');const c={r:a.rank,s:'S'};if(!o||o===p||ownIndex<0||targetIndex<0||ownIndex>=p.hand.length||targetIndex>=o.hand.length)throw new Error('Invalid card position.');emitAction(room,{type:'ability',actorId:p.id,actorName:p.name,ability:c.r,status:`${p.name} Used ${c.r} Ability`});room.abilityPending.stage='reveal';room.pendingKing=c.r==='K'?{ownerId:p.id,targetId:o.id,ownIndex,targetIndex}:null;log(room,`${p.name} used ${c.r} to inspect two cards.`);socket.emit('reveal',{kind:c.r==='K'?'king':'queen',cards:[{owner:p.name,index:ownIndex,card:cardPublic(p.hand[ownIndex])},{owner:o.name,index:targetIndex,card:cardPublic(o.hand[targetIndex])}],seconds:4,canSwitch:c.r==='K'});emitRoom(room);setTimeout(()=>{if(room.ended||room.turn!==playerIndex(room,p.id))return;if(c.r==='Q'){room.pendingKing=null;room.abilityPending=null;finishHumanAction(room);}},4050);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('kingChoice',({switchCards}={})=>{try{const room=roomForSocket(socket),p=ensureTurn(room,socket);const k=room.pendingKing;if(!k||k.ownerId!==p.id)throw new Error('No pending King action.');const o=playerById(room,k.targetId);if(switchCards){[p.hand[k.ownIndex],o.hand[k.targetIndex]]=[o.hand[k.targetIndex],p.hand[k.ownIndex]];log(room,`${p.name} used King to switch the exact two cards they inspected.`);}else log(room,`${p.name} kept the exact two cards they inspected.`);room.pendingKing=null;room.abilityPending=null;finishHumanAction(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('sendChat',({text}={})=>{try{const room=roomForSocket(socket),p=room?.players.find(x=>x.socketId===socket.id);if(!room||!p)throw new Error('Join a room first.');const msg=addRoomChat(room,p.name,text);if(!msg)throw new Error('Message is empty.');emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('sendPrivateChat',({toId,text}={})=>{try{const room=roomForSocket(socket),from=room?.players.find(x=>x.socketId===socket.id),to=room?.players.find(x=>x.id===toId);if(!room||!from||!to)throw new Error('Choose a player first.');if(to.ai)throw new Error('AI players do not accept private messages.');const msg=addRoomChat(room,from.name,text,'private',to.id);if(!msg)throw new Error('Message is empty.');for(const id of [from.id,to.id]){const target=playerById(room,id);if(target?.socketId)io.to(target.socketId).emit('privateChat',msg);}}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('state',()=>{const room=roomForSocket(socket);if(room)socket.emit('state',publicState(room,socket.id));});
  socket.on('leaveRoom',()=>{try{const room=roomForSocket(socket);if(!room)return;const p=room.players.find(x=>x.socketId===socket.id);if(!p) return;if(room.drawPendingPlayerId===p.id) clearDrawTimer(room); if(room.abilityPending?.ownerId===p.id) room.abilityPending=null;
  room.players=room.players.filter(x=>x.id!==p.id);if(room.hostId===p.id){const next=room.players.find(x=>!x.ai)||room.players[0];if(next)room.hostId=next.id;}socket.leave(room.code);socket.data.playerId=null;if(room.players.length===0){rooms.delete(room.code);return;}log(room,`${p.name} left the room.`);emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('roomSettings',({roomTitle}={})=>{try{const room=roomForSocket(socket);if(!room)throw new Error('Join a room first.');if(room.hostId!==socket.data.playerId)throw new Error('Only the host can edit room settings.');room.title=String(roomTitle||'').trim().slice(0,32)||room.code;log(room,`Room settings updated.`);emitRoom(room);}catch(e){socket.emit('errorMsg',e.message)}});
  socket.on('disconnect',()=>{for(const room of rooms.values()){const p=room.players.find(x=>x.socketId===socket.id);if(!p)continue;p.socketId=null;if(!p.ai){log(room,`${p.name} disconnected.`);if(room.hostId===p.id){const next=room.players.find(x=>!x.ai&&x.socketId);if(next){room.hostId=next.id;log(room,`${next.name} is now the host.`);}}emitRoom(room);}}});
});

app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));
const PORT=process.env.PORT||3000;
server.listen(PORT,'0.0.0.0',()=>console.log(`Switchie running on http://localhost:${PORT}`));
