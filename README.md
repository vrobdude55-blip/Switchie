# Switchie

Real-time multiplayer hidden-card game with AI opponents, room management, room/private chat, animations, and a cinematic wood-and-felt table UI.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Room flow

Create a room, add AI or invite friends, edit the room name, then start the game. The host controls room settings.

## Deck recycling

When the draw pile becomes empty, all discard cards except the current top card are shuffled back into the draw pile automatically so play can continue.

## Deployment

Deploy as a Node/Express Web Service with `npm install` as the build command and `npm start` as the start command. The server uses the platform `PORT` environment variable and binds to `0.0.0.0`.
