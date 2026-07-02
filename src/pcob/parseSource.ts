// Parses raw .pcob source into a Division -> Section -> Card tree. Directive lines (first
// non-space char is "@") drive structure; everything else is buffered as card-text body
// lines for the tokenizer to handle later. This module does not resolve links/anchors or
// classify tokens — see tokenizeCardLine.ts and compile.ts for that.

import { PcobError, type DivisionId } from './types';

export interface RawCard {
    name: string;
    lineNo: number;
    rowsOverride?: number;
    body: { raw: string; lineNo: number }[];
    slot?: { name: string; rows: number; atBodyIndex: number };
}

export interface RawSection {
    name: string;
    id: string;
    rowsOverride?: number;
    lineNo: number;
    cards: RawCard[];
}

export interface RawDivision {
    id: DivisionId;
    rowsOverride?: number;
    lineNo: number;
    sections: RawSection[];
}

export interface RawProgram {
    defaultRows?: number;
    divisions: RawDivision[];
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

export function parseSource(source: string): RawProgram {
    const lines = source.split(/\r\n|\n/);
    const program: RawProgram = { divisions: [] };

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

        const rowsMatch = trimmed.match(/^@ROWS\s+(\d+)\s*$/);
        if (rowsMatch) {
            const n = Number(rowsMatch[1]);
            if (card) card.rowsOverride = n;
            else if (section) section.rowsOverride = n;
            else if (division) division.rowsOverride = n;
            else program.defaultRows = n;
            continue;
        }

        const slotMatch = trimmed.match(/^@SLOT\s+(\S+)\s+rows=(\d+)\s*$/);
        if (slotMatch) {
            if (!card) throw new PcobError('@SLOT outside of any @CARD', lineNo);
            if (card.slot) throw new PcobError(`Card "${card.name}" declares more than one @SLOT`, lineNo);
            card.slot = { name: slotMatch[1], rows: Number(slotMatch[2]), atBodyIndex: card.body.length };
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

        const cardMatch = trimmed.match(/^@CARD\s+(\S+)\s*$/);
        if (cardMatch) {
            if (!section) throw new PcobError('@CARD outside of any @SECTION', lineNo);
            card = { name: cardMatch[1], lineNo, body: [] };
            section.cards.push(card);
            continue;
        }

        throw new PcobError(`Unrecognized directive: "${trimmed}"`, lineNo);
    }

    return program;
}
