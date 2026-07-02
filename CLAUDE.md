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
| `src/components/sections/SectionTop.astro` | Hero — WORKING-STORAGE with scroll-driven scramble + photo panel |
| `src/components/sections/SectionAboutMe.astro` | LOCAL-STORAGE — 5-card noise-transition stack |
| `src/components/sections/SectionWork.astro` | LINKAGE SECTION — 2-card noise-transition stack |
| `src/components/sections/SectionLinks.astro` | PROCEDURE DIVISION LINKS — 2-card noise-transition stack |
| `src/components/sections/SectionImpressum.astro` | IMPRESSUM-SECTION — single card with `slotAtLine` slot injection |
| `src/scripts/app.ts` | Main scroll handler: section activation, directional transitions, nav updates |
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
  displaySlot?: boolean;         // legacy DISPLAY/END-DISPLAY zone + <slot>
  displayLabel?: string;
  displayHeader?: string;
  callLinks?: Record<string, string>; // val token text → href
  noStage?: boolean;             // omit pcf-stage wrapper (use in pcf-stage-multi)
  slotAtLine?: number;           // inject <slot> between line[n-1] and line[n]
}
```

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

## SectionTop dynamic rows

Scroll interval: `INTERVAL_HEIGHT = 70px`, 7 items cycling.

```
NAME_ROW = 4   // row index (0-based) for the 05 group line
NAME_START = 7 // char offset into pcf-chars for the name token
NAME_LEN = 14

VAL_ROW = 5    // 10 NAME-VAL line
VAL_START = 39 // lvl(9) + name(13) + kw(10) + kw(7) = 39
VAL_LEN = 34   // length of the val token including quotes

DESC_ROW = 6   // 10 NAME-DSCRPTN line
DESC_START = 39
DESC_LEN = 11
```

Items (group / value / desc / imageId):
```
IDENTITY    / 'SEBASTIAN SCHWINN               ' / 'NAME     ' / top-me
BACKGROUND  / 'MSC ELECTRICAL ENGINEERING      ' / 'EDUCATION' / top-degree
CAREER      / 'COBOL DEVELOPER AT RETROCODE    ' / 'CURR-ROLE' / top-cobol
CAREER      / 'EMBEDDED C / OPC-UA             ' / 'PREV-ROLE' / top-opcua
SKILLS      / 'PYTHON  SQL-DB2  JCL  JS        ' / 'LANGUAGES' / top-coding
INTERESTS   / '3D PRINTING - TECHNICAL TINKERIN' / 'HOBBIES  ' / top-3d
COMMUNITY   / 'TENNIS + TABLE TENNIS CLUBS     ' / 'COMMUNITY' / top-sports
```

Animation: `scrambleRange` for name+val, `directUpdate` for desc.

---

## Multi-card sections (SectionAboutMe, SectionWork, SectionLinks)

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

Cards are `position: absolute; top: 7vh; bottom: 7vh; left: 7%; right: 7%; opacity: 0`.
Active card: `pcf-card-active` → `opacity: 1`.
Ghost silhouettes: `pcf-stage-multi::before/::after` (CSS pseudo-elements, 8px / 16px offset).

Card switch: `scrambleCardRows` scrambles rows 2+ (skips DATA DIVISION + SECTION header rows), then swaps active class.

Scroll calc:
```js
relScroll = window.scrollY - section.offsetTop;
cardH     = section.scrollHeight / CARD_COUNT;  // = 88vh
newIdx    = Math.floor(relScroll / cardH);
```

---

## Scroll / section activation system (app.ts)

- Each section: `.section-scroll-container` (tall, gives scrollable space) + `.section-content-wrapper` (position: fixed)
- `getActiveSection()`: uses `window.scrollY + innerHeight/2` vs section `offsetTop + offsetHeight`
- On section change: `transitionTo(id)` applies enter/exit CSS classes
- Same DIVISION → horizontal slide (translateX); cross-DIVISION → vertical (translateY)
- `sectionRunners` map calls `window.__topRun` etc. on each scroll tick while active

DIVISION_OF: `top/aboutme/work → 'data'`, `links/impressum → 'proc'`

Section runners:
- `__topRun` (SectionTop): called every scroll tick while in #top — drives item cycling
- `__aboutMeRun`, `__workRun`, `__linksRun`, `__impressumRun`: currently no-ops; card switching uses own `addEventListener('scroll', ...)` in each section's script

---

## Navigation config (punch-nav.ts)

```ts
DIVISION_MAP = { data: ['top','aboutme','work'], proc: ['links','impressum'] }

PARAS_BY_SECTION = {
  top:       [{ label: '01 SSCHW-RECORD.', href: '#top' }],
  aboutme:   [WORK-NOW, WORK-BFRE, STUDIES, PRG-LANGUAGES, VOC-LANGUAGES]
  work:      [WORK-CURRENT, WORK-PREV]
  links:     [SERVICES-PRGRPH, SOCIALS-PRGRPH]
  impressum: [IMPRESSUM-PRGRPH]
}
```

Nav highlight: `pcf-nav-active` class + `▶ ` pseudo-content before active items.

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
| `.pcf-display-block` | Slot injection zone between two punch areas (slotAtLine) |
| `.pcf-display-body` | Legacy full-height slot zone (displaySlot prop) |
| `.pcf-zone-row` | Header row (LINE / SEQUENCE / A / B labels), `height: 15px` |
| `.pcf-ruler-row` | Ruler tick row, `height: 13px` |
| `.section-scroll-container` | Tall spacer giving scrollable height |
| `.section-content-wrapper` | `position: fixed; width: 100%; height: 100vh` — the visible content |

Transition classes on `.section-content-wrapper`:
`active | exit-up | exit-down | exit-left | exit-right | enter-up | enter-down | enter-left | enter-right`

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

## SectionImpressum (slotAtLine)

10 lines defined, `slotAtLine={5}` → slot injected between line 4 (DISPLAY) and line 5 (END-DISPLAY).
`slotFlex = 18 - 10 = 8` → slot div gets `flex: 8`.
Slot content: `.impressum-grid` 2-column CSS grid with German legal text.

`.pcf-display-block` padding should respect linenum (32px) + seq (72px) left offset so content doesn't cover those zones.

---

## Established patterns

- All sections share the same PunchCard header values: `programName="SSCHW-DEV"`, `programmerName="SEBASTIAN SCHWINN"`, `currentSystem="RETROCODE GMBH"`, `identificationHref="#impressum"`
- Empty COBOL lines: `['000003', []]`
- Standalone dot line (closes a statement block): `['000015', [['dot','     .']]]` — 5-space statement indent, not bare
- Comment lines: `['000013', [['comment','* GOBACK TO ...']]]`
- `callLinks` maps the exact val token string (including leading space and quotes) → URL
- Font: `"Share Tech Mono", monospace` throughout
