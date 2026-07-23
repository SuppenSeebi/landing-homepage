# Roadmap — Upcoming Projects

Status: **planning**. Nothing below has code yet. This doc tracks four initiatives Sebastian
raised in one conversation (2026-07-23), in the order agreed to tackle them — that order does
**not** match the order they were originally raised in. Each gets its own dedicated design doc
(same pattern as `docs/punch-card-content-system.md`) once work actually starts; this file is
the index + current state, updated as things move.

Only #1 and #4 live in this repo. #2/#3 live in `D:\WRK\tool-homepage`. #5 isn't a code repo at
all. Kept together here anyway since they're one connected roadmap Sebastian is tracking.

---

## Priority order

| # | Project | Repo | State |
|---|---|---|---|
| 1 | Claude's own section | landing-homepage | **Done** (2026-07-23) |
| 2 | Tools page redesign + embed | tool-homepage (+ landing-homepage for the embed point) | Not started |
| 3 | AI tool-authoring pipeline | tool-homepage | Not started, deliberately deferred until after #2 |
| 4 | Blog / projects write-ups | landing-homepage | Not started, needs a content-model discussion first |
| 5 | 3D-printed lamp (design + PCB + firmware) | new, non-code project | Not started, intentionally last |

---

## 1. Claude's own section

