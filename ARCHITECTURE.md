# Switchie architecture

Switchie intentionally stays dependency-light and free to run.

## Current stack

- Node.js + Express
- Socket.IO for multiplayer
- HTML/CSS for the existing visual design
- Vanilla JavaScript modules for client behavior
- Web Animations/CSS keyframes for card movement and transitions
- No paid services or animation libraries are required

## Frontend boundaries

`public/index.html` owns the markup and visual styling so the current table design stays intact.

`public/modules/game-animations.js` owns the visual card-motion/reveal effects. It receives the small set of state/UI functions it needs instead of reaching into the game's global state directly.

The remaining game/controller code keeps the existing behavior and Socket.IO event protocol. This lets the game be migrated into smaller modules incrementally without risking the current UI.

## Static/Bolt behavior

Bolt's static preview does not provide `/socket.io/socket.io.js`. The client now automatically enters the existing demo state whenever the Socket.IO client is unavailable, instead of crashing on `io(...)` and leaving the page black.

On Render, where Socket.IO is available, the normal multiplayer path is unchanged.

## Deployment

`npm run build` copies `public/` to `dist/` using `build.mjs`.

Do not commit `node_modules/` or generated local-only files unless intentionally required.
