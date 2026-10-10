# GitHub Actions workflows

## `backend.yml`

Validates and deploys the Fitso API — a Cloudflare Worker (`fitso-api` in
`server/worker/`) backed by Supabase Postgres through a Hyperdrive binding.

- On every pull request to `main` that touches `server/worker/**` or
  `server/prisma/**`: bundles the Worker with `wrangler deploy --dry-run` and
  validates the Prisma schema. Nothing is deployed.
- On every push to `main` that touches those paths (or via manual dispatch):
  1. Runs `npx prisma db push` against Supabase so the schema stays in sync.
  2. Runs `npx wrangler deploy` to ship the Worker.

### Required GitHub secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts: Edit** on the account. Create at dash.cloudflare.com → My Profile → API Tokens. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (dashboard right sidebar). |
| `SUPABASE_DATABASE_URL` | Postgres URL used by `prisma db push`. Use the Supabase **session pooler** (port 5432) or a direct connection — NOT the transaction pooler (port 6543) that Hyperdrive uses. Schema push is skipped if unset. |

Worker runtime secrets (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`) are stored in
Cloudflare, not GitHub — see below.

### One-time Cloudflare setup

```bash
cd server/worker
wrangler login                    # or export CLOUDFLARE_API_TOKEN
wrangler secret put JWT_PRIVATE_KEY   # paste contents of server/keys/jwt-private.pem
wrangler secret put JWT_PUBLIC_KEY    # paste contents of server/keys/jwt-public.pem
```

The Hyperdrive binding (`HYPERDRIVE` → Supabase transaction pooler) is already
configured in `wrangler.toml` and requires no CI secrets.

## `mobile-ota.yml`

Publishes an EAS Update (OTA) for the mobile app. Unrelated to the backend
deploy — see the file header for details.
