// Parses raw .pcob source into a Division -> Section -> Card tree. Directive lines (first
// non-space char is "@") drive structure; everything else is buffered as card-text body
// lines for the tokenizer to handle later. This module does not resolve links/anchors or
// classify tokens — see tokenizeCardLine.ts and compile.ts for that.
//
// @IMPORT (only meaningful at the top level, before any @DIVISION) merges another file's
// divisions into this one's tree — see src/pcob/loadProgram.ts for the Astro-side file lookup
// that supplies parseSource's resolveImport callback.
//
// @HEADER-* (also top-level-only, like @IMPORT) authors the 5 configurable form-header cells
// (left column x3, right column x2 - the 3rd right cell, DATE-VERSION, is computed at build
// time and deliberately not part of this) - see compile.ts for how a value's {{link}} tag (if
// any) gets resolved into an href.

import { PcobError, type DivisionId, type Visibility } from './types';

export interface RawCard {
    name: string;
    /** Optional anchor id (shares the same flat namespace as @SECTION id=/{{anchor:name}}) —
     * lets a {{link:}} target this exact card within a multi-card section instead of just
     * landing on the section's first card. Unlike @SECTION, not required: most cards are never
     * linked to directly. */
    id?: string;
    lineNo: number;
    rowsOverride?: number;
    visibilityOverride?: Visibility;
    body: { raw: string; lineNo: number }[];
}

export interface RawSection {
    name: string;
    id: string;
    rowsOverride?: number;
    visibilityOverride?: Visibility;
    lineNo: number;
    cards: RawCard[];
}

export interface RawDivision {
    id: DivisionId;
    rowsOverride?: number;
    visibilityOverride?: Visibility;
    lineNo: number;
    sections: RawSection[];
}

export interface RawHeaderCell {
    label: string;
    valueRaw: string;
    lineNo: number;
}

export type HeaderSlot = 'leftFirst' | 'leftSecond' | 'leftThird' | 'rightFirst' | 'rightSecond';

export interface RawProgram {
    defaultRows?: number;
    defaultVisibility?: Visibility;
    divisions: RawDivision[];
    header: Partial<Record<HeaderSlot, RawHeaderCell>>;
}

const DIVISION_IDS: Record<string, DivisionId> = { DATA: 'data', PROCEDURE: 'proc' };

function parseAttrs(text: string, lineNo: number): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const part of text.trim().split(/\s+/).filter(Boolean)) {
        const eq = part.indexOf('=');
        if (eq === -1) throw new PcobError(`Malformed attribute "${part}" — expected key=value`, lineNo);
        attrs[part.slice(0, eq)] = part.slice(eq + 1);
    }
    return attrs;
}

/**
 * An imported file's own program-level default (and any division-level override) only makes
 * sense scoped to that file's own sections — once its divisions get merged into a shared
 * main-program bucket by division id (see mergeImportedProgram), a division-level fact from one
 * file could otherwise silently leak onto another file's sections sharing the same division id.
 * Pushing every file's resolved default down to section level, before merging, keeps each
 * file's own rows fully self-contained through the merge.
 */
function pushDownRows(program: RawProgram): void {
    for (const division of program.divisions) {
        const divDefault = division.rowsOverride ?? program.defaultRows;
        if (divDefault === undefined) continue;
        for (const section of division.sections) {
            if (section.rowsOverride === undefined) section.rowsOverride = divDefault;
        }
    }
}

/** Same reasoning as pushDownRows, for @VISIBILITY: a division/program-level default is only
 * meaningful scoped to the file that declared it, so it's pushed onto that file's own sections
 * before merging into a shared per-division-id bucket. */
function pushDownVisibility(program: RawProgram): void {
    for (const division of program.divisions) {
        const divDefault = division.visibilityOverride ?? program.defaultVisibility;
        if (divDefault === undefined) continue;
        for (const section of division.sections) {
            if (section.visibilityOverride === undefined) section.visibilityOverride = divDefault;
        }
    }
}

function mergeImportedProgram(target: RawProgram, imported: RawProgram): void {
    pushDownRows(imported);
    pushDownVisibility(imported);
    for (const division of imported.divisions) {
        const existing = target.divisions.find(d => d.id === division.id);
        if (existing) existing.sections.push(...division.sections);
        else target.divisions.push(division);
    }
}

/**
 * @param resolveImport Looks up an imported file's raw source by the name given after
 * @IMPORT. Only the top-level parse (a "main program") should pass this — the imported file
 * is itself parsed with no resolver, so an @IMPORT inside it throws immediately rather than
 * silently nesting. This is what keeps subordinate files "fully self-contained" a real
 * invariant instead of just a convention.
 */
