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
  two ways: directly on `:8081`, and on `:80` for requests whose `Host` header is
  `lan.sschw.dev`.

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
3. Apache's `sschw-landing.conf` has a third, name-based `<VirtualHost *:80>` matching
   `ServerName lan.sschw.dev`, serving `dist-internal/` — so LAN devices just browse
   `http://lan.sschw.dev`, no port number to remember.

The actual security boundary is **guest-network isolation** (a router-level firewall rule
blocking guest WiFi from reaching any other LAN device) — not the DNS setup itself. Every device
on the Fritz!Box's network resolves `lan.sschw.dev` to the same private IP, guest WiFi included;
what stops guest devices from actually seeing internal content is that they can't route to that
IP at all. Confirm guest isolation is enabled if you rely on this.

No TLS on this path — `lan.sschw.dev` is `http://` only (Apache has no certificate for it). Fine
for a LAN-only convenience URL, not meant to be internet-facing.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
