const navBoxes   = document.querySelectorAll<HTMLAnchorElement>(".nav-box");
const sections   = document.querySelectorAll<HTMLElement>("section");
const logoWrapper = document.getElementById("logo-wrapper")!;

const sectionRunners: Record<string, () => void> = {
    top:       () => (window as any).__topRun?.(),
    aboutme:   () => (window as any).__aboutMeRun?.(),
    work:      () => (window as any).__workRun?.(),
    links:     () => (window as any).__linksRun?.(),
    impressum: () => (window as any).__impressumRun?.(),
};

/* ── scroll direction ──────────────────────────── */
let lastScrollY = 0;
let scrollDir: "up" | "down" = "down";

function updateScrollDir() {
    const y = window.scrollY;
    scrollDir = y > lastScrollY ? "down" : "up";
    lastScrollY = Math.max(0, y);
}

/* ── active section ────────────────────────────── */
function getActiveSection(): string {
    const mid = window.scrollY + window.innerHeight / 2;
    let active = "top";
    sections.forEach(s => {
        if (mid >= s.offsetTop && mid < s.offsetTop + s.offsetHeight) active = s.id;
    });
    return active;
}

/* ── section transitions ───────────────────────── */
let activeSectionId: string | null = null;

function transitionTo(id: string) {
    const next    = document.querySelector<HTMLElement>(`#${id} .section-content-wrapper`);
    const current = document.querySelector<HTMLElement>(".section-content-wrapper.active");
    if (!next) return;

    next.classList.remove("exit-up", "exit-down", "enter-up", "enter-down", "active");
    next.classList.add(scrollDir === "down" ? "enter-up" : "enter-down");
    void next.offsetWidth; /* force reflow */

    if (current) {
        current.classList.remove("active");
        current.classList.add(scrollDir === "down" ? "exit-up" : "exit-down");
        setTimeout(() => current.classList.remove("exit-up", "exit-down"), 2000);
    }

    next.classList.remove("enter-up", "enter-down");
    next.classList.add("active");
}

/* ── navbar & logo ─────────────────────────────── */
function updateNav(id: string) {
    navBoxes.forEach(box => {
        box.classList.remove("active", "top");
        if (box.getAttribute("href") === `#${id}`) box.classList.add("active");
        if (box.getAttribute("href") === "#top" && id !== "top") box.classList.add("top");
    });
}

function updateLogo(id: string) {
    if (id === "top") logoWrapper.classList.add("visible");
    else              logoWrapper.classList.remove("visible");
}

/* ── main scroll handler ───────────────────────── */
function onScroll() {
    updateScrollDir();
    const id = getActiveSection();
    updateNav(id);
    updateLogo(id);

    if (id !== activeSectionId) {
        transitionTo(id);
        sectionRunners[id]?.();
        activeSectionId = id;
    }

    /* Top section runner needs to run on every scroll for scroll-driven content */
    if (id === "top") sectionRunners["top"]?.();
}

window.addEventListener("scroll", onScroll);
window.addEventListener("DOMContentLoaded", onScroll);
