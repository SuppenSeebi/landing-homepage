export const DIVISION_MAP: Record<string, string[]> = {
    data: ['top', 'aboutme', 'work'],
    proc: ['links', 'impressum'],
};

export const SECTIONS_BY_DIV: Record<string, { label: string; href: string }[]> = {
    data: [
        { label: 'WORKING-STORAGE.', href: '#top' },
        { label: 'LOCAL-STORAGE.',   href: '#aboutme' },
        { label: 'LINKAGE SECTION.', href: '#work' },
    ],
    proc: [
        { label: 'LINKS SECTION.',     href: '#links' },
        { label: 'IMPRESSUM-SECTION.', href: '#impressum' },
    ],
};

// cardIdx identifies which card within the section this paragraph jumps to/highlights for -
// see multiCardSection.ts (source of the active-card state) and PunchCard.astro's nav code
// (consumer, for both click-to-jump and highlighting).
export const PARAS_BY_SECTION: Record<string, { label: string; href: string; cardIdx: number }[]> = {
    'top': [
        { label: 'IDENTITY.',    href: '#top', cardIdx: 0 },
        { label: 'BACKGROUND.',  href: '#top', cardIdx: 1 },
        { label: 'CAREER-CURR.', href: '#top', cardIdx: 2 },
        { label: 'CAREER-PREV.', href: '#top', cardIdx: 3 },
        { label: 'SKILLS.',      href: '#top', cardIdx: 4 },
        { label: 'INTERESTS.',   href: '#top', cardIdx: 5 },
        { label: 'COMMUNITY.',   href: '#top', cardIdx: 6 },
    ],
    'aboutme':   [
        { label: 'WORK-NOW.',      href: '#aboutme', cardIdx: 0 },
        { label: 'WORK-BFRE.',     href: '#aboutme', cardIdx: 1 },
        { label: 'STUDIES.',       href: '#aboutme', cardIdx: 2 },
        { label: 'PRG-LANGUAGES.', href: '#aboutme', cardIdx: 3 },
        { label: 'VOC-LANGUAGES.', href: '#aboutme', cardIdx: 4 },
    ],
    'work':      [
        { label: 'WORK-CURRENT.', href: '#work', cardIdx: 0 },
        { label: 'WORK-PREV.',    href: '#work', cardIdx: 1 },
    ],
    'links':     [
        { label: 'SERVICES-PRGRPH.', href: '#links', cardIdx: 0 },
        { label: 'SOCIALS-PRGRPH.',  href: '#links', cardIdx: 1 },
    ],
    'impressum': [
        { label: 'IMPRESSUM-SECTION.', href: '#impressum', cardIdx: 0 },
    ],
};
