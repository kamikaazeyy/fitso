# Fitso — Project Guide

## Architecture

Offline-first workout tracker. Mobile app writes to local SQLite (PowerSync),
which syncs bidirectionally with a self-hosted PowerSync server backed by
Postgres. A Fastify REST API handles auth, routine management, and sync upload.

### Services (docker-compose in `server/`)
- **postgres** — Postgres 17 with logical replication (`wal_level=logical`)
- **backend** — Fastify + Prisma REST API on port 3000 (mapped to host 3001)
- **powersync** — PowerSync sync server on port 8080
- **caddy** — Reverse proxy on port 80, routes `/powersync/*` → powersync, everything else → backend

### Mobile app (`mobile/`)
- Expo + React Native + Expo Router
- PowerSync v2 (`@powersync/react-native@2.1.0`) — OP-SQLite is built-in
- Zustand store (`src/store/useWorkoutSessionStore.ts`) for active session state
- MMKV for crash-recovery persistence
- React Query for cached reads from local SQLite

## Key commands

### Server (local dev)
```bash
cd server
docker compose up -d --build        # start all services (builds backend from Dockerfile)
docker compose down                  # stop all services
docker logs fitso-powersync -f       # watch sync logs
docker exec fitso-postgres psql -U fitso -d fitso  # psql shell
```

### Server (first-time setup on physical server)
```bash
cd /opt/fitso/server
bash scripts/setup.sh                # generates keys, .env, publication, schema
```

### Mobile
```bash
cd mobile
npx tsc --noEmit                     # typecheck
npx jest                             # run tests (33 tests)
npx expo start                       # start dev server
npx expo run:android                 # build and run on Android device
```

## Auth flow
1. Mobile calls `POST /api/auth/login` → Fastify returns RS256 JWT with `sub` (user UUID) and `aud: "powersync"`
2. JWT is stored in SecureStore and passed to `BackendConnector.setToken()`
3. PowerSync client connects to sync server using the JWT
4. Sync rules in `server/powersync/sync-config.yaml` scope data by `auth.user_id()`
5. JWT expires in 24h (PowerSync requires max 86400s)
6. On login, `AuthContext` sets the user id on the workout session store so `finishWorkout` writes the correct `user_id`

## Sync architecture

### Download (server → client)
PowerSync's sync protocol handles this automatically. Sync rules in
`server/powersync/sync-config.yaml` scope all 5 tables by `auth.user_id()`.

### Upload (client → server)
The mobile app's `BackendConnector.uploadData()` grabs pending CRUD operations
via `getCrudBatch()`, POSTs them to `POST /api/sync/upload` on the Fastify
backend, which applies them to Postgres via Prisma. The server:
- Maps snake_case SQLite columns → camelCase Prisma fields
- Coerces null to schema defaults for non-nullable fields (weight→0, reps→0)
- Transforms booleans (0/1 → true/false), arrays (JSON string → array), dates (ISO → Date)
- Overrides `userId` with the JWT-authenticated user for security
- Handles `PATCH` via upsert and `DELETE` P2025 (not found) as success

## Schema alignment
- **Postgres tables**: camelCase columns (Prisma convention) — `"Workout"`, `"userId"`, `"exerciseName"`
- **Local SQLite tables**: snake_case columns (PowerSync convention) — `workouts`, `user_id`, `exercise_name`
- **Sync rules** map between the two: `SELECT "userId" as user_id FROM "Workout"`
- **AppSchema** (`mobile/src/db/AppSchema.ts`) defines the local SQLite schema

## Sync rules
Defined in `server/powersync/sync-config.yaml`. All tables are `auto_subscribe: true`
and scoped by `auth.user_id()` either directly (routines, workouts) or via JOIN
(splits → routine, routine_exercises → split → routine, workout_sets → workout).

## Important files
- `server/index.js` — Fastify server with RS256 JWT auth + sync upload endpoint
- `server/prisma/schema.prisma` — Postgres schema
- `server/powersync/sync-config.yaml` — PowerSync sync rules
- `server/powersync/service.yaml` — PowerSync service config (includes RSA public key)
- `server/scripts/setup.sh` — one-time server setup script (keys, env, publication, schema)
- `server/.env.example` — documents all server env vars
- `mobile/src/db/AppSchema.ts` — local SQLite schema
- `mobile/src/db/BackendConnector.ts` — connects PowerSync client to sync server, uploads CRUD batches
- `mobile/src/db/PowerSyncProvider.tsx` — React provider + connect/disconnect helpers
- `mobile/src/db/database.ts` — PowerSync database singleton
- `mobile/src/store/useWorkoutSessionStore.ts` — Zustand store for active workouts (userId, splitId, MMKV persistence)
- `mobile/context/AuthContext.tsx` — auth state, sets userId on workout store
- `mobile/app/workout.tsx` — workout screen (uses store, not local useState)
- `mobile/src/hooks/useRoutines.ts` — reads routines from local SQLite
- `mobile/src/hooks/useWorkouts.ts` — reads workouts from local SQLite
- `mobile/src/hooks/useDashboard.ts` — reads recent workouts from local SQLite, nutrition from API

## Environment variables
- `server/.env` (gitignored) — `PORT`, `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `CADDY_HOST`, `NODE_ENV`, `JWT_SECRET`
- `server/.env.example` — documents all server vars
- `mobile/.env` (gitignored) — `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_POWERSYNC_URL`
- `mobile/.env.example` — documents mobile vars

## Postgres publication
PowerSync requires a publication for logical replication:
```sql
CREATE PUBLICATION powersync FOR ALL TABLES;
```
Created automatically by `server/scripts/setup.sh` or by CI/CD on deploy.

## RSA key pair
Generated at `server/keys/jwt-private.pem` and `server/keys/jwt-public.pem`
(gitignored). The public key modulus is embedded in
`server/powersync/service.yaml` under `client_auth.jwks.keys[0].n` with
`kid: fitso-jwt-key-1`. The `setup.sh` script generates the keys and updates
`service.yaml` automatically.

## CI/CD
`.github/workflows/backend.yml` triggers on push to `main` when `server/**` changes:
1. Builds the backend Docker image → pushes to GHCR (`ghcr.io/<owner>/fitso-backend:latest`)
2. SSHes into the physical server via Tailscale
3. Pulls the new image, restarts all services
4. Ensures the PowerSync publication exists (idempotent)
5. Runs `prisma db push` inside the backend container to sync the schema
6. Restarts PowerSync to pick up any sync-config changes

### GitHub Secrets required
- `TAILSCALE_CLIENT_ID` / `TAILSCALE_CLIENT_SECRET` — for Tailscale CI access
- `SERVER_HOST` — server's Tailscale IP or hostname
- `SERVER_USER` — SSH username
- `SERVER_SSH_KEY` — SSH private key
- `SERVER_SSH_PORT` — SSH port (optional, defaults to 22)

### One-time server setup (before first CI/CD deploy)
```bash
ssh user@<server-tailscale-ip>
cd /opt/fitso
git clone <repo-url> .
cd server
bash scripts/setup.sh
```
