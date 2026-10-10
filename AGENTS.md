# Fitso — Project Guide

## Architecture

Offline-first workout tracker. Mobile app writes to local SQLite (PowerSync),
which syncs bidirectionally with a PowerSync Cloud instance backed by Supabase
Postgres. A Cloudflare Worker (`fitso-api` in `server/worker/`) handles auth,
routine management, and sync upload, reaching Supabase through a Hyperdrive
binding.

### Services
- **Cloudflare Worker** (`server/worker/`) — production REST API
  (`fitso-api.<account>.workers.dev`), raw SQL via `postgres` + Hyperdrive
- **Supabase** — managed Postgres; transaction pooler (port 6543) via Hyperdrive
  for the Worker, session pooler (port 5432)/direct for `prisma db push`
- **PowerSync Cloud** — managed sync instance; sync rules come from
  `server/powersync/sync-config.yaml`, JWT client auth via static JWKS
- **docker-compose** (`server/`) — legacy self-hosted stack (Postgres, Fastify,
  PowerSync, Caddy), still usable for local dev

### Cloudflare Worker (`server/worker/`)
A Workers port of the Fastify backend (`fitso-api`), deployed at
`https://fitso-api.pranavmehrotra528.workers.dev`. Same endpoints, same JWTs.

- Fastify → tiny router in `src/index.js`; Prisma → `postgres` (postgres.js)
  raw SQL over a **Hyperdrive** binding (`env.HYPERDRIVE`)
