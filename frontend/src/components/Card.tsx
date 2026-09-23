import { motion } from 'framer-motion';
import type { MouseEvent } from 'react';
import type { Card as CardType } from '../../../shared/game';

const suit: Record<CardType['s'], string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export type CardProps = {
  card: CardType | null;
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  pickable?: boolean;
  disabled?: boolean;
  size?: 'normal' | 'small' | 'tiny';
  className?: string;
  onClick?: (card: CardType | null, event: MouseEvent<HTMLDivElement>) => void;
};

/**
 * React version of Switchie's existing card.
 * Visual styling intentionally reuses the existing .card CSS so the migration
 * does not change the current game's appearance.
 */
export function Card({
  card,
  faceDown = false,
  selected = false,
  playable = false,
  pickable = false,
  disabled = false,
  size = 'normal',
  className = '',
  onClick,
}: CardProps) {
  const isRed = !!card && (card.s === 'H' || card.s === 'D');
  const isPrinted = !!card && ['J', 'Q', 'K'].includes(card.r);
  const sizeClass = size === 'small' ? 'small' : size === 'tiny' ? 'tiny' : '';
  const stateClass = [
    faceDown ? 'back' : 'face',
    isRed ? 'red' : '',
    isPrinted && !faceDown ? 'printedFace' : '',
    playable ? 'throwable' : '',
    pickable ? 'pickable' : '',
    selected ? 'selected' : '',
    disabled ? 'disabled' : '',
    sizeClass,
    className,
  ].filter(Boolean).join(' ');

  const label = faceDown || !card ? 'Hidden card' : `${card.r}${suit[card.s]}`;

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (disabled || !onClick) return;
    onClick(card, event);
  }

  return (
    <motion.div
      className={`card ${stateClass}`}
      role={onClick && !disabled ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-label={label}
      aria-pressed={selected || undefined}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onClick && !disabled) {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: selected ? -8 : 0, scale: selected ? 1.025 : 1 }}
      whileHover={disabled ? undefined : { y: -8, scale: 1.035 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      {faceDown ? (
        <img
          className="cardBackImg"
          src="/cards/card_back_print.png"
          alt=""
          draggable={false}
        />
      ) : (
        <>
          <div className="corner">
            {card?.r}
            <br />
            {card ? suit[card.s] : ''}
          </div>
          {isPrinted && card ? (
            <img
              className="facePrint"
              src={`/cards/${card.r.toLowerCase()}_art.png`}
              alt=""
              draggable={false}
            />
          ) : null}
          <div className="suit">{card ? suit[card.s] : ''}</div>
          <div className="corner rot">
            {card?.r}
            <br />
            {card ? suit[card.s] : ''}
          </div>
        </>
      )}
    </motion.div>
  );
}

/** Backwards-compatible name for the first migration version. */
export const AnimatedCard = Card;
