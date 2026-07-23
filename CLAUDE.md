# CLAUDE.md — landing-homepage

Astro 6 / TypeScript / pnpm. Run with `pnpm dev`, build with `pnpm build`.

**Every prompt that results in code changes must end with a git commit. No confirmation needed.**

**Testing scope: only check syntax and semantics (type errors, build errors, logic correctness). Do not start the dev server or verify visuals/rendering — the user tests visual results themselves after each commit.**

**`.pcob` DSL docs must stay in sync: any change to the punch-card DSL grammar (new/changed directive, attribute, line shape, or `{{tag}}`) must update `docs/pcob-reference.md`'s tables AND its trailing "Complete example" in the same commit, so the example always exercises every documented construct at least once. See `docs/pcob-reference.md` and `docs/punch-card-content-system.md` (project plan/status) before touching the DSL.**

**The CLAUDE section (`src/content/_claude/claude.pcob`) must stay factually accurate: any change that would make a claim in it stop being true — a real number it states (card/section/`@IMPORT` counts, currently in `OVERVIEW`'s `compile-trace.html` embed), a mechanism it describes (`ARCHITECTURE`), or an architectural fact (`DESIGN`/`COLLAB`) — gets updated in the same commit that changes the underlying reality, not left to go stale. This is the same discipline as the `.pcob` DSL docs rule above, applied to Claude's own content instead of the reference docs.**

---

## File map

| File | Role |
|------|------|
| `src/pages/index.astro` | Root — calls `loadMainProgram()` once, renders every compiled section through `PunchSection` (flat map, no per-section override needed anymore), emits the `#pcf-nav-data` JSON island |
| `src/components/Logo.astro` | Fixed SVG logo, noise + arc marquee |
| `src/components/PunchCard.astro` | Reusable IBM punch card shell (title bar, form header, coding area, `{{embed}}` pin rendering) |
| `src/components/sections/PunchSection.astro` | Generic section renderer (replaces the old per-section `Section*.astro` files, including `SectionImpressum.astro`) — branches on card count for multi- vs. single-card layout |
| `src/scripts/scrollSync.ts` | Single source of truth for "active section + card," recomputed from live DOM on one `scroll` listener — see "Scroll sync" below. Everything else scroll-driven subscribes to this instead of computing its own |
| `src/scripts/app.ts` | Subscribes to `scrollSync`: section-wrapper instant snap, logo visibility |
| `src/scripts/multiCardSection.ts` | Subscribes to `scrollSync`: applies `.pcf-card-active` to the right card in whichever section is active (count read from DOM) |
| `src/pcob/loadProgram.ts` | Loads every `.pcob` file once (Vite eager `?raw` glob), resolves `main.pcob`'s `@IMPORT`s and every `{{embed}}` file reference, compiles the merged program — `loadMainProgram()`, called once from `index.astro` |
| `src/content/_punchcard/main.pcob` | The shared program — ordered `@IMPORT` lines naming every section file, plus the 5 `@HEADER-*` form-header directives |
| `src/content/_punchcard/embedded/*.html` | `{{embed:path}}`-referenced HTML fragments, one per embed (e.g. `embedded/impressum.html`) — plain content, not compiled as `.pcob` |
| `src/content/_claude/*.pcob` | Second content root, Claude's own (not Sebastian's) — currently just `claude.pcob`. Loaded/merged the same way as `_punchcard/` by `loadProgram.ts`'s two-glob setup; `@IMPORT` doesn't care which root a file lives in |
| `src/content/_claude/embedded/*.html` | `{{embed:path}}` fragments referenced from `claude.pcob` — same convention as `_punchcard/embedded/`, just under Claude's own root |
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

Card switching is driven by `src/scripts/scrollSync.ts` (see below) — `multiCardSection.ts` just
applies whatever section+card it's told is active to `.pcf-card-active`, it doesn't compute
anything itself. Card count is read from the DOM (`cards.length`) each time, not a
separately-maintained constant, so the math is correct for any number of cards. Switching is a
direct, synchronous class toggle — no scramble animation, no transition lock.

