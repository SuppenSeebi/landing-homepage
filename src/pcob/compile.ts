// Walks a parsed .pcob AST and produces exactly what PunchCard.astro's renderer already
// consumes: per-card Line[] + callLinks + embeds, plus SECTIONS_BY_DIV/PARAS_BY_SECTION-shaped
// nav data (replacing today's hand-maintained src/config/punch-nav.ts). Two passes:
//   1. Walk the tree to register every anchor (@SECTION id= and {{anchor:name}}) in one
//      flat namespace and reject duplicates, before any link needs resolving.
//   2. Walk it again to tokenize card text, resolve {{link}} targets against the now-
//      complete registry, and pad/validate each card's row count.
//
// The compiler never synthesizes visible card-text lines (no DIVISION/SECTION/paragraph-
// name auto-stamping) — see the "coding-area text is WYSIWYG" rule in
// docs/punch-card-content-system.md. Nav data (divisionMap/sectionsByDiv/parasBySection)
// is derived freely, since that's structure *around* the text, not the text itself.
//
// {{cycle}}/{{noise}} tags are parsed and validated (so malformed usage errors out here,
// not silently) but otherwise inert — wiring them into the renderer is Phase 5, deferred
// by design (see docs/punch-card-content-system.md).

import { extractTags } from './tags';
import { type AnchorRegistry, type EmbedResolver, makeSeq, tokenizeCardLine } from './tokenizeCardLine';
import {
    type HeaderSlot, type RawCard, type RawDivision, type RawHeaderCell, type RawProgram, type RawSection,
    parseSource,
} from './parseSource';
import {
    type CompiledCard, type CompiledHeader, type CompiledProgram, type CompiledSection, type HeaderCell,
    type Line, PcobError,
} from './types';

// This module walks a fully-resolved RawProgram tree (any @IMPORTs already merged in by
// parseSource) - it doesn't know or care whether that tree came from one file or several.

interface AnchorEntry {
    sectionId: string;
    kind: 'section' | 'anchor';
    lineNo: number;
}

function buildAnchorRegistry(program: RawProgram): Map<string, AnchorEntry> {
    const registry = new Map<string, AnchorEntry>();
    const declare = (name: string, sectionId: string, kind: AnchorEntry['kind'], lineNo: number) => {
        const existing = registry.get(name);
        if (existing) {
            throw new PcobError(
                `Duplicate anchor "${name}" — already declared as ${existing.kind} in section "${existing.sectionId}"`,
                lineNo,
            );
        }
        registry.set(name, { sectionId, kind, lineNo });
    };

    for (const division of program.divisions) {
        for (const section of division.sections) {
            declare(section.id, section.id, 'section', section.lineNo);
            for (const card of section.cards) {
                for (const bodyLine of card.body) {
                    if (!bodyLine.raw) continue;
                    const { spans } = extractTags(bodyLine.raw, bodyLine.lineNo);
                    for (const span of spans) {
                        if (span.tag === 'anchor' && span.param) {
                            declare(span.param, section.id, 'anchor', bodyLine.lineNo);
                        }
                    }
                }
            }
        }
    }
    return registry;
}

function makeAnchorRegistry(registry: Map<string, AnchorEntry>): AnchorRegistry {
    return {
        resolveAnchor(name, lineNo) {
            const entry = registry.get(name);
            if (!entry) {
                throw new PcobError(`{{link:${name}}} does not match any @SECTION id= or {{anchor:}}`, lineNo);
            }
            return `#${entry.sectionId}`;
        },
    };
}

/** Resolves a header cell's value text the same way a {{link}}-bearing card value would -
 * reusing extractTags rather than inventing new tag-parsing logic. At most one {{link}} is
 * expected per cell; if present, it makes the whole rendered cell clickable (see
 * PunchCard.astro), same as today's hardcoded XREF/IDENTIFICATION cells. */
function resolveHeaderCell(raw: RawHeaderCell, anchors: AnchorRegistry): HeaderCell {
    const { clean, spans } = extractTags(raw.valueRaw, raw.lineNo);
    const linkSpan = spans.find(s => s.tag === 'link');
    let href: string | undefined;
    if (linkSpan) {
        const param = linkSpan.param ?? '';
        href = param.startsWith("'") && param.endsWith("'") ? param.slice(1, -1) : anchors.resolveAnchor(param, raw.lineNo);
    }
    return { label: raw.label, value: clean, href };
}

function requireHeaderCell(program: RawProgram, slot: HeaderSlot, directiveName: string): RawHeaderCell {
    const raw = program.header[slot];
    if (!raw) throw new PcobError(`No ${directiveName} defined (all 5 header cells are required)`);
    return raw;
}

