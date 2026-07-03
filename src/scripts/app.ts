const sections      = document.querySelectorAll<HTMLElement>("section");
const logoWrapper   = document.getElementById("logo-wrapper")!;

const sectionRunners: Record<string, () => void> = {
    top:       () => (window as any).__topRun?.(),
    aboutme:   () => (window as any).__aboutMeRun?.(),
    work:      () => (window as any).__workRun?.(),
    links:     () => (window as any).__linksRun?.(),
    impressum: () => (window as any).__impressumRun?.(),
};

/* ── active section ────────────────────────────── */
// Uses scrollY directly (not a viewport-midpoint offset) so the section boundary lines up
// exactly with multiCardSection.ts's own scrollY-based card math - otherwise the section
// deactivates innerHeight/2 early, cutting its last card's effective scroll range short.
function getActiveSection(): string {
    const y = window.scrollY;
    let active = "top";
    sections.forEach(s => {
        if (y >= s.offsetTop && y < s.offsetTop + s.offsetHeight) active = s.id;
    });
    return active;
}

/* ── section transitions (instant snap, no animation) ──────────────────── */
let activeSectionId: string | null = null;

function transitionTo(id: string) {
    const next    = document.querySelector<HTMLElement>(`#${id} .section-content-wrapper`);
    const current = document.querySelector<HTMLElement>(".section-content-wrapper.active");
    if (!next || next === current) return;

    current?.classList.remove('active');
    next.classList.add('active');
}

/* ── logo ───────────────────────────────────────── */
function updateLogo(id: string) {
    if (id === "top") logoWrapper.classList.add("visible");
    else              logoWrapper.classList.remove("visible");
}

/* ── main scroll handler ───────────────────────── */
function onScroll() {
    const id = getActiveSection();
    updateLogo(id);

    if (id !== activeSectionId) {
        transitionTo(id);
        sectionRunners[id]?.();
        activeSectionId = id;
    }

    if (id === "top") sectionRunners["top"]?.();
}

window.addEventListener("scroll", onScroll);
window.addEventListener("DOMContentLoaded", onScroll);
