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

# lan.sschw.dev — a real public DNS record (Namecheap) pointing straight at this
# box's LAN IP, only resolvable by clients whose resolver has it allow-listed
# past DNS-rebind protection (Fritz!Box: Heimnetz > Netzwerk > Netzwerkeinstellungen
# > DNS-Rebind-Schutz). Name-based vhost, so it must come AFTER the unnamed :80
# vhost above (Apache's default-vhost-is-first-listed rule) — any request whose
# Host header doesn't match "lan.sschw.dev" exactly (raw IP, guest devices that
# somehow got this far, everything else) falls through to the public dist/ vhost
# above, not this one. The actual security boundary is the LAN's own guest-network
# isolation blocking guest devices from reaching this private IP at all — this
# vhost match alone doesn't gate anything.
<VirtualHost *:80>
    ServerName lan.sschw.dev
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html/dist-internal

    <Directory /var/www/html/dist-internal>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/error-lan.log
    CustomLog ${APACHE_LOG_DIR}/access-lan.log combined
</VirtualHost>
APACHECONF

a2dissite 000-default.conf 2>/dev/null || true
a2ensite sschw-landing.conf
a2enmod rewrite

apache2ctl graceful 2>/dev/null || service apache2 reload 2>/dev/null || apachectl graceful 2>/dev/null || true

echo ""
echo "==> Setup complete. Apache now serves:"
echo "      :80   (default)          -> /var/www/html/dist            (public build)"
echo "      :80   (Host: lan.sschw.dev) -> /var/www/html/dist-internal (LAN-only build)"
echo "      :8081                    -> /var/www/html/dist-internal    (LAN-only build, direct-port access)"
echo "    lan.sschw.dev needs: a Namecheap A record -> this box's LAN IP, and a"
echo "    Fritz!Box DNS-Rebind-Schutz exception for that hostname. See README."