function resolveHeader(program: RawProgram, anchors: AnchorRegistry): CompiledHeader {
    const leftFirst   = resolveHeaderCell(requireHeaderCell(program, 'leftFirst', '@HEADER-LEFT-FIRST'), anchors);
    const leftSecond  = resolveHeaderCell(requireHeaderCell(program, 'leftSecond', '@HEADER-LEFT-SECOND'), anchors);
    const leftThird   = resolveHeaderCell(requireHeaderCell(program, 'leftThird', '@HEADER-LEFT-THIRD'), anchors);
    const rightFirst  = resolveHeaderCell(requireHeaderCell(program, 'rightFirst', '@HEADER-RIGHT-FIRST'), anchors);
    const rightSecond = resolveHeaderCell(requireHeaderCell(program, 'rightSecond', '@HEADER-RIGHT-SECOND'), anchors);
    return { left: [leftFirst, leftSecond, leftThird], right: [rightFirst, rightSecond] };
}

function makeEmbedResolver(resolveEmbedFile: (path: string) => string | undefined): EmbedResolver {
    return {
        resolveEmbedFile(path, lineNo) {
            const html = resolveEmbedFile(path);
            if (html === undefined) {
                throw new PcobError(`{{embed:${path}}} — file not found`, lineNo);
            }
            return html;
        },
    };
}

function resolveRows(card: RawCard, section: RawSection, division: RawDivision, program: RawProgram): number {
    const resolved = card.rowsOverride ?? section.rowsOverride ?? division.rowsOverride ?? program.defaultRows;
    if (resolved === undefined) {
        throw new PcobError(`No @ROWS resolvable for card "${card.name}" (not set at card, section, or program level)`, card.lineNo);
    }
    return resolved;
}

function compileCard(
    card: RawCard,
    section: RawSection,
    division: RawDivision,
    program: RawProgram,
    anchors: AnchorRegistry,
    embedResolver: EmbedResolver,
    cardIdx: number,
): CompiledCard {
    const resolvedRows = resolveRows(card, section, division, program);

    const lines: Line[] = [];
    const callLinks: Record<string, string> = {};
    const embeds: CompiledCard['embeds'] = [];

    card.body.forEach((bodyLine, row) => {
        const { tokens, callLinks: lineLinks, embeds: lineEmbeds } = tokenizeCardLine(bodyLine.raw, anchors, embedResolver, bodyLine.lineNo);
        lines.push(['', tokens]);
        Object.assign(callLinks, lineLinks);
        for (const e of lineEmbeds) embeds.push({ ...e, row, sectionId: section.id, cardIdx });
    });

    if (lines.length > resolvedRows) {
        throw new PcobError(
            `Card "${card.name}" has ${lines.length} lines, exceeding its resolved @ROWS ${resolvedRows}`,
            card.lineNo,
        );
    }
    while (lines.length < resolvedRows) lines.push(['', []]);

    const seqedLines: Line[] = lines.map(([, tokens], idx) => [makeSeq(idx), tokens]);

    return { name: card.name, lines: seqedLines, callLinks, embeds };
}

export function compileRawProgram(program: RawProgram, resolveEmbedFile: (path: string) => string | undefined): CompiledProgram {
    const registry = buildAnchorRegistry(program);
    const anchors = makeAnchorRegistry(registry);
    const embedResolver = makeEmbedResolver(resolveEmbedFile);
    const header = resolveHeader(program, anchors);

    const sections: CompiledSection[] = [];
    const divisionMap: CompiledProgram['divisionMap'] = { data: [], proc: [] };
    const sectionsByDiv: CompiledProgram['sectionsByDiv'] = { data: [], proc: [] };
    const parasBySection: CompiledProgram['parasBySection'] = {};

    for (const division of program.divisions) {
        for (const section of division.sections) {
            divisionMap[division.id].push(section.id);
            sectionsByDiv[division.id].push({ label: `${section.name} SECTION`, href: `#${section.id}` });
            parasBySection[section.id] = section.cards.map((card, cardIdx) => ({
                label: card.name,
                href: `#${section.id}`,
                cardIdx,
            }));

            const cards = section.cards.map((card, cardIdx) => compileCard(card, section, division, program, anchors, embedResolver, cardIdx));
            sections.push({ id: section.id, name: section.name, division: division.id, cards });
        }
    }

    return { sections, divisionMap, sectionsByDiv, parasBySection, header };
}

/** Single-file entry point — parses then compiles one self-contained .pcob source (no
 * @IMPORT resolution). Used by anything that only ever deals with one file at a time, e.g.
 * docs/pcob-reference.md's Complete example. Multi-file programs go through
 * src/pcob/loadProgram.ts's loadMainProgram() instead, which resolves @IMPORT before calling
 * compileRawProgram directly. `resolveEmbedFile` defaults to "nothing found" - fine for
 * anything that doesn't reference {{embed}}. */
export function compileProgram(source: string, resolveEmbedFile: (path: string) => string | undefined = () => undefined): CompiledProgram {
    return compileRawProgram(parseSource(source), resolveEmbedFile);
}
