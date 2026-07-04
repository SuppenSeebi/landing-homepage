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

**Extended target (Phase 6, sketched 2026-07-04):** the same test, applied to adding a whole new
*section*, not just editing an existing one — drop a new `.pcob` file in `src/content/_punchcard/`,
add one line to a `main.pcob` naming it, and it renders correctly (nav, scroll order, working
cross-section links) with no other file touched. Phases 1–5 solved this for card *text*; Phase 6
is the same trust gap applied to section/card *structure*.

### Core rule: the coding-area text is WYSIWYG

**The rendered COBOL STATEMENT text (the punch card's coding area) is a 1:1 rendering of what
Sebastian typed in the `.pcob` file.** Strip out `{{tags}}` and every remaining character in a
rendered card — including leading and internal whitespace — must trace back to literal text he
wrote — the compiler never invents, injects, auto-generates, or re-indents a visible line. This
applies without exception: DIVISION headers, SECTION headers, paragraph names, record group
lines — if any of these should appear, Sebastian types them himself, per card, same as any other
line, indentation included. There is no canonical/auto-applied indent for any recognized line
shape (level rows, statements, headers); want a statement indented five spaces, or a standalone
`.` under column 12? Type the spaces — the compiler classifies characters into colored tokens, it
never adds or discards any.

Directives (`@DIVISION`, `@SECTION`, `@CARD`, `@ROWS`) and inline tags (`{{link}}`,
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
- ~~Indentation is non-semantic: leading whitespace before a recognized line shape is always
  ignored — the compiler emits its own canonical indent.~~ **Superseded** — see the Core rule
  above. Indentation is just more literal text; there is no canonical/auto-applied indent for
  any line shape. Every example in `docs/dsl-mockup.pcob` types its own indentation (following
  this project's visual convention — 01→1 space, 05→5, 10/88→7, statements/standalone `.`→5,
  headers→1 — by choice, not compiler enforcement).
- **`@ROWS N`** is one directive, usable at program level, right after a `SECTION`, or inside a
  `CARD` — nearest one wins (Card > Section > program default). Replaces the earlier `rows=`
  attribute idea with a single, uniformly-scoped mechanism.
- **Linking has no implicit `self`.** `{{link:name}}` references an anchor by bare name (a
  `@SECTION id=` is automatically one); `{{link:'https://...'}}` (quoted) is an external URL.
  `{{anchor:name}}` declares a finer-grained target below section level, sharing one namespace
  with section ids.
- **`{{cycle:groupId}}`** replaces `SectionTop`'s character-offset constants; **`{{noise}}`** is
  the (not-yet-needed) ASCII-scramble tag, included now so the syntax exists before it's required.
- ~~`@SLOT name rows=N` stays the escape hatch for Impressum's floating legal-text overlay~~
  **Removed entirely (2026-07-04)** — see "`@SLOT` removed as dead code" in Migration findings.
  Embedding non-text content (images, video, rich HTML) has no mechanism yet; if it's needed,
  design it fresh rather than reviving this.

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
| 3.2 | Write `src/content/_punchcard/links.pcob` — author LINKS section content matching today's `SectionLinks.astro` data 1:1. | **Done** — `src/content/_punchcard/links.pcob`, hand-typed DIVISION/SECTION/paragraph-name lines per the WYSIWYG rule. |
| 3.3 | Wire `SectionLinks.astro` to compile 3.2's file and feed the result into the existing `<PunchCard>` props. | **Done** — `SERVICES-PRGRPH`/`SOCIALS-PRGRPH` cards looked up by name from the compiled section; hand-written `LINES`/`CALL_LINKS` arrays deleted. |
| 3.4 | Verify structural equivalence against the current hand-written arrays. | **Done** — compiled `lines` are byte-identical to both hand-written arrays (verified via a scratch diff script, not committed — no test runner configured yet). `callLinks` differ from the old shared object by design/improvement: the compiler emits precise per-card link maps instead of one object with irrelevant keys reused across both cards; functionally equivalent since `PunchCard.astro` only looks up keys that exist in that card's own rendered text. `astro build` (via `node_modules/.bin/astro build`, since neither `pnpm` nor `npx astro` were on PATH in this shell) completed with no errors; output HTML contains the expected compiled text. |
| 3.5 | Decide `punch-nav.ts` fate for this pilot. | **Done** — applied the stated default: left untouched. Links' nav entries in `src/config/punch-nav.ts` are still the hand-written ones; nav consolidation is deferred to Phase 4. |
| 3.6 | Sebastian's visual confirmation of the migrated Links section. Do not start Phase 4 before this is checked off. | **Done** — confirmed 2026-07-03 across several sessions of scroll/nav/layout fixes exercising the whole site including the live Links section, ending with an explicit "I am happy with the design." |

Anything that doesn't port cleanly gets written into the Migration findings below, not
silently worked around.

### Phase 4 — Migrate remaining sections
- AboutMe (5 paragraphs), Work (2), Impressum (1 — turned out not to need `@SLOT` after all, see
  Migration findings), Top (1).
- Each migration gets its own visual check before moving to the next.
- Delete the old hand-written arrays and `punch-nav.ts` content once each section is confirmed.
- `punch-nav.ts` stays hand-written for now (per the 3.5 precedent) — its `PARAS_BY_SECTION`
  entries carry a `cardIdx` (added after the compiler's nav-derivation code was written) that
  `compileProgram()`'s own `parasBySection` output doesn't produce yet. Nav consolidation
  remains its own deferred step, not bundled into any section's content migration.

| # | Step | State |
|---|---|---|
| 4.1 | AboutMe: write `src/content/_punchcard/aboutme.pcob`, mechanically derived from today's `SectionAboutMe.astro` hand-written arrays (no new content invented). | **Done** — 5 cards (`WORK-NOW`, `WORK-BFRE`, `STUDIES`, `PRG-LANGUAGES`, `VOC-LANGUAGES`), program-level `@ROWS 19`, no links/slots needed (this section has none). |
| 4.2 | Wire `SectionAboutMe.astro` to compile 4.1's file and feed the result into the existing `<PunchCard>` props. | **Done** — hand-written `Line[]` arrays deleted; cards looked up by name from the compiled section, same pattern as `SectionLinks.astro`. |
| 4.3 | Verify structural equivalence against the current hand-written arrays. | **Done** — verified via a scratch comparison script (not committed, no test runner configured yet): every row's rendered visible text and per-character color class matches the old hand-written arrays exactly. Token *boundaries* differ in places (e.g. the compiler puts inter-word gap spaces in a different token than the original hand array did) but this is invisible — `PunchCard.astro`'s renderer forces every space character to the blank `pcc-empty` style regardless of which token it came from, so only non-space character classification matters, and that always matches (fixed PIC/VALUE/quote/digit keyword rules, independent of whitespace width). `astro build` completed with no errors; compiled HTML contains the expected text. |
| 4.4 | Sebastian's visual confirmation of the migrated AboutMe section. Do not start the next section's migration before this is checked off. | **Done** — confirmed 2026-07-03 ("looks good") after an explicit proof: temporarily changed a value in `aboutme.pcob`, rebuilt, showed it appear in the compiled HTML in place of the old text, then reverted — demonstrating the rendered card text is genuinely sourced from the `.pcob` file at build time, not a leftover hand-written fallback. |
| 4.5 | Work: write `src/content/_punchcard/work.pcob`, mechanically derived from `SectionWork.astro`'s 2 hand-written arrays. | **Done** — `WORK-CURRENT`/`WORK-PREV`, program-level `@ROWS 19`. `WORK-CURRENT`'s `PROFILE` field carries an external `{{link:'https://www.linkedin.com/in/sschwinn/'}}` — previously bolted on as a hand-written `callLinks` prop keyed on the *untrimmed* val token (`" 'linkedin.com/in/sschwinn/'"`, leading space included); now derived from an inline tag like every other link in the migrated sections, with the same leading-whitespace-excluded fix already applied to Links' `CALL 'LINKEDIN'`. |
| 4.6 | Wire `SectionWork.astro` to compile 4.5's file. | **Done** — hand-written arrays and the hand-written `callLinks` prop both deleted; `currentCard.callLinks`/`prevCard.callLinks` used instead, same pattern as Links/AboutMe. |
| 4.7 | Verify structural equivalence. | **Done** — scratch comparison script: all rows match old arrays character-for-character with matching color class; the link's resolved `href` matches (`https://www.linkedin.com/in/sschwinn/`) though its callLinks *key* differs on purpose (trimmed, no leading space, per 4.5's note). `astro build` succeeds; compiled HTML contains the expected text and link. |
| 4.8 | Sebastian's visual confirmation of the migrated Work section. | **Waived** — 2026-07-03, Sebastian said "go for it," directing continuous progress rather than a per-section confirmation gate from here on. Per-section stops are relaxed for the rest of Phase 4; a comprehensive visual pass across all migrated sections happens once, at the end of Phase 4, instead. |
| 4.9 | Impressum: write `src/content/_punchcard/impressum.pcob`, mechanically derived from `SectionImpressum.astro`'s single hand-written array — **not** using `@SLOT` (see Migration findings' "Impressum's SLOT was already dead" below). | **Done** — one `@CARD IMPRESSUM-SECTION`, 19 rows, no links/slots except a self-link (`{{link:impressum}}EXIT SECTION{{/link}}`) reproducing the existing card's own `callLinks={{ 'EXIT SECTION': '#impressum' }}` exactly, including its pre-existing mismatch with the "GOBACK TO ... LINKS SECTION" comment text next to it (see Migration findings — preserved as-is, not silently "corrected," since deciding the intended target is a content call, not a compiler one). |
| 4.10 | Wire `SectionImpressum.astro` to compile 4.9's file; leave the JS-measured `.impressum-overlay` positioning script untouched (it measures rendered rows by index, not by any compiler-provided slot data). | **Done**. |
| 4.11 | Verify structural equivalence. | **Done** — surfaced and fixed a real tokenizer gap along the way (see Migration findings' "Hyphen-joined header line misclassified"). After the fix, scratch comparison script: all rows match old array character-for-character with matching color class (including the corrected `IMPRESSUM-SECTION.` header coloring); link href matches; `astro build` succeeds. |
| 4.12 | Top: write `src/content/_punchcard/top.pcob`, mechanically derived from `SectionTop.astro`'s `ITEMS`/`buildCard()` template (7 cards sharing one header, only the `05` group name and two `10`-level `VALUE` strings varying per card). | **Done** — `IDENTITY`, `BACKGROUND`, `CAREER-CURR`, `CAREER-PREV`, `SKILLS`, `INTERESTS`, `COMMUNITY`, program-level `@ROWS 19`, no links. The padded `VALUE` strings (e.g. `'SEBASTIAN SCHWINN               '`) were derived programmatically from the old `buildCard()` logic in a scratch script rather than hand-transcribed, since manually counting exact padding widths across 7 cards × 2 fields is error-prone. No `{{cycle}}` tag used — the field-cycling animation this data once fed was already removed (per `CLAUDE.md`'s SectionTop history: "No animation... Cards switch the same instant way as every other multi-card section"); every card is now just static text like everywhere else. |
| 4.13 | Wire `SectionTop.astro` to compile 4.12's file, looking up all 7 cards by name in nav order. | **Done** — `ITEMS`/`buildCard()` deleted; `CARDS` is now `CARD_NAMES.map(name => topSection.cards.find(...))`. |
| 4.14 | Verify structural equivalence. | **Done** — scratch comparison script (replicating the old `buildCard()` inline for comparison): all 7 cards match old arrays character-for-character with matching color class. `astro build` succeeds; compiled HTML contains all 7 cards' text. |

**All five sections (Links, AboutMe, Work, Impressum, Top) are now compiled from `.pcob` source.**
No hand-written `Line[]` arrays remain in any section component. The `punch-nav.ts` consolidation
mentioned here as deferred is now done — see Phase 6.4 below, which extended nav-derivation to
carry `cardIdx` and retired the file entirely. Sebastian's one comprehensive visual pass across
the whole site is still outstanding (no dev server per this project's testing-scope rule; now
also covers Phase 6's changes, not just Phase 4's).

### Phase 5 — Re-introduce animation/transition tags (deferred, not blocking)
- Today there are two distinct behaviors: SectionTop's per-field scramble-cycle and the
  multi-card sections' whole-row scramble-on-swap. Once the base system is stable, design a
  small, deliberately narrow tag set for these rather than a general animation DSL.

### Phase 6 — One shared program + generic rendering (6.1–6.4 done 2026-07-04, 6.5 deferred)

**The target test**: drop a new `.pcob` file in `src/content/_punchcard/`, add one line to
`main.pcob` naming it, and it renders correctly — in nav, in scroll order, with working
cross-section links — with no other file touched. Everything below exists to close the gap
between that and where Phase 4 left things.

Prompted directly by two real incidents in Phase 4: merging Top's INTERESTS/COMMUNITY cards
crashed the page (a hardcoded card-name list in `SectionTop.astro` didn't know the merge
happened), and left a stale `COMMUNITY.` nav tab behind (a *second* hardcoded, hand-maintained
copy of the same fact, in `punch-nav.ts`, that also didn't know). Both are the same root cause:
facts about section/card structure live in more places than the `.pcob` file itself.

**6.1 — `main.pcob` with `@IMPORT`, one shared compiled program.** **Done.** `src/pcob/parseSource.ts`
gained an `@IMPORT filename` directive, valid only before any `@DIVISION`/`@SECTION`/`@CARD`/`@ROWS`
in the importing file. It calls a `resolveImport(name)` callback, recursively parses the returned
source with *no* resolver of its own — so an `@IMPORT` inside an imported file throws
`"nested @IMPORT not supported"` immediately, a real compile error rather than a silent
convention. Duplicate imports and unresolvable names are also compile errors. Each imported
file's own program-level `@ROWS` default (and any division-level override) is pushed down onto
its own sections *before* merging (`pushDownRows`/`mergeImportedProgram`) — necessary because
multiple imported files sharing a division id (e.g. `top.pcob`/`aboutme.pcob`/`work.pcob` all
declare their own `@DIVISION DATA`) get concatenated into one division bucket, and a bare
division-level default would otherwise leak from whichever file happened to merge first onto
every other file sharing that bucket.

`src/pcob/compile.ts` split `compileProgram(source)` into `compileRawProgram(program: RawProgram)`
(the actual walk) plus a thin single-file wrapper that still parses-then-compiles one source —
kept for anything that only ever deals with one file, e.g. `docs/pcob-reference.md`'s Complete
example. New `src/pcob/loadProgram.ts` loads every `.pcob` file's raw text once via Vite's eager
`?raw` glob (`import.meta.glob('../content/_punchcard/*.pcob', { query: '?raw', import: 'default',
eager: true })`), and exposes `loadMainProgram()` — reads `main.pcob`, resolves its `@IMPORT`s
against that in-memory map, calls `compileRawProgram`. Called exactly once, from `index.astro`.

New `src/content/_punchcard/main.pcob` is nothing but five `@IMPORT` lines (top/aboutme/work/
links/impressum, in page order) — subordinate files are unchanged, still fully self-contained.
`impressum.pcob`'s closing `GOBACK` — previously `{{link:'#top'}}GOBACK{{/link}}` (an external-URL
literal, the pragmatic workaround from Phase 4 for "anchors don't span `.pcob` files") — is now a
real internal anchor reference, `{{link:top}}GOBACK{{/link}}`, resolving through the one shared
registry `main.pcob` gives every card. Verified by rebuilding and inspecting the compiled
`data-call-links` JSON: `{"GOBACK":"#top"}`, same resolved href as before, now compiler-validated
instead of a blind literal.
- Chosen over directory auto-discovery (e.g. Vite's `import.meta.glob`): an explicit, visible
  import list is more consistent with this project's established "explicit, no implicit"
  stance (see the Core rule, and the `@SLOT` removal above) than silently scanning a folder.
  Adding a section is still a one-line edit to `main.pcob` — small and visible, not zero-touch,
  and that's an accepted tradeoff, not a gap.
- **Subordinate files stay fully self-contained.** Each `.pcob` file keeps declaring its own
  `@DIVISION`/`@SECTION`/`@CARD`s, exactly as today. `main.pcob` does not re-declare structure
  the subordinate files already own — it's purely an ordered import manifest, plus whatever
  values are genuinely identical everywhere by policy (not a place to duplicate section content).
- **Not settled yet**: exact `@IMPORT` syntax and error handling (missing file, double-import,
  self-import), and whether `main.pcob` needs any directive of its own beyond the import list.

**6.2 — Card-height math is not `.pcob` config.** **Done**, folded into 6.3 below — the
`CARD_COUNT * 88vh` multiplier now has exactly one occurrence in the whole codebase, inside
`PunchSection.astro`, computed from `section.cards.length`. It was never authored anywhere in
`.pcob` source, per the original call.

**6.3 — One generic rendering component, replacing 5 near-duplicate `Section*.astro` files.**
**Done.** New `src/components/sections/PunchSection.astro`, `Props { section: CompiledSection }`:
renders whichever cards the section actually contains, in the `.pcob` file's own order — no
hardcoded name list to fall out of sync, the direct fix for the class of bug that crashed the
page when Top's cards were merged. Branches purely on `section.cards.length`: `> 1` renders
today's multi-card shape (`.pcf-stage-multi`, `CARD_COUNT * 88vh`, one `<PunchCard noStage>`
per card); `=== 1` renders today's single-card shape (`.pcf-stage`, fixed `.pcf-section-height`).
`setupMultiCardSection` is no longer called with a hardcoded id per file — `PunchSection`'s one
shared (Astro-deduped) script does `document.querySelectorAll('section[data-multi-card="true"]')`
and sets each one up in a single sweep.
- **Impressum, the known exception**: `SectionImpressum.astro` is now a thin wrapper —
  `<PunchSection section={...}><Fragment slot="overlay">` containing exactly its previous
  `.impressum-overlay` markup and `positionImpressumOverlay` script, both untouched.
  `PunchSection`'s single-card branch always renders a `<slot name="overlay" />` after the card
  (unfilled/inert for any future single-card section without one) — the escape hatch the design
  called for, without leaking Impressum-specific markup into the generic component.
- `src/pages/index.astro` calls `loadMainProgram()` once and renders every compiled section
  through a small `id → component` override map (`{ impressum: SectionImpressum }`, default
  `PunchSection`) — Impressum's exception is named explicitly in exactly one place; a plain new
  section needs only a new `.pcob` file + one `@IMPORT` line.
- Dead code removed alongside this: `src/scripts/app.ts`'s `sectionRunners` map and both call
  sites, plus each section's `__xRun` export. All five hooks (`__topRun`/`__aboutMeRun`/
  `__workRun`/`__linksRun`/`__impressumRun`) were already no-ops (`SectionTop`'s per-field
  cycling animation — the thing `__topRun` originally drove — was removed back in Phase 4/5's
  predecessor work; `CLAUDE.md`'s app.ts description just hadn't been updated to say so).

