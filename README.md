# Fitso

Monorepo for the Fitso fitness app.

## Structure

- `mobile/` — Expo + React Native phone app
- `server/` — Node.js backend server

## Mobile

```bash
cd mobile
npm install
npx expo start
```

## Server

```bash
cd server
npm start
```

Binds to `127.0.0.1:3000` by default. Override with `HOST` / `PORT` (e.g. `HOST=0.0.0.0` to reach it
from a device on the LAN). Only `GET`/`HEAD` are served.

### Endpoints

- `GET /health` — server health check
- `GET /api/today` — mock daily fitness metrics
