# Punch Card Refactor — Execution Plan

This file is a complete, self-contained spec for a fresh Claude session.
Read this file, then execute. No prior conversation context needed.

---

## What exists now

`src/components/sections/SectionDemoCardFull.astro` is a fully working IBM-style
COBOL punch card component. It is self-contained (everything in one file) and needs
to be split into a reusable base component.

The card renders:
- A title bar ("Program Information" | "Program Navigation" | form number)
- A 3-row IBM Coding Form header (PROGRAMMER/DIVISION, PROGRAM/SECTION, CURRENT SYSTEM/PARAGRAPH)
- A coding area: LINE col (32px) | SEQUENCE col (72px) | 80-col COBOL STATEMENT area
- Column rulers top + bottom, zone label row
- 18 lines of COBOL content rendered as individual character spans (1ch each)
- Spaces in header values rendered as amber dots (punch-style)
- Wear & tear: nth-child opacity + micro-jitter transforms on content and header chars
- Interactive nav: scroll updates active DIVISION / SECTION / PARAGRAPH items

The existing nav structure maps to page sections:
```
DATA DIVISION      → #top, #aboutme, #work
PROCEDURE DIVISION → #links, #impressum
PROTOTYPE DIVISION → #demo-full, #demo-texture
```

---

## Target architecture after refactor

```
src/
  config/
    punch-nav.ts          ← shared nav data (DIVISION_MAP, SECTIONS_BY_DIV, PARAS_BY_DIV)
  utils/
    punchText.ts          ← punchText(str) helper
  components/
    PunchCard.astro       ← base component, accepts props (see below)
    sections/
      SectionTop.astro          ← replaces current bespoke COBOL-styled HTML
      SectionAboutMe.astro      ← replaces current reveal-item HTML
      SectionWork.astro         ← replaces current reveal-item HTML
      SectionLinks.astro        ← replaces current CALL-link HTML
      SectionImpressum.astro    ← special case: punch card shell + prose slot
      SectionDemoCardFull.astro ← becomes thin wrapper using PunchCard
      SectionDemoCardTexture.astro ← second prototype card
```

CSS: move all `pcf-*` rules from `SectionDemoCardFull.astro <style is:global>`
into `src/styles/global.css` (already imported everywhere via index.astro).

---

## Step 1 — Extract shared nav config

**Create `src/config/punch-nav.ts`:**

```typescript
export const DIVISION_MAP: Record<string, string[]> = {
  data:  ['top', 'aboutme', 'work'],
  proc:  ['links', 'impressum'],
  proto: ['demo-full', 'demo-texture'],
};

export const SECTIONS_BY_DIV: Record<string, { label: string; href: string }[]> = {
  data:  [
    { label: 'WORKING-STORAGE.', href: '#top' },
    { label: 'LOCAL-STORAGE.',   href: '#aboutme' },
    { label: 'LINKAGE SECTION.', href: '#work' },
  ],
  proc:  [
    { label: 'LINKS SECTION.',     href: '#links' },
    { label: 'IMPRESSUM-SECTION.', href: '#impressum' },
  ],
  proto: [
    { label: 'PROTO-A FULL-CARD.', href: '#demo-full' },
    { label: 'PROTO-B TEXTURE.',   href: '#demo-texture' },
  ],
};

export const PARAS_BY_DIV: Record<string, { label: string; href: string }[]> = {
  data:  [
    { label: '01 SSCHW-RECORD.', href: '#top' },
    { label: '01 WORK-VARS.',    href: '#aboutme' },
  ],
  proc:  [
    { label: 'MAIN-PRGRPH.',  href: '#links' },
    { label: 'INIT-PRGRPH.', href: '#impressum' },
  ],
  proto: [
    { label: 'CARD-FULL.',    href: '#demo-full' },
    { label: 'CARD-TEXTURE.', href: '#demo-texture' },
  ],
};
```

NOTE: PARAS_BY_DIV is currently division-grained. When multiple paragraph cards
exist per section (e.g. LOCAL-STORAGE has 5 paragraph cards), this needs to become
section-grained. See Step 6 for the updated structure.

---

## Step 2 — Extract punchText utility

**Create `src/utils/punchText.ts`:**

