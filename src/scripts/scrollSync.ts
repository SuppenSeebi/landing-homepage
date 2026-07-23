// Single source of truth for "which section, and which card within it, is currently active" -
// computed once per scroll event from live DOM measurements (offsetTop/offsetHeight/card
// count), never cached across events. This used to be computed independently three times:
// app.ts's getActiveSection() (section only), PunchCard.astro's near-identical getActiveId()
// (section only, duplicated rather than shared), and one multiCardSection.ts listener PER
// multi-card section (card index within that one section). Three separate
// window.addEventListener('scroll', ...) registrations, each reading/writing shared DOM state
// (section.dataset.activeCard) with no ordering guarantee between them, is exactly what caused
// nav highlighting and embed visibility to visibly lag the card actually on screen by one
// scroll event - whichever listener happened to run first each tick read the PREVIOUS tick's
// value. It also meant every multi-card section kept recomputing its own "active card"
// continuously regardless of whether that section was even the visible one, which is why
// scrolling past the last real section (into the trailing .pcf-scroll-end-spacer) could leave
// an entirely different, off-screen section's card index silently mutated to something wrong
// by the time you scrolled back into it.
//
// Every scroll-driven consumer (section visibility, card visibility, nav highlighting, embed
// visibility, logo visibility) now subscribes here instead of registering its own listener, and
// every subscriber for a given scroll event receives the exact same computed state, applied
// synchronously in one pass - there is no ordering between subscribers left to get wrong.
export interface ActiveState {
    sectionId: string;
    cardIdx: number;
}

type Listener = (state: ActiveState) => void;
const listeners: Listener[] = [];

function computeActiveState(): ActiveState {
    const sections = document.querySelectorAll<HTMLElement>('section');
    let active: ActiveState = { sectionId: sections[0]?.id ?? '', cardIdx: 0 };
    const y = window.scrollY;
    sections.forEach(section => {
        if (y < section.offsetTop) return;
        // .pcf-card count works uniformly for single-card sections too (count 1, cardIdx
        // always clamps to 0) - no separate multi-vs-single-card branch needed here.
        const cardCount = Math.max(section.querySelectorAll('.pcf-card').length, 1);
        const cardH = section.offsetHeight / cardCount;
        const relScroll = y - section.offsetTop;
        const cardIdx = Math.max(0, Math.min(Math.floor(relScroll / cardH), cardCount - 1));
        // Keep overwriting as long as this section's offsetTop is at or before the current
        // scroll position - the last (i.e. furthest-down) section to satisfy that wins. Once y
        // exceeds every real section's range (inside the trailing spacer), the last real
        // section keeps winning with its cardIdx clamped to its own last card - never falls
        // back to a hardcoded default.
        active = { sectionId: section.id, cardIdx };
    });
    return active;
}

/** Register a callback - called once immediately with the current state, then again every time
 * the computed state actually changes. Registration order controls nothing observable: every
 * listener for a given scroll event receives the identical state object. */
export function onActiveStateChange(fn: Listener): void {
    listeners.push(fn);
    fn(computeActiveState());
}

let last: ActiveState | null = null;
function tick(): void {
    const state = computeActiveState();
    if (last && last.sectionId === state.sectionId && last.cardIdx === state.cardIdx) return;
    last = state;
    listeners.forEach(fn => fn(state));
}

window.addEventListener('scroll', tick, { passive: true });
