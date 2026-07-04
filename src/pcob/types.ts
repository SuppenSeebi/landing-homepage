// Shared types for the .pcob compiler. `TT`/`Token`/`Line` mirror PunchCard.astro's
// renderer-facing shapes exactly — the compiler's job is to produce these, not new ones.

export type TT = 'div' | 'section' | 'para' | 'lvl' | 'name' | 'kw' | 'val' | 'numval' | 'dot' | 'comment';
export type Token = [TT, string];
export type Line = [seq: string, tokens: Token[]];

export type DivisionId = 'data' | 'proc';

export class PcobError extends Error {
    constructor(message: string, public line?: number) {
        super(line !== undefined ? `${message} (line ${line})` : message);
        this.name = 'PcobError';
    }
}

export interface NavEntry {
    label: string;
    href: string;
}

export interface ParaNavEntry extends NavEntry {
    /** Which card within the section this paragraph jumps to/highlights for. */
    cardIdx: number;
}

export type EmbedCorner =
    | 'top-left' | 'top' | 'top-right'
    | 'left' | 'center' | 'right'
    | 'bottom-left' | 'bottom' | 'bottom-right';

export const EMBED_CORNERS: readonly EmbedCorner[] = [
    'top-left', 'top', 'top-right',
    'left', 'center', 'right',
    'bottom-left', 'bottom', 'bottom-right',
];

export interface CompiledEmbed {
    /** Resolved raw HTML content of the referenced file. */
    html: string;
    /** 0-based row within the card's Line[]. */
    row: number;
    /** 0-based character column within that row (where the {{embed}} tag sat). */
    col: number;
    corner: EmbedCorner;
    sectionId: string;
    cardIdx: number;
}

export interface CompiledCard {
    name: string;
    lines: Line[];
    callLinks: Record<string, string>;
    embeds: CompiledEmbed[];
}

export interface CompiledSection {
    id: string;
    name: string;
    division: DivisionId;
    cards: CompiledCard[];
}

export interface HeaderCell {
    label: string;
    value: string;
    /** Resolved href if the value's {{link}} tag (at most one) was present. */
    href?: string;
}

export interface CompiledHeader {
    /** PROGRAMMER / PROGRAM / CURRENT SYSTEM cells, in that row order. */
    left: [HeaderCell, HeaderCell, HeaderCell];
    /** XREF / IDENTIFICATION cells, in that row order. The 3rd right cell
     * (DATE - VERSION) is computed in PunchCard.astro, not part of this. */
    right: [HeaderCell, HeaderCell];
}

export interface CompiledProgram {
    sections: CompiledSection[];
    divisionMap: Record<DivisionId, string[]>;
    sectionsByDiv: Record<DivisionId, NavEntry[]>;
    parasBySection: Record<string, ParaNavEntry[]>;
    header: CompiledHeader;
}
