# Switchie

Polished online multiplayer card game with AI, private rooms, room chat, private player-to-player chat, smooth card animations, and a single-screen casino-style interface.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Multiplayer

Create a room, share the room code/invite link, add AI, and start the game. AI players are server-controlled and remain shown as connected. Human players can reconnect using their stored player identity while the room is still in memory.

## Chat

- **Room Chat** is visible to everyone in the room.
- **Private** chat lets one human player message another human player.

## UI

The game is designed as a single-screen, no-scroll casino/tabletop interface with dark wood, green felt, gold trim, neutral placeholder avatars, ornate card backs, animated piles, centered reveal modals, and smooth card transitions.

## Deployment

This is a Node/Express + Socket.IO server. Deploy it to a host that supports long-lived WebSocket connections, such as Render, Railway, Fly.io, or a VPS. The server binds to `0.0.0.0` and uses the `PORT` environment variable.

## State/security

Cards remain on the server. Hidden cards are not sent to other players. Ability reveals are sent only to the player entitled to see them. Wrong throws are intentionally revealed to everyone. Room state is in memory, so a server restart clears active rooms/games.
