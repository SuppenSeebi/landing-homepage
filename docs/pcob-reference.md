# `.pcob` Language Reference

Status: **syntax agreed in discussion, not yet compiled** — see `docs/dsl-mockup.pcob` for a
full worked example and `docs/punch-card-content-system.md` for the project plan this belongs to.

## What it is

A plain-text format for authoring punch-card content (Division → Section → Card → Line) without
touching TypeScript. You write near-literal COBOL-flavoured text; a compiler turns it into the
`Line[]` data `PunchCard.astro`'s renderer already consumes, deriving sequence numbers, line
numbers, and row-padding so you don't have to — indentation is yours to type, see below.

## The one rule

> A line whose first non-space character is `@` is a **directive**. Every other line is
> **card text**, rendered close to verbatim.

Directives are always whole-line, always start at column 1. This is the entire boundary between
"structure" and "text" — nothing else in the grammar can blur it.

## Card text is WYSIWYG

**The compiler never generates a visible card-text line, and never re-indents one.** Strip out
`{{tags}}` and every character left in a rendered card — including leading and internal
whitespace — must trace back to something you literally typed. Directives and inline tags only
ever affect things *around* the text — anchors, nav labels, link targets, row budget — never the
text itself, and never its indentation. Want a `DATA DIVISION.` line to appear? Type it, in every
card that should show it, same as any other line — the compiler doesn't stamp it in for you, even
though `@DIVISION DATA` already told it which division this is. Want that line indented one
space, or a statement indented five? Type the spaces; there is no canonical/auto-applied indent
for any line shape.

## Directives

