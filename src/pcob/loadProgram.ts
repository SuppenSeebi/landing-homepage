// Loads every .pcob file from two content roots once (Vite's eager `?raw` glob), resolves
// main.pcob's @IMPORTs against that in-memory map, and compiles the merged result into one
// shared CompiledProgram. Called exactly once, from src/pages/index.astro - every section's
// content, nav data, cross-section {{link}} targets, and {{embed}} file references all come
// from this single call.
//
// Two roots, not one: src/content/_punchcard/ is Sebastian's own content; src/content/_claude/
// is Claude's (currently just claude.pcob - see CLAUDE.md's "Established patterns"). Both are
// flattened into one fileMap by basename, so @IMPORT doesn't care which root a file lives in -
// main.pcob just says `@IMPORT claude.pcob` same as any other file.

import { compileRawProgram } from './compile';
import { parseSource } from './parseSource';
import type { CompiledProgram } from './types';

// Vite's import.meta.glob is statically analyzed at build time, so the pattern list must be a
// literal array here - it can't be built from a shared CONTENT_ROOTS constant.
const files = import.meta.glob(['../content/_punchcard/*.pcob', '../content/_claude/*.pcob'], {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

// {{embed:path}} references are resolved relative to the referencing .pcob file - since every
// .pcob file lives flatly in its content root today, that's the same as resolving relative to
// that root itself. Recursive glob so subdirectories (e.g. embedded/impressum.html) resolve.
const embedFiles = import.meta.glob(['../content/_punchcard/**/*.html', '../content/_claude/**/*.html'], {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

const CONTENT_ROOTS = ['../content/_punchcard', '../content/_claude'];

function basename(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

function stripContentRoot(path: string): string {
    const root = CONTENT_ROOTS.find(root => path.startsWith(`${root}/`));
    return root ? path.slice(root.length + 1) : path;
}

const fileMap: Record<string, string> = {};
for (const [path, content] of Object.entries(files)) {
    fileMap[basename(path)] = content;
}

const embedFileMap: Record<string, string> = {};
for (const [path, content] of Object.entries(embedFiles)) {
    embedFileMap[stripContentRoot(path)] = content;
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
