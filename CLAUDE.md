# CLAUDE.md — landing-homepage

Astro 6 / TypeScript / pnpm. Run with `pnpm dev`, build with `pnpm build`.

**Every prompt that results in code changes must end with a git commit. No confirmation needed.**

**Testing scope: only check syntax and semantics (type errors, build errors, logic correctness). Do not start the dev server or verify visuals/rendering — the user tests visual results themselves after each commit.**

**`.pcob` DSL docs must stay in sync: any change to the punch-card DSL grammar (new/changed directive, attribute, line shape, or `{{tag}}`) must update `docs/pcob-reference.md`'s tables AND its trailing "Complete example" in the same commit, so the example always exercises every documented construct at least once. See `docs/pcob-reference.md` and `docs/punch-card-content-system.md` (project plan/status) before touching the DSL.**

---

## File map

| File | Role |
|------|------|
| `src/pages/index.astro` | Root — calls `loadMainProgram()` once, renders every compiled section through `PunchSection` (flat map, no per-section override needed anymore), emits the `#pcf-nav-data` JSON island |
| `src/components/Logo.astro` | Fixed SVG logo, noise + arc marquee |
| `src/components/PunchCard.astro` | Reusable IBM punch card shell (title bar, form header, coding area, `{{embed}}` pin rendering) |
| `src/components/sections/PunchSection.astro` | Generic section renderer (replaces the old per-section `Section*.astro` files, including `SectionImpressum.astro`) — branches on card count for multi- vs. single-card layout |
| `src/scripts/app.ts` | Main scroll handler: section activation, instant panel snap, logo visibility |
| `src/scripts/multiCardSection.ts` | Shared card-switching logic for multi-card sections (count read from DOM) |
| `src/pcob/loadProgram.ts` | Loads every `.pcob` file once (Vite eager `?raw` glob), resolves `main.pcob`'s `@IMPORT`s and every `{{embed}}` file reference, compiles the merged program — `loadMainProgram()`, called once from `index.astro` |
| `src/content/_punchcard/main.pcob` | The shared program — ordered `@IMPORT` lines naming every section file, plus the 5 `@HEADER-*` form-header directives |
| `src/content/_punchcard/embedded/*.html` | `{{embed:path}}`-referenced HTML fragments, one per embed (e.g. `embedded/impressum.html`) — plain content, not compiled as `.pcob` |
| `src/content/_claude/*.pcob` | Second content root, Claude's own (not Sebastian's) — currently just `claude.pcob`. Loaded/merged the same way as `_punchcard/` by `loadProgram.ts`'s two-glob setup; `@IMPORT` doesn't care which root a file lives in |
| `src/styles/global.css` | All styles (pcf-* punch card, section scroll system, token colors) |
| `src/utils/punchText.ts` | Renders strings as per-character span markup for form header values (wear/jitter effect removed 2026-07-04 — see CSS history if reviving it) |

---

## PunchCard component API

```ts
interface Props {
  header: CompiledHeader;        // form-header cells, from src/pcob/types.ts — see below
  lines?: Line[];                // [seq6chars, Token[]][]
  callLinks?: Record<string, string>; // val token text → href
  embeds?: CompiledEmbed[];      // {{embed:path}} pins — see "Embeds" below
  noStage?: boolean;             // omit pcf-stage wrapper (use in pcf-stage-multi)
}
```

`header` is `{ left: [Cell,Cell,Cell]; right: [Cell,Cell] }`, `Cell = { label, value, href? }` —
authored via `@HEADER-*` in `main.pcob` (see "Form-header cells" below), compiled once in
`index.astro`, threaded down through `PunchSection` unchanged. The 3rd right cell
(`DATE - VERSION`) isn't part of this prop — it stays computed inline in this file (build date +
git short-hash), not authored.