```typescript
export function punchText(text: string): string {
  return text.split('').map(ch => {
    if (ch === ' ') return '<span class="pcf-fh-sp"></span>';
    const e = ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="pcf-fh-ch">${e}</span>`;
  }).join('');
}
```

---

## Step 3 — Move CSS to global.css

Cut ALL rules with `pcf-` prefix from `SectionDemoCardFull.astro` `<style is:global>`
and paste them into `src/styles/global.css` at the end.

Also move these token color rules (they may already be in global.css — check first):
```css
.pcc-div, .pcc-section, .pcc-para, .pcc-lvl, .pcc-name,
.pcc-kw, .pcc-val, .pcc-numval, .pcc-dot, .pcc-comment,
.pcc-empty
```

---

## Step 4 — Create PunchCard.astro base component

**`src/components/PunchCard.astro`** accepts these props:

```typescript
interface Props {
  sectionId: string;          // e.g. 'top', 'aboutme' — used for section wrapper id
  programName: string;        // e.g. 'SSCHW-DEV' — shown in PROGRAM cell
  programmerName: string;     // e.g. 'SEBASTIAN SCHWINN'
  currentSystem: string;      // e.g. 'RETROCODE GMBH'
  identificationHref: string; // e.g. '#impressum'
  lines: Line[];              // COBOL content lines (see type below)
  // Optional: for Impressum special case
  displaySlot?: boolean;      // if true, render DISPLAY/END-DISPLAY shell with <slot/>
}