- `jsonwebtoken` → WebCrypto RS256 in `src/lib/jwt.js` (keys are PKCS#8/SPKI)
- bcryptjs → PBKDF2-SHA256 @100k iters via WebCrypto (`src/lib/password.js`) —
  bcrypt burns the Free-plan CPU budget; bcrypt hashes still verify as a
  legacy fallback. Note: workerd caps PBKDF2 at 100k iterations.
- `/api/sync/upload` logic lives in `src/sync.js` (same table/column maps and
  ownership checks as the Fastify version)
- Monitor endpoints (`/api/monitor/*`) were NOT ported — they read host
  metrics (/proc, docker, systemctl) which don't exist on Workers
- Postgres is on **Supabase**. Hyperdrive MUST point at the **session pooler**
  (port 5432) — the transaction pooler (6543) drops session state and hangs
  postgres.js connections. Connection string also needs `sslmode=require`.
- Deploy: `cd server/worker && npx wrangler deploy`
- Secrets set via `wrangler secret put`: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
- The Supabase connection string lives in `server/.env` as
  `SUPABASE_DATABASE_URL` (gitignored) — its password contains a raw `@`,
  percent-encode it before passing to `wrangler hyperdrive`

### Mobile app (`mobile/`)
- Expo + React Native + Expo Router
- PowerSync v2 (`@powersync/react-native@2.1.0`) — OP-SQLite is built-in
- Zustand store (`src/store/useWorkoutSessionStore.ts`) for active session state
- MMKV for crash-recovery persistence
- React Query for cached reads from local SQLite

## Key commands

### Worker (server/worker)
```bash
cd server/worker
npx wrangler dev                       # local dev server (port 8787)
npx wrangler deploy                    # manual deploy (CI deploys on main pushes)
npx wrangler secret put JWT_PRIVATE_KEY  # set runtime secrets
npx wrangler tail                      # live production logs
```

### Legacy server (local dev)
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
1. Mobile calls `POST /api/auth/login` → the Worker returns an RS256 session JWT with `sub` (user UUID) and `aud: "powersync"` (7-day expiry)
2. JWT is stored in SecureStore and passed to `BackendConnector.setToken()`
3. `BackendConnector.fetchCredentials()` exchanges the session JWT for a 24h sync token via `POST /api/auth/sync-token` — PowerSync rejects tokens whose iat→exp span exceeds 86400s (PSYNC_S2104), so the 7d session token cannot be used on the sync stream directly
4. PowerSync client connects to sync server using the sync token
5. Sync rules in `server/powersync/sync-config.yaml` scope data by `auth.user_id()`
6. `POST /api/auth/refresh` mints a fresh session token from a still-valid one; the axios client retries one refresh on 401 and `AuthContext` refreshes proactively when < 24h remains
7. On login, `AuthContext` sets the user id on the workout session store so `finishWorkout` writes the correct `user_id`

## Sync architecture

### Download (server → client)
PowerSync's sync protocol handles this automatically. Sync rules in
`server/powersync/sync-config.yaml` scope all 6 synced tables by
`auth.user_id()` (routines, splits, routine_exercises, workouts,
workout_sets, custom_exercises). A seventh local table, `exercise_cache`,
is `localOnly` — a client-side wger catalogue cache that never syncs.

### Upload (client → server)
The mobile app's `BackendConnector.uploadData()` grabs pending CRUD operations
via `getCrudBatch()`, POSTs them to `POST /api/sync/upload` on the fitso-api
Worker, which applies them to Supabase Postgres via raw SQL (`src/sync.js`).
The server:
- Applies the whole batch in a single transaction (all-or-nothing; client retries on failure)
- Maps snake_case SQLite columns → camelCase Prisma fields
- Coerces null to schema defaults for non-nullable fields (weight→0, reps→0)
- Transforms booleans (0/1 → true/false), arrays (JSON string → array), dates (ISO → Date)
- Overrides `userId` with the JWT-authenticated user for security
- Verifies row ownership before every write — child tables (workout_sets, splits,
  routine_exercises) are checked via their parent chain, so a client can't write
  to another user's rows
- Handles `PATCH` as update-only (P2025 = success) and `DELETE` P2025 (not found) as success

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
- `server/worker/src/index.js` — production API (Cloudflare Worker, RS256 JWT auth + sync upload)
- `server/worker/wrangler.toml` — Worker config + Hyperdrive binding to Supabase
- `server/index.js` — legacy Fastify server (same endpoints, Prisma)
- `server/prisma/schema.prisma` — Postgres schema
- `server/powersync/sync-config.yaml` — PowerSync sync rules
- `server/powersync/service.yaml` — PowerSync service config (includes RSA public key)
- `server/scripts/setup.sh` — one-time server setup script (keys, env, publication, schema)
- `server/.env.example` — documents all server env vars
- `mobile/src/db/AppSchema.ts` — local SQLite schema
- `mobile/src/db/BackendConnector.ts` — connects PowerSync client to sync server, uploads CRUD batches
- `mobile/src/db/PowerSyncProvider.tsx` — React provider + connect/disconnect helpers
- `mobile/src/db/database.ts` — PowerSync database singleton
- `mobile/src/store/useWorkoutSessionStore.ts` — Zustand store for active workouts (userId, splitId, MMKV persistence); `finishWorkout` also writes completed-session data back into the routine template (`src/utils/routineSync.ts` — adds/updates only, never deletes template rows)
- `mobile/src/store/useSettingsStore.ts` — kg/lb unit + rest/bar defaults (MMKV); weight is canonically stored in kg, converted at display/input via `src/utils/units.ts`
- `mobile/src/hooks/useRoutineMutations.ts` — routine/split/exercise CRUD (edit, delete, duplicate, multi-split)
- `mobile/src/services/exerciseCache.ts` — wger catalogue prefetch into `exercise_cache` (7-day staleness) so the picker works offline; custom exercises live in synced `custom_exercises`
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
`.github/workflows/backend.yml` triggers on push to `main` when `server/worker/**`
or `server/prisma/**` changes (PRs run the same bundle/schema checks without deploying):
1. Bundles the Worker (`wrangler deploy --dry-run`) and validates `schema.prisma`
2. Runs `prisma db push` against Supabase (idempotent schema sync)
3. Deploys `fitso-api` to Cloudflare Workers via `wrangler deploy`

The production backend is a Cloudflare Worker (`server/worker/`) backed by
Supabase Postgres through a Hyperdrive binding. The Docker Compose stack in
`server/` is the legacy self-hosted deployment, still usable for local dev.

### GitHub Secrets required
- `CLOUDFLARE_API_TOKEN` — API token with Workers Scripts:Edit on the account
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `SUPABASE_DATABASE_URL` — Postgres URL for `prisma db push`; use the Supabase
  session pooler (port 5432) or direct connection, not the transaction pooler
  (6543) that Hyperdrive uses. Schema push is skipped if unset.

### One-time Cloudflare setup (before first CI/CD deploy)
```bash
cd server/worker
wrangler login                          # or export CLOUDFLARE_API_TOKEN
wrangler secret put JWT_PRIVATE_KEY     # contents of server/keys/jwt-private.pem
wrangler secret put JWT_PUBLIC_KEY      # contents of server/keys/jwt-public.pem
```
The Hyperdrive binding (`HYPERDRIVE` → Supabase transaction pooler) is already
configured in `wrangler.toml`.
