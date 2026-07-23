// Applies scrollSync's single computed {sectionId, cardIdx} to whichever section it names -
// card count is read from the DOM each time (cards.length), not a separately-maintained
// constant. This file used to register its own per-section scroll listener (one instance per
// multi-card section, called from PunchSection.astro's setup loop); now there's exactly one
// subscription total, self-registered on import - PunchSection.astro just imports this module
// once for its side effect. See scrollSync.ts for why: every section recomputing its own active
// card continuously, regardless of whether it was even the visible section, is what let an
// off-screen section's card index drift to something wrong.
import { onActiveStateChange } from './scrollSync';

onActiveStateChange(({ sectionId, cardIdx }) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const cards = section.querySelectorAll<HTMLElement>('.pcf-card');
    if (cards.length < 2) return; // single-card sections have nothing to switch
    cards.forEach((card, i) => card.classList.toggle('pcf-card-active', i === cardIdx));
});
