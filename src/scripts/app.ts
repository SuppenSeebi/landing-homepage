import { onActiveStateChange } from './scrollSync';

const logoWrapper = document.getElementById('logo-wrapper')!;

/* ── section transitions (instant snap, no animation) ──────────────────── */
function transitionTo(id: string) {
    const next    = document.querySelector<HTMLElement>(`#${id} .section-content-wrapper`);
    const current = document.querySelector<HTMLElement>('.section-content-wrapper.active');
    if (!next || next === current) return;

    current?.classList.remove('active');
    next.classList.add('active');
}

/* ── logo ───────────────────────────────────────── */
// "top" is a deliberate, specific reference to the identity/home section, not a positional
// "first section" fact - unlike a first-of-division link, there's no divisionMap-style array to
// derive "the section the logo should show on" from, so this one hardcoded id is intentional.
function updateLogo(id: string) {
    logoWrapper.classList.toggle('visible', id === 'top');
}

onActiveStateChange(({ sectionId }) => {
    transitionTo(sectionId);
    updateLogo(sectionId);
});
