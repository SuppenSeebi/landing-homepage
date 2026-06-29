const navBoxes      = document.querySelectorAll<HTMLAnchorElement>(".nav-box");
const navDivData    = document.getElementById("nav-div-data");
const navDivProc    = document.getElementById("nav-div-proc");
const navDivProto   = document.getElementById("nav-div-proto");
const sections      = document.querySelectorAll<HTMLElement>("section");
const logoWrapper   = document.getElementById("logo-wrapper")!;

const sectionRunners: Record<string, () => void> = {
    top:       () => (window as any).__topRun?.(),
    aboutme:   () => (window as any).__aboutMeRun?.(),
    work:      () => (window as any).__workRun?.(),
    links:     () => (window as any).__linksRun?.(),
    impressum: () => (window as any).__impressumRun?.(),
};

const DATA_DIV_SECTIONS  = new Set(["top", "aboutme", "work"]);
const PROTO_DIV_SECTIONS = new Set(["demo-full", "demo-texture"]);

// Division membership for directional slide: same division → horizontal, cross → vertical
const DIVISION_OF: Record<string, string> = {
    top: 'data', aboutme: 'data', work: 'data', links: 'proc', impressum: 'proc',
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

    const fromId = activeSectionId ?? '';
    const sameDivision = !!fromId && DIVISION_OF[fromId] === DIVISION_OF[id];

    let enterClass: string;
    let exitClass: string;

    if (sameDivision) {
        // Within same DIVISION: horizontal slide
        enterClass = scrollDir === 'down' ? 'enter-right' : 'enter-left';
        exitClass  = scrollDir === 'down' ? 'exit-left'   : 'exit-right';
    } else {
        // Crossing DIVISION boundary: vertical slide
        enterClass = scrollDir === 'down' ? 'enter-up'   : 'enter-down';
        exitClass  = scrollDir === 'down' ? 'exit-up'    : 'exit-down';
    }

    next.classList.remove('exit-up','exit-down','exit-left','exit-right','enter-up','enter-down','enter-left','enter-right','active');
    next.classList.add(enterClass);
    void next.offsetWidth;

    if (current) {
        current.classList.remove('active');
        current.classList.add(exitClass);
        setTimeout(() => current.classList.remove('exit-up','exit-down','exit-left','exit-right'), 2000);
    }

    next.classList.remove(enterClass);
    next.classList.add('active');
}

/* ── navbar, logo, control paragraph ──────────── */
function updateNav(id: string) {
    navBoxes.forEach(box => {
        box.classList.remove("active", "top");
        if (box.getAttribute("href") === `#${id}`) box.classList.add("active");
        if (box.getAttribute("href") === "#top" && id !== "top") box.classList.add("top");
    });

    const inData  = DATA_DIV_SECTIONS.has(id);
    const inProto = PROTO_DIV_SECTIONS.has(id);
    navDivData?.classList.toggle("active-division",  inData);
    navDivProc?.classList.toggle("active-division",  !inData && !inProto);
    navDivProto?.classList.toggle("active-division", inProto);
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

    if (id === "top") sectionRunners["top"]?.();
}

window.addEventListener("scroll", onScroll);
window.addEventListener("DOMContentLoaded", onScroll);
