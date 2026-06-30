# Punch Card Content System — Design Doc

Status: **concept / not implemented**. No rendering code has changed because of this doc.
Owner of rendering machinery: Claude. Owner of content/structure: Sebastian.

---

## A. Goal

Today, every card on the site is a hand-written `Line[]` TypeScript literal: sequence numbers,
line numbers, DIVISION/SECTION boilerplate, row-padding, and link targets are all typed out by
hand, repeated per card, and kept in sync with `punch-nav.ts` and per-section `callLinks` maps
by hand. This works, but two problems follow directly from it:

1. **Error-prone duplication.** The same DIVISION/SECTION header lines are copy-pasted into
   every card in a section. Nav labels in `punch-nav.ts` are a second, hand-maintained copy of
   text that already exists in the card data. Sequence numbers are 100% derivable from position
   but are typed out anyway. Row counts are manually padded with `[]` entries to hit a magic
   number. Any drift between these copies is a silent bug.
2. **A trust gap.** Sebastian wants to edit text content himself — small wording changes, new
   links, maybe a new card — without being afraid of breaking something in code he didn't write.
   Hand-rolled TS literals and the rendering script around them don't offer that confidence today.

**The goal is a clean split:**

- **Design, layout, and rendering machinery** = built once by Claude, reused everywhere. This
  includes the visual system (punch card chrome, column rulers, transitions), the
  Division/Section/Paragraph data model, and the compiler that turns content into what the
  renderer already expects.
- **Content** = owned and edited by Sebastian, in a plain-text format he can read, reason about,
  and safely change without touching TypeScript/component code. New capability he wants but the
  format doesn't support yet becomes a conversation ("extend the format to allow X"), not a
  reason to hand-edit rendering internals.

A useful test for any design decision below: *if Sebastian opens this file at 11pm with no
context, can he confidently change one line of text or add one card without fear of breaking
the page?* If the answer is no, the design needs to move further toward plain text and away
from code.

---

## B. Current state (as of this conversation)

### What's already solid
- Card chrome (title bar, form header, zone row, ruler rows) and the COBOL column-budget logic
  (`pcf-chars` fixed 80-col grid, Area A/B boundaries, ruler tick math) were just fixed and are
  visually correct on the WORKING-STORAGE card. This is the rendering target the new system
  must keep producing — no visual regressions are acceptable from a model change alone.
- All 10 cards across the 5 sections now have a uniform 19-row line count.
- `PunchCard.astro`'s client-side renderer (`renderLinesForArea`, ruler builders) consumes a
  simple `Line[]` format and doesn't need to know anything about where that data came from —
  this is the seam a compiler can sit behind without touching the renderer.

### Known bug: card row height still differs between sections
Root cause identified and Phase 0 fix applied (`align-self: stretch` added to
`.top-punch-wrapper` in `global.css`) — pending Sebastian's visual confirmation:
- `#top` (WORKING-STORAGE): `.top-container` is a row-flex with `align-items: center`.
  `.top-punch-wrapper`'s `flex: 1` only affects width in that row direction, so the wrapper
  (and everything inside it, down to each `.pcf-line-row`) sizes to its own min-content height —
  i.e. compact, "natural" line height — rather than filling the available vertical space.
- `#aboutme` / `#work` / `#links`: cards are positioned via `.pcf-stage-multi .pcf-card { top:
  7vh; bottom: 7vh; }` — a definite height — so rows stretch to fill ~86vh.
- `#impressum`: uses plain `.pcf-stage { height: 100%; flex-direction: column }`, which is also
  a definite height, so it behaves like the multi-card sections (tall rows).
- Net effect: WORKING-STORAGE renders compact rows; the other four sections render tall rows.
  This is a CSS layout fix (give `.top-punch-wrapper` a definite/stretched height), independent
  of the content-model work in this doc, but listed here because "same form factor" depends on
  fixing it too.
- Secondary, smaller effect once the above is fixed: 19 equal-flex rows dividing a non-integer
  pixel height will sub-pixel round, causing up to ~1px jitter between rows. A fixed-px row
  height (computed once, applied directly) avoids this; flex-grow distribution doesn't.