A new section on this page, authored solely by Claude — explains what the page is/does, how
it's designed (tradeoffs, opinions), and states explicitly that this section is Claude's own and
not Sebastian's to edit. Fits the existing architecture directly: one new `.pcob` file +
`@IMPORT` line in `main.pcob`, same as any section (see `CLAUDE.md`'s "Sections are generic").
Since Claude is the sole author here, the usual "keep content plain-text so Sebastian can safely
edit it" concern doesn't apply.

**Open questions to settle before writing it:**
- What does "embedded in the header PROGRAM SSCHW-DEV ABOUT THIS PAGE" mean concretely — a new
  `@HEADER-*` cell linking to this section (cells already support an optional `href` via
  `{{link:name}}`), or something else?
- Reachable from main nav like any other section, or more hidden?

**Done (2026-07-23).** `src/content/_claude/claude.pcob` — `@SECTION CLAUDE id=claude`,
PROCEDURE division, 6 cards (`OVERVIEW-PRGRPH`, `ARCHITECTURE-PRGRPH`, `DESIGN-PRGRPH`,
`COLLAB-PRGRPH`, `COMMENTARY-PRGRPH`, `AUTHORSHIP-PRGRPH`) covering what the page does, the real
engineering underneath it, tradeoffs, the human/AI authorship split, Claude's own commentary, and
an explicit authorship/ownership statement. Answered the open questions by
precedent: the `PROGRAM` header cell's existing value (`SSCHW-DEV`) now links to this section
(`{{link:claude}}SSCHW-DEV{{/link}}` in `main.pcob`) — same pattern as `XREF`→`links` and
`IDENTIFICATION`→`impressum` already use — and it's a normal section in nav (`proc` division),
also matching precedent rather than being hidden.

Surfaced a real gap while wiring the link: `PunchCard.astro` only had conditional `<a>`/`<div>`
rendering for the *right* header cells — left cells (`PROGRAMMER`/`PROGRAM`/`CURRENT SYSTEM`)
always rendered as plain `<div>`, silently ignoring any `href`, even though `CLAUDE.md`'s
documented header-cell contract never scoped that behavior to right cells only. Fixed for all
three left cells, in both `PunchCard.astro` templates — this was also a blocker waiting to happen
for #2 below, since `CURRENT SYSTEM` (a left cell) is exactly the cell that project needs to link.
`astro build` verified end-to-end (compiled HTML spot-checked: `PROGRAM` → `href="#claude"`, all
4 cards present with correct `cardIdx` nav entries).

Sebastian then asked for the content itself to live in a folder that's visibly Claude's, not
mixed into `_punchcard/` (his own content root) — moved to `src/content/_claude/claude.pcob`,
`src/pcob/loadProgram.ts` updated to glob both content roots (two literal glob-pattern arrays;
Vite's `import.meta.glob` requires a static array, not one built from a shared constant — found
by a real build failure, fixed by inlining the patterns). `@IMPORT claude.pcob` in `main.pcob`
needed no change — both roots flatten into the same by-basename lookup map. Re-verified with a
full `astro build` after the move.

After deploying, Sebastian found two real bugs: (1) the `PROGRAM`/`SSCHW-DEV` header cell gave no
textual hint it was clickable — fixed by relabeling it `ABOUT PROGRAM` (value unchanged), staying
within the ~14-char width already proven safe by `CURRENT SYSTEM`/`IDENTIFICATION`. (2) Scrolling
or clicking into the CLAUDE section never got past Impressum — root cause turned out to be a real
layout constraint, not leftover hardcoding: whichever section is physically last in the document
needs its own height to reach at least one viewport past its `offsetTop`, or the browser's max
scroll position falls short and it's unreachable. That was special-cased onto Impressum alone
(`.pcf-section-height: 110vh`, "Impressum is the last section") and broke the moment `claude.pcob`
became the new last import. Fixed generically with `.pcf-scroll-end-spacer`, a flat one-viewport
`<div>` appended once after all sections in `index.astro` — guarantees reachability for whichever
section ends up last from now on, with no per-section special-casing. Both fixes verified via
`astro build` + compiled-HTML spot checks (see `CLAUDE.md`'s "Established patterns" for detail).

A third round: Sebastian caught a factual error (`DESIGN-PRGRPH` claimed row counts were derived
from the text — they're not, `@ROWS` is authored directly, only sequence numbers/nav/links are
actually derived) and asked for more depth on the real engineering and the human/AI split, rather
than describing it in the abstract — "this page itself should resemble the technicality it uses."
Added two cards: `ARCHITECTURE-PRGRPH` (the actual mechanisms — `.pcob`'s parse/tokenize/compile
pipeline, `@IMPORT`'s shared anchor registry, `{{embed:path}}`'s zero-width pin, `@VISIBILITY`'s
dual static builds) and `COLLAB-PRGRPH` (concretely: Sebastian authors `_punchcard/`, Claude
authors `_claude/` and built every mechanism above; Claude never runs a dev server or sees the
rendered page, so all visual judgment on this site is Sebastian's, by rule, not by omission).
`DESIGN-PRGRPH` now states the row-count correction plainly rather than being silently fixed.
Writing literal `{{link}}`/`{{embed:path}}` syntax into card *text* (not as functioning tags)
required the DSL's `\{{` escape — confirmed via a real `astro build` that it renders as literal
text rather than either erroring or firing as a real tag. Now 6 cards total, `astro build`
verified.

Sebastian also pointed out the section was still fairly text-only and explicitly invited a
visual flex, since `{{embed:path}}` already exists and this section is Claude's to decide.
Added `src/content/_claude/embedded/compile-trace.html`, a self-contained CSS-only "HUD" panel
pinned into `OVERVIEW-PRGRPH` (`{{embed:embedded/compile-trace.html left}}` at col 60) — loops
real numbers (6 `@IMPORT`s, 6 sections, 23 cards) pulled from the actual `.pcob` sources, styled
deliberately unlike the aged-paper card around it. No `<script>` — embeds are injected via
`innerHTML`, which never executes injected `<script>` tags, so the animation is pure CSS
`@keyframes` (respecting `prefers-reduced-motion`). Verified via `astro build` + inspecting the
compiled `data-embeds` JSON (`col: 60, row: 9, corner: "left", cardIdx: 0`, matching the pin's
placement exactly).

A fifth round of feedback, deliberately framed as optional ("fix on your desire"): (1) `COLLAB`'s
literal `src/content/_punchcard` path reference in rendered card text got reworded to plain
terms (a folder that's Sebastian's vs. folders that are Claude's) — paths are fine in `@@`
developer comments, not in text an actual visitor reads. (2) `COLLAB` gained explicit advantage/
disadvantage bullets for the human/AI split, not just a description of it. (3) The compile-trace
HUD was covering the word "CARD" at the end of `OVERVIEW`'s `DISPLAY` line — root cause was
`corner="left"`'s vertical centering combined with col 60 sitting only ~4 characters past that
line's actual text; measured every line in the card (max 65 chars) and moved the pin to col 70,
comfortably clear regardless of how far the panel spreads vertically. (4) Sebastian explicitly
lifted the requirement to follow COBOL-style card formatting for this section — used that to add
a per-card `@ROWS 20` override on `ARCHITECTURE` without hesitation, same as `SOCIALS-PRGRPH` in
`links.pcob` already does elsewhere. (5) Added a second embed, `pipeline-diagram.html` (col 70,
same measured-not-guessed logic, longest line 62 chars) — a small parse→tokenize→compile→render
flow diagram on `ARCHITECTURE`, visually related to `compile-trace.html` (shared dark-panel/
gold-corner-bracket language) without sharing any CSS between the two files. (6) All 6 card names
dropped their `-PRGRPH` suffix (`OVERVIEW`/`ARCHITECTURE`/`DESIGN`/`COLLAB`/`COMMENTARY`/
`AUTHORSHIP`) — the long forms were clipping visually in the paragraph-nav row once all 6 showed
at once (`.pcf-fh-nav` has no ellipsis, just `overflow: hidden`). `astro build` verified; both
embeds' compiled `col`/`row` re-confirmed against the new pin positions.

A sixth round, split into three asks: (1) a standing rule, added to `CLAUDE.md` near the top
(alongside the existing `.pcob` DSL-docs-sync rule) — the CLAUDE section must be updated in the
same commit as any change that makes one of its factual claims stop being true. (2) A real bug,
not a symptom: nav highlighting and embed visibility visibly lagged the card actually on screen
by one scroll event, and scrolling past the last section could show a wrong, off-screen section's
card. Root cause was three independent "what's active" computations (`app.ts`'s
`getActiveSection`, a near-duplicate `getActiveId` in `PunchCard.astro`, and one
`multiCardSection.ts` listener per multi-card section) racing on separate `scroll` listeners with
no ordering guarantee, plus a hardcoded `"top"` fallback masking the overscroll case — exactly
the tech debt already flagged in the (now resolved) `project_duplicate_scroll_logic` memory.
Unified into `src/scripts/scrollSync.ts`: one computation, one listener, one `{sectionId,
cardIdx}` value every consumer subscribes to and receives directly rather than re-reading a DOM
attribute another script wrote. Sebastian's own proposed framing ("scale height by card count ×
ticks × height per tick, shouldn't that fix nav/embeds too") was structurally right — the fix is
a single source of truth, which is what this is. (3) An audit for other hardcoded pcob↔design-master
coupling turned up one more: the DIVISION-nav row's jump links were hardcoded to `#top`/`#links`,
assuming those are each division's first section — now derived from `divisionMap`'s first entry
per division (`patchDivisionLinks()`), so a future `@IMPORT` reorder can't silently break them.
The one remaining hardcoded content id (`app.ts`: logo only shows on `id === 'top'`) is
intentional and documented as such — it names a specific concept (the identity/home section),
not a positional "first of N" fact with an array to derive from. `astro build` verified; the
compiled JS bundle for `scrollSync.ts`, `app.ts`, and `multiCardSection.ts` was read directly
(post-bundle, pre-minified logic confirmed by hand) since scroll behavior itself can't be
verified without a browser.

A seventh round: Sebastian caught the exact hardcoding the audit above described but didn't
actually fix — `<a class="pcf-div-item" data-div="proc" href="#">PROCEDURE DIVISION</a>` still
had its *label text* ("DATA DIVISION"/"PROCEDURE DIVISION") typed directly in `PunchCard.astro`'s
template, only the `href` had been derived. Stated rule of thumb: darker-beige chrome (title bar,
zone-row labels) is legitimately fixed design; lighter-beige areas (form header, navbar, links,
card content) should trace back to `.pcob`-compiled data, not independently-typed template
literals. Fixed properly this time: `types.ts`'s new `DIVISION_WORDS` constant is now the *one*
place `DATA`/`PROCEDURE` are spelled out — `parseSource.ts`'s `@DIVISION` regex/word-map and
`compile.ts`'s new `divisionNav: DivisionNavEntry[]` (fully resolved `{id, label, href}` per
division, server-side) both derive from it. Threaded as a plain prop (`index.astro` →
`PunchSection.astro` → `PunchCard.astro`, same pattern as `header`) rather than the client-side
placeholder-then-patch approach from the previous round, which is now removed entirely
(`patchDivisionLinks()` deleted). See `CLAUDE.md`'s new "DIVISION nav" section for full detail.

Broader audit against the stated rule found no other clear-cut violations, but surfaced a
genuinely ambiguous case Sebastian asked to discuss rather than have decided unilaterally: the
`DIVISION`/`SECTION`/`PARAGRAPH`/`DATE - VERSION` caption words above each header nav row are
hardcoded template text, visually inside the lighter-beige area, but arguably not "content" at
all — they're fixed COBOL/form structural category names with no pcob-authored source to derive
from, same category as `DATE - VERSION` (already a deliberate, previously-discussed exception via
the `@HEADER-RIGHT-THIRD` compile error). **Resolved**: Sebastian confirmed leaving them as
hardcoded design chrome — see `CLAUDE.md`'s "DIVISION nav" section for the settled reasoning.

---

## 2. Tools page redesign + embed

Rework `tool.sschw.dev` (`D:\WRK\tool-homepage`): sophisticated design, default tools, and
tagging/grouping (e.g. "string", "pdf"). Embed into this page, replacing the
`CURRENT SYSTEM RETROCODE GMBH` header cell/value.

**Recommended approach:** treat this as its own project in `tool-homepage`, not a reskin into
the COBOL punch-card aesthetic — a tools directory has different UI needs (forms, previews,
outputs) than 80-column fixed-format cards. Keep it thematically consistent but let it be its
own "system" the user jumps into, similar to how `CURRENT SYSTEM`/`IDENTIFICATION` already act
as pointers to other systems, not embedded page content.

**Scope for this step specifically:** redesign + tagging/grouping only. No AI-authoring pipeline
yet — that's #3, deliberately sequenced after this exists and is stable.

**Open questions:** current stack of `tool-homepage` (needs a look before any design decision);
exact mechanism for "embed" (iframe vs. link-out vs. shared header/nav) — likely a link-out from
the header cell rather than a true embed, to avoid cross-origin/styling entanglement, but worth
confirming once the redesign shape is clearer.

---

## 3. AI tool-authoring pipeline

The ambitious part: prompt something like "add a tool to remove all whitespace from a string"
and have Claude write the backend + frontend, wire it into the API, install dependencies, and
commit — gated so only Sebastian (or an explicitly authorized other person) can trigger it, via
token/MFA/similar, with no need for Sebastian to touch the underlying files directly.

**Recommendation: don't build this as custom always-on agent infrastructure for v1.** What's
described is a secure remote-code-execution-on-request system with auto-deploy — real
infrastructure (auth, sandboxing, dependency install, auto-commit, auto-deploy), not a feature
on top of the tools page. The risk is blast radius: a compromised token or a bad prompt
modifying a live backend with no human in the loop.

**Staged plan:**
- **v1 (do first, ships immediately, zero new infra):** exactly what already happens in a
  Claude Code session — Sebastian prompts in a coding session against `tool-homepage`, Claude
  writes the tool, Sebastian reviews the diff, Claude commits. This is "AI writes the tool" with
  none of the remote-trigger risk.
- **v2 (only if v1 proves inconvenient in practice — e.g. wanting to trigger from a phone with
  no laptop/session open):** a gated remote trigger — token/MFA-authenticated endpoint that
  kicks off a Claude Code run against `tool-homepage` in an isolated worktree/sandbox, with a
  mandatory review or CI gate before anything merges or deploys. Scope narrowly: allowlisted
  repo/paths only, rate-limited, secrets never reachable by the agent, no direct prod-deploy
  path without that gate passing.

**Open questions (for when we actually design v2):** what "gate" looks like in practice (human
approval vs. automated checks only), how dependency installation is sandboxed, how tokens are
issued/revoked, whether "someone else" ever gets access and what that access model looks like.

---

## 4. Blog / project write-ups

Longer-form content — project descriptions, possibly images and embedded external content
(e.g. GitHub). Needs a content-model discussion before any implementation, since prose at this
length doesn't fit the existing 80-column punch-card line format well.

**Starting point for that discussion:** `{{embed:path}}` (`src/pcob/tags.ts`,
`src/content/_punchcard/embedded/*.html`) is already a generic, freely-positioned HTML-fragment
pin — not Impressum-specific — and may already cover images/GitHub-card-style embeds without
inventing new tag vocabulary (per the project's established preference for reusing existing
directives — see `docs/punch-card-content-system.md`'s Phase 1 process note). The actual gap is
long-form prose itself: either stretch the punch-card metaphor with a sibling format (e.g. a
"printout"/greenbar-report sheet, thematically consistent but not row/column-constrained the
same way), or keep cards as a terse index that links out to differently-templated pages.

**Recommended next step:** dedicated design conversation (own doc, same pattern as the punch-card
content system doc) before writing any code — this is a content-model decision, not a small
addition.

---

## 5. 3D-printed lamp

FreeCAD 3D-print design, KiCad PCB design + sourcing, and (if scoped) firmware — Claude doing
all of the design work. Intentionally last, and structurally different from everything else
here: it's not a web project, doesn't live in a code repo yet, and iteration depends on physical
prototyping (fit, thermals, tolerances) that Claude can't verify directly — expect a
print/assemble → report back → adjust loop rather than the usual build/typecheck iteration.

**Open questions (for when this starts):** new working directory/repo for CAD + firmware
sources; what "lamp" actually needs to do (just light, or dimming/color/smart-home integration —
this determines whether firmware/PCB complexity is trivial or substantial); sourcing constraints
(budget, preferred suppliers, what Sebastian can actually assemble/solder himself vs. needs
pre-assembled).

---

## Next action

Pick which of #1–#4 to actually scope first (the priority order above says #1, Claude's own
section) and start that project's own design conversation.