export function parseSource(source: string, resolveImport?: (name: string) => string | undefined): RawProgram {
    const lines = source.split(/\r\n|\n/);
    const program: RawProgram = { divisions: [], header: {} };
    const importedNames = new Set<string>();

    let division: RawDivision | null = null;
    let section: RawSection | null = null;
    let card: RawCard | null = null;
    let pendingBlanks = 0;

    const flushPendingBlanks = () => {
        if (card && pendingBlanks > 0) {
            for (let i = 0; i < pendingBlanks; i++) card.body.push({ raw: '', lineNo: -1 });
        }
        pendingBlanks = 0;
    };

    for (let i = 0; i < lines.length; i++) {
        const lineNo = i + 1;
        const raw = lines[i];
        const trimmed = raw.trim();

        if (trimmed === '') {
            if (card) pendingBlanks++;
            continue;
        }

        if (!trimmed.startsWith('@')) {
            if (!card) throw new PcobError(`Card text outside of any @CARD: "${trimmed}"`, lineNo);
            flushPendingBlanks();
            card.body.push({ raw, lineNo });
            continue;
        }

        // Directive line: discard any pending blanks (they were just visual separation).
        pendingBlanks = 0;

        if (trimmed.startsWith('@@')) continue;

        const importMatch = trimmed.match(/^@IMPORT\s+(\S+)\s*$/);
        if (importMatch) {
            const name = importMatch[1];
            if (!resolveImport) {
                throw new PcobError('nested @IMPORT not supported — subordinate files must be self-contained', lineNo);
            }
            if (division) {
                throw new PcobError('@IMPORT must appear before any @DIVISION', lineNo);
            }
            if (importedNames.has(name)) {
                throw new PcobError(`duplicate @IMPORT "${name}"`, lineNo);
            }
            importedNames.add(name);
            const importedSource = resolveImport(name);
            if (importedSource === undefined) {
                throw new PcobError(`@IMPORT "${name}" not found`, lineNo);
            }
            mergeImportedProgram(program, parseSource(importedSource));
            continue;
        }

        const headerMatch = trimmed.match(/^@HEADER-(LEFT|RIGHT)-(FIRST|SECOND|THIRD)\s+"([^"]*)"\s+"([^"]*)"\s*$/);
        if (headerMatch) {
            const [, side, ordinal, label, valueRaw] = headerMatch;
            if (!resolveImport) {
                throw new PcobError('@HEADER-* only allowed in the top-level program, not an imported file', lineNo);
            }
            if (side === 'RIGHT' && ordinal === 'THIRD') {
                throw new PcobError(
                    '@HEADER-RIGHT-THIRD is not configurable — DATE-VERSION is computed at build time (date + git hash), not authored content',
                    lineNo,
                );
            }
            const slot = (side.toLowerCase() + ordinal[0] + ordinal.slice(1).toLowerCase()) as HeaderSlot;
            if (program.header[slot]) {
                throw new PcobError(`duplicate @HEADER-${side}-${ordinal}`, lineNo);
            }
            program.header[slot] = { label, valueRaw, lineNo };
            continue;
        }

        const rowsMatch = trimmed.match(/^@ROWS\s+(\d+)\s*$/);
        if (rowsMatch) {
            const n = Number(rowsMatch[1]);
            if (card) card.rowsOverride = n;
            else if (section) section.rowsOverride = n;
            else if (division) division.rowsOverride = n;
            else program.defaultRows = n;
            continue;
        }

        const visibilityMatch = trimmed.match(/^@VISIBILITY\s+(PUBLIC|INTERNAL)\s*$/);
        if (visibilityMatch) {
            const visibility = visibilityMatch[1].toLowerCase() as Visibility;
            if (card) card.visibilityOverride = visibility;
            else if (section) section.visibilityOverride = visibility;
            else if (division) division.visibilityOverride = visibility;
            else program.defaultVisibility = visibility;
            continue;
        }

        const divisionMatch = trimmed.match(/^@DIVISION\s+(DATA|PROCEDURE)\s*$/);
        if (divisionMatch) {
            const id = DIVISION_IDS[divisionMatch[1]];
            division = { id, lineNo, sections: [] };
            program.divisions.push(division);
            section = null;
            card = null;
            continue;
        }

        const sectionMatch = trimmed.match(/^@SECTION\s+(\S+)(?:\s+(.*))?$/);
        if (sectionMatch) {
            if (!division) throw new PcobError('@SECTION outside of any @DIVISION', lineNo);
            const attrs = parseAttrs(sectionMatch[2] ?? '', lineNo);
            if (!attrs.id) throw new PcobError(`@SECTION ${sectionMatch[1]} is missing required id=`, lineNo);
            const unknownAttrs = Object.keys(attrs).filter(k => k !== 'id');
            if (unknownAttrs.length) {
                throw new PcobError(`@SECTION ${sectionMatch[1]} has unknown attribute(s): ${unknownAttrs.join(', ')}`, lineNo);
            }
            section = { name: sectionMatch[1], id: attrs.id, lineNo, cards: [] };
            division.sections.push(section);
            card = null;
            continue;
        }

        const cardMatch = trimmed.match(/^@CARD\s+(\S+)(?:\s+(.*))?$/);
        if (cardMatch) {
            if (!section) throw new PcobError('@CARD outside of any @SECTION', lineNo);
            const attrs = parseAttrs(cardMatch[2] ?? '', lineNo);
            const unknownAttrs = Object.keys(attrs).filter(k => k !== 'id');
            if (unknownAttrs.length) {
                throw new PcobError(`@CARD ${cardMatch[1]} has unknown attribute(s): ${unknownAttrs.join(', ')}`, lineNo);
            }
            card = { name: cardMatch[1], id: attrs.id, lineNo, body: [] };
            section.cards.push(card);
            continue;
        }

        throw new PcobError(`Unrecognized directive: "${trimmed}"`, lineNo);
    }

    return program;
}
