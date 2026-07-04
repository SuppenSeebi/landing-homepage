// Strips {{tag:param}}...{{/tag}} markup from a card-text line, returning the plain
// text with markers removed plus the character ranges (in that plain text) each tag
// covered. Tags nest via a stack, so {{cycle:x}}{{noise}}'A'{{/noise}}{{/cycle}} works.
//
// Per the resolved DSL decision, every tag is always open/close paired — there is no
// bare/self-closing shorthand (e.g. EXIT PARAGRAPH links must be written
// {{link:name}}EXIT PARAGRAPH{{/link}}, never a trailing unwrapped {{link:name}}).
//
// {{embed:path}} / {{embed:path corner}} is the one deliberate exception: it's a zero-width
// pin marking a row+character position, not a decorator around visible text (nothing renders
// in its place), so it never goes on the stack waiting for a close - it records its span
// immediately, start === end at the point it appears. A stray {{/embed}} still errors via the
// normal close-tag mismatch check below, since nothing of that tag is ever pushed.

import { PcobError } from './types';

export type TagName = 'link' | 'anchor' | 'cycle' | 'noise' | 'embed';
const KNOWN_TAGS: readonly TagName[] = ['link', 'anchor', 'cycle', 'noise', 'embed'];

export interface TagSpan {
    tag: TagName;
    param?: string;
    start: number; // inclusive index into `clean`
    end: number;   // exclusive index into `clean`
}

export interface ExtractedText {
    clean: string;
    spans: TagSpan[];
}

export function extractTags(raw: string, lineNo?: number): ExtractedText {
    let clean = '';
    const spans: TagSpan[] = [];
    const stack: { tag: TagName; param?: string; startClean: number }[] = [];

    let i = 0;
    while (i < raw.length) {
        if (raw[i] === '\\' && raw.startsWith('{{', i + 1)) {
            clean += '{{';
            i += 3;
            continue;
        }
        if (raw.startsWith('{{', i)) {
            const close = raw.indexOf('}}', i + 2);
            if (close === -1) throw new PcobError(`Unclosed "{{" tag`, lineNo);
            const inner = raw.slice(i + 2, close);
            i = close + 2;

            if (inner.startsWith('/')) {
                const name = inner.slice(1);
                const top = stack.pop();
                if (!top || top.tag !== name) {
                    throw new PcobError(
                        `Mismatched closing tag {{/${name}}}${top ? ` — expected {{/${top.tag}}}` : ' — no open tag'}`,
                        lineNo,
                    );
                }
                spans.push({ tag: top.tag, param: top.param, start: top.startClean, end: clean.length });
            } else {
                const colonIdx = inner.indexOf(':');
                const name = (colonIdx === -1 ? inner : inner.slice(0, colonIdx)) as TagName;
                const param = colonIdx === -1 ? undefined : inner.slice(colonIdx + 1);
                if (!KNOWN_TAGS.includes(name)) {
                    throw new PcobError(`Unknown tag {{${name}}}`, lineNo);
                }
                if (name === 'embed') {
                    spans.push({ tag: name, param, start: clean.length, end: clean.length });
                } else {
                    stack.push({ tag: name, param, startClean: clean.length });
                }
            }
            continue;
        }
        clean += raw[i];
        i++;
    }

    if (stack.length) {
        throw new PcobError(`Unclosed tag {{${stack[stack.length - 1].tag}}}`, lineNo);
    }
    return { clean, spans };
}

/** True when [start, end) is fully covered by some span of the given tag. */
export function isFullyCoveredBy(spans: TagSpan[], tag: TagName, start: number, end: number): boolean {
    return spans.some(s => s.tag === tag && s.start <= start && s.end >= end);
}
