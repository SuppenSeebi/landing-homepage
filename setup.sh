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

echo "==> Installing project dependencies..."
npm install

echo "==> Building site (public + LAN-only variants)..."
npm run build
npm run build:internal

echo "==> Configuring Apache to serve dist/ on :80 and dist-internal/ on :8081..."
grep -qx 'Listen 8081' /etc/apache2/ports.conf || echo 'Listen 8081' >> /etc/apache2/ports.conf

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

<VirtualHost *:8081>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html/dist-internal

    <Directory /var/www/html/dist-internal>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/error-internal.log
    CustomLog ${APACHE_LOG_DIR}/access-internal.log combined
</VirtualHost>
APACHECONF

a2dissite 000-default.conf 2>/dev/null || true
a2ensite sschw-landing.conf
a2enmod rewrite

apache2ctl graceful 2>/dev/null || service apache2 reload 2>/dev/null || apachectl graceful 2>/dev/null || true

echo ""
echo "==> Setup complete. Apache now serves:"
echo "      :80   -> /var/www/html/dist            (public build)"
echo "      :8081 -> /var/www/html/dist-internal    (LAN-only build, includes @VISIBILITY INTERNAL content)"
echo "    Don't forget to add the LAN check block in Nginx Proxy Manager (see README) —"
echo "    route LAN-source requests to :8081, everyone else to :80."
