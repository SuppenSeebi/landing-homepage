# Astro Starter Kit: Minimal

```sh
pnpm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## Deployment

Runs via Apache in a Docker container — see `setup.sh` (first-time) / `update_site.sh` (updates).
Each deploy builds two variants:

- `pnpm build` → `dist/` — public site, served on :80 (default vhost) and via Nginx Proxy Manager
  for `sschw.dev`.
- `pnpm build:internal` → `dist-internal/` — same content plus anything a `.pcob` file marks
  `@VISIBILITY INTERNAL` (see `docs/pcob-reference.md`'s "Internal-only content" section), served
  three ways: directly on `:8081`, and on `:80`/`:443` for requests whose `Host` header is
  `lan.sschw.dev` (see below — `:443` is the one that actually works in a browser).

### LAN-only access (`lan.sschw.dev`)

Reaching internal content over the public `sschw.dev` domain doesn't work — NAT hairpinning makes
LAN and guest-WiFi traffic indistinguishable by source IP once it round-trips through the router
(this was tried and abandoned; see git history / conversation logs for why). Instead:

1. **Namecheap** (DNS provider for `sschw.dev`) has a plain `A` record: host `lan`, value = this
   box's LAN IP (`192.168.178.56` as of writing). This is separate from the DynamicDNS-managed
   root record — it never changes automatically, so if the box's LAN IP changes, update this
   record by hand.
2. **Fritz!Box** has `lan.sschw.dev` allow-listed under DNS-Rebind-Schutz (Heimnetz > Netzwerk >
   Netzwerkeinstellungen > Weitere Einstellungen, needs Expertenmodus) — without this, the router
   blocks the DNS answer on sight, since "public domain name resolving to a private IP" is exactly
   what rebind protection exists to stop.
3. Apache's `sschw-landing.conf` has name-based vhosts for `ServerName lan.sschw.dev` on both
   `:80` and `:443` — so LAN devices just browse `lan.sschw.dev`, no port number to remember.

The actual security boundary is **guest-network isolation** (a router-level firewall rule
blocking guest WiFi from reaching any other LAN device) — not the DNS setup itself. Every device
on the Fritz!Box's network resolves `lan.sschw.dev` to the same private IP, guest WiFi included;
what stops guest devices from actually seeing internal content is that they can't route to that
IP at all. Confirm guest isolation is enabled if you rely on this.

**Must use `https://`, not `http://`.** Every major browser hardcodes "the entire `.dev` TLD
requires HTTPS" (it's on Chrome's static HSTS preload list — confirmed via
`chrome://net-internals/#hsts`: `static_sts_domain: dev`, `dynamic_sts_domain` empty). This isn't
a header `sschw.dev`'s server ever sent and can't be turned off from the server side at all — it's
compiled into the browser, independent of any config here. So the `:80` vhost is effectively dead
for real browsers (kept only for non-browser HTTP clients like `curl`).

**The cert must be genuinely trusted, not just present.** A self-signed cert was tried first, but
Chrome refuses to even offer an "Advanced → Proceed anyway" bypass on HSTS-enforced domains (the
whole point of HSTS is blocking exactly this kind of override) — so an untrusted cert isn't a
"warning you click through" here, it's a hard wall with no escape hatch. A real cert is required.

Let's Encrypt's usual HTTP-01 challenge can't work either — their validation servers can't reach
`lan.sschw.dev`'s private IP. The fix is a **manual DNS-01 challenge**:
```
certbot certonly --manual --preferred-challenges dns -d lan.sschw.dev
```
This pauses and asks you to add a `TXT` record (`_acme-challenge.lan.sschw.dev`) via Namecheap's
Advanced DNS with a value it gives you; once deployed, press Enter and it issues the cert to
`/etc/letsencrypt/live/lan.sschw.dev/`. `setup.sh` prefers this cert automatically if present,
falling back to generating a self-signed one (which still needs manual per-device trust-store
import to be usable at all, given the above) only if it isn't.

**This does not auto-renew.** `--manual` mode has no renewal hook, so certbot won't touch this
cert again on its own — repeat the exact command above (and the TXT-record step) before the
cert's expiry, or `lan.sschw.dev` goes back to being unusable in any real browser. Check the
expiry with `certbot certificates` if unsure. An automated Namecheap-API-based DNS-01 setup was
considered and rejected — it would need Namecheap API access IP-whitelisted to this box's public
IP, which is dynamic (the same moving-target problem that broke the earlier nginx-based
IP-detection attempt for this same feature).

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
