# `.pcob` Language Reference

Status: **syntax agreed in discussion, not yet compiled** — see `docs/dsl-mockup.pcob` for a
full worked example and `docs/punch-card-content-system.md` for the project plan this belongs to.

## What it is

A plain-text format for authoring punch-card content (Division → Section → Card → Line) without
touching TypeScript. You write near-literal COBOL-flavoured text; a compiler turns it into the
`Line[]` data `PunchCard.astro`'s renderer already consumes, deriving sequence numbers, line
numbers, indentation, and row-padding so you don't have to.

## The one rule

> A line whose first non-space character is `@` is a **directive**. Every other line is
> **card text**, rendered close to verbatim.

Directives are always whole-line, always start at column 1. This is the entire boundary between
"structure" and "text" — nothing else in the grammar can blur it.

## Directives

| Directive | Where | Purpose |
|---|---|---|
| `@@ ...` | anywhere | Comment. Entire line is discarded, never rendered. |
| `@ROWS N` | before any `DIVISION`; right after a `SECTION`; inside a `CARD` | Sets the row count for everything from here down until a more specific `@ROWS` overrides it. Precedence: Card > Section > program default. |
| `@DIVISION DATA \| PROCEDURE` | top level | Starts a division. |
| `@SECTION NAME attr=val ...` | inside a division | Starts a section. See attributes below. |
| `@CARD NAME` | inside a section | Starts one card = one COBOL paragraph. `NAME` is also its nav label. |
| `@SLOT name rows=N` | inside a card | Reserves N blank rows for a section-owned HTML overlay (e.g. Impressum's legal text). Doesn't define the content — the section component still owns that. |

### `@SECTION` attributes

| Attribute | Required | Meaning |
|---|---|---|
| `id=` | always | Anchor id (`#id`) and the name other content links to it by. |
| `record=` | DATA DIVISION sections only | Generates the shared `01 <name>.` group line stamped onto every card in the section. |

## Card text

Everything not starting with `@` is rendered text, line for line. Recognized line *shapes* get
their canonical formatting auto-applied; anything else is passed through literally:

| You write | What happens |
|---|---|
| (blank line) | Blank rendered row. |
| `.` | Standalone closing dot. |
| `* some text` | Comment row (column 1, never indented). |
| `01 / 05 / 10 / 88 NAME ...` | Level row — compiler applies the canonical indent for that level number (01→1 space, 05→5, 10/88→7). Everything after the name (PIC clause, VALUE, spacing between them) is literal, author-controlled text. |
| `CALL '...'`, `EXIT PARAGRAPH`, `EXIT SECTION`, `DISPLAY`, `END-DISPLAY` | Statement row — compiler applies the standard 5-space statement indent. |

**Leading whitespace you type before a recognized line shape is ignored** — the compiler always
emits its own canonical indent for that shape, regardless of how the source was indented. Indent
your `.pcob` source however is easiest for you to read; it has no effect on the rendered card.
Internal spacing *after* the recognized prefix (e.g. padding to line up sibling `PIC` clauses) is
left exactly as typed — the compiler never reflows that.

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

Tags can nest (e.g. a cycling field that also noise-transitions). A literal `{{` in text, if ever
needed, is escaped as `\{{`.

Every tag is always an open/close pair wrapping the exact text it applies to — there is no bare
or self-closing shorthand. To make a whole phrase clickable (e.g. `EXIT PARAGRAPH`), wrap the
phrase itself: `{{link:name}}EXIT PARAGRAPH{{/link}}`, not a trailing unwrapped `{{link:name}}`.

## Open / not yet decided

- DATA DIVISION boilerplate beyond what's shown (deeper field/condition patterns) gets added to
  the table above as real migrations surface them — this reference grows with the grammar.

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
@SECTION DEMO-DATA id=demo-data record=DEMO-RECORD
@CARD DEMO-FIELDS
05 DEMO-FIELDS.
10 LABEL PIC X(10) VALUE {{anchor:demo-label}}{{cycle:demo}}{{noise}}'HELLO'{{/noise}}{{/cycle}}{{/anchor}}.
10 COUNT PIC 9(2) VALUE 7.
88 IS-READY VALUE 'YES'.

@DIVISION PROCEDURE
@SECTION DEMO-PROC id=demo-proc
@ROWS 14
@CARD DEMO-CARD
@ROWS 20
* a comment row
DISPLAY
@SLOT demo-slot rows=2
END-DISPLAY
CALL {{link:'https://example.com'}}'EXAMPLE'{{/link}}
CALL {{link:demo-label}}'JUMP TO LABEL'{{/link}}
.

{{link:demo-proc}}EXIT PARAGRAPH{{/link}}
.
{{link:demo-proc}}EXIT SECTION{{/link}}
.
```

What's exercised, in order: `@@` comment, program-level `@ROWS`, `@DIVISION DATA`, `@SECTION` with
`id=`/`record=`, a `05` group with a `10 PIC X` field (quoted `val`, plus `{{anchor}}`/`{{cycle}}`/
`{{noise}}` nested on one span), a `10 PIC 9` field with a bare numeric value (`numval`), an `88`
condition; the decorative blank line before `@DIVISION PROCEDURE` (discarded, since it precedes a
directive); `@SECTION` with a section-level `@ROWS` override; a
card-level `@ROWS` override; a comment row; `DISPLAY`/`@SLOT`/`END-DISPLAY`; a `CALL` with an
external (quoted) `{{link}}` and one with an internal (bare-name) `{{link}}` to the `{{anchor}}`
declared earlier; a standalone `.`; a content blank line (kept, since it precedes card text, not
a directive); and both `EXIT PARAGRAPH` and `EXIT SECTION`, each linking back to their own
section by explicit name (no implicit `self`).