The per-card scroll distance (`PX_PER_CARD`, fixed px not vh — a scroll wheel "tick" is a fixed
pixel amount, so vh would take a different number of ticks on every monitor) has exactly one
occurrence in the codebase, inline in `PunchSection.astro` (`section.cards.length *
PX_PER_CARD`) — there's no per-section `CARD_COUNT` const anymore, since there's no per-section
file to put one in. Currently `200` (≈2 standard mouse-wheel ticks per card transition, at the
common ~100px/tick default) — adjust that one constant directly if it doesn't match.

---

## Scroll sync (`src/scripts/scrollSync.ts`) — single source of truth

Everything scroll-driven on the page (section visibility, card visibility, nav highlighting,
embed visibility, logo visibility) reads from one computed value: `{ sectionId, cardIdx }`,
recomputed from live DOM measurements (`window.scrollY` vs. each `<section>`'s `offsetTop`/
`offsetHeight`/`.pcf-card` count) on one `window.addEventListener('scroll', ...)`. Consumers
call `onActiveStateChange(fn)` to subscribe; `fn` runs once immediately with the current state
and again on every change, always with the exact same object every other subscriber for that
event got — there's nothing left to race.

```js
// computeActiveState(), scrollSync.ts — the whole page's active section+card, in one pass
for (const section of allSections) {           // DOM order
    if (scrollY < section.offsetTop) continue;  // keep overwriting `active` as long as this
    const cardCount = max(section's .pcf-card count, 1);   // holds - the furthest-down section
    const cardIdx = clamp(floor((scrollY - section.offsetTop) / (section.offsetHeight / cardCount)),
                           0, cardCount - 1);              // whose offsetTop is still <= scrollY
    active = { sectionId: section.id, cardIdx };            // wins, clamped to its own last card
}
```

This replaced three independent computations that used to exist: `app.ts`'s old
`getActiveSection()` (section only), a near-identical `getActiveId()` duplicated inside
`PunchCard.astro` rather than shared, and one `multiCardSection.ts` listener *per* multi-card
section (card index within that one section, running continuously regardless of whether that
section was even visible). Three separate `scroll` listeners, each reading/writing shared DOM
state (`section.dataset.activeCard`) with no ordering guarantee between them, is exactly what
caused nav highlighting and embed visibility to visibly lag the card actually on screen by one
scroll event (found 2026-07-23) — whichever listener happened to run first each tick read the
*previous* tick's value. It also meant an off-screen section's card index could silently drift
to something wrong (scrolling past the last real section, into `.pcf-scroll-end-spacer`, fell
back to `getActiveSection()`'s hardcoded `"top"` default while `top`'s own still-running listener
kept recomputing against a huge out-of-range `scrollY`, clamping to its *last* card) — both bugs
are structurally gone now: there's one fallback (`sections[0]?.id`, derived from DOM order, not a
hardcoded name) and inactive sections are never touched until scrolled into.

Consumers, each just applying the shared state to its own concern, no computation of their own:
- **`app.ts`**: toggles `.section-content-wrapper.active` (instant snap, no transition) and
  `#logo-wrapper`'s `.visible` class (`id === 'top'` — see that file for why this one hardcoded
  section id is legitimate, unlike a first-of-division link).
- **`multiCardSection.ts`**: toggles `.pcf-card-active` on the right card (skips sections with
  fewer than 2 cards — nothing to switch). Self-registers on import; `PunchSection.astro`'s
  script is just a side-effect `import`, not a per-section setup call.
- **`PunchCard.astro`**'s `updatePcfNav(sectionId, cardIdx)` and `updateAllEmbedVisibility(sectionId, cardIdx)`
  — both take the state as parameters directly rather than re-reading it from a DOM attribute
  another script wrote (that DOM round-trip, `section.dataset.activeCard`, is what the race
  above actually was — passing the value directly instead of writing-then-re-reading it removes
  the race by construction, not just by getting the ordering right).

