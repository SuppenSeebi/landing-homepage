// Shared card-switching logic for multi-card sections (AboutMe/Work/Links). Card count is
// read from the DOM (cards.length), not a separately-maintained constant, so the switching
// math is correct for any number of cards without needing to stay in sync with anything else.
// Switching is a direct synchronous class toggle - no animation, so no lock is needed to
// survive overlapping calls.
export function setupMultiCardSection(sectionId: string): void {
    const section = document.getElementById(sectionId);
    const cards = section
        ? (Array.from(section.querySelectorAll<HTMLElement>('.pcf-card')) as HTMLElement[])
        : [];
    if (!section || !cards.length) return;

    let activeIdx = 0;
    cards[0].classList.add('pcf-card-active');
    // Read by PunchCard.astro's nav highlighting - the source of truth for "which card in
    // this section is active" lives here, on the section element, so any other script can
    // read it via a plain DOM query without needing a cross-module API.
    section.dataset.activeCard = '0';

    function switchCard(newIdx: number) {
        if (newIdx < 0 || newIdx >= cards.length || newIdx === activeIdx) return;
        cards[activeIdx].classList.remove('pcf-card-active');
        cards[newIdx].classList.add('pcf-card-active');
        activeIdx = newIdx;
        section!.dataset.activeCard = String(newIdx);
    }

    function onScroll() {
        const relScroll = window.scrollY - section!.offsetTop;
        const cardH = section!.scrollHeight / cards.length;
        const newIdx = Math.max(0, Math.min(Math.floor(relScroll / cardH), cards.length - 1));
        switchCard(newIdx);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}
