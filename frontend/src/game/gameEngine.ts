import { canPlayOn, type Card, type GameState } from '../../../shared/game';

/** Pure client-side game helpers. The server remains authoritative for multiplayer. */
export function isMyTurn(state: GameState | null) {
  if (!state || state.ended || !state.started || !state.playerId) return false;
  return state.players[state.turn]?.id === state.playerId;
}
export function canDraw(state: GameState | null) { return isMyTurn(state) && !state?.drawn && state.deckCount > 0; }
export function canPlayDrawn(state: GameState | null) { return isMyTurn(state) && !!state?.drawn && canPlayOn(state.pileTop, state.drawn); }