| Directive | Where | Purpose |
|---|---|---|
| `@@ ...` | anywhere | Comment. Entire line is discarded, never rendered. |
| `@IMPORT filename.pcob` | before any `DIVISION` | Merges another `.pcob` file's divisions/sections/cards into this program, in the order the `@IMPORT` lines appear. Only meaningful in a top-level "main program" (this site's is `src/content/_punchcard/main.pcob`) — an imported file may not itself contain `@IMPORT` (subordinate files must stay fully self-contained; nesting throws a compile error, not a silent no-op). Importing the same file twice, or a file that can't be found, is also a compile error. This is what lets any card `{{link:}}` any section by name, anywhere in the program — every imported file's anchors land in the one shared registry. |
| `@HEADER-LEFT-FIRST\|SECOND\|THIRD "label" "value"` | top-level "main program" only, same rule as `@IMPORT` | Authors one of the 3 left form-header cells (`PROGRAMMER`/`PROGRAM`/`CURRENT SYSTEM` today). All 3 are required — a missing one is a compile error. |
| `@HEADER-RIGHT-FIRST\|SECOND "label" "value"` | top-level "main program" only, same rule as `@IMPORT` | Authors one of the first 2 right form-header cells (`XREF`/`IDENTIFICATION` today). Both required. `value` may contain one `{{link:...}}...{{/link}}` — if present, the whole rendered cell becomes clickable to that target; if absent, the cell renders as plain (non-linked) text. There is no `@HEADER-RIGHT-THIRD` — the 3rd right cell (`DATE - VERSION`) is computed at build time (today's date + git short-hash), not authored content, and using that combination is a compile error with a message saying so. |
| `@ROWS N` | before any `DIVISION`; right after a `SECTION`; inside a `CARD` | Sets the row count for everything from here down until a more specific `@ROWS` overrides it. Precedence: Card > Section > program default. |
| `@DIVISION DATA \| PROCEDURE` | top level | Starts a division. |
| `@SECTION NAME attr=val ...` | inside a division | Starts a section. See attributes below. |
| `@CARD NAME` | inside a section | Starts one card = one COBOL paragraph. `NAME` is also its nav label. |

### `@SECTION` attributes

| Attribute | Required | Meaning |
|---|---|---|
| `id=` | always | Anchor id (`#id`) and the name other content links to it by. |

## Card text

Everything not starting with `@` is rendered text, line for line, exactly as typed. Recognized
line *shapes* get their characters classified into colored tokens (level/statement/header/etc.)
— but classification never changes what's rendered, and a shape is only ever applied to text you
actually wrote; the compiler doesn't add lines you didn't type. Anything not matching a
recognized shape is passed through literally, same as everything else:

| You write | What happens |
|---|---|
| (blank line) | Blank rendered row. |
| `.` (anywhere on the line, alone) | Standalone closing dot, exactly as indented — a bare `.` renders unindented; `     .` renders with 5 leading spaces. Nothing is added. |
| `* some text` | Comment row, rendered exactly as typed. |
| `01 / 05 / 10 / 88 NAME ...` | Level row — leading whitespace before the level number, and the whitespace between the number and the name, are both kept exactly as typed. Everything after the name (PIC clause, VALUE, spacing between them) is likewise literal, author-controlled text. |
| `CALL '...'`, `EXIT PARAGRAPH`, `EXIT SECTION`, `GOBACK`, `DISPLAY`, `END-DISPLAY` | Statement row — leading whitespace before the verb is kept exactly as typed (want the usual 5-space Area B indent? type 5 spaces). |
| `... DIVISION` / `... SECTION` (optionally followed by `.`), incl. hyphen-joined (`...-SECTION`) | Header row — colored as a DIVISION/SECTION heading. Purely recognition of text you wrote, indentation included; `@DIVISION`/`@SECTION` do not generate this line for you. The trailing word is matched on a word boundary, not a required preceding space, so `IMPRESSUM-SECTION.` is recognized the same as `LINKS SECTION.`. |
| A single bare word, e.g. `SERVICES-PRGRPH.` | Paragraph-name row — colored as a paragraph heading. Same rule: `@CARD` names the nav entry, it does not stamp this line into the card. |

**There is no canonical or auto-applied indent for any line shape.** Leading whitespace is just
more literal text, same as everything else on the line — type it exactly the way you want it
rendered. This is the same WYSIWYG rule as line generation, applied to indentation too.

## Inline tags

Used inside card text to mark a span without leaving plain-text mode. All follow the same shape:
`{{name:param}} ... {{/name}}`.

| Tag | Meaning |
|---|---|
| `{{link:name}}...{{/link}}` | Internal link to an anchor (a `@SECTION id=` or an `{{anchor:}}`), referenced by bare name. |
| `{{link:'https://...'}}...{{/link}}` | External link — quotes mean "literal URL," distinguishing it from an internal anchor name. |
| `{{anchor:name}}...{{/anchor}}` | Declares a named link target finer-grained than a whole section. Shares one namespace with `@SECTION id=` — names must be unique document-wide. |
| `{{cycle:groupId}}...{{/cycle}}` | Marks a span as a rotating/dynamic value belonging to cycle-group `groupId` (replaces today's hand-counted character-offset constants). |
| `{{noise}}...{{/noise}}` | Marks a span to noise/ASCII-scramble in on scroll. Composable by nesting with other tags. |
| `{{embed:path}}` / `{{embed:path corner}}` | Pins a separate HTML file's raw content to this exact row+character position — a zero-width marker, no closing tag (see below). `path` is relative to the referencing `.pcob` file. `corner` (optional, default `top-left`) picks which corner of the *embedded content* touches the pin — one of `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`; anything else is a compile error. |

Tags can nest (e.g. a cycling field that also noise-transitions). A literal `{{` in text, if ever
needed, is escaped as `\{{`.

Every tag is always an open/close pair wrapping the exact text it applies to — there is no bare
or self-closing shorthand — **except `{{embed}}`**, which is a pure pin, not a decorator around
visible text (nothing renders in its place, so there's nothing to wrap): `{{embed:path}}` on its
own is complete, no `{{/embed}}` follows. To make a whole phrase clickable (e.g. `EXIT
PARAGRAPH`), wrap the phrase itself: `{{link:name}}EXIT PARAGRAPH{{/link}}`, not a trailing
unwrapped `{{link:name}}`.

**`{{embed}}` reserves no space of its own.** Whatever row it's typed on renders exactly as
that row's other characters dictate (usually blank, if it's the only thing on the line) — if you
want visual space made for the embedded content, you type blank lines around it yourself, same
WYSIWYG rule as everything else. The embedded HTML/CSS is free to overflow the card, or the
screen, entirely; sizing and layout are its own responsibility, not something `@ROWS` or any
`.pcob` construct controls.

## Open / not yet decided

- DATA DIVISION boilerplate beyond what's shown (deeper field/condition patterns) gets added to
  the table above as real migrations surface them — this reference grows with the grammar.
- ~~Embedding non-text content (images, video) has no tag yet.~~ **Built (2026-07-04)**: see
  `{{embed:path}}` above. `@SLOT name rows=N`, the old model this replaces (reserve N rows for
  a section-owned Astro `<slot/>`), was removed entirely first — nothing ever consumed it; see
  `docs/punch-card-content-system.md`'s decisions log. `{{embed}}` is a genuinely different
  shape: a zero-width pin, not a row-reserving slot, with the reference travelling through
  `compileRawProgram()`'s output as data — no Astro-side slot-supplying code needed per use.

## Deferred to the compiler (Phase 2, design already settled)

- Anchor uniqueness: `@SECTION id=` and `{{anchor:name}}` share one flat namespace and must be
  globally unique — not yet implemented as a validation rule. `{{link}}` references may duplicate
  freely; that's normal.
- There is no self-link concept. A card only ever defines an anchor or links to one by name; if
  the resolved target happens to be the current page, that's not special-cased.

## Complete example

Every directive, attribute, line shape, and tag from this reference, used at least once. This
example must stay in sync with the tables above — see the upkeep rule in `CLAUDE.md`.

```pcob
@@ comment — never rendered
@ROWS 8

@DIVISION DATA
@SECTION DEMO-DATA id=demo-data
@CARD DEMO-FIELDS
 DATA DIVISION.
 DEMO-DATA SECTION.
 01 DEMO-RECORD.
     05 DEMO-FIELDS.
       10 LABEL PIC X(10) VALUE {{anchor:demo-label}}{{cycle:demo}}{{noise}}'HELLO'{{/noise}}{{/cycle}}{{/anchor}}.
       10 COUNT PIC 9(2) VALUE 7.
       88 IS-READY VALUE 'YES'.

@DIVISION PROCEDURE
@SECTION DEMO-PROC id=demo-proc
@ROWS 14
@CARD DEMO-CARD
@ROWS 20
 PROCEDURE DIVISION.
 DEMO-PROC-SECTION.
 DEMO-CARD.
* a comment row
     DISPLAY
     END-DISPLAY
{{embed:demo-photo.html bottom-right}}
     CALL {{link:'https://example.com'}}'EXAMPLE'{{/link}}
     CALL {{link:demo-label}}'JUMP TO LABEL'{{/link}}
     .

     {{link:demo-proc}}EXIT PARAGRAPH{{/link}}
     .
     {{link:demo-proc}}EXIT SECTION{{/link}}
     .

     {{link:demo-data}}GOBACK{{/link}}
     .
```

What's exercised, in order: `@@` comment, program-level `@ROWS`, `@DIVISION DATA`, `@SECTION`
with `id=`; a literal `DATA DIVISION.` / `DEMO-DATA SECTION.` (header row shape — written by
hand, not generated, indentation typed by hand too), an `01` group, a `05` group with a `10 PIC
X` field (quoted `val`, plus `{{anchor}}`/`{{cycle}}`/`{{noise}}` nested on one span; note the
level indentation — 1/5/7 spaces — is typed, not computed, though it happens to match the COBOL
convention this project follows), a `10 PIC 9` field with a bare numeric value (`numval`), an
`88` condition; the decorative blank line before `@DIVISION PROCEDURE` (discarded, since it
precedes a directive); `@SECTION` with a section-level `@ROWS` override; a card-level `@ROWS`
override; a literal `PROCEDURE DIVISION.` / `DEMO-PROC-SECTION.` (header row shape again, this
time hyphen-joined — recognized on the trailing word's boundary, not a required preceding space)
and a literal `DEMO-CARD.` (paragraph-name row shape — also hand-typed, matching the `@CARD` name
because Sebastian chose to type it that way, not because the compiler enforces it); a comment
row (column 1, exactly as typed); `DISPLAY`/`END-DISPLAY` (each statement's 5-space indent typed
by hand); `{{embed:demo-photo.html bottom-right}}` on its own line, column 0 — a zero-width pin,
so this line still renders blank, with the explicit `corner` form used here (contrast with
Impressum's real `{{embed:embedded/impressum.html}}`, which omits it and defaults to
`top-left`); a `CALL` with an external (quoted) `{{link}}` and one with an internal
(bare-name) `{{link}}` to the `{{anchor}}` declared earlier; a standalone `.` indented to match
the statements above it (also typed, not automatic); a content blank line (kept, since it
precedes card text, not a directive); `EXIT PARAGRAPH` and `EXIT SECTION`, each linking back to
their own section by explicit name (no implicit `self`); and a final `GOBACK`, linking back across
divisions to the other section's anchor (`demo-data`) — same statement-row treatment as any other
recognized verb, just a different word.

(Actually compiling this exact snippet needs a `resolveEmbedFile` callback that can find
`demo-photo.html` — unlike everything else here, which compiles standalone via a bare
`compileProgram(source)` call, since that function's `resolveEmbedFile` param defaults to
"nothing found." Not a real file in this repo — illustrative only, same as `demo-data`/
`demo-proc` aren't real anchors anywhere outside this example.)

`@IMPORT` and `@HEADER-*` are both top-level-only constructs, so they don't fit inside the
single-file example above — here's the whole `.pcob` file above treated as `demo.pcob`, with a
second, top-level file importing it and authoring the 5 header cells:

```pcob
@@ main.pcob — a top-level "main program": an ordered import list plus the 5 required
@@ form-header cells. Subordinate files (like demo.pcob above) stay fully self-contained —
@@ no @IMPORT or @HEADER-* of their own.
@HEADER-LEFT-FIRST   "PROGRAMMER"     "SEBASTIAN SCHWINN"
@HEADER-LEFT-SECOND  "PROGRAM"        "SSCHW-DEV"
@HEADER-LEFT-THIRD   "CURRENT SYSTEM" "RETROCODE GMBH"
@HEADER-RIGHT-FIRST  "XREF"           "{{link:demo-proc}}DEMO{{/link}}"
@HEADER-RIGHT-SECOND "IDENTIFICATION" "{{link:demo-data}}FIELDS{{/link}}"

@IMPORT demo.pcob
```

Compiling `main.pcob` (not `demo.pcob` directly) merges `demo.pcob`'s two divisions/sections/cards
in, so anything in the real program could now write e.g. `{{link:demo-data}}...{{/link}}` from a
third imported file too — one shared anchor registry across every imported file, not one per file.
The two `@HEADER-RIGHT-*` values each link back into `demo.pcob`'s own anchors (`demo-proc`,
`demo-data`) — same `{{link:name}}` mechanism card text uses, just resolved once per header cell
instead of once per token.