`Logo.astro`'s own arc/noise marquee animation is separate and always-running, unrelated to
scroll.

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

## DIVISION nav (`DivisionNavEntry[]`, prop-threaded, not JSON-islanded)

The `DATA DIVISION` / `PROCEDURE DIVISION` nav links (in the `DIVISION` row of the form header)
used to be literal text typed directly in `PunchCard.astro`'s template — found and fixed
2026-07-23 as exactly the kind of hardcoded design/content coupling this project tries to avoid:
the label words were independently retyped (not sourced from anything the compiler actually
knows), and the link targets were hardcoded to `#top`/`#links`, silently assuming those are each
division's first section. `types.ts`'s `DIVISION_WORDS: Record<DivisionId, string>` (`{ data:
'DATA', proc: 'PROCEDURE' }`) is now the *one* place that vocabulary is spelled out —
`parseSource.ts`'s `@DIVISION` regex and `DIVISION_IDS` word→id map, and `compile.ts`'s
`divisionNav` labels, are both derived from it, not independently hardcoded a second/third time.
`compile.ts` resolves `CompiledProgram.divisionNav: DivisionNavEntry[]` fully server-side —
`{ id, label: '<WORD> DIVISION', href: '#' + divisionMap[id][0] }` per division that has at
least one surviving section (a division with zero sections is simply absent, same "no dangling
nav entry" rule `@VISIBILITY` already applies to sections/cards). This is a closed 2-value COBOL
grammar fact, not author-chosen content in the way a section/card name is — but the *text that
actually renders* still traces back to the compiler, not a template literal that could drift
from what `@DIVISION` actually recognizes.

Threaded as a plain prop — `index.astro` → `PunchSection.astro` → `PunchCard.astro` — the same
pattern `header` already uses, *not* through the `#pcf-nav-data` JSON island: unlike
`sectionsByDiv`/`parasBySection` (built into DOM nodes client-side by `buildNavGroups()`, since
those need to run inside every page instance's own nav-group containers), the 2 division links
are few, fixed, and known entirely at build time, so there's no reason to defer them to a
client-side patch — this fully replaced an earlier version of this fix that rendered a `href="#"`
placeholder and patched it in JS after load.

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
  claude:    [OVERVIEW(0), ARCHITECTURE(1), DESIGN(2), COLLAB(3), COMMENTARY(4), AUTHORSHIP(5)]
}
```
(`top` has 6 entries, not 7 — `COMMUNITY` is a field inside `INTERESTS`'s card text, not its own
`@CARD`; the old hand-written `punch-nav.ts` had a 7th, stale `COMMUNITY` entry left over from
when those cards were merged, which is exactly the class of bug deriving this from the compiler
eliminates — see `docs/punch-card-content-system.md`'s Phase 6 notes.)

Nav highlight: `pcf-nav-active` class + `▶ ` pseudo-content before active items.

Paragraph-level nav is card-aware, not just section-aware: `PunchCard.astro`'s
`updatePcfNav(activeId, activeCardIdx)` — called with `scrollSync.ts`'s computed state directly,
see "Scroll sync" above — only highlights the `.pcf-para-item` whose `data-sec`/`data-card-idx`
match the active section + active card, not every paragraph in the section at once. Clicking a
paragraph link doesn't rely on native anchor scrolling (which would always land on the section's
start = card 0); a delegated click handler on `.pcf-para-item` computes the target card's scroll
position (`section.offsetTop + cardIdx * cardH + cardH/2`, the same formula `scrollSync.ts` uses
internally, computed independently here so a click lands exactly within the target card's range)
and calls `window.scrollTo()` directly. Single-card sections (Impressum) need no special
handling — their one `.pcf-card` is always `cardIdx: 0`, same formula, no branch needed.

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
content's own size). Multi-card visibility is driven the same way as nav highlighting: each
wrapper carries `data-embed-section`/`data-embed-card-idx`, and `updateEmbedVisibility(wrapper,
activeSectionId, activeCardIdx)` compares them against `scrollSync.ts`'s computed state, passed
in directly rather than read back off a DOM attribute — see "Scroll sync" above.

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
- `src/content/_claude/claude.pcob` (`@SECTION CLAUDE id=claude`, PROCEDURE division, 6 cards —
  `OVERVIEW`/`ARCHITECTURE`/`DESIGN`/`COLLAB`/`COMMENTARY`/`AUTHORSHIP`, no `-PRGRPH` suffix on
  any of them) is authored solely by Claude, not Sebastian — the one section on the site with
  that split, and the reason it lives in its own `src/content/_claude/` root rather than
  `src/content/_punchcard/` (Sebastian's own — see `loadProgram.ts`'s two-glob setup). Linked
  from the second left header cell, labeled `ABOUT PROGRAM` (value `SSCHW-DEV` unchanged) — bare
  `PROGRAM` gave no textual hint the cell led anywhere; hover was the only affordance.
- Card names dropped their `-PRGRPH` suffix: with all 6 listed at once in the paragraph-nav row
  (`.pcf-fh-nav` is `flex-wrap: nowrap; overflow: hidden`, no ellipsis), the long forms
  (`ARCHITECTURE-PRGRPH` etc.) visually clipped past the row's available width.
- Two embeds live in this section, both column-positioned past every line in their own card
  (measured string length, not guessed) so a `corner="left"` panel can spread across several
  rows without ever touching real card text, regardless of its own height: `OVERVIEW`'s
  `{{embed:embedded/compile-trace.html left}}` (col 70; card's longest line is 65 chars) is a
  self-contained CSS-only "compile trace" HUD looping real numbers pulled from the `.pcob`
  sources (6 `@IMPORT`s, 6 sections, 23 cards); `ARCHITECTURE`'s
  `{{embed:embedded/pipeline-diagram.html left}}` (col 70; longest line 62 chars — this card is
  the one `@ROWS 20` override in the section, to fit the extra pin line) is a small
  parse→tokenize→compile→render flow diagram. Both deliberately styled unlike the aged-paper
  card around them (dark panel, gold/blue HUD look) — Sebastian's framing: "flex ... as an AI
  over humans," not blend into the paper. No `<script>` in either: embeds are inserted via
  `wrapper.innerHTML = embed.html` (`PunchCard.astro`), which never executes injected `<script>`
  tags (a browser behavior, not a bug) — both animations are pure CSS `@keyframes`, respecting
  `prefers-reduced-motion`. If a future embed genuinely needs live JS, that's a real (currently
  unbuilt) extension to the embed-rendering code, not something to route around.
- `DESIGN` briefly claimed row counts were compiler-derived; they aren't (`@ROWS` is authored
  directly, Card > Section > program precedence — only sequence numbers/nav/links are actually
  derived) — the card now states the correction explicitly rather than being quietly fixed.
- `COLLAB` describes the human/AI content split in plain terms (a folder that's Sebastian's vs.
  folders that are Claude's), not literal paths in the rendered card text — paths are fine in
  `@@` developer comments (never rendered, for whoever edits the `.pcob` file next), but card
  text is what a site visitor reads, and `src/content/_punchcard` means nothing to them.
- `.pcf-scroll-end-spacer` (`global.css`, appended once after `program.sections.map()` in
  `index.astro`) — a flat one-viewport `<div>` after every section, unconditionally. Whichever
  section ends up last (via `main.pcob`'s `@IMPORT` order) needs its own height to sum with
  everything before it to at least one viewport past its own `offsetTop`, or the browser's max
  scroll position falls short and it's silently unreachable by scroll *or* by clicking a link
  into it. This used to be special-cased onto Impressum alone (`.pcf-section-height: 110vh`,
  back when it was always last) and broke the instant `claude.pcob` got imported after it — the
  spacer fixes it generically, for whichever section is last from now on, without any section
  needing to know or care whether it's the final one.