### DRY violations found (concrete, to be eliminated by the new model)
| Data | Where | Issue |
|---|---|---|
| `DATA DIVISION.` / `LOCAL-STORAGE SECTION.` header lines | Every `SectionAboutMe`/`SectionWork` card array | Identical literal tuples repeated 7×|
| Sequence numbers (`000001`…) | Every `Line` tuple | Always strictly sequential — pure index math typed by hand |
| Paragraph nav labels (`WORK-NOW.`, etc.) | `punch-nav.ts` `PARAS_BY_SECTION` | Hand-mirrors text already in card data; two sources of truth |
| Link targets | Per-section `callLinks: Record<string,string>` | Lives apart from the token it applies to |
| Dynamic field offsets (`NAME_START=7`, `VAL_START=39`, …) | `SectionTop.astro` | Character-offset math into a flattened row; silently breaks if text length changes |
| Row-count padding | Manually appended `['0000NN', []]` entries | Magic number, easy to get wrong (this is what was just fixed by hand) |

---

## C. Required work (phased)

This is a sequence, not a sprint plan — each phase should be validated (visually, by Sebastian)
before the next begins.

### Phase 0 — Unblock (small, independent)
- Fix the `#top` container height asymmetry (CSS only) so WORKING-STORAGE's row height matches
  the rest. This does not depend on anything else in this doc and can happen first.

### Phase 1 — Design the authoring format
Decision made: **plain-text DSL**, not TypeScript object literals. Rationale: Sebastian should
be able to open a text file and change a value or add a line without writing TypeScript.

Working sketch (subject to revision once we actually start building it):

```
DIVISION DATA
  SECTION WORKING-STORAGE id=top rows=19
    PARAGRAPH SSCHW-RECORD
      01 SSCHW-RECORD.
      05 IDENTITY.
        10 NAME-VAL PIC X(32) VALUE {{CYCLE:identity}}'SEBASTIAN SCHWINN'.
        10 NAME-DSCRPTN PIC X(9) VALUE {{CYCLE:identity-desc}}'NAME'.
      05 BACKGROUND.
        10 ...

  SECTION LOCAL-STORAGE id=aboutme rows=19
    PARAGRAPH WORK-NOW
      05 WORK-NOW.
        10 COMPANY PIC X(30) VALUE 'RETROCODE'.
        10 ROLE    PIC X(30) VALUE 'COBOL DEVELOPER'.
    PARAGRAPH WORK-BFRE
      05 WORK-BFRE.
        10 COMPANY PIC X(30) VALUE 'HILSCHER'.

DIVISION PROCEDURE
  SECTION LINKS id=links rows=19
    PARAGRAPH SERVICES-PRGRPH
      * Personal wiki and notes
      CALL {{LINKTO:'https://kb.sschw.dev'}}'KB.SSCHW.DEV'
      .
      * GOBACK TO PROCEDURE DIVISION LINKS SECTION
      EXIT PARAGRAPH {{LINKTO:self}}
      .

  SECTION IMPRESSUM id=impressum rows=19 identification=self
    PARAGRAPH IMPRESSUM-SECTION
      DISPLAY
      SLOT impressum-legal rows=11
      END-DISPLAY
      * GOBACK TO PROCEDURE DIVISION LINKS SECTION
      EXIT SECTION {{LINKTO:'#impressum'}}
      .
```

Notes on this sketch:
- Indentation expresses the Division → Section → Paragraph → field hierarchy (like YAML/Pug) —
  no braces to balance.
- DIVISION/SECTION boilerplate text is written **once** per section, not per card; the
  compiler stamps it onto every paragraph/card automatically.
- `rows=` is declared once per section (override-able per paragraph later if ever needed) and
  drives auto-padding — this directly replaces manual blank-line counting.
- Sequence numbers and `LINE` numbers are never written — always derived from position.
- `{{TAG:param}}` is the one piece of "syntax" to learn; everything else is just COBOL-flavored
  text, matching how the page already reads. `{{LINKTO:...}}`, `{{CYCLE:groupId}}` cover today's
  link and dynamic-field-cycling needs; more tags get added on request (see process below).
