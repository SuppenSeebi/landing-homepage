// Walks a parsed .pcob AST and produces exactly what PunchCard.astro's renderer already
// consumes: per-card Line[] + callLinks, plus SECTIONS_BY_DIV/PARAS_BY_SECTION-shaped nav
// data (replacing today's hand-maintained src/config/punch-nav.ts). Two passes:
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
import { type AnchorRegistry, makeSeq, tokenizeCardLine } from './tokenizeCardLine';
import { type RawCard, type RawDivision, type RawProgram, type RawSection, parseSource } from './parseSource';
import { type CompiledCard, type CompiledProgram, type CompiledSection, type Line, PcobError } from './types';

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
): CompiledCard {
    const resolvedRows = resolveRows(card, section, division, program);

    const lines: Line[] = [];
    const callLinks: Record<string, string> = {};

    card.body.forEach(bodyLine => {
        const { tokens, callLinks: lineLinks } = tokenizeCardLine(bodyLine.raw, anchors, bodyLine.lineNo);
        lines.push(['', tokens]);
        Object.assign(callLinks, lineLinks);
    });

    if (lines.length > resolvedRows) {
        throw new PcobError(
            `Card "${card.name}" has ${lines.length} lines, exceeding its resolved @ROWS ${resolvedRows}`,
            card.lineNo,
        );
    }
    while (lines.length < resolvedRows) lines.push(['', []]);

    const seqedLines: Line[] = lines.map(([, tokens], idx) => [makeSeq(idx), tokens]);

    return { name: card.name, lines: seqedLines, callLinks };
}

export function compileRawProgram(program: RawProgram): CompiledProgram {
    const registry = buildAnchorRegistry(program);
    const anchors = makeAnchorRegistry(registry);

    const sections: CompiledSection[] = [];
    const divisionMap: CompiledProgram['divisionMap'] = { data: [], proc: [] };
    const sectionsByDiv: CompiledProgram['sectionsByDiv'] = { data: [], proc: [] };
    const parasBySection: CompiledProgram['parasBySection'] = {};

    for (const division of program.divisions) {
        for (const section of division.sections) {
            divisionMap[division.id].push(section.id);
            sectionsByDiv[division.id].push({ label: `${section.name} SECTION.`, href: `#${section.id}` });
            parasBySection[section.id] = section.cards.map((card, cardIdx) => ({
                label: `${card.name}.`,
                href: `#${section.id}`,
                cardIdx,
            }));

            const cards = section.cards.map(card => compileCard(card, section, division, program, anchors));
            sections.push({ id: section.id, name: section.name, division: division.id, cards });
        }
    }

    return { sections, divisionMap, sectionsByDiv, parasBySection };
}

/** Single-file entry point — parses then compiles one self-contained .pcob source (no
 * @IMPORT resolution). Used by anything that only ever deals with one file at a time, e.g.
 * docs/pcob-reference.md's Complete example. Multi-file programs go through
 * src/pcob/loadProgram.ts's loadMainProgram() instead, which resolves @IMPORT before calling
 * compileRawProgram directly. */
export function compileProgram(source: string): CompiledProgram {
    return compileRawProgram(parseSource(source));
}
