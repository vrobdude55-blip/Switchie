export function createAnimations({ $, card, getState, getThrowCardIndex, getMode, setMode, render, showModal, closeModal, socket, esc }) {
function animateDraw(){
  if(window.__switchieDrawAnimating||!getState()?.drawn)return;
  const src=document.querySelector('#deck .card:last-child');
  const target=$('centerAction');
  if(!src||!target){setMode('drawnMenu');render();return}
  window.__switchieDrawAnimating=true;
  target.classList.add('drawTransitHide');
  const a=src.getBoundingClientRect();
  const b=target.getBoundingClientRect();
  const el=document.createElement('div');
  el.className='fly smoothDraw';
  el.innerHTML=card(null,true);
  const startX=a.left+a.width/2-36;
  const startY=a.top+a.height/2-50;
  const endX=b.left+b.width/2-36;
  const endY=b.top+b.height*.12;
  el.style.left=startX+'px';
  el.style.top=startY+'px';
  el.style.setProperty('--tx',(endX-startX)+'px');
  el.style.setProperty('--ty',(endY-startY)+'px');
  el.style.setProperty('--dx',((endX-startX)*.42)+'px');
  el.style.setProperty('--dy',((endY-startY)-75)+'px');
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.getBoundingClientRect());
  setTimeout(()=>{
    el.remove();
    window.__switchieDrawAnimating=false;
    target.classList.remove('drawTransitHide');
    setMode('drawnMenu');
    render();
    target.classList.add('actionPing');
    setTimeout(()=>target.classList.remove('actionPing'),700);
  },1080);
}
function actionPointForPlayer(actorId){
  if(actorId===getState()?.playerId){
    const slot=document.querySelector('#hand .slot:last-child');
    return slot || $('centerAction');
  }
  return document.querySelector(`.opp[data-pid="${CSS.escape(actorId||'')}"] .miniBack:last-child`) || document.querySelector(`.opp[data-pid="${CSS.escape(actorId||'')}"]`) || $('topOpps');
}
function animateRemoteAction(a){
  if(!a||a.actorId===getState()?.playerId)return;
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
  if(getThrowCardIndex()===null)return;
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

  return { animateDraw, actionPointForPlayer, animateRemoteAction, animateThrowFlourish, revealCard };
}
