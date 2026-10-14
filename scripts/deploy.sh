#!/bin/bash
# Pulls the latest code from GitHub and (re)starts all three containers.
# Run from anywhere:  bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only || echo "(git pull skipped)"

# Create .env with random passwords the first time (never committed to GitHub)
if [ ! -f .env ]; then
  echo "==> Creating .env with random passwords"
  cat > .env << ENVEOF
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
MYSQL_DATABASE=ramiza
MYSQL_USER=ramiza_user
MYSQL_PASSWORD=$(openssl rand -hex 16)
ENVEOF
  chmod 600 .env
fi

echo "==> Building and starting containers"
docker compose up -d --build

echo "==> Removing old unused images"
docker image prune -f >/dev/null

echo
docker compose ps
echo
echo "Wait ~30-60 seconds on the first run (MySQL initializes), then test:"
echo "  curl localhost/health"
echo "  curl localhost/api/health"
