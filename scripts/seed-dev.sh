#!/usr/bin/env bash
# Seed script for local development.
# Creates three test users (admin, host, viewer) and sets their roles.
#
# Prerequisites: auth-worker must be running (pnpm dev).
# Usage: pnpm db:seed
#
# Idempotent — safe to run multiple times; existing users are skipped.

set -euo pipefail

AUTH_URL="${AUTH_WORKER_URL:-http://localhost:8788}"

create_user() {
  local email="$1" password="$2" name="$3"

  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${AUTH_URL}/api/auth/sign-up/email" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"name\":\"${name}\"}")

  if [ "$status" = "200" ]; then
    echo "  Created ${email}"
  elif [ "$status" = "422" ] || [ "$status" = "409" ]; then
    echo "  Skipped ${email} (already exists)"
  else
    echo "  Warning: ${email} returned HTTP ${status}"
  fi
}

echo "Seeding dev users..."
echo ""

# Create users via auth-worker API
create_user "admin@example.com" "password" "Admin User"
create_user "host@example.com" "password" "Host User"
create_user "viewer@example.com" "password" "Viewer User"

echo ""
echo "Setting roles via D1..."

# Set roles directly in D1 (auth-worker's local database)
cd "$(dirname "$0")/../workers/auth-worker"

npx wrangler d1 execute AUTH_DB --local \
  --command "UPDATE user SET role = 'admin' WHERE email = 'admin@example.com'" 2>/dev/null

npx wrangler d1 execute AUTH_DB --local \
  --command "UPDATE user SET role = 'host' WHERE email = 'host@example.com'" 2>/dev/null

# viewer@example.com already has 'viewer' as default

echo "Done! Test accounts:"
echo "  admin@example.com / password  (admin)"
echo "  host@example.com  / password  (host)"
echo "  viewer@example.com / password (viewer)"
