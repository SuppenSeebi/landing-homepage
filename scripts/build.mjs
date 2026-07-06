// Thin wrapper so `pnpm build` / `pnpm build:internal` set PCF_INCLUDE_INTERNAL and pick an
// outDir without an extra cross-env dependency — plain Node env vars work identically on
// Windows and the Linux host this actually deploys to. See src/pages/index.astro and
// src/pcob/loadProgram.ts for how the flag is consumed, and
// docs/punch-card-content-system.md's Phase 7 for why two separate builds exist at all.

import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
if (mode !== '--public' && mode !== '--internal') {
    console.error('Usage: node scripts/build.mjs --public|--internal');
    process.exit(1);
}

const outDir = mode === '--internal' ? 'dist-internal' : 'dist';
const env = { ...process.env, PCF_INCLUDE_INTERNAL: mode === '--internal' ? 'true' : 'false' };

const result = spawnSync('astro', ['build', '--outDir', outDir], {
    stdio: 'inherit',
    env,
    shell: true,
});

process.exit(result.status ?? 1);
