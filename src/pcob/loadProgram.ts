// Loads every .pcob file in src/content/_punchcard once (Vite's eager `?raw` glob), resolves
// main.pcob's @IMPORTs against that in-memory map, and compiles the merged result into one
// shared CompiledProgram. Called exactly once, from src/pages/index.astro - every section's
// content, nav data, cross-section {{link}} targets, and {{embed}} file references all come
// from this single call.

import { compileRawProgram } from './compile';
import { parseSource } from './parseSource';
import type { CompiledProgram } from './types';

const files = import.meta.glob('../content/_punchcard/*.pcob', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

// {{embed:path}} references are resolved relative to the referencing .pcob file - since every
// .pcob file lives flatly in _punchcard/ today, that's the same as resolving relative to
// _punchcard/ itself. Recursive glob so subdirectories (e.g. embedded/impressum.html) resolve.
const embedFiles = import.meta.glob('../content/_punchcard/**/*.html', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

function basename(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

const fileMap: Record<string, string> = {};
for (const [path, content] of Object.entries(files)) {
    fileMap[basename(path)] = content;
}

const embedFileMap: Record<string, string> = {};
for (const [path, content] of Object.entries(embedFiles)) {
    embedFileMap[path.replace('../content/_punchcard/', '')] = content;
}

/** @param includeInternal Whether @VISIBILITY internal cards/sections are compiled in — see
 * compile.ts's CompileOptions. Defaults to false (the public build); index.astro passes this
 * from the PCF_INCLUDE_INTERNAL build-time env var, read via process.env (not import.meta.env,
 * so it's never subject to Vite's client-exposure rules — this only ever runs in frontmatter,
 * at build time, for a static site with no server runtime). */
export function loadMainProgram(includeInternal = false): CompiledProgram {
    const mainSource = fileMap['main.pcob'];
    if (mainSource === undefined) throw new Error('main.pcob not found in src/content/_punchcard');
    const program = parseSource(mainSource, name => fileMap[name]);
    return compileRawProgram(program, path => embedFileMap[path], { includeInternal });
}
