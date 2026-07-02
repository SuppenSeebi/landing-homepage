// Turns one card-text line (already known not to be a directive) into Token[] per the
// documented line shapes, resolving inline {{link}}/{{anchor}} tags along the way.
//
// No shape is ever generated here that the author didn't type — see the "coding-area text
// is WYSIWYG" rule in docs/punch-card-content-system.md. This module only recognizes and
// colors what's already literal text (level rows, statement rows, DIVISION/SECTION/
// paragraph-name header lines); everything else is a fixed literal shape. Whitespace-only
// differences in *where* a token boundary falls inside a run of spaces are visually
// invisible — PunchCard.astro's renderer recolors every space character to `.pcc-empty`
// regardless of which token it belongs to — so the splitting rules below favor simplicity
// over exactly mirroring hand-authored legacy spacing.

import { extractTags, isFullyCoveredBy, type TagSpan } from './tags';
import type { Token } from './types';

export interface AnchorRegistry {
    /** Resolve a bare internal anchor name (a @SECTION id= or {{anchor:name}}) to its href. */
    resolveAnchor(name: string, lineNo?: number): string;
}

export interface LineResult {
    tokens: Token[];
    /** exact token text -> resolved href, for every {{link}} span this line produced. */
    callLinks: Record<string, string>;
}

const LEVEL_INDENT: Record<string, number> = { '01': 1, '05': 5, '10': 7, '88': 7 };
const STATEMENT_VERBS = ['END-DISPLAY', 'DISPLAY', 'EXIT PARAGRAPH', 'EXIT SECTION', 'CALL'] as const;

function findWord(haystack: string, word: string, from = 0): number {
    const re = new RegExp(`\\b${word}\\b`);
    const idx = haystack.slice(from).search(re);
    return idx === -1 ? -1 : idx + from;
}

/** Resolves a {{link:...}} span's param to an href, recording the callLinks entry. */
function resolveLinkSpan(
    span: TagSpan,
    tokenText: string,
    anchors: AnchorRegistry,
    callLinks: Record<string, string>,
    lineNo?: number,
): void {
    const param = span.param ?? '';
    const isExternal = param.startsWith("'") && param.endsWith("'");
    const href = isExternal ? param.slice(1, -1) : anchors.resolveAnchor(param, lineNo);
    callLinks[tokenText] = href;
}

/** Classifies one "value position" run (quoted / bare-number / tag-forced / other). */
function classifyValueRun(
    text: string,
    absStart: number,
    spans: TagSpan[],
    anchors: AnchorRegistry,
    callLinks: Record<string, string>,
    lineNo?: number,
): Token {
    const trimmed = text.trim();
    // Tag spans cover only the meaningful content (e.g. the quoted string), not the
    // separator whitespace this run's own leading/trailing edges may include — so check
    // coverage against the trimmed content's offsets, not the whole run.
    const leadingWs = text.length - text.trimStart().length;
    const contentStart = absStart + leadingWs;
    const contentEnd = contentStart + trimmed.length;
    const linkSpan = spans.find(s => s.tag === 'link' && s.start <= contentStart && s.end >= contentEnd);
    if (linkSpan) resolveLinkSpan(linkSpan, text, anchors, callLinks, lineNo);

    if (/^'.*'$/.test(trimmed)) return ['val', text];
    if (linkSpan) return ['val', text];
    if (/^\d+$/.test(trimmed)) return ['numval', text];
    return ['val', text];
}

function tokenizeLevelLine(
    clean: string,
    spans: TagSpan[],
    anchors: AnchorRegistry,
    callLinks: Record<string, string>,
    lineNo?: number,
): Token[] | null {
    const m = clean.match(/^(01|05|10|88)\s+(.*)$/s);
    if (!m) return null;
    const [, level, restRaw] = m;
    const offset = clean.length - (level.length + 1 + restRaw.length); // start offset of `restRaw` in clean, usually 0

    let rest = restRaw;
    let hasDot = false;
    if (rest.endsWith('.')) {
        rest = rest.slice(0, -1);
        hasDot = true;
    }

    const tokens: Token[] = [['lvl', ' '.repeat(LEVEL_INDENT[level]) + level]];

    const picIdx = findWord(rest, 'PIC');
    const valueIdx = findWord(rest, 'VALUE', picIdx >= 0 ? picIdx + 3 : 0);
    const firstKwIdx = picIdx >= 0 ? picIdx : valueIdx;

    const nameEnd = firstKwIdx >= 0 ? Math.max(firstKwIdx - 1, 0) : rest.length;
    tokens.push(['name', ' ' + rest.slice(0, nameEnd)]);

    if (picIdx >= 0) {
        const picClauseEnd = valueIdx >= 0 ? Math.max(valueIdx - 1, picIdx) : rest.length;
        tokens.push(['kw', ' ' + rest.slice(picIdx, picClauseEnd)]);
    }

    if (valueIdx >= 0) {
        tokens.push(['kw', ' VALUE']);
        const valueText = rest.slice(valueIdx + 'VALUE'.length);
        if (valueText.trim().length > 0) {
            const absStart = offset + level.length + 1 + valueIdx + 'VALUE'.length;
            tokens.push(classifyValueRun(valueText, absStart, spans, anchors, callLinks, lineNo));
        }
    }

    if (hasDot) tokens.push(['dot', '.']);
    return tokens;
}

