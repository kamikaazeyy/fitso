# Fitso — Project Guide

## Architecture

Offline-first workout tracker. Mobile app writes to local SQLite (PowerSync),
which syncs bidirectionally with a self-hosted PowerSync server backed by
Postgres. A Fastify REST API handles auth and routine management.

### Services (docker-compose in `server/`)
- **postgres** — Postgres 16 with logical replication (`wal_level=logical`)
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

### Server
```bash
cd server
docker compose up -d --build        # start all services
docker compose down                  # stop all services
docker logs fitso-powersync -f       # watch sync logs
docker exec fitso-postgres psql -U fitso -d fitso  # psql shell
```

### Mobile
```bash
cd mobile
npx tsc --noEmit                     # typecheck
npx jest                             # run tests (31 tests)
npx expo start                       # start dev server
```

## Auth flow
1. Mobile calls `POST /api/auth/login` → Fastify returns RS256 JWT with `sub` (user UUID) and `aud: "powersync"`
2. JWT is stored in SecureStore and passed to `BackendConnector.setToken()`
3. PowerSync client connects to sync server using the JWT
4. Sync rules in `server/powersync/sync-config.yaml` scope data by `auth.user_id()`
5. JWT expires in 24h (PowerSync requires max 86400s)

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
- `server/index.js` — Fastify server with RS256 JWT auth
- `server/prisma/schema.prisma` — Postgres schema
- `server/powersync/sync-config.yaml` — PowerSync sync rules
- `server/powersync/service.yaml` — PowerSync service config
- `mobile/src/db/AppSchema.ts` — local SQLite schema
- `mobile/src/db/BackendConnector.ts` — connects PowerSync client to sync server
- `mobile/src/db/PowerSyncProvider.tsx` — React provider + connect/disconnect helpers
- `mobile/src/db/database.ts` — PowerSync database singleton
- `mobile/src/store/useWorkoutSessionStore.ts` — Zustand store for active workouts
- `mobile/app/workout.tsx` — workout screen (uses store, not local useState)
- `mobile/src/hooks/useRoutines.ts` — reads routines from local SQLite
- `mobile/src/hooks/useWorkouts.ts` — reads workouts from local SQLite
- `mobile/src/hooks/useDashboard.ts` — reads recent workouts from local SQLite, nutrition from API

## Environment variables
- `server/.env` — `DATABASE_URL`, `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH`, `JWT_AUDIENCE`, `CADDY_HOST`
- `mobile/.env.example` — `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_POWERSYNC_URL`

## Postgres publication
PowerSync requires a publication for logical replication:
```sql
CREATE PUBLICATION powersync FOR ALL TABLES;
```
This was created manually after the first `docker compose up`.

## RSA key pair
Generated at `server/keys/private_key.pem` and `server/keys/public_key.pem`.
The public key is also referenced in `server/powersync/service.yaml` under
`jwt.keys` with `kid: fitso-jwt-key-1`.
