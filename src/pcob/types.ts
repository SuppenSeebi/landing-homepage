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

export interface CompiledCard {
    name: string;
    lines: Line[];
    callLinks: Record<string, string>;
}

export interface CompiledSection {
    id: string;
    name: string;
    division: DivisionId;
    cards: CompiledCard[];
}

export interface CompiledProgram {
    sections: CompiledSection[];
    divisionMap: Record<DivisionId, string[]>;
    sectionsByDiv: Record<DivisionId, NavEntry[]>;
    parasBySection: Record<string, NavEntry[]>;
}
