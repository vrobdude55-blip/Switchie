export const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const;
export const SUITS = ['S','H','D','C'] as const;
export type Rank = typeof RANKS[number];
export type Suit = typeof SUITS[number];
export type Card = { r: Rank; s: Suit };
export type PlayerState = { id: string; name: string; ai: boolean; connected: boolean; handCount: number };
export type GameState = { code: string; title: string; hostId: string; started: boolean; turn: number; ended: boolean; winner: string | null; pileTop: Card | null; deckCount: number; drawn: Card | null; players: PlayerState[]; playerId: string | null };
export const SPECIAL_RANKS = new Set<Rank>(['8','9','10','J','Q','K']);
export function sameRank(a?: Card | null, b?: Card | null) { return !!a && !!b && a.r === b.r; }
export function cardValue(card: Card, faceDown = true) { if (card.r === 'A') return 1; if (card.r === 'J') return 11; if (card.r === 'Q') return 12; if (card.r === 'K') return card.s === 'D' && faceDown ? -1 : 13; return Number(card.r); }
export function canPlayOn(discard: Card | null, card: Card) { return !discard || discard.r === card.r || discard.s === card.s; }