- `SLOT name rows=N` is the explicit escape hatch for non-text regions (Impressum's legal grid).
  It reserves blank rows; the section's own component still owns the actual HTML/positioning —
  slots are intentionally not absorbed into the text model.
- `identification=self` on a section flags that its own header IDENTIFICATION link shouldn't
  behave as a normal cross-section link (exact UI treatment — suppressed vs. "you are here"
  styling — still open, see Decisions Log).

Process for extending the tag vocabulary: when Sebastian wants something the current tags can't
express, that's a short scoped conversation ("add a `{{TAG}}` that does X"), not a request to
edit renderer internals. The format grows by request, not by guessing future needs up front.

### Phase 2 — Build the parser + compiler (Claude-owned code)
- Small hand-written line/indentation parser → structured tree (Division/Section/Paragraph/Line).
- Compiler walks the tree and emits **today's exact `Line[]` format**, so `PunchCard.astro`'s
  renderer needs zero changes. This is the main risk-reduction move: the new system is purely
  "what feeds the renderer," not a renderer rewrite.
- Compiler also derives `SECTIONS_BY_DIV` / `PARAS_BY_SECTION` (replacing the hand-maintained
  `punch-nav.ts`) and the link map (replacing per-section `callLinks`) from the same tree.
- Runs at Astro build time (frontmatter), zero runtime cost.

### Phase 3 — Pilot migration (one section)
- Migrate the smallest section (Links — 2 short paragraphs) to the new format end-to-end.
- Visual check by Sebastian against the current rendering before touching anything else.
- Anything that doesn't port cleanly gets written into the Decisions Log below, not silently
  worked around.

### Phase 4 — Migrate remaining sections
- AboutMe (5 paragraphs), Work (2), Impressum (1, with its `SLOT` special case), Top (1).
- Each migration gets its own visual check before moving to the next.
- Delete the old hand-written arrays and `punch-nav.ts` content once each section is confirmed.

### Phase 5 — Re-introduce animation/transition tags (deferred, not blocking)
- Today there are two distinct behaviors: SectionTop's per-field scramble-cycle and the
  multi-card sections' whole-row scramble-on-swap. Once the base system is stable, design a
  small, deliberately narrow tag set for these rather than a general animation DSL.

---

## D. Decisions log / concerns / things to document as we go

Use this section as a running list — append rather than rewrite, so we keep a record of what
was decided and why, and what was found not to port cleanly.

### Open decisions (need an answer before/while building)
- [ ] Exact suppressed/"you are here" treatment for Impressum's self-referencing
      `identification=self` header link.
- [ ] File extension / location for the new content files (e.g. `src/content/*.pcard`?).
- [ ] Exact tag syntax details: case sensitivity, how `{{LINKTO:self}}` resolves to "the current
      section's anchor" without hardcoding it twice.

### Risks to keep in mind while building (carried over from initial design discussion)
- **Column-budget tension**: the DSL must not auto-layout `PIC X(N)` padding or column
  positions. Sebastian writes exact text; the system's job is bookkeeping (sequence numbers,
  row counts, link wiring) around that text, not making layout decisions for him. The first
  time the compiler "helpfully" reflows a value, the precise-alignment aesthetic breaks.
- **Tag vocabulary scope creep**: keep the tag set minimal and request-driven (see Phase 1
  process note) rather than designing a general-purpose templating language up front.
- **Sub-pixel row-height rounding**: even after Phase 0, verify rows use a computed fixed
  pixel height rather than flex-grow distribution if 1px jitter is visible.

### Migration findings (fill in during Phase 3/4)
*(empty — populate as sections are migrated)*

---

## Quick status snapshot

| Phase | Status |
|---|---|
| 0 — Fix `#top` height asymmetry | Implemented (`align-self: stretch` on `.top-punch-wrapper`); pending Sebastian's visual confirmation |
| 1 — Format design | Sketch above; format choice (plain-text DSL) confirmed |
| 2 — Parser/compiler | Not started |
| 3 — Pilot migration (Links) | Not started |
| 4 — Full migration | Not started |
| 5 — Animation tags | Deferred |