type TT = 'div'|'section'|'para'|'lvl'|'name'|'kw'|'val'|'numval'|'dot'|'comment';
type Token = [TT, string];
type Line  = [string, Token[]]; // [seqNumber, tokens]
```

The component body is essentially the current SectionDemoCardFull.astro HTML+JS+CSS,
but with:
- Hard-coded values replaced by props
- CSS removed (now in global.css)
- Nav data imported from punch-nav.ts
- punchText imported from utils/punchText.ts
- `<slot />` rendered inside DISPLAY/END-DISPLAY wrapper when `displaySlot={true}`
- The git hash and compiled date stay in the component frontmatter (build-time)

The `<script>` block stays inline in PunchCard.astro but imports nav config:
```typescript
import { DIVISION_MAP, SECTIONS_BY_DIV, PARAS_BY_DIV } from '../config/punch-nav';
// NOTE: Astro inlines scripts — if multiple PunchCard instances exist on the same
// page, use a data attribute on the card element to scope scroll handlers per card,
// OR move nav logic to a single shared app.ts and remove it from PunchCard entirely.
```

**IMPORTANT — multiple cards per page:** When a section has multiple paragraph cards
(e.g. LOCAL-STORAGE), all cards appear in the same page scroll. The nav highlighter
(`updatePcfNav`) must NOT be duplicated per card. Move it to `app.ts` and have each
card register its own element with a shared nav controller. OR: only one card per
visible section (paragraph cards replace the section on scroll). Decide before implementing.

Recommended approach: keep nav logic in `app.ts`, have PunchCard emit a custom event
`pcf-nav-update` that app.ts listens for, or simply call `window.__pcfNavUpdate?.()`.

---

## Step 5 — LINES arrays for each section

### #top — WORKING-STORAGE SECTION (already done in demo card, copy as-is)

```typescript
const LINES: Line[] = [
  ['000001', [['div','DATA DIVISION'],['dot','.']]],
  ['000002', [['section','WORKING-STORAGE SECTION'],['dot','.']]],
  ['000003', [['lvl','01'],['name',' SSCHW-RECORD'],['dot','.']]],
  ['000004', [['lvl','    05'],['name',' NAME    '],['kw',' PIC X(50)'],['kw','  VALUE'],['val'," 'SEBASTIAN SCHWINN'"],['dot','.']]],
  ['000005', [['lvl','    05'],['name',' ROLE    '],['kw',' PIC X(40)'],['kw','  VALUE'],['val'," 'COBOL DEVELOPER'"],['dot','.']]],
  ['000006', [['lvl','    05'],['name',' YEAR    '],['kw',' PIC 9(4) '],['kw','  VALUE'],['numval',' 2025'],['dot','.']]],
  ['000007', [['lvl','    88'],['name',' ACTIVE  '],['kw','           VALUE'],['numval',' 2025'],['dot','.']]],
  ['000008', [['lvl','01'],['name',' WORK-VARS'],['dot','.']]],
  ['000009', [['lvl','    05'],['name',' WS-STATUS'],['kw',' PIC X(10)'],['kw','  VALUE'],['val'," 'AVAILABLE'"],['dot','.']]],
  ['000010', [['lvl','    05'],['name',' WS-CTR   '],['kw',' PIC 9(3) '],['kw','  VALUE'],['numval','  000'],['dot','.']]],
  ['000011', []],
  ['000012', [['div','PROCEDURE DIVISION'],['dot','.']]],
  ['000013', [['para','MAIN-PRGRPH'],['dot','.']]],
  ['000014', [['kw','    DISPLAY'],['name',' NAME']]],
  ['000015', [['kw','    PERFORM'],['name',' INIT-PRGRPH'],['kw',' THRU'],['name',' INIT-END']]],
  ['000016', [['kw','    MOVE'],['val'," 'ENGINEER'"],['kw',' TO'],['name',' ROLE']]],
  ['000017', [['kw','    STOP RUN'],['dot','.']]],
  ['000018', [['para','INIT-PRGRPH'],['dot','.']]],
];
```

### #aboutme — LOCAL-STORAGE SECTION
Split into 5 paragraph cards. Each card is 18 lines.

**Card 1 of 5 — WORK-NOW paragraph:**
```typescript
[
  ['000001', [['section','LOCAL-STORAGE SECTION'],['dot','.']]],
  ['000002', [['lvl','01'],['name',' ABOUT-ME'],['dot','.']]],
  ['000003', []],
  ['000004', [['lvl','    05'],['name',' WORK-NOW'],['dot','.']]],
  ['000005', [['lvl','        10'],['name',' COMPANY'],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'RETROCODE'"],['dot','.']]],
  ['000006', [['lvl','        10'],['name',' ROLE   '],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'COBOL DEVELOPER'"],['dot','.']]],
  ['000007', [['lvl','        10'],['name',' SECTOR '],['kw',' PIC X(25)'],['kw',' VALUE'],['val'," 'FINANCIAL SECTOR'"],['dot','.']]],
  ['000008', [['lvl','        10'],['name',' SINCE  '],['kw',' PIC 9(4) '],['kw',' VALUE'],['numval',' 2025'],['dot','.']]],
  ['000009', []],
  ['000010', [['lvl','    05'],['name',' WORK-BFRE'],['dot','.']]],
  ['000011', [['lvl','        10'],['name',' COMPANY'],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'HILSCHER'"],['dot','.']]],
  ['000012', [['lvl','        10'],['name',' ROLE   '],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'C DEVELOPER'"],['dot','.']]],
  ['000013', [['lvl','        10'],['name',' TECH   '],['kw',' PIC X(40)'],['kw',' VALUE'],['val'," 'OPC UA - INDUSTRIAL AUTOMATION'"],['dot','.']]],
  ['000014', []],
  ['000015', [['lvl','    05'],['name',' STUDIES'],['dot','.']]],
  ['000016', [['lvl','        10'],['name',' DEGREE '],['kw',' PIC X(5) '],['kw',' VALUE'],['val'," 'MSC'"],['dot','.']]],
  ['000017', [['lvl','        10'],['name',' FIELD  '],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'ELECTRICAL ENGINEERING'"],['dot','.']]],
  ['000018', [['lvl','        10'],['name',' GRADE  '],['kw',' PIC X(20)'],['kw',' VALUE'],['val'," 'WITH DISTINCTION'"],['dot','.']]],
]
```

**Card 2 of 5 — 05 PRG-LANGUAGES paragraph:**
```typescript
[
  ['000001', [['section','LOCAL-STORAGE SECTION'],['dot','.']]],
  ['000002', [['lvl','01'],['name',' ABOUT-ME'],['dot','.']]],
  ['000003', []],
  ['000004', [['lvl','    05'],['name',' PRG-LANGUAGES'],['kw',' PIC X(10)'],['dot','.']]],
  ['000005', [['lvl','        88'],['name',' COBOL     '],['kw','  VALUE'],['val'," 'PRIMARY'"],['dot','.']]],
  ['000006', [['lvl','        88'],['name',' C         '],['kw','  VALUE'],['val'," 'PRIMARY'"],['dot','.']]],
  ['000007', [['lvl','        88'],['name',' CPP       '],['kw','  VALUE'],['val'," 'KNOWN'"],['dot','.']]],
  ['000008', [['lvl','        88'],['name',' PYTHON    '],['kw','  VALUE'],['val'," 'KNOWN'"],['dot','.']]],
  ['000009', [['lvl','        88'],['name',' SQL-DB2   '],['kw','  VALUE'],['val'," 'KNOWN'"],['dot','.']]],
  ['000010', [['lvl','        88'],['name',' JCL       '],['kw','  VALUE'],['val'," 'KNOWN'"],['dot','.']]],
  ['000011', [['lvl','        88'],['name',' SHELL     '],['kw','  VALUE'],['val'," 'KNOWN'"],['dot','.']]],
  ['000012', [['lvl','        88'],['name',' JAVASCRIPT'],['kw','  VALUE'],['val'," 'KNOWN'"],['dot','.']]],
  ['000013', [['lvl','        88'],['name',' OPC-UA    '],['kw','  VALUE'],['val'," 'KNOWN'"],['dot','.']]],
  ['000014', []],
  ['000015', [['lvl','    05'],['name',' VOC-LANGUAGES'],['kw',' PIC X(10)'],['dot','.']]],
  ['000016', [['lvl','        88'],['name',' GERMAN  '],['kw','  VALUE'],['val'," 'NATIVE'"],['dot','.']]],
  ['000017', [['lvl','        88'],['name',' ENGLISH '],['kw','  VALUE'],['val'," 'C2'"],['dot','.']]],
  ['000018', [['lvl','        88'],['name',' JAPANESE'],['kw','  VALUE'],['val'," 'BEGINNER'"],['dot','.']]],
]
```

Cards 3–5 for LOCAL-STORAGE can mirror WORK-BFRE, STUDIES, and remaining content
as needed — split when 18 lines would be exceeded.

### #work — LINKAGE SECTION

```typescript
[
  ['000001', [['section','LINKAGE SECTION'],['dot','.']]],
  ['000002', [['lvl','01'],['name',' WORKLOAD'],['dot','.']]],
  ['000003', []],
  ['000004', [['lvl','    05'],['name',' WORK-CURRENT'],['dot','.']]],
  ['000005', [['lvl','        10'],['name',' COMPANY'],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'RETROCODE'"],['dot','.']]],
  ['000006', [['lvl','        10'],['name',' ROLE   '],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'COBOL DEVELOPER'"],['dot','.']]],
  ['000007', [['lvl','        10'],['name',' SECTOR '],['kw',' PIC X(25)'],['kw',' VALUE'],['val'," 'FINANCIAL SECTOR'"],['dot','.']]],
  ['000008', [['lvl','        10'],['name',' SINCE  '],['kw',' PIC 9(4) '],['kw',' VALUE'],['numval',' 2025'],['dot','.']]],
  ['000009', [['lvl','        10'],['name',' PROFILE'],['kw',' PIC X(50)'],['kw',' VALUE'],['val'," 'linkedin.com/in/sschwinn/'"],['dot','.']]],
  ['000010', []],
  ['000011', [['lvl','    05'],['name',' WORK-PREV'],['dot','.']]],
  ['000012', [['lvl','        10'],['name',' COMPANY'],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'HILSCHER'"],['dot','.']]],
  ['000013', [['lvl','        10'],['name',' ROLE   '],['kw',' PIC X(30)'],['kw',' VALUE'],['val'," 'C DEVELOPER'"],['dot','.']]],
  ['000014', [['lvl','        10'],['name',' TECH   '],['kw',' PIC X(40)'],['kw',' VALUE'],['val'," 'OPC UA - INDUSTRIAL AUTOMATION'"],['dot','.']]],
  ['000015', []],
  ['000016', [['comment','*> LINKAGE: data passed from calling program context']]],
  ['000017', [['comment','*> LOCAL-STORAGE: personal identity record (see #aboutme)']]],
  ['000018', []],
]
```

### #links — LINKS SECTION (PROCEDURE DIVISION)

```typescript
[
  ['000001', [['div','PROCEDURE DIVISION'],['dot','.']]],
  ['000002', [['section','LINKS SECTION'],['dot','.']]],
  ['000003', []],
  ['000004', [['para','SERVICES-PRGRPH'],['dot','.']]],
  ['000005', [['kw','    CALL'],['val'," 'KB.SSCHW.DEV'"],['comment','  *> Personal wiki & notes']]],
  ['000006', [['kw','    CALL'],['val'," 'LLDAP'"],['comment','         *> Directory management (LAN)']]],
  ['000007', [['kw','    CALL'],['val'," 'BITWARDEN'"],['comment','     *> Password manager (LAN)']]],
  ['000008', [['dot','.']]],
  ['000009', []],
  ['000010', [['para','SOCIALS-PRGRPH'],['dot','.']]],
  ['000011', [['kw','    CALL'],['val'," 'LINKEDIN'"],['comment','      *> linkedin.com/in/sschwinn/']]],
  ['000012', [['kw','    CALL'],['val'," 'INSTAGRAM'"],['comment','     *> instagram.com/s.schwinni/']]],
  ['000013', [['dot','.']]],
  ['000014', []],
  ['000015', [['para','EXIT-PRGRPH'],['dot','.']]],
  ['000016', [['kw','    EXIT PARAGRAPH'],['dot','.']]],
  ['000017', []],
  ['000018', []],
]
```

Note: CALL tokens should be clickable links in the rendered card. This requires
extending the token system with a `call` type that renders as `<a href="...">`.
The href mapping lives in a separate config alongside the LINES data for that section.

### #impressum — IMPRESSUM-SECTION (special case, no LINES array)

Uses `displaySlot={true}` prop. PunchCard renders:
- Full punch card header (DISPLAY as the zone label row, styled)
- `<slot />` in the coding area — existing impressum HTML goes here unchanged
- Footer row showing END-DISPLAY

The coding area background (the beige punch card texture) wraps the prose content.
The existing `impressum-grid` div, legal sections, and German text stay as-is.

### #demo-full — already done (existing SectionDemoCardFull.astro content)

### #demo-texture — SectionDemoCardTexture.astro

Unknown content — check the existing file and author LINES[] to match.
If it currently has no COBOL content, create placeholder lines.

---

## Step 6 — Updated PARAS_BY_DIV (section-grained, not division-grained)

When multiple paragraph cards exist within one section (e.g. LOCAL-STORAGE),
the PARAGRAPH nav row should show the paragraphs of the ACTIVE section, not
all paragraphs of the active division. Update the config to:

```typescript
export const PARAS_BY_SECTION: Record<string, { label: string; href: string }[]> = {
  'top':      [{ label: '01 SSCHW-RECORD.', href: '#top' }, { label: '01 WORK-VARS.', href: '#top' }],
  'aboutme':  [
    { label: 'WORK-NOW.',        href: '#aboutme' },
    { label: '05 PRG-LANGUAGES.', href: '#aboutme' },
    { label: '05 VOC-LANGUAGES.', href: '#aboutme' },
  ],
  'work':     [{ label: 'WORK-CURRENT.', href: '#work' }, { label: 'WORK-PREV.', href: '#work' }],
  'links':    [{ label: 'SERVICES-PRGRPH.', href: '#links' }, { label: 'SOCIALS-PRGRPH.', href: '#links' }],
  'impressum':[{ label: 'IMPRESSUM-PRGRPH.', href: '#impressum' }],
  'demo-full':[{ label: 'CARD-FULL.', href: '#demo-full' }],
  'demo-texture':[{ label: 'TEXTURE-INIT.', href: '#demo-texture' }],
};
```

And update `updatePcfNav` to look up by active section id, not active division id.

---

## Step 7 — Order of operations

1. Create `src/config/punch-nav.ts`
2. Create `src/utils/punchText.ts`
3. Move all `pcf-*` CSS from SectionDemoCardFull into `src/styles/global.css`
4. Create `src/components/PunchCard.astro` by extracting from SectionDemoCardFull,
   replacing hardcoded values with props, importing nav config + punchText
5. Rewrite `SectionDemoCardFull.astro` as thin wrapper using `<PunchCard>`
   — verify it still looks identical before touching other sections
6. Create `SectionTop.astro` using `<PunchCard>` with the #top LINES array
   — verify, then retire the old bespoke HTML (keep the scroll-driven image
   animation in a separate overlay div ABOVE the punch card, not inside it)
7. Create `SectionAboutMe.astro` using `<PunchCard>` with the two LINES arrays
8. Create `SectionWork.astro` using `<PunchCard>`
9. Create `SectionLinks.astro` using `<PunchCard>` (extend token types for CALL links)
10. Create `SectionImpressum.astro` using `<PunchCard displaySlot={true}>`
    with existing prose content as the slot
11. Update `PARAS_BY_DIV` → `PARAS_BY_SECTION` in nav config and update nav logic
12. Remove now-unused CSS classes from the old bespoke section components

---

## Important implementation notes

**CALL link tokens:** The Links section uses `CALL 'X'` where the value is a
clickable URL. Extend the token type system:
```typescript
type TT = 'div'|'section'|'para'|'lvl'|'name'|'kw'|'val'|'numval'|'dot'|'comment'|'call';
```
Add a `callLinks` prop to PunchCard mapping token text to href:
```typescript
callLinks?: Record<string, string>; // e.g. { "'KB.SSCHW.DEV'": 'https://kb.sschw.dev' }
```
When rendering a `val` token that appears in `callLinks`, wrap in `<a href="...">`.

**Scroll-driven SectionTop animation:** The current SectionTop has a scroll-driven
image slideshow and text scrambler animation. These live OUTSIDE the punch card
(in an overlay or side panel). The punch card for #top shows static COBOL data;
the animation logic stays as a separate component or overlay div rendered alongside
the card. Do not try to put the animation inside the punch card.

**Multiple paragraph cards within one section:** Currently one punch card = one page
section (`<section id="...">` element). When LOCAL-STORAGE needs 2 cards, those 2
cards both live inside the same `<section id="aboutme">` and stack vertically.
The section height increases accordingly (currently `88vh` per card, so 2 cards
= `176vh`). The scroll handler already picks the active section by offsetTop
so this works without changes to app.ts.

**Sequence numbers:** Each card restarts at `000001`. This is intentional — each
card is a separate coding form. Sequence numbers are cosmetic only.

**The `displaySlot` Impressum case:** PunchCard renders:
```html
<div class="pcf-coding-area">
  <div class="pcf-zone-row">
    <div class="pcf-zone-linenum">LINE</div>
    <div class="pcf-zone-seq">DISPLAY</div>        <!-- replace "SEQUENCE" -->
    <div class="pcf-zone-stmt">IMPRESSUM-SECTION.</div>
  </div>
  <div class="pcf-display-body">
    <slot />   <!-- existing impressum prose HTML goes here -->
  </div>
  <div class="pcf-zone-row pcf-zone-btm">
    <div class="pcf-zone-seq">END-DISPLAY</div>
    <div class="pcf-zone-stmt"></div>
  </div>
</div>
```
Style `pcf-display-body` to have the same beige background + border as the punch area,
with normal prose typography (not monospace, normal font-size for readability).

---

## CSS tokens already in use (do not rename)

```
Colors: --blue-primary, --blue-darker-1, --blue-darker-2, --text-muted
Punch card: pcf-card, pcf-stage, pcf-title-bar, pcf-form-header, pcf-coding-area
Form header: pcf-fh-row, pcf-fh-cell, pcf-fh-w1/w2/w3, pcf-fh-nav-cell
Form header content: pcf-fh-lbl, pcf-fh-val, pcf-fh-ch, pcf-fh-sp, pcf-fh-nav
Nav items: pcf-div-item, pcf-sec-item, pcf-para-item, pcf-nav-active, pcf-nav-dot
Nav groups: pcf-sec-group, pcf-para-group
Rulers: pcf-ruler-row, pcf-ruler-linenum, pcf-ruler-seq, pcf-ruler-chars
Ruler ticks: pcf-rlinenum-tick, pcf-rseq-tick, pcf-rchars-tick
Content: pcf-line-row, pcf-line-num, pcf-line-num-digit, pcf-seq, pcf-seq-digit, pcf-chars
Token colors: pcc-div, pcc-section, pcc-para, pcc-lvl, pcc-name, pcc-kw, pcc-val, pcc-numval, pcc-dot, pcc-comment, pcc-empty
```

---

## Files NOT to touch during this refactor

- `src/scripts/app.ts` — handles global nav, scroll direction, section transitions
- `src/components/BottomNav.astro` — existing bottom nav, separate from punch card nav
- `src/styles/global.css` — only APPEND punch card CSS, don't modify existing rules
- `src/pages/index.astro` — only update section component imports if filenames change
- `src/components/Logo.astro`

---

## Verification checklist after each step

- [ ] `pnpm dev` starts without errors
- [ ] Card visually identical to pre-refactor for #demo-full
- [ ] Scroll updates DIVISION / SECTION / PARAGRAPH active highlights correctly
- [ ] Amber dots appear in header values (punchText working)
- [ ] Column ruler numbers align with COBOL STATEMENT characters
- [ ] Wear & tear (opacity + micro-jitter) visible on content and header chars
- [ ] IDENTIFICATION "IMPRESSUM" text links to #impressum on click
- [ ] DATE - VERSION shows build date and git hash
