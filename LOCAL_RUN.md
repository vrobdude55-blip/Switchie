# Switchie local run

1. Unzip this project into `~/Documents/Switchie-next-pass` (or replace your existing local copy after backing it up).
2. In Terminal:

```bash
cd ~/Documents/Switchie-next-pass
npm install
npm run dev
```

3. Open `http://localhost:3000`.

This build keeps the Node.js + Express + Socket.IO architecture. The lockfile uses the public npm registry rather than Replit's internal package firewall URL.

The visual changes in this build are in `public/index.html`; the exported editor/layout metadata is in `switchie-layout.json`.
