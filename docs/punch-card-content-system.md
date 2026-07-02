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

### Core rule: the coding-area text is WYSIWYG

**The rendered COBOL STATEMENT text (the punch card's coding area) is a 1:1 rendering of what
Sebastian typed in the `.pcob` file.** Strip out `{{tags}}` and every remaining character in a
rendered card must trace back to literal text he wrote — the compiler never invents, injects, or
auto-generates a visible line. This applies without exception: DIVISION headers, SECTION
headers, paragraph names, record group lines — if any of these should appear, Sebastian types
them himself, per card, same as any other line.

Directives (`@DIVISION`, `@SECTION`, `@CARD`, `@ROWS`, `@SLOT`) and inline tags (`{{link}}`,
`{{anchor}}`, `{{cycle}}`, `{{noise}}`) only ever affect things *around* the text — anchors, nav
labels, link targets, row budget, future animation — never the text itself. Naming used for
navigation (a `@SECTION`'s name, a `@CARD`'s name) is independent of whatever text Sebastian
chooses to write to visually represent that division/section/paragraph in the card (which may
need different casing, spacing, or wording) — keeping the two in sync, if he wants them in sync,
is his responsibility, not the compiler's.

Concretely: wanting a link means setting an anchor and a link tag, explicitly, both ends. Wanting
a DIVISION heading in the navbar means naming it in `@DIVISION`/`@SECTION`; wanting that heading
to *also* show as a line of card text means typing that line, separately, as card text. Nothing
implicit.

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

### DRY violations found
| Data | Where | Issue | Eliminated by the new model? |
|---|---|---|---|
| `DATA DIVISION.` / `LOCAL-STORAGE SECTION.` header lines | Every `SectionAboutMe`/`SectionWork` card array | Identical literal tuples repeated 7× | **No, by design** — see [Core rule](#core-rule-the-coding-area-text-is-wysiwyg) above. The compiler never injects visible text; Sebastian types these per card if he wants them, same repetition as today. |
| Sequence numbers (`000001`…) | Every `Line` tuple | Always strictly sequential — pure index math typed by hand | Yes — derived from row position. |
| Paragraph nav labels (`WORK-NOW.`, etc.) | `punch-nav.ts` `PARAS_BY_SECTION` | Hand-mirrors text already in card data; two sources of truth | Yes — derived from `@CARD` name. |
| Link targets | Per-section `callLinks: Record<string,string>` | Lives apart from the token it applies to | Yes — derived from `{{link}}`/`{{anchor}}` tags at the point of use. |
| Dynamic field offsets (`NAME_START=7`, `VAL_START=39`, …) | `SectionTop.astro` | Character-offset math into a flattened row; silently breaks if text length changes | Deferred to Phase 5 — `{{cycle:groupId}}` replaces the offset constants, not yet wired to the renderer. |
| Row-count padding | Manually appended `['0000NN', []]` entries | Magic number, easy to get wrong (this is what was just fixed by hand) | Yes — derived from resolved `@ROWS`. |

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

**Syntax finalized** (after a dedicated discussion round) in two artifacts:
- `docs/dsl-mockup.pcob` — a full worked example with inline commentary explaining each construct.
- `docs/pcob-reference.md` — the terse keyword/tag reference to actually write `.pcob` files from.

Headline decisions from that discussion (superseding the earlier indentation-based sketch that
used to live in this section):
- **Text vs. directive split**: a line is a directive only if its first non-space character is
  `@`; everything else is rendered card text. No indentation-sensitive parsing.
- **Comments**: `@@ ...` (not a special keyword like `REM`).
- **Indentation is non-semantic**: leading whitespace before a recognized line shape (a level
  number, a statement verb) is always ignored — the compiler emits its own canonical indent.
  Internal spacing after that prefix (e.g. padding to line up sibling `PIC` clauses) is left
  exactly as typed.
- **`@ROWS N`** is one directive, usable at program level, right after a `SECTION`, or inside a
  `CARD` — nearest one wins (Card > Section > program default). Replaces the earlier `rows=`
  attribute idea with a single, uniformly-scoped mechanism.
- **Linking has no implicit `self`.** `{{link:name}}` references an anchor by bare name (a
  `@SECTION id=` is automatically one); `{{link:'https://...'}}` (quoted) is an external URL.
  `{{anchor:name}}` declares a finer-grained target below section level, sharing one namespace
  with section ids.
- **`{{cycle:groupId}}`** replaces `SectionTop`'s character-offset constants; **`{{noise}}`** is
  the (not-yet-needed) ASCII-scramble tag, included now so the syntax exists before it's required.
- **`@SLOT name rows=N`** stays the escape hatch for Impressum's floating legal-text overlay —
  reserves rows, doesn't model the HTML.

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

Broken into small, independently-committable steps so a fresh session (or a context reset
mid-phase) can read this table and know exactly what's done, without needing prior chat
history. Update the **State** column in the same commit as the step it describes — that's
the durable record, not the conversation.

| # | Step | State |
|---|---|---|
| 3.1 | Decide + implement how a `.pcob` file gets from disk into `compileProgram()` at Astro build time. | **Done** — Vite `?raw` string import in `SectionLinks.astro`'s frontmatter (`import linksSource from '../../content/punchcard/links.pcob?raw'`), then `compileProgram(linksSource)`. No Astro config changes needed; `astro/client` ambient types already cover `?raw`. |
| 3.2 | Write `src/content/punchcard/links.pcob` — author LINKS section content matching today's `SectionLinks.astro` data 1:1. | **Done** — `src/content/punchcard/links.pcob`, hand-typed DIVISION/SECTION/paragraph-name lines per the WYSIWYG rule. |
| 3.3 | Wire `SectionLinks.astro` to compile 3.2's file and feed the result into the existing `<PunchCard>` props. | **Done** — `SERVICES-PRGRPH`/`SOCIALS-PRGRPH` cards looked up by name from the compiled section; hand-written `LINES`/`CALL_LINKS` arrays deleted. |
| 3.4 | Verify structural equivalence against the current hand-written arrays. | **Done** — compiled `lines` are byte-identical to both hand-written arrays (verified via a scratch diff script, not committed — no test runner configured yet). `callLinks` differ from the old shared object by design/improvement: the compiler emits precise per-card link maps instead of one object with irrelevant keys reused across both cards; functionally equivalent since `PunchCard.astro` only looks up keys that exist in that card's own rendered text. `astro build` (via `node_modules/.bin/astro build`, since neither `pnpm` nor `npx astro` were on PATH in this shell) completed with no errors; output HTML contains the expected compiled text. |
| 3.5 | Decide `punch-nav.ts` fate for this pilot. | **Done** — applied the stated default: left untouched. Links' nav entries in `src/config/punch-nav.ts` are still the hand-written ones; nav consolidation is deferred to Phase 4. |
| 3.6 | Sebastian's visual confirmation of the migrated Links section. Do not start Phase 4 before this is checked off. | Not started — **blocked on Sebastian**, not on further work. |

Anything that doesn't port cleanly gets written into the Migration findings below, not
silently worked around.

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

### Resolved decisions
- [x] File extension: **`.pcob`**, location `src/content/punchcard/*.pcob` (to be created during
      Phase 2/3 — not yet wired anywhere).
- [x] Comment syntax: `@@ ...`, not a keyword like `REM`.
- [x] `@ROWS` scoping: Card > Section > program default, one directive for all three levels.
- [x] No implicit `self` for links — see `{{link:name}}` / `{{anchor:name}}` in Phase 1 above.
- [x] No special "you are here" treatment for self-referencing links (e.g. Impressum's own
      `IDENTIFICATION` header pointing at `#impressum`). There is no such thing as a self-link in
      the model — a card only ever *defines* an anchor or *links to* one by name; if the resolved
      anchor happens to match the page you're already on, that's not a distinct case the DSL or
      compiler needs to know about or suppress.
- [x] Anchor/link uniqueness: **anchors** (`@SECTION id=` and `{{anchor:name}}`) share one flat
      namespace and must be globally unique — this is a compiler validation responsibility (not
      yet built). **Links** (`{{link:name}}` / `{{link:'url'}}`) may reference the same anchor any
      number of times — duplicates are normal, not an error. Paragraph nav entries are just
      labelled links into that same namespace, so they're covered by this rule already, not a
      separate case. `DIVISION` (`data` / `proc`) is a small fixed grouping attribute on sections,
      not an authored/anchored identifier, so it isn't part of this uniqueness check.

### Open decisions (need an answer before/while building)
*(empty — see Resolved decisions above)*

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
- **No implicit lines, ever — DIVISION/SECTION/paragraph-name lines are hand-typed per card.**
  Per direct clarification, the compiler must never generate a visible card-text line; it only
  recognizes and colors DIVISION/SECTION/paragraph-name shapes when Sebastian types them himself
  (see the Core rule near the top of this doc). This reverses `compile.ts`'s original
  auto-stamping behavior. Concretely: migrated `.pcob` cards repeat their `DATA DIVISION.` /
  `LOCAL-STORAGE SECTION.` / `01 ABOUT-ME.` lines by hand, same as today's `Line[]` arrays do —
  that specific DRY violation is *not* eliminated by the new model, by design. See the DRY
  violations table in section B for the full accounting of what is/isn't eliminated.
- **Nav label wording will still change cosmetically** (this part *is* auto-derived). The
  compiler always renders a `sectionsByDiv` nav label as `NAME SECTION.`, uniformly. Today's
  hand-written labels aren't uniform — `WORKING-STORAGE.` / `LOCAL-STORAGE.` (no "SECTION"
  suffix) vs `LINKS SECTION.` vs `IMPRESSUM-SECTION.` (hyphenated, no space). When a section
  migrates, expect its nav text to shift to the uniform `NAME SECTION.` form unless the
  `@SECTION` name is chosen to reproduce today's exact wording.
- **Bug found in both DSL example files while building the compiler**: `EXIT PARAGRAPH`/
  `EXIT SECTION` were written with a trailing, unclosed `{{link:name}}` (no wrapping, no
  `{{/link}}`) — inconsistent with every other tag use and with the "always paired, no bare
  shorthand" decision. Fixed in `docs/dsl-mockup.pcob` and `docs/pcob-reference.md` to
  `{{link:name}}EXIT PARAGRAPH{{/link}}`.
- **Gap found comparing the compiler against real site content**: today's `SectionLinks.astro`
  renders a paragraph-name line (`SERVICES-PRGRPH.`, styled `para`) that neither the grammar docs
  nor the Phase 2 compiler accounted for. Resolved by adding paragraph-name as a recognized (not
  generated) card-text line shape — a bare `NAME.` line with nothing else on it.

---

## Quick status snapshot

| Phase | Status |
|---|---|
| 0 — Fix `#top` height asymmetry | Confirmed. `align-self: stretch` on `.top-punch-wrapper` plus switching `.pcf-punch-area` from flex-column to CSS Grid (`minmax(0, 1fr)` rows) to fix uneven row heights between text and empty rows |
| 1 — Format design | Syntax finalized — see `docs/dsl-mockup.pcob` + `docs/pcob-reference.md` |
| 2 — Parser/compiler | Core built in `src/pcob/` (parser, tag extractor, level-row/statement-row tokenizers, anchor resolution, nav derivation). Validated by compiling `docs/dsl-mockup.pcob` and the reference's Complete example. Not yet wired into any Astro page or `.pcob` content file — that's Phase 3. |
| 3 — Pilot migration (Links) | 3.1–3.5 done — Links section now renders from `src/content/punchcard/links.pcob` via the compiler. Blocked on 3.6, Sebastian's visual confirmation, before Phase 4 starts |
| 4 — Full migration | Not started |
| 5 — Animation tags | Deferred |
