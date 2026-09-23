import { useState } from 'react';
import type { Card as CardType } from '../../../shared/game';
import { Card } from './Card';

const samples: CardType[] = [
  { r: '7', s: 'S' },
  { r: '10', s: 'H' },
  { r: 'J', s: 'D' },
  { r: 'Q', s: 'C' },
  { r: 'K', s: 'H' },
];

/** Temporary opt-in test surface for the Card migration. Click a card to flip it face-down; click again to reveal it. */
export function CardMigrationPreview() {
  const [faceDown, setFaceDown] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [lastClicked, setLastClicked] = useState('Nothing selected');

  return (
    <main className="reactMigrationPreview">
      <h1>Switchie Card Migration Test</h1>
      <p>Click any card to flip it face-down. Click it again to reveal it.</p>
      <div className="reactMigrationCards">
        {samples.map((card, index) => {
          const hidden = !!faceDown[index];
          return (
            <Card
              key={`${card.r}-${card.s}`}
              card={card}
              faceDown={hidden}
              selected={!hidden && selected === index}
              playable
              onClick={(clicked) => {
                setFaceDown((current) => ({ ...current, [index]: !current[index] }));
                setSelected(hidden ? null : index);
                setLastClicked(
                  hidden
                    ? `Revealed ${card.r}${card.s}`
                    : `Flipped ${clicked ? `${clicked.r}${clicked.s}` : 'card'} face-down`,
                );
              }}
            />
          );
        })}
      </div>
      <p aria-live="polite">{lastClicked}</p>
    </main>
  );
}
