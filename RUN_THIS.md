# Switchie — polished overlay pass

## Run locally

Open Terminal 1:

```bash
cd ~/Documents/Switchie-next-pass
npm install
npm run dev:server
```

Leave it running.

Open Terminal 2:

```bash
cd ~/Documents/Switchie-next-pass
npm run dev:client
```

Open:

```text
http://localhost:5173/
```

Card migration test:

```text
http://localhost:5173/?card-test=1
```

## What changed

- Card Values + Special Cards moved to the left side.
- Game Log remains on the right side.
- Removed the separate Throw Your Cards countdown ring.
- Throw countdown is now shown inside the tilted Your Turn overlay.
- Removed the bottom Use Ability / Throw Card / Replace Card / Knock action bar.
- Hidden the old Current Card Ability / Knock / status overlays.
- Rounded and softened overlay geometry, borders and shadows.
- Menu selections use the warm serif styling from the supplied reference.
- Your Turn overlay uses a perspective/back-pushed tilt.
- Deck and discard pile have stronger perspective and physical depth.
- Face-down hand cards remain clickable.
- The existing table background PNG was not edited or replaced.
