# CLAUDE.md — landing-homepage

Astro 6 / TypeScript / pnpm. Run with `pnpm dev`, build with `pnpm build`.

**Every prompt that results in code changes must end with a git commit. No confirmation needed.**

**Testing scope: only check syntax and semantics (type errors, build errors, logic correctness). Do not start the dev server or verify visuals/rendering — the user tests visual results themselves after each commit.**

**`.pcob` DSL docs must stay in sync: any change to the punch-card DSL grammar (new/changed directive, attribute, line shape, or `{{tag}}`) must update `docs/pcob-reference.md`'s tables AND its trailing "Complete example" in the same commit, so the example always exercises every documented construct at least once. See `docs/pcob-reference.md` and `docs/punch-card-content-system.md` (project plan/status) before touching the DSL.**

---

## File map

| File | Role |
|------|------|
| `src/pages/index.astro` | Root — imports Logo + 5 sections |
| `src/components/Logo.astro` | Fixed SVG logo, noise + arc marquee |
| `src/components/PunchCard.astro` | Reusable IBM punch card shell (title bar, form header, coding area) |
| `src/components/sections/SectionTop.astro` | Hero — WORKING-STORAGE, 7-card stack, switching via `multiCardSection.ts` |
| `src/components/sections/SectionAboutMe.astro` | LOCAL-STORAGE — 5-card stack, switching via `multiCardSection.ts` |
| `src/components/sections/SectionWork.astro` | LINKAGE SECTION — 2-card stack, switching via `multiCardSection.ts` |
| `src/components/sections/SectionLinks.astro` | PROCEDURE DIVISION LINKS — 2-card stack, switching via `multiCardSection.ts` |
| `src/components/sections/SectionImpressum.astro` | IMPRESSUM-SECTION — single card, legal text is a JS-positioned overlay (not a PunchCard slot) |
| `src/scripts/app.ts` | Main scroll handler: section activation, instant panel snap, logo visibility |
| `src/scripts/multiCardSection.ts` | Shared card-switching logic for multi-card sections (count read from DOM) |
| `src/config/punch-nav.ts` | Nav config: DIVISION_MAP, SECTIONS_BY_DIV, PARAS_BY_SECTION |
| `src/styles/global.css` | All styles (pcf-* punch card, section scroll system, token colors) |
| `src/utils/punchText.ts` | Renders strings as wear/jitter span markup for form header values |

---

## PunchCard component API

```ts
interface Props {
  programName: string;
  programmerName: string;
  currentSystem: string;
  identificationHref?: string;   // default '#impressum'
  lines?: Line[];                // [seq6chars, Token[]][]
  callLinks?: Record<string, string>; // val token text → href
  noStage?: boolean;             // omit pcf-stage wrapper (use in pcf-stage-multi)
}
```

(`displaySlot`/`displayLabel`/`displayHeader`/`slotAtLine` — the old Astro-`<slot/>`-passthrough
mechanism, plus the `@SLOT` directive that fed it — were removed entirely as unused dead code;
nothing in the codebase ever consumed them. If embedded non-text content is needed again, revisit
as a fresh design rather than reviving this — see `docs/punch-card-content-system.md`'s decisions
log.)

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

## SectionTop card data

Not a special case anymore — SectionTop is a `.pcf-stage-multi` section like AboutMe/Work/Links
(see below), just with `CARD_COUNT = 7`. Compiled from `src/content/_punchcard/top.pcob`
(7 `@CARD`s sharing one DIVISION/SECTION/01-level header; only the 05-level group name and the
two 10-level VALUE strings vary per card — see that file for the exact padded text):

```
IDENTITY     BACKGROUND   CAREER-CURR  CAREER-PREV  SKILLS  INTERESTS  COMMUNITY
```

No animation, no photo panel (both removed) — cards switch the same instant way as every other
multi-card section. `punch-nav.ts`'s `PARAS_BY_SECTION.top` labels stay hand-written for now
(nav consolidation is a deferred follow-up, see `docs/punch-card-content-system.md`).

---

## Multi-card sections (SectionTop, SectionAboutMe, SectionWork, SectionLinks)

Pattern:
```astro
<section id="aboutme">
  <div class="section-scroll-container" style={`height: ${CARD_COUNT * 88}vh;`}>
    <div class="section-content-wrapper">
      <div class="pcf-stage-multi">
        <PunchCard noStage={true} ... />  <!-- card 0 -->
        <PunchCard noStage={true} ... />  <!-- card 1 -->
      </div>
    </div>
  </div>
</section>
```

Cards are absolutely centered (`top: 50%; left: 50%; transform: translate(-50%,-50%)`), height
intrinsic to row count (not stretched to a fixed region), `opacity: 0` by default.
Active card: `pcf-card-active` → `opacity: 1`.