**6.4 — Retire `punch-nav.ts`, derive nav from the one shared compiled program.** **Done.**
`src/pcob/types.ts` gained `ParaNavEntry extends NavEntry { cardIdx: number }`; `compile.ts`'s
`parasBySection` now emits `cardIdx` for every entry (`section.cards.map((card, cardIdx) => ...)`)
— the one missing piece blocking this. `src/config/punch-nav.ts` is deleted. Nav data now has
nowhere static to live client-side (it's a compiler output, computed once per build, not a
module), so `index.astro` serializes `{ divisionMap, sectionsByDiv, parasBySection }` once as a
`<script type="application/json" id="pcf-nav-data">` JSON island, and `PunchCard.astro`'s client
script reads + `JSON.parse`s it once (at module top level, same dedup guarantee the rest of that
script already relies on) instead of statically importing `punch-nav.ts`. This directly closes
the stale-`COMMUNITY.`-tab class of bug: rebuilding and inspecting the compiled nav JSON shows
`parasBySection.top` now has exactly 6 entries (`IDENTITY`…`INTERESTS`, `cardIdx` 0–5) matching
`top.pcob`'s real 6 `@CARD`s — `COMMUNITY` was already folded into `INTERESTS` as a field value,
not a separate card, back when Top's cards were merged; the old hand-written `punch-nav.ts` just
never had that fact removed. There's no separate hand-maintained copy left to go stale.

