const navBoxes      = document.querySelectorAll<HTMLAnchorElement>(".nav-box");
const navDivData    = document.getElementById("nav-div-data");
const navDivProc    = document.getElementById("nav-div-proc");
const sections      = document.querySelectorAll<HTMLElement>("section");
const logoWrapper   = document.getElementById("logo-wrapper")!;
const controlPrgrph    = document.getElementById("control-prgrph");
const fileSectionEl    = document.getElementById("file-section-indicator");

const sectionRunners: Record<string, () => void> = {
    top:       () => (window as any).__topRun?.(),
    aboutme:   () => (window as any).__aboutMeRun?.(),
    work:      () => (window as any).__workRun?.(),
    links:     () => (window as any).__linksRun?.(),
    impressum: () => (window as any).__impressumRun?.(),
};

const DATA_DIV_SECTIONS = new Set(["top", "aboutme", "work"]);

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
    void next.offsetWidth;

    if (current) {
        current.classList.remove("active");
        current.classList.add(scrollDir === "down" ? "exit-up" : "exit-down");
        setTimeout(() => current.classList.remove("exit-up", "exit-down"), 2000);
    }

    next.classList.remove("enter-up", "enter-down");
    next.classList.add("active");
}

/* ── navbar, logo, control paragraph ──────────── */
function updateNav(id: string) {
    navBoxes.forEach(box => {
        box.classList.remove("active", "top");
        if (box.getAttribute("href") === `#${id}`) box.classList.add("active");
        if (box.getAttribute("href") === "#top" && id !== "top") box.classList.add("top");
    });

    const inData = DATA_DIV_SECTIONS.has(id);
    navDivData?.classList.toggle("active-division", inData);
    navDivProc?.classList.toggle("active-division", !inData);
}

function updateLogo(id: string) {
    if (id === "top") logoWrapper.classList.add("visible");
    else              logoWrapper.classList.remove("visible");
}

function updateControlPrgrph(id: string) {
    const show = id === "links" || id === "impressum";
    controlPrgrph?.classList.toggle("visible", show);
    fileSectionEl?.classList.toggle("visible", id === "aboutme" || id === "work");
}

/* ── main scroll handler ───────────────────────── */
function onScroll() {
    updateScrollDir();
    const id = getActiveSection();
    updateNav(id);
    updateLogo(id);
    updateControlPrgrph(id);

    if (id !== activeSectionId) {
        transitionTo(id);
        sectionRunners[id]?.();
        activeSectionId = id;
    }

    if (id === "top") sectionRunners["top"]?.();
}

window.addEventListener("scroll", onScroll);
window.addEventListener("DOMContentLoaded", onScroll);
