// Turns one card-text line (already known not to be a directive) into Token[] per the
// documented line shapes, resolving inline {{link}}/{{anchor}} tags along the way.
//
// Strict WYSIWYG: strip {{tags}} out of a line and every remaining character — including
// leading/internal whitespace — must reappear in the rendered tokens unchanged. This module
// never adds, removes, or re-indents a character; it only classifies which existing
// characters belong to which colored token (level rows, statement rows, DIVISION/SECTION/
// paragraph-name header lines, or a plain fallback). Indentation is entirely author-typed:
// there is no canonical/auto-applied indent for any line shape.

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

const STATEMENT_VERBS = ['END-DISPLAY', 'DISPLAY', 'EXIT PARAGRAPH', 'EXIT SECTION', 'GOBACK', 'CALL'] as const;

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
): Token[] {
    const trimmed = text.trim();
    // Tag spans cover only the meaningful content (e.g. the quoted string), not the
    // separator whitespace this run's own leading/trailing edges may include — so check
    // coverage against the trimmed content's offsets, not the whole run.
    const leadingWs = text.length - text.trimStart().length;
    const trailingWs = text.length - text.trimEnd().length;
    const contentStart = absStart + leadingWs;
    const contentEnd = contentStart + trimmed.length;
    const linkSpan = spans.find(s => s.tag === 'link' && s.start <= contentStart && s.end >= contentEnd);

    if (!linkSpan) {
        if (/^\d+$/.test(trimmed)) return [['numval', text]];
        return [['val', text]];
    }

    // A linked run's own separator whitespace (e.g. the space between `CALL` and a quoted
    // value) must not ride along inside the {{link}}'s clickable <a> — split it into its own
    // (non-linked) token so callLinks keys only the actual content, same char count/content
    // either way, just a different token boundary.
    resolveLinkSpan(linkSpan, trimmed, anchors, callLinks, lineNo);
    const tokens: Token[] = [];
    if (leadingWs > 0) tokens.push(['val', text.slice(0, leadingWs)]);
    tokens.push(['val', trimmed]);
    if (trailingWs > 0) tokens.push(['val', text.slice(text.length - trailingWs)]);
    return tokens;
}