**6.5 — Future embed tag for non-text content (images, video), replacing `@SLOT`'s old job.**
Not `@SLOT` revived — a different model. The card reserves rows and an anchor point (the same
"give space + a point" idea `@SLOT` had), but the *content* is named directly in the `.pcob`
file (e.g. an image path), and the reference travels through `compileProgram()`'s output as
data so `PunchCard.astro`'s existing client-side renderer can create the actual element itself —
no Astro-side slot-supplying code needed per use, unlike `@SLOT`. Design constraints agreed so
far, not yet built:
  - Scoped to assets/raw HTML only, **not arbitrary `.astro` components** — an `.astro` file is
    code (its own compile step, can run logic, import other components); letting content
    reference one reopens exactly the content/code boundary this whole system protects. Treat
    "embed a whole Astro component" as a separate, much bigger conversation if it ever comes up.
  - The reserved space is a rectangular row-count box (matching `@SLOT`'s old shape); within
    that box, the embedded media/HTML's own layout is its own responsibility (not dictated by
    the character grid) — same relationship Impressum's overlay already has with its reserved
    rows today, just made into a real mechanism instead of a JS-measurement hack.
  - Not yet decided: exact tag name/params, file-path reference vs. inline HTML, how Astro's
    asset pipeline (`astro:assets`) fits in if at all.