function tokenizeStatementLine(
    clean: string,
    spans: TagSpan[],
    anchors: AnchorRegistry,
    callLinks: Record<string, string>,
    lineNo?: number,
): Token[] | null {
    const verb = STATEMENT_VERBS.find(v => clean === v || clean.startsWith(v + ' ') || clean.startsWith(v + "'"));
    if (!verb) return null;

    const remainder = clean.slice(verb.length);
    const verbCoveredByLink = isFullyCoveredBy(spans, 'link', 0, verb.length);

    const tokens: Token[] = [];
    if (verbCoveredByLink) {
        tokens.push(['kw', '     ']);
        tokens.push(classifyValueRun(verb, 0, spans, anchors, callLinks, lineNo));
    } else {
        tokens.push(['kw', '     ' + verb]);
    }

    if (remainder.trim().length > 0) {
        tokens.push(classifyValueRun(remainder, verb.length, spans, anchors, callLinks, lineNo));
    }
    return tokens;
}

/**
 * DIVISION/SECTION/paragraph-name header lines — recognized (and canonically colored) when
 * the author types them, never auto-generated. Same Area-A single-space indent as an 01-level
 * line. Checked after statement-row so e.g. "EXIT SECTION" (a statement) isn't mistaken for a
 * section header just because it also ends in the word "SECTION".
 */
function tokenizeHeaderLine(clean: string): Token[] | null {
    let text = clean;
    let hasDot = false;
    if (text.endsWith('.')) {
        text = text.slice(0, -1);
        hasDot = true;
    }
    const trimmed = text.trim();
    if (trimmed === '') return null;

    let tt: 'div' | 'section' | 'para' | null = null;
    if (/ DIVISION$/.test(trimmed)) tt = 'div';
    else if (/ SECTION$/.test(trimmed)) tt = 'section';
    else if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(trimmed)) tt = 'para';
    if (!tt) return null;

    const tokens: Token[] = [[tt, ' ' + trimmed]];
    if (hasDot) tokens.push(['dot', '.']);
    return tokens;
}

/** Fallback for lines that match no recognized shape: passed through close to verbatim. */
function tokenizeFallbackLine(
    clean: string,
    spans: TagSpan[],
    anchors: AnchorRegistry,
    callLinks: Record<string, string>,
    lineNo?: number,
): Token[] {
    return [classifyValueRun(clean, 0, spans, anchors, callLinks, lineNo)];
}

export function tokenizeCardLine(raw: string, anchors: AnchorRegistry, lineNo?: number): LineResult {
    const { clean, spans } = extractTags(raw, lineNo);
    const trimmed = clean.trim();
    const callLinks: Record<string, string> = {};

    if (trimmed === '') return { tokens: [], callLinks };
    // A standalone "." closes a statement block (CALL/DISPLAY/EXIT ...), so it takes the
    // same 5-space statement indent, not a bare dot — matches every real occurrence on the
    // live site (there is no bare-indent standalone dot anywhere in current card data).
    if (trimmed === '.') return { tokens: [['dot', '     .']], callLinks };
    if (trimmed.startsWith('*')) return { tokens: [['comment', trimmed]], callLinks };

    const leftTrimmed = clean.replace(/^\s+/, '');
    const level = tokenizeLevelLine(leftTrimmed, spans, anchors, callLinks, lineNo);
    if (level) return { tokens: level, callLinks };

    const statement = tokenizeStatementLine(leftTrimmed, spans, anchors, callLinks, lineNo);
    if (statement) return { tokens: statement, callLinks };

    const header = tokenizeHeaderLine(leftTrimmed);
    if (header) return { tokens: header, callLinks };

    return { tokens: tokenizeFallbackLine(clean, spans, anchors, callLinks, lineNo), callLinks };
}

export function makeSeq(rowIndex: number): string {
    return String(rowIndex + 1).padStart(6, '0');
}
