#!/bin/bash
# Run this inside the Apache Docker container to deploy updates:
#   docker exec -it <container_name> bash /var/www/html/update_site.sh

set -e
cd /var/www/html

echo "==> Pulling latest changes..."
git pull origin main

echo "==> Installing any new dependencies..."
pnpm install

echo "==> Rebuilding site..."
pnpm run build

echo "==> Done. Site updated."