- This is deliberately its own scoped addition, sequenced after (or reviewed separately from)
  6.1–6.4 rather than bundled in — keeps each change small enough to verify independently.

---

## D. Decisions log / concerns / things to document as we go

Use this section as a running list — append rather than rewrite, so we keep a record of what
was decided and why, and what was found not to port cleanly.

### Resolved decisions
- [x] File extension: **`.pcob`**, location `src/content/_punchcard/*.pcob` — underscore-prefixed
      directory so Astro's content-layer scanner (which only understands its own collection
      types) doesn't warn about files it doesn't recognize; unrelated to how the compiler reads
      them (a plain Vite `?raw` string import, not an Astro content collection).
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
- [x] `punch-nav.ts`'s stale `COMMUNITY.` tab: resolved by Phase 6.4 retiring `punch-nav.ts`
      entirely — nav is now derived straight from the compiled program, which only ever reports
      the 6 cards `top.pcob` actually has.
- [x] Phase 6.1's exact `@IMPORT` syntax/error handling: `@IMPORT filename`, top-level only
      (before any `@DIVISION`), nesting/duplicate-import/missing-file are all compile errors.
      `main.pcob` carries no directive beyond an ordered `@IMPORT` list (a leading `@@` comment
      is the only other thing in it).
- [ ] Phase 6.5's exact embed-tag name, params, and file-path-vs-inline-content shape.

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
  compiler always renders a `sectionsByDiv` nav label as `NAME SECTION`, uniformly. Today's
  hand-written labels aren't uniform — `WORKING-STORAGE` / `LOCAL-STORAGE` (no "SECTION"
  suffix) vs `LINKS SECTION` vs `IMPRESSUM-SECTION` (hyphenated, no space). When a section
  migrates, expect its nav text to shift to the uniform `NAME SECTION` form unless the
  `@SECTION` name is chosen to reproduce today's exact wording. (Updated 2026-07-04: both
  `sectionsByDiv` and `parasBySection` labels dropped their trailing `.` — the navbar isn't card
  text, so it doesn't need the COBOL-statement-ending punctuation; Sebastian asked for this after
  seeing it live, e.g. `BACKGROUND.` in the paragraph nav.)
