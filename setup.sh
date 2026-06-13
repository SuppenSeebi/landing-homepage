#!/bin/bash
# First-time setup for the sschw.dev landing page.
# Run this ONCE inside the Apache Docker container:
#   docker exec -it <container_name> bash /var/www/html/setup.sh

set -e
cd /var/www/html

echo "==> Installing Node.js 22 (via NodeSource)..."
apt-get update -q
apt-get install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "==> Installing pnpm..."
npm install -g pnpm

echo "==> Installing project dependencies..."
pnpm install --no-frozen-lockfile

echo "==> Building site..."
pnpm run build

echo "==> Configuring Apache to serve from dist/..."
cat > /etc/apache2/sites-available/sschw-landing.conf << 'APACHECONF'
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html/dist

    <Directory /var/www/html/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
APACHECONF

a2dissite 000-default.conf 2>/dev/null || true
a2ensite sschw-landing.conf
a2enmod rewrite

apache2ctl graceful 2>/dev/null || service apache2 reload 2>/dev/null || apachectl graceful 2>/dev/null || true

echo ""
echo "==> Setup complete. Apache now serves /var/www/html/dist/"
echo "    Don't forget to add the LAN check block in Nginx Proxy Manager (see README)."