Card switching is a shared module, `src/scripts/multiCardSection.ts` (`setupMultiCardSection(sectionId)`),
called once from each section's own `<script>` block — no more per-section copy-pasted logic.
Card count is read from the DOM (`cards.length`), not a separately-maintained constant, so the
math is correct for any number of cards. Switching is a direct, synchronous class toggle — no
scramble animation, no transition lock.

Scroll calc (inside `multiCardSection.ts`):
```js
relScroll = window.scrollY - section.offsetTop;
cardH     = section.scrollHeight / cards.length;
newIdx    = clamp(Math.floor(relScroll / cardH), 0, cards.length - 1);
```

Each section's frontmatter still defines its own `CARD_COUNT` const — that one is unrelated to
switching, it's only used for `style={height: CARD_COUNT * 88vh}` sizing of `.section-scroll-container`.

---

## Scroll / section activation system (app.ts)

- Each section: `.section-scroll-container` (tall, gives scrollable space) + `.section-content-wrapper` (position: fixed)
- `getActiveSection()`: uses `window.scrollY + innerHeight/2` vs section `offsetTop + offsetHeight`
- On section change: `transitionTo(id)` toggles `.active` on the wrapper — instant snap, no
  animation (no `transition` CSS property, no enter/exit classes, no direction-from-scroll logic)
- `sectionRunners` map calls `window.__topRun` etc. on each scroll tick while active

Section runners:
- `__topRun` (SectionTop): called every scroll tick while in #top — drives item cycling
- `__aboutMeRun`, `__workRun`, `__linksRun`, `__impressumRun`: no-ops; card switching uses
  `multiCardSection.ts`'s own `addEventListener('scroll', ...)` in each section's script

`updateLogo(id)` toggles `.visible` on `#logo-wrapper` (visible only on `#top`) — the only other
thing `app.ts`'s scroll handler does besides section switching. `Logo.astro`'s own arc/noise
marquee animation is separate and always-running, unrelated to scroll.

---

## Navigation config (punch-nav.ts)

```ts
DIVISION_MAP = { data: ['top','aboutme','work'], proc: ['links','impressum'] }

PARAS_BY_SECTION = {
  // each entry: { label, href, cardIdx } — cardIdx addresses a specific card within the section
  top:       [IDENTITY(0), BACKGROUND(1), CAREER-CURR(2), CAREER-PREV(3), SKILLS(4), INTERESTS(5), COMMUNITY(6)]
  aboutme:   [WORK-NOW(0), WORK-BFRE(1), STUDIES(2), PRG-LANGUAGES(3), VOC-LANGUAGES(4)]
  work:      [WORK-CURRENT(0), WORK-PREV(1)]
  links:     [SERVICES-PRGRPH(0), SOCIALS-PRGRPH(1)]
  impressum: [IMPRESSUM-SECTION(0)]
}
```

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

## SectionImpressum (JS-measured overlay, not a PunchCard slot)

Compiled from `src/content/_punchcard/impressum.pcob` (one `@CARD`, 19 rows). `@SLOT` and
`PunchCard`'s `slotAtLine`/`displaySlot` props have been removed entirely — nothing ever
consumed them (see the PunchCard component API section above).

The German legal text (`.impressum-grid`) is a plain sibling `<div class="impressum-overlay">`
next to the `<PunchCard>`, absolutely positioned at runtime by the section's own script
(`positionImpressumOverlay`), which measures `.pcf-line-row` elements at fixed indices — `rows[3]`
(line 4, first blank row after `DISPLAY`) and `rows[13]` (line 14, last blank row before
`END-DISPLAY`) — via `getBoundingClientRect()` and sizes the overlay to span exactly that range.
Changing the card's row layout (e.g. how many blank rows sit between `DISPLAY`/`END-DISPLAY` in
`impressum.pcob`) must keep those two indices pointing at the right rows, or update them to match.

The card's own `IMPRESSUM-SECTION.` line is intentionally styled as a section-header token
(`pcc-section`), not a paragraph-name token — it doubles as both this card's only heading and a
literal echo of the `@SECTION`'s name. This relies on the tokenizer's header-row check matching
the trailing `SECTION`/`DIVISION` word on a `\b` boundary rather than a required preceding space,
so a hyphen-joined form like `IMPRESSUM-SECTION.` is recognized the same as `LINKS SECTION.`.

---

## Established patterns

- All sections share the same PunchCard header values: `programName="SSCHW-DEV"`, `programmerName="SEBASTIAN SCHWINN"`, `currentSystem="RETROCODE GMBH"`, `identificationHref="#impressum"`
- Empty COBOL lines: `['000003', []]`
- Standalone dot line (closes a statement block): `['000015', [['dot','     .']]]` — 5-space statement indent, not bare
- Comment lines: `['000013', [['comment','* GOBACK TO ...']]]`
- `callLinks` maps the exact val token string (including leading space and quotes) → URL
- Font: `"Share Tech Mono", monospace` throughout
