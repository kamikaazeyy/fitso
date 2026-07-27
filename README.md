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

### Endpoints

- `GET /health` — server health check
- `GET /api/today` — mock daily fitness metrics
