#!/usr/bin/env bash
#
# One-time server setup script.
#
# Run this ONCE on the physical server after cloning the repo and before the
# first CI/CD deploy. It generates RSA keys, creates the .env file, starts all
# services, creates the Postgres publication, and pushes the Prisma schema.
#
# Usage:
#   cd /opt/fitso/server
#   bash scripts/setup.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  Fitso Server Setup"
echo "=========================================="

# --- 1. Generate RSA keys for JWT signing ---
echo ""
echo "[1/5] Generating RSA key pair for JWT signing..."
mkdir -p "$SERVER_DIR/keys"
if [ -f "$SERVER_DIR/keys/jwt-private.pem" ]; then
  echo "  Keys already exist — skipping generation."
  echo "  (Delete server/keys/ and re-run if you want to regenerate)"
else
  openssl genrsa -out "$SERVER_DIR/keys/jwt-private.pem" 2048
  openssl rsa -in "$SERVER_DIR/keys/jwt-private.pem" -pubout -out "$SERVER_DIR/keys/jwt-public.pem"
  echo "  Keys generated."
fi

# --- 2. Update service.yaml with the public key modulus ---
echo ""
echo "[2/5] Updating PowerSync service.yaml with public key modulus..."
MODULUS=$(openssl rsa -in "$SERVER_DIR/keys/jwt-public.pem" -pubin -noout -modulus \
  | sed 's/Modulus=//' | tr -d ' \n' \
  | xxd -r -p | base64 | tr '+/' '-_' | tr -d '=')

if [ "$(uname)" = "Darwin" ]; then
  sed -i '' "s|n: \".*\"|n: \"$MODULUS\"|" "$SERVER_DIR/powersync/service.yaml"
else
  sed -i "s|n: \".*\"|n: \"$MODULUS\"|" "$SERVER_DIR/powersync/service.yaml"
fi
echo "  service.yaml updated."

# --- 3. Create .env if it doesn't exist ---
echo ""
echo "[3/5] Creating server/.env..."
if [ -f "$SERVER_DIR/.env" ]; then
  echo "  .env already exists — skipping."
else
  cat > "$SERVER_DIR/.env" << 'EOF'
PORT=3000
DATABASE_URL=postgresql://fitso:fitso-secret@postgres:5432/fitso?schema=public
POSTGRES_USER=fitso
POSTGRES_PASSWORD=fitso-secret
POSTGRES_DB=fitso
CADDY_HOST=:80
NODE_ENV=production
JWT_SECRET=fitso-dev-fallback-secret
EOF
  echo "  .env created."
fi

# --- 4. Start all services ---
echo ""
echo "[4/5] Starting Docker services..."
cd "$SERVER_DIR"
docker compose up -d --build

# Wait for Postgres to be healthy
echo "  Waiting for Postgres to be healthy..."
for i in $(seq 1 30); do
  if docker exec fitso-postgres pg_isready -U fitso -d fitso >/dev/null 2>&1; then
    echo "  Postgres is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  ERROR: Postgres did not become healthy in 60s."
    exit 1
  fi
  sleep 2
done

# --- 5. Create publication + push Prisma schema ---
echo ""
echo "[5/5] Setting up database..."
echo "  Creating PowerSync publication..."
docker exec fitso-postgres psql -U fitso -d fitso -c \
  "DO \$\$ BEGIN CREATE PUBLICATION powersync FOR ALL TABLES; EXCEPTION WHEN duplicate_object THEN null; END \$\$;" \
  2>/dev/null || echo "  Publication already exists."

echo "  Pushing Prisma schema..."
docker exec fitso-backend npx prisma db push --skip-generate 2>/dev/null || \
  echo "  WARNING: prisma db push failed — may need to run manually."

echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
echo "Services:"
docker compose ps
echo ""
echo "Next steps:"
echo "  - Verify backend:  curl http://localhost:3001/health"
echo "  - Verify PowerSync: curl http://localhost:8080/"
echo "  - Future deploys happen automatically via CI/CD on push to main"