- **Bug found in both DSL example files while building the compiler**: `EXIT PARAGRAPH`/
  `EXIT SECTION` were written with a trailing, unclosed `{{link:name}}` (no wrapping, no
  `{{/link}}`) — inconsistent with every other tag use and with the "always paired, no bare
  shorthand" decision. Fixed in `docs/dsl-mockup.pcob` and `docs/pcob-reference.md` to
  `{{link:name}}EXIT PARAGRAPH{{/link}}`.
- **No implicit indentation either — WYSIWYG extends to whitespace.** After the pilot's Links
  section was live and visible, Sebastian extended the "no implicit lines" rule to indentation:
  the compiler previously auto-applied a canonical indent per line shape (01→1 space, 05→5,
  10/88→7, statements→5), discarding whatever leading whitespace was actually typed. That's the
  same category of implicit behavior as auto-generated lines. `tokenizeCardLine.ts` no longer
  computes any indent; every line shape's leading/internal whitespace is preserved exactly as
  typed, and `.pcob` sources (including both example files) now type their own indentation.
- **Card height is intrinsic to row count, not stretched to fill a fixed region.** Also
  surfaced by the pilot: shrinking `links.pcob`'s `@ROWS` made the row *height* grow instead of
  the card getting shorter, because `.pcf-card`/`.pcf-punch-area` filled a fixed viewport region
  (`top:7vh;bottom:7vh` etc.) and CSS Grid distributed that fixed budget across however many
  rows existed. Fixed by removing the forced-stretch chain — row height now comes purely from
  `.pcf-chars span`'s `line-height`, uniform and font-driven, and a card's total height is
  exactly `rows * that height`. Multi-card sections now center the active card instead of
  top/bottom-anchoring it. The card-stack ghost silhouettes still use fixed-region sizing
  (unchanged) since matching them to a dynamically-sized active card needs JS, not just CSS —
  a known, accepted mismatch, most visible on cards with an unusual `@ROWS`.
  **Briefly reopened (2026-07-03) — see "Fixed: uneven row height regression" below. Root cause
  turned out unrelated to Grid vs. block flow, so this entry's reasoning still stands.**

