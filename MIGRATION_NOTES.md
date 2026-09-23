# Architecture 1 migration

This branch moves Switchie toward the requested architecture without throwing away the existing working game.

## Current structure

- React + TypeScript + Vite: `frontend/`
- UI component boundary: `frontend/src/components/`
- Pure game helpers: `frontend/src/game/`
- Animation layer: `frontend/src/animations/`
- Socket.IO client boundary: `frontend/src/multiplayer/`
- Shared card/rules types: `shared/`
- Node/Express + Socket.IO server: `server.js`
- Existing production UI preserved in `frontend/src/legacy/`

## Why there is a legacy layer

The existing Switchie UI is heavily DOM-driven. Rewriting the whole interface in one step would risk changing the visual design and game behavior. The compatibility layer lets the new React app own the page while the existing UI is migrated one surface at a time.

## Next migration order

1. React lobby
2. Opponent cards/player area
3. Deck + discard table
4. Player hand
5. Right-side panels
6. Modals/chat
7. Move all client game actions behind typed hooks
8. Move authoritative server game rules into a typed shared/server game engine
9. Remove `legacy/`

This keeps each step testable and avoids another black-screen rewrite.