function tokenizeLevelLine(
    clean: string,
    spans: TagSpan[],
    anchors: AnchorRegistry,
    callLinks: Record<string, string>,
    lineNo?: number,
): Token[] | null {
    const m = clean.match(/^(\s*)(01|05|10|88)(\s+)(.*)$/s);
    if (!m) return null;
    const [, leadWs, level, sepWs, restRaw] = m;
    const restOffset = leadWs.length + level.length + sepWs.length;

    let rest = restRaw;
    let hasDot = false;
    if (rest.endsWith('.')) {
        rest = rest.slice(0, -1);
        hasDot = true;
    }

    const tokens: Token[] = [['lvl', leadWs + level]];

    const picIdx = findWord(rest, 'PIC');
    const valueIdx = findWord(rest, 'VALUE', picIdx >= 0 ? picIdx + 3 : 0);
    const firstKwIdx = picIdx >= 0 ? picIdx : valueIdx;

    const nameEnd = firstKwIdx >= 0 ? firstKwIdx : rest.length;
    tokens.push(['name', sepWs + rest.slice(0, nameEnd)]);

    if (picIdx >= 0) {
        const picClauseEnd = valueIdx >= 0 ? valueIdx : rest.length;
        tokens.push(['kw', rest.slice(picIdx, picClauseEnd)]);
    }

    if (valueIdx >= 0) {
        tokens.push(['kw', rest.slice(valueIdx, valueIdx + 'VALUE'.length)]);
        const valueText = rest.slice(valueIdx + 'VALUE'.length);
        if (valueText.length > 0) {
            const absStart = restOffset + valueIdx + 'VALUE'.length;
            tokens.push(...classifyValueRun(valueText, absStart, spans, anchors, callLinks, lineNo));
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
    const leadMatch = clean.match(/^(\s*)/)!;
    const leadWs = leadMatch[1];
    const afterLead = clean.slice(leadWs.length);
    const verb = STATEMENT_VERBS.find(v => afterLead === v || afterLead.startsWith(v + ' ') || afterLead.startsWith(v + "'"));
    if (!verb) return null;

    const verbAbsStart = leadWs.length;
    const remainder = afterLead.slice(verb.length);
    const verbCoveredByLink = isFullyCoveredBy(spans, 'link', verbAbsStart, verbAbsStart + verb.length);

    const tokens: Token[] = [];
    if (verbCoveredByLink) {
        if (leadWs.length > 0) tokens.push(['kw', leadWs]);
        tokens.push(...classifyValueRun(verb, verbAbsStart, spans, anchors, callLinks, lineNo));
    } else {
        tokens.push(['kw', leadWs + verb]);
    }

    if (remainder.length > 0) {
        tokens.push(...classifyValueRun(remainder, verbAbsStart + verb.length, spans, anchors, callLinks, lineNo));
    }
    return tokens;
}

/**
 * DIVISION/SECTION/paragraph-name header lines — recognized (and colored) when the author
 * types them, never auto-generated, never re-indented. Checked after statement-row so e.g.
 * "EXIT SECTION" (a statement) isn't mistaken for a section header just because it also ends
 * in the word "SECTION".
 *
 * The trailing DIVISION/SECTION word is matched on a \b word boundary, not a literal preceding
 * space, so a hyphen-joined header like "IMPRESSUM-SECTION." (this project's convention for a
 * card whose own name doubles as its section label) is still recognized as a header rather than
 * falling through to the bare paragraph-name shape below.
 */
function tokenizeHeaderLine(clean: string): Token[] | null {
    let text = clean;
    let hasDot = false;
    if (text.endsWith('.')) {
        text = text.slice(0, -1);
        hasDot = true;
    }
    const forShapeCheck = text.trim();
    if (forShapeCheck === '') return null;

    let tt: 'div' | 'section' | 'para' | null = null;
    if (/\bDIVISION$/.test(forShapeCheck)) tt = 'div';
    else if (/\bSECTION$/.test(forShapeCheck)) tt = 'section';
    else if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(forShapeCheck)) tt = 'para';
    if (!tt) return null;

    const tokens: Token[] = [[tt, text]];
    if (hasDot) tokens.push(['dot', '.']);
    return tokens;
}

/** Fallback for lines that match no recognized shape: passed through verbatim. */
function tokenizeFallbackLine(
    clean: string,
    spans: TagSpan[],
    anchors: AnchorRegistry,
    callLinks: Record<string, string>,
    lineNo?: number,
): Token[] {
    return classifyValueRun(clean, 0, spans, anchors, callLinks, lineNo);
}

export function tokenizeCardLine(raw: string, anchors: AnchorRegistry, lineNo?: number): LineResult {
    const { clean, spans } = extractTags(raw, lineNo);
    const trimmedBoth = clean.trim();
    const callLinks: Record<string, string> = {};

    if (trimmedBoth === '') return { tokens: [], callLinks };
    // A standalone "." — rendered exactly as typed, including whatever indent (if any) the
    // author wrote. No canonical indent is applied; want it under column 12? Type it.
    if (trimmedBoth === '.') return { tokens: [['dot', clean]], callLinks };
    if (clean.trimStart().startsWith('*')) return { tokens: [['comment', clean]], callLinks };

    const level = tokenizeLevelLine(clean, spans, anchors, callLinks, lineNo);
    if (level) return { tokens: level, callLinks };

    const statement = tokenizeStatementLine(clean, spans, anchors, callLinks, lineNo);
    if (statement) return { tokens: statement, callLinks };

    const header = tokenizeHeaderLine(clean);
    if (header) return { tokens: header, callLinks };

    return { tokens: tokenizeFallbackLine(clean, spans, anchors, callLinks, lineNo), callLinks };
}

export function makeSeq(rowIndex: number): string {
    return String(rowIndex + 1).padStart(6, '0');
}