### Fixed: uneven row height regression (was open, now resolved)
Reported 2026-07-03 right as a session ended; root-caused and fixed the next session.

- **Symptom**: empty rows were visibly slimmer than rows with text.
- **Actual root cause** (not the Grid/flex distribution theory originally logged here):
  `renderLinesForArea` in `PunchCard.astro` built `.pcc-empty` spans (the blank/unpunched
  columns) with **no text node at all** — `document.createElement('span')` with `className` set
  but `textContent` left unset. A `<span>` with zero children has no line box, so it collapses to
  0 height regardless of its own `line-height: calc(1em + 8px)`; a sibling span with a real
  character gets a line box sized by that `line-height`. Since `.pcf-chars` is a flex row with
  `align-items: center`, a row's height is set by its tallest child — so an all-blank row (every
  span empty) collapsed to ~0 while any row with real text stretched to full height. This was
  never a Grid-vs-block-flow question; both layouts were consistent with this bug, since neither
  forces a childless inline-block to acquire a line box.
- **Fix**: give `.pcc-empty` spans a text node, a non-breaking space (U+00A0, not a plain
  space, since a lone regular space is collapsible whitespace and can itself get trimmed away
  by an inline-block's own leading/trailing whitespace handling, silently reproducing the same
  bug), so they get the same line box as any other character while staying visually blank
  (the punched-hole dot is drawn by `.pcc-empty::before`, `position: absolute`, unaffected by
  the text node). Two call sites in `renderLinesForArea` (`PunchCard.astro`), one for plain
  chars, one for the `callLinks`-wrapped `<a>` run. No CSS changes needed — `.pcf-punch-area`'s
  plain block flow from the "intrinsic height" fix above is unaffected and correct; "intrinsic
  to row count" and "uniform row height" were never actually in tension, since the real bug was
  upstream of any block-vs-grid layout choice.
- **Gap found comparing the compiler against real site content**: today's `SectionLinks.astro`
  renders a paragraph-name line (`SERVICES-PRGRPH.`, styled `para`) that neither the grammar docs
  nor the Phase 2 compiler accounted for. Resolved by adding paragraph-name as a recognized (not
  generated) card-text line shape — a bare `NAME.` line with nothing else on it.