(`displaySlot`/`displayLabel`/`displayHeader`/`slotAtLine` — the old Astro-`<slot/>`-passthrough
mechanism, plus the `@SLOT` directive that fed it — were removed entirely as unused dead code;
nothing in the codebase ever consumed them. Embedded non-text content did come up again, and got
a fresh design rather than reviving this — see "Embeds" below and
`docs/punch-card-content-system.md`'s decisions log.)

### Token types (`TT`)
`div | section | para | lvl | name | kw | val | numval | dot | comment`

### Line format
```ts
type Line = [seq: string, tokens: Token[]];
// seq is always 6 chars, e.g. '000001'
// empty line: ['000003', []]
```

### Token color map (CSS classes)
| Token | Class | Color |
|-------|-------|-------|
| div | pcc-div | #1A0E00 (near black) |
| section | pcc-section | #2C1A00 |
| para | pcc-para | --blue-darker-1 |
| lvl | pcc-lvl | --text-muted |
| name | pcc-name | --blue-darker-2 |
| kw | pcc-kw | #8B7040 (brown) |
| val | pcc-val | --blue-primary |
| numval | pcc-numval | --blue-primary |
| dot | pcc-dot | #8B7040 |
| comment | pcc-comment | #9B8050 italic |

---

## Coding area layout (per line-row)

```
[pcf-line-num 32px] [pcf-seq 72px] [pcf-chars 80ch]
```

- `pcf-line-num`: 2-digit line index (01, 02…), bg `#EDE0A8`
- `pcf-seq`: 6-digit sequence from Line[0], bg `#EDE0A8`
- `pcf-chars`: 80 × 1ch spans, each rendered as a token-colored span or `pcc-empty` dot

Zone header row (above ruler):
```
[LINE 32px] [SEQUENCE 72px] [ind 1ch] [A 4ch] [B · COBOL STATEMENT flex]
```

Ruler row:
- `pcf-ruler-linenum` (32px): ticks "1","2"
- `pcf-ruler-seq` (72px): ticks 1–6 (built by `buildSeqRuler`)
- `pcf-ruler-chars` (80ch): single ticks 1–8, then 4ch ticks 12,16,20…80

---

## COBOL column conventions (in pcf-chars, 0-indexed)

| COBOL cols | 0-indexed in pcf-chars | Zone |
|-----------|----------------------|------|
| 1–6 | 0–5 | Sequence (visual only — separate pcf-seq zone) |
| 7 | 6 | Indicator (pcf-zone-ind) |
| 8–11 | 7–10 | Area A |
| 12–72 | 11–71 | Area B (statements) |
| 73–80 | 72–79 | Identification |

Statements (`CALL`, `EXIT PARAGRAPH`, `DISPLAY`, `.`) indent: **`     `** (5 spaces = col 6) — this is the project's established style, not strict COBOL Area B.

---

## Sections are generic — one component, driven by the compiled program

There is no more per-section `Section*.astro` file — not even for Impressum anymore
(SectionTop/AboutMe/Work/Links/Impressum are all gone). `index.astro` calls `loadMainProgram()`
(`src/pcob/loadProgram.ts`) once, then renders every `CompiledSection` it returns through
`PunchSection.astro` with a flat `.map()` — no per-section override needed, since `{{embed:path}}`
(see "Embeds" below) replaced the one thing (Impressum's bespoke legal-text overlay) that used to
require one. Adding a new section is: write a `.pcob` file, add one `@IMPORT` line to
`src/content/_punchcard/main.pcob`, done.

`top.pcob` currently has 6 `@CARD`s (`IDENTITY`, `BACKGROUND`, `CAREER-CURR`, `CAREER-PREV`,
`SKILLS`, `INTERESTS`) sharing one DIVISION/SECTION/01-level header — `COMMUNITY` is a field
*inside* `INTERESTS`, not its own card (merged during Phase 4; see that file's own header
comment). No animation, no photo panel — cards switch the same instant way as every other
multi-card section.

---

## Multi-card sections (`PunchSection.astro`)

`PunchSection.astro` takes one prop, `section: CompiledSection`, and branches purely on
`section.cards.length`:

```astro
<section id={section.id} data-multi-card={String(isMulti)}>
  <div class="section-scroll-container" style={`height: ${section.cards.length * PX_PER_CARD}px;`}>
    <div class="section-content-wrapper">
      <div class="pcf-stage-multi">
        <PunchCard noStage={true} ... />  <!-- one per section.cards, in file order -->
      </div>
    </div>
  </div>
</section>
```

(`cards.length === 1` renders the single-card shape instead — `.pcf-stage`, fixed
`.pcf-section-height`. Impressum used to need a `<slot name="overlay" />` here for its bespoke
legal-text overlay; that's gone now that `{{embed:path}}` handles it generically — see "Embeds"
below.)

Cards are absolutely centered (`top: 50%; left: 50%; transform: translate(-50%,-50%)`), height
intrinsic to row count (not stretched to a fixed region), `opacity: 0` by default.
Active card: `pcf-card-active` → `opacity: 1`.

Card switching is a shared module, `src/scripts/multiCardSection.ts` (`setupMultiCardSection(sectionId)`).
`PunchSection.astro`'s own script (Astro-deduped across every instance, so it runs exactly once)
sweeps `document.querySelectorAll('section[data-multi-card="true"]')` and calls
`setupMultiCardSection` on each — no per-section hardcoded id. Card count is read from the DOM
(`cards.length`) inside that module, not a separately-maintained constant, so the math is correct
for any number of cards. Switching is a direct, synchronous class toggle — no scramble animation,
no transition lock.

Scroll calc (inside `multiCardSection.ts`):
```js
relScroll = window.scrollY - section.offsetTop;
cardH     = section.scrollHeight / cards.length;
newIdx    = clamp(Math.floor(relScroll / cardH), 0, cards.length - 1);
```

The per-card scroll distance (`PX_PER_CARD`, fixed px not vh — a scroll wheel "tick" is a fixed
pixel amount, so vh would take a different number of ticks on every monitor) has exactly one
occurrence in the codebase, inline in `PunchSection.astro` (`section.cards.length *
PX_PER_CARD`) — there's no per-section `CARD_COUNT` const anymore, since there's no per-section
file to put one in. Currently `200` (≈2 standard mouse-wheel ticks per card transition, at the
common ~100px/tick default) — adjust that one constant directly if it doesn't match.

---

## Scroll / section activation system (app.ts)

- Each section: `.section-scroll-container` (tall, gives scrollable space) + `.section-content-wrapper` (position: fixed)
- `getActiveSection()`: uses `window.scrollY + innerHeight/2` vs section `offsetTop + offsetHeight`
- On section change: `transitionTo(id)` toggles `.active` on the wrapper — instant snap, no
  animation (no `transition` CSS property, no enter/exit classes, no direction-from-scroll logic)

(There used to be a `sectionRunners` map calling a per-section `window.__xRun` hook every scroll
tick; removed 2026-07-04 — every hook was already a no-op, since SectionTop's per-field cycling
animation, the thing `__topRun` originally drove, had been removed earlier. Card switching is
entirely `multiCardSection.ts`'s own `addEventListener('scroll', ...)`, independent of app.ts.)

`updateLogo(id)` toggles `.visible` on `#logo-wrapper` (visible only on `#top`) — the only other
thing `app.ts`'s scroll handler does besides section switching. `Logo.astro`'s own arc/noise
marquee animation is separate and always-running, unrelated to scroll.

---

## Form-header cells (authored via `@HEADER-*` in `main.pcob`)

The 5 configurable form-header cells — left column `PROGRAMMER`/`ABOUT PROGRAM`/`CURRENT SYSTEM`,
right column `XREF`/`IDENTIFICATION` — are `@HEADER-LEFT-FIRST|SECOND|THIRD "label" "value"` /
`@HEADER-RIGHT-FIRST|SECOND "label" "value"` directives in `main.pcob`, resolved once by
`compile.ts`'s `resolveHeader`/`resolveHeaderCell` into `CompiledProgram.header`. All 5 are
required (missing one is a compile error, same rigor as `@ROWS`). A `value` may contain one
`{{link:name}}...{{/link}}` — reuses `extractTags`/the same anchor registry card text resolves
through, no separate tag-parsing path — and if present, `PunchCard.astro` renders the whole cell
as an `<a>`; if absent, a plain `<div>`. This applies uniformly to all 5 cells — left cells
(`header.left[0..2]`) only gained the same conditional `<a>`/`<div>` branch right cells already
had in 2026-07-23, when the second left cell (label originally `PROGRAM`, since relabeled `ABOUT
PROGRAM` for click affordance — see "Established patterns" below) became the first left cell to
actually carry a link; before that fix a left cell's `href` was silently ignored.

The 3rd right cell, `DATE - VERSION`, is deliberately **not** part of this — it's computed build
metadata (today's date + `git rev-parse --short HEAD`), not authored content, and stays inline in
`PunchCard.astro` exactly as before. `@HEADER-RIGHT-THIRD` is a dedicated compile error naming
this, not a silently-accepted or generically-rejected directive.

---

## Navigation data (compiler-derived, no more `punch-nav.ts`)

`src/config/punch-nav.ts` is gone. Nav data (`divisionMap`/`sectionsByDiv`/`parasBySection`) is
now a build-time output of `loadMainProgram()` (see `src/pcob/compile.ts`'s `compileRawProgram`),
computed once in `index.astro` and serialized into the page as a JSON island:
```astro
<script type="application/json" id="pcf-nav-data" set:html={JSON.stringify({
  divisionMap: program.divisionMap, sectionsByDiv: program.sectionsByDiv, parasBySection: program.parasBySection
})} />
```
`PunchCard.astro`'s client script reads and `JSON.parse`s `#pcf-nav-data` once, at module top
level, instead of statically importing a config module — this is a build-time compiler output,
not a hand-maintained file, so there's nothing left to import client-side. Shape (unchanged from
the old hand-written version, just derived now):
```ts
divisionMap = { data: ['top','aboutme','work'], proc: ['links','impressum','claude'] }

parasBySection = {
  // each entry: { label, href, cardIdx } — cardIdx addresses a specific card within the section
  top:       [IDENTITY(0), BACKGROUND(1), CAREER-CURR(2), CAREER-PREV(3), SKILLS(4), INTERESTS(5)]
  aboutme:   [WORK-NOW(0), WORK-BFRE(1), STUDIES(2), PRG-LANGUAGES(3), VOC-LANGUAGES(4)]
  work:      [WORK-CURRENT(0), WORK-PREV(1)]
  links:     [SERVICES-PRGRPH(0), SOCIALS-PRGRPH(1)]
  impressum: [IMPRESSUM-SECTION(0)]
  claude:    [OVERVIEW-PRGRPH(0), DESIGN-PRGRPH(1), COMMENTARY-PRGRPH(2), AUTHORSHIP-PRGRPH(3)]
}
```
(`top` has 6 entries, not 7 — `COMMUNITY` is a field inside `INTERESTS`'s card text, not its own
`@CARD`; the old hand-written `punch-nav.ts` had a 7th, stale `COMMUNITY` entry left over from
when those cards were merged, which is exactly the class of bug deriving this from the compiler
eliminates — see `docs/punch-card-content-system.md`'s Phase 6 notes.)

Nav highlight: `pcf-nav-active` class + `▶ ` pseudo-content before active items.

Paragraph-level nav is card-aware, not just section-aware: `multiCardSection.ts` writes the
active card index onto its `<section>` as `data-active-card` on every switch (and at setup).
`PunchCard.astro`'s `updatePcfNav` reads that attribute and only highlights the `.pcf-para-item`
whose `data-sec`/`data-card-idx` match the active section + active card — not every paragraph
in the section at once. Clicking a paragraph link doesn't rely on native anchor scrolling
(which would always land on the section's start = card 0); a delegated click handler on
`.pcf-para-item` computes the target card's scroll position (`section.offsetTop + cardIdx *
cardH + cardH/2`, same math `multiCardSection.ts` uses internally) and calls `window.scrollTo()`
directly. Single-card sections (Impressum) need no wiring — `data-active-card` is simply never
set, and the lookup falls back to `'0'`, matching `cardIdx: 0`.

---

## Key CSS classes (pcf-*)

| Class | Purpose |
|-------|---------|
| `.pcf-stage` | Single-card centered container, `padding: 7vh 7%` |
| `.pcf-stage-multi` | Multi-card container, `position: relative; overflow: hidden` |
| `.pcf-card` | The punch card itself — `width: fit-content`, clip-path notch |
| `.pcf-card-active` | Makes card `opacity: 1; pointer-events: auto` |
| `.pcf-coding-area` | flex column wrapping ruler + punch area |
| `.pcf-punch-area` | flex column of pcf-line-rows, `data-lines` attr holds JSON |
| `.pcf-line-row` | One COBOL line: linenum + seq + chars |
| `.pcf-zone-row` | Header row (LINE / SEQUENCE / A / B labels), `height: 15px` |
| `.pcf-ruler-row` | Ruler tick row, `height: 13px` |
| `.section-scroll-container` | Tall spacer giving scrollable height |
| `.section-content-wrapper` | `position: fixed; width: 100%; height: 100vh` — the visible content |
| `.pcf-embed` | `{{embed:path}}` wrapper — `position: fixed`, positioned/transformed via inline styles set by `PunchCard.astro`'s client script |

`.section-content-wrapper` has exactly two states: default (hidden) and `.active` (visible) —
instant toggle, no transition/animation classes.

---

## CSS variable palette

```css
--blue-light:     #EAF3FF
--blue-bg:        #DDEEFF
--blue-mid:       #A3BBF7
--blue-dark:      #3057D5
--blue-primary:   #3366FF
--blue-secondary: #2C4FB3
--blue-darker-1:  #2542A3
--blue-darker-2:  #1B2D73
--text-primary:   #333333
--text-secondary: #555555
--text-muted:     #777777
```

Card background: `#F5EDD4` (aged paper). Card border/accents: `#C2A840` (gold). Header bg: `#EDE0A8`.

---

## Embeds (`{{embed:path}}` — pin-anchored file attachments)

Compiled from `src/content/_punchcard/impressum.pcob` (one `@CARD`, 19 rows) — Impressum's
German legal text is the one real usage today, but the mechanism is generic, not
Impressum-specific. `@SLOT` and `PunchCard`'s `slotAtLine`/`displaySlot` props (the old
Astro-`<slot/>`-passthrough model this replaced) are gone entirely (see the PunchCard component
API section above) — nothing ever consumed them, and their contract (calling `.astro` file
supplies JSX children per use) didn't fit where embeds needed to go.

`{{embed:path}}` / `{{embed:path corner}}` is a **zero-width pin**, not a decorator — the one tag
with no closing pair (`src/pcob/tags.ts`). `path` is resolved relative to the referencing `.pcob`
file (via a second eager glob in `src/pcob/loadProgram.ts`, `**/*.html` under
`src/content/_punchcard/`); `corner` (default `top-left`) picks which corner of the *embedded
content* touches the pin — `top-left`/`top`/`top-right`/`left`/`center`/`right`/`bottom-left`/
`bottom`/`bottom-right`. The tag reserves no row space of its own — whatever blank lines surround
it in the `.pcob` source are just typed WYSIWYG spacing, same as any other card. Impressum's
`impressum.pcob` places `{{embed:embedded/impressum.html}}` on the first blank line after
`DISPLAY`; `src/content/_punchcard/embedded/impressum.html` is the actual German-text fragment
(same markup Impressum's old bespoke overlay used).

`CompiledCard.embeds` (`src/pcob/types.ts`) carries each embed's resolved `html`, `row`/`col`
(derived from the tag's position, never author-typed), `corner`, and `sectionId`/`cardIdx` baked
in at compile time. `PunchCard.astro`'s client script creates a `.pcf-embed` wrapper per embed,
appended to `.section-content-wrapper` — **not** inside `.pcf-stage-multi`, which is
`overflow: hidden` and would clip anything meant to extend past the card or the screen — and
positions it via `getBoundingClientRect()` on the exact character span at `(row, col)`, applying
a `transform: translate(x%, y%)` looked up from `corner` (no need to measure the embedded
content's own size). Multi-card visibility reuses the existing `data-active-card` convention
(each wrapper carries `data-embed-section`/`data-embed-card-idx`, checked by the same scroll
listener that already drives paragraph-nav highlighting) — no changes needed to
`multiCardSection.ts`.

The card's own `IMPRESSUM-SECTION.` line is intentionally styled as a section-header token
(`pcc-section`), not a paragraph-name token — it doubles as both this card's only heading and a
literal echo of the `@SECTION`'s name. This relies on the tokenizer's header-row check matching
the trailing `SECTION`/`DIVISION` word on a `\b` boundary rather than a required preceding space,
so a hyphen-joined form like `IMPRESSUM-SECTION.` is recognized the same as `LINKS SECTION.`.

---

## Established patterns

- All sections share the same PunchCard form-header values — authored once via `@HEADER-*` in `main.pcob`, not per-section props (see "Form-header cells" above)
- Empty COBOL lines: `['000003', []]`
- Standalone dot line (closes a statement block): `['000015', [['dot','     .']]]` — 5-space statement indent, not bare
- Comment lines: `['000013', [['comment','* GOBACK TO ...']]]`
- `callLinks` maps the exact val token string (including leading space and quotes) → URL
- Font: `"Share Tech Mono", monospace` throughout
- `src/content/_claude/claude.pcob` (added 2026-07-23, `@SECTION CLAUDE id=claude`, PROCEDURE
  division, 4 cards) is authored solely by Claude, not Sebastian — the one section on the site
  with that split, and the reason it lives in its own `src/content/_claude/` root rather than
  `src/content/_punchcard/` (Sebastian's own content — see `loadProgram.ts`'s two-glob setup).
  It's linked from the second left header cell (`SSCHW-DEV` → `#claude`), which is what required
  the left-header-cell `<a>`/`<div>` fix noted under "Form-header cells" above. That cell's label
  was relabeled `PROGRAM` → `ABOUT PROGRAM` the same day, since `PROGRAM`/`SSCHW-DEV` alone gave
  no textual hint it was clickable (hover was the only affordance) — chosen to stay within the
  ~14-char width `CURRENT SYSTEM`/`IDENTIFICATION` already prove fits the cell without clipping
  (`.pcf-fh-cell` is `overflow: hidden`, and `.pcf-fh-lbl` has no ellipsis truncation, unlike
  `.pcf-fh-val`).
- `.pcf-scroll-end-spacer` (`global.css`, appended once after `program.sections.map()` in
  `index.astro`) — a flat one-viewport `<div>` after every section, unconditionally. Whichever
  section ends up last (via `main.pcob`'s `@IMPORT` order) needs its own height to sum with
  everything before it to at least one viewport past its own `offsetTop`, or the browser's max
  scroll position falls short and it's silently unreachable by scroll *or* by clicking a link
  into it. This used to be special-cased onto Impressum alone (`.pcf-section-height: 110vh`,
  back when it was always last) and broke the instant `claude.pcob` got imported after it — the
  spacer fixes it generically, for whichever section is last from now on, without any section
  needing to know or care whether it's the final one.
