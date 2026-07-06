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

# Every browser hardcodes "*.dev must be HTTPS" (the whole .dev TLD is on the
# static HSTS preload list — this is not a header sschw.dev's server ever sent,
# it's compiled into the browser and cannot be disabled from the server side).
# So lan.sschw.dev needs *some* cert to be reachable at all. Prefer a real
# Let's Encrypt cert (via manual DNS-01 — see README; HTTP-01 can't work since
# Let's Encrypt's validators can't reach a private IP) if one's already been
# issued; fall back to a self-signed cert (works, but needs importing into
# every device's trust store) if not, so a from-scratch setup.sh run still
# produces a working :443 vhost without requiring the interactive DNS-01 dance.
if [ -f /etc/letsencrypt/live/lan.sschw.dev/fullchain.pem ]; then
    echo "==> Using existing Let's Encrypt cert for lan.sschw.dev"
    LAN_CERT=/etc/letsencrypt/live/lan.sschw.dev/fullchain.pem
    LAN_KEY=/etc/letsencrypt/live/lan.sschw.dev/privkey.pem
else
    echo "==> No Let's Encrypt cert for lan.sschw.dev yet — generating a self-signed fallback"
    mkdir -p /etc/apache2/ssl-lan
    if [ ! -f /etc/apache2/ssl-lan/lan-sschw-dev.crt ]; then
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout /etc/apache2/ssl-lan/lan-sschw-dev.key \
            -out /etc/apache2/ssl-lan/lan-sschw-dev.crt \
            -subj "/CN=lan.sschw.dev" \
            -addext "subjectAltName=DNS:lan.sschw.dev"
    fi
    LAN_CERT=/etc/apache2/ssl-lan/lan-sschw-dev.crt
    LAN_KEY=/etc/apache2/ssl-lan/lan-sschw-dev.key
    echo "    For a real, browser-trusted cert (no per-device import needed), run:"
    echo "    certbot certonly --manual --preferred-challenges dns -d lan.sschw.dev"
    echo "    (see README's LAN-only access section), then re-run this script."
fi

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
# > DNS-Rebind-Schutz). Name-based vhosts, so they must come AFTER the unnamed :80
# vhost above (Apache's default-vhost-is-first-listed rule) — any request whose
# Host header doesn't match "lan.sschw.dev" exactly (raw IP, guest devices that
# somehow got this far, everything else) falls through to the public dist/ vhost
# above, not this one. The actual security boundary is the LAN's own guest-network
# isolation blocking guest devices from reaching this private IP at all — this
# vhost match alone doesn't gate anything.
#
# The :80 block below is effectively unreachable from any real browser — every
# browser hardcodes "*.dev requires HTTPS" (HSTS static preload for the whole
# .dev TLD, not something this server controls) and force-upgrades before the
# request is even sent. It's kept only for non-browser HTTP clients (curl etc).
# The :443 block is the one that actually works in a browser, using whichever
# cert was selected above (__LAN_CERT__/__LAN_KEY__ placeholders, substituted
# after the heredoc — the heredoc itself must stay quoted so Apache's own
# ${APACHE_LOG_DIR} references below aren't mistaken for bash variables).
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

<VirtualHost *:443>
    ServerName lan.sschw.dev
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html/dist-internal

    SSLEngine on
    SSLCertificateFile __LAN_CERT__
    SSLCertificateKeyFile __LAN_KEY__

    <Directory /var/www/html/dist-internal>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/error-lan-ssl.log
    CustomLog ${APACHE_LOG_DIR}/access-lan-ssl.log combined
</VirtualHost>
APACHECONF

sed -i "s#__LAN_CERT__#$LAN_CERT#; s#__LAN_KEY__#$LAN_KEY#" /etc/apache2/sites-available/sschw-landing.conf

a2dissite 000-default.conf 2>/dev/null || true
a2ensite sschw-landing.conf
a2enmod rewrite
a2enmod ssl

# A full restart, not graceful/reload — newly a2enmod'd modules (mod_ssl) only
# actually load into the master process on restart, not on a reload signal.
systemctl restart apache2 2>/dev/null || apache2ctl graceful 2>/dev/null || service apache2 reload 2>/dev/null || apachectl graceful 2>/dev/null || true

echo ""
echo "==> Setup complete. Apache now serves:"
echo "      :80   (default)             -> /var/www/html/dist            (public build)"
echo "      :80   (Host: lan.sschw.dev)  -> /var/www/html/dist-internal   (unreachable from browsers, see README)"
echo "      :443  (Host: lan.sschw.dev)  -> /var/www/html/dist-internal   (cert: $LAN_CERT)"
echo "      :8081                       -> /var/www/html/dist-internal    (LAN-only build, direct-port access)"
echo "    lan.sschw.dev needs: a Namecheap A record -> this box's LAN IP, and a"
echo "    Fritz!Box DNS-Rebind-Schutz exception for that hostname. See README."