- **Fixed: `{{link}}` CALL values were unclickable, and DevTools showed a bogus highlight rect
  for them.** Found during Sebastian's 3.6 visual confirmation on the live Socials card
  (LinkedIn/Instagram links present in the DOM at the right text but not clickable; EXIT
  PARAGRAPH's link highlighted in the wrong position). Root cause: `.pcf-call-link` (`global.css`)
  had `display: contents`, pre-dating this migration (present since commit `e501354`, 2026-06-29)
  — not something Phase 3 introduced, just never previously exercised/clicked. `display: contents`
  removes an element's own render box, which is a documented source of broken click/focus/
  hit-testing for interactive elements (`<a>`, `<button>`) in several browser engines, and also
  explains why DevTools couldn't compute a real bounding rect for it. Fix: drop the `display:
  contents` override entirely. `.pcf-call-link` is a direct child of `.pcf-chars` (`display:
  flex`), so per the CSS Display spec a plain `<a>` there is auto-blockified into a normal flex
  item anyway — same visual layout, but now with a real, clickable box.
- **Fixed: a linked value's separator whitespace rode along inside its `<a>`.** Also found during
  3.6 confirmation: `CALL 'LINKEDIN'` compiled the space between `CALL` and the quoted value into
  the *same* token as the linked content, so `callLinks` keyed on `" 'LINKEDIN'"` (leading space
  included) and the space ended up inside the clickable/underline-on-hover `<a>`. `tokenizeCardLine.ts`'s
  `classifyValueRun` now returns `Token[]` instead of one `Token`: for a run with no `{{link}}`
  span it's still exactly one token (unchanged, byte-identical to before); for a linked run it
  splits off any leading/trailing separator whitespace into its own plain (non-linked) token
  first, so `callLinks` keys only the trimmed content (`"'LINKEDIN'"`) and the `<a>` wraps only
  that. Same characters, same visible text — only the token boundary moved. All four call sites
  (`tokenizeLevelLine`, `tokenizeStatementLine` ×2, `tokenizeFallbackLine`) updated to spread the
  array.
- **Impressum's `@SLOT` was already dead before this migration.** The doc's Phase 4 line and
  `CLAUDE.md`'s old "SectionImpressum (slotAtLine)" section both described `PunchCard`'s
  slot-injection mechanism (`slotAtLine`/`displaySlot` props, the `useSlot` branch) as Impressum's
  actual design — stale since commit `17d323e` (2026-06-30, "Rework impressum: normal 18-line
  card + JS-anchored overlay"), which replaced it with a plain 19-row card plus a sibling
  `.impressum-overlay` div positioned at runtime by measuring specific `.pcf-line-row` elements
  (`rows[3]`/`rows[13]`) via `getBoundingClientRect()`. No section actually passes `slotAtLine` or
  `displaySlot` to `PunchCard` today (confirmed by grep) — that whole code path, and the `@SLOT`
  directive's compiler support, is validated only by `docs/dsl-mockup.pcob` and
  `docs/pcob-reference.md`'s Complete example, not by any real page. `impressum.pcob` is written
  to match current reality (no `@SLOT`); `CLAUDE.md` updated to describe the actual JS-measured
  overlay instead of the abandoned slot design.
- **Resolved: the "EXIT SECTION → #impressum vs. comment says LINKS SECTION" mismatch flagged
  above.** Migrated verbatim first, then Sebastian decided on the actual intent directly:
  `impressum.pcob`'s closing statement is now `{{link:'#top'}}GOBACK{{/link}}` (was
  `{{link:impressum}}EXIT SECTION{{/link}}`) with the comment updated to match ("GOBACK TO DATA
  DIVISION WORKING-STORAGE SECTION," mirroring the existing `GOBACK TO PROCEDURE DIVISION LINKS
  SECTION` phrasing style used elsewhere). `GOBACK` wasn't yet a recognized statement verb —
  added to `STATEMENT_VERBS` in `tokenizeCardLine.ts`, with `docs/pcob-reference.md`'s statement
  row table and Complete example updated in the same commit (a new `GOBACK` line linking across
  sections, `{{link:demo-data}}GOBACK{{/link}}`) per `CLAUDE.md`'s DSL-doc-sync rule. Also
  surfaced: anchors don't span `.pcob` files — each file compiles as its own independent
  `compileProgram()` call with its own anchor registry, so `{{link:top}}` from within
  `impressum.pcob` fails (`top` is only declared in `top.pcob`). Worked around with the existing
  external-link form, `{{link:'#top'}}` (a quoted param is used as a literal href with no anchor
  lookup, regardless of whether it's actually off-site) — cross-file internal navigation has no
  dedicated syntax yet, this is the pragmatic option today's compiler already supports.
- **Fixed: hyphen-joined header line misclassified as a paragraph name.** Found while migrating
  Impressum: `IMPRESSUM-SECTION.` (the card's own heading, styled `section` in the original
  hand-written array) was coming out of the compiler as `para` instead. Root cause:
  `tokenizeHeaderLine`'s DIVISION/SECTION recognition required a literal space immediately before
  the trailing word (`/ SECTION$/`), which "IMPRESSUM-SECTION" fails — the character before
  "SECTION" there is a hyphen, not a space — so it fell through to the bare-paragraph-name shape
  instead. Fixed by matching on a `\b` word boundary (`/\bSECTION$/`, `/\bDIVISION$/`) rather than
  a required preceding space; a hyphen is still a non-word character, so the boundary holds for
  both `LINKS SECTION.` and `IMPRESSUM-SECTION.` alike, with no change to any line already
  classified correctly. `docs/pcob-reference.md`'s header-row table row and Complete example
  updated in the same commit per `CLAUDE.md`'s DSL-doc-sync rule (`DEMO-PROC SECTION.` →
  `DEMO-PROC-SECTION.`, now exercising the hyphen-joined form).
- **`@SLOT` removed as dead code (2026-07-04), not just left dormant.** The finding above
  established `@SLOT`/`slotAtLine`/`displaySlot` were already unused by every real section — but
  they were designed for a two-part contract (content file reserves rows, calling Astro file
  supplies JSX children via a real `<slot/>`) that doesn't fit where embeds are actually headed:
  the card should name the asset directly, with the renderer creating the element from that data,
  no Astro-side slot-supplying code at all. Since nothing in that old contract survives the new
  direction, keeping `@SLOT` around "just in case" would mean maintaining two mechanisms for a
  problem with no current solution, one of them provably unused. Removed entirely: the `@SLOT`
  directive (`parseSource.ts`), `slotAtLine` tracking (`compile.ts`, `types.ts`), and the
  `slotAtLine`/`displaySlot`/`displayLabel`/`displayHeader` props plus their whole rendering branch
  in `PunchCard.astro` (collapsing both the `noStage` and non-`noStage` templates to always render
  the plain punch-area). Also dropped the now-orphaned CSS this left behind
  (`.pcf-display-block`, `.pcf-display-body`, `.pcf-para-hdr-row`, `.pcf-dot-row`,
  `.pcf-para-hdr-stmt`, `.pcf-zone-btm`, and `.pcf-zone-stmt` — the last three confirmed unused
  only after the branch removal, not before). `docs/dsl-mockup.pcob` and `docs/pcob-reference.md`'s
  Complete example updated to drop their `@SLOT` usage (both re-verified to still compile). If
  embedding non-text content comes up again, it needs a fresh mechanism where the embed reference
  itself travels through `compileProgram()`'s output as data — see "Open / not yet decided" in
  `docs/pcob-reference.md`.

---

## Quick status snapshot

| Phase | Status |
|---|---|
| 0 — Fix `#top` height asymmetry | Confirmed. `align-self: stretch` on `.top-punch-wrapper`; row-height uniformity now comes from giving `.pcc-empty` spans a text node (see "Fixed: uneven row height regression") |
| 1 — Format design | Syntax finalized — see `docs/dsl-mockup.pcob` + `docs/pcob-reference.md` |
| 2 — Parser/compiler | Core built in `src/pcob/` (parser, tag extractor, level-row/statement-row tokenizers, anchor resolution, nav derivation). Validated by compiling `docs/dsl-mockup.pcob` and the reference's Complete example. Not yet wired into any Astro page or `.pcob` content file — that's Phase 3. |
| 3 — Pilot migration (Links) | **Confirmed.** Links section renders from `src/content/_punchcard/links.pcob` via the compiler; 3.6 visual confirmation done 2026-07-03. |
| 4 — Full migration | Content migration done for all 5 sections (AboutMe, Work, Impressum, Top, plus Links from Phase 3). AboutMe visually confirmed (4.1–4.4); Work/Impressum/Top's per-section confirmation gate waived (Sebastian: "go for it") in favor of one comprehensive visual pass across the whole site, still outstanding. `punch-nav.ts` consolidation deliberately deferred, not yet scheduled. |
| 5 — Animation tags | Deferred |
| 6 — Shared program + generic rendering | **6.1–6.4 done** (2026-07-04): `main.pcob`/`@IMPORT`/one shared program, card-height math folded into the one generic `PunchSection.astro` component (replacing 5 hand-authored files), `punch-nav.ts` retired in favor of compiler-derived nav delivered via a `#pcf-nav-data` JSON island. `astro build` passes; compiled output spot-checked (nav `cardIdx`s, all `callLinks` hrefs including the new cross-file `{{link:top}}GOBACK{{/link}}`). Sebastian's visual pass still outstanding (no dev server per this project's testing-scope rule). 6.5 (embed tag) stays deferred, scoped separately. |
