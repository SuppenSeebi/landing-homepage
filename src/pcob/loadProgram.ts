// Loads every .pcob file in src/content/_punchcard once (Vite's eager `?raw` glob), resolves
// main.pcob's @IMPORTs against that in-memory map, and compiles the merged result into one
// shared CompiledProgram. Called exactly once, from src/pages/index.astro - every section's
// content, nav data, and cross-section {{link}} targets all come from this single call.

import { compileRawProgram } from './compile';
import { parseSource } from './parseSource';
import type { CompiledProgram } from './types';

const files = import.meta.glob('../content/_punchcard/*.pcob', {
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

export function loadMainProgram(): CompiledProgram {
    const mainSource = fileMap['main.pcob'];
    if (mainSource === undefined) throw new Error('main.pcob not found in src/content/_punchcard');
    const program = parseSource(mainSource, name => fileMap[name]);
    return compileRawProgram(program);
}
