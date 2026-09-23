# Switchie Architecture 1

Switchie now has a React + TypeScript frontend boundary while preserving the existing game UI during migration.

- `frontend/src/components`: React UI components.
- `frontend/src/animations`: reusable animation layer.
- `frontend/src/game`: pure client game helpers.
- `frontend/src/multiplayer`: Socket.IO client boundary.
- `shared`: shared card/game types and pure rules.
- `server.js`: authoritative Node/Express + Socket.IO backend.
- `frontend/src/legacy`: compatibility layer for the current production UI; this is intentionally temporary so the visual design is not changed during migration.

The next migration steps are to replace `LegacySwitchie` sections one at a time with React components, then move authoritative game rules into `server/game` and shared types.

## Local development

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:5173`

For a separate backend URL, set `VITE_SOCKET_URL`.
