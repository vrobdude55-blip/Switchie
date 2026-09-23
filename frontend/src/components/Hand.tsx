import type { MouseEvent } from 'react';
import type { Card as CardType } from '../../../shared/game';
import { Card } from './Card';

export type HandCard = CardType | null;

export type HandProps = {
  cards: HandCard[];
  selectedIndex?: number | null;
  playableIndices?: number[];
  pickableIndices?: number[];
  disabled?: boolean;
  onCardClick?: (index: number, card: HandCard, event: MouseEvent<HTMLDivElement>) => void;
};

/**
 * Small, focused React hand component. It preserves the existing .hand/.slot
 * layout and lets the parent own all game rules and state transitions.
 */
export function Hand({
  cards,
  selectedIndex = null,
  playableIndices = [],
  pickableIndices = [],
  disabled = false,
  onCardClick,
}: HandProps) {
  return (
    <div className="hand" aria-label="Your hand">
      {cards.map((card, index) => {
        const playable = playableIndices.includes(index);
        const pickable = pickableIndices.includes(index);
        const selected = selectedIndex === index;
        const clickable = !!onCardClick && !disabled && (playable || pickable || selected);

        return (
          <div
            className={`slot ${playable ? 'throwable' : ''} ${pickable ? 'pickable' : ''}`}
            key={`${index}-${card?.r ?? 'hidden'}-${card?.s ?? 'none'}`}
          >
            <Card
              card={card}
              faceDown={!card}
              selected={selected}
              playable={playable}
              pickable={pickable}
              disabled={!clickable}
              onClick={(clickedCard, event) => onCardClick?.(index, clickedCard, event)}
            />
            <div className="slotNum">{index + 1}</div>
          </div>
        );
      })}
    </div>
  );
}
