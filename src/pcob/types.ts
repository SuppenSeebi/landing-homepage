// Shared types for the .pcob compiler. `TT`/`Token`/`Line` mirror PunchCard.astro's
// renderer-facing shapes exactly — the compiler's job is to produce these, not new ones.

export type TT = 'div' | 'section' | 'para' | 'lvl' | 'name' | 'kw' | 'val' | 'numval' | 'dot' | 'comment';
export type Token = [TT, string];
export type Line = [seq: string, tokens: Token[]];

export type DivisionId = 'data' | 'proc';

/** The DSL's fixed, closed @DIVISION vocabulary, in COBOL's own fixed division order - DATA and
 * PROCEDURE are the only values @DIVISION accepts. Defined once, here: parseSource.ts's
 * @DIVISION regex and compile.ts's division-nav labels are both derived from this, neither
 * independently retypes the COBOL words. Unlike section/card names, this is a closed 2-value
 * grammar fact (like @VISIBILITY's PUBLIC|INTERNAL), not author-chosen content - but the actual
 * rendered text/order still traces back to this one declaration, not a template literal that
 * could drift from what the compiler actually recognizes. */
export const DIVISION_WORDS: Record<DivisionId, string> = { data: 'DATA', proc: 'PROCEDURE' };

export type Visibility = 'public' | 'internal';

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

export interface CallLinkTarget {
    href: string;
    /** Present when the link resolves to a specific card within a multi-card section (via
     * @CARD id= or {{anchor:name}} placed inside that card's body) - lets the client jump to
     * that exact card's scroll position instead of just landing on the section's first card. */
    cardIdx?: number;
}

export interface CompiledCard {
    name: string;
    lines: Line[];
    callLinks: Record<string, CallLinkTarget>;
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

/** One DATA/PROCEDURE division-nav link, fully resolved server-side - label from DIVISION_WORDS,
 * href from that division's first section (divisionMap[id][0]). Rendered directly, no
 * client-side patch needed; a division with zero surviving sections is simply absent, same "no
 * dangling nav entry" rule @VISIBILITY already applies to sections/cards. */
export interface DivisionNavEntry {
    id: DivisionId;
    label: string;
    href: string;
}

export interface CompiledProgram {
    sections: CompiledSection[];
    divisionMap: Record<DivisionId, string[]>;
    divisionNav: DivisionNavEntry[];
    sectionsByDiv: Record<DivisionId, NavEntry[]>;
    parasBySection: Record<string, ParaNavEntry[]>;
    header: CompiledHeader;
}
