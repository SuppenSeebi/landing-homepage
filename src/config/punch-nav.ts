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

export const PARAS_BY_SECTION: Record<string, { label: string; href: string }[]> = {
    'top':       [{ label: '01 SSCHW-RECORD.', href: '#top' }],
    'aboutme':   [
        { label: 'WORK-NOW.',         href: '#aboutme' },
        { label: '05 PRG-LANGUAGES.', href: '#aboutme' },
        { label: '05 VOC-LANGUAGES.', href: '#aboutme' },
    ],
    'work':      [{ label: 'WORK-CURRENT.', href: '#work' }, { label: 'WORK-PREV.', href: '#work' }],
    'links':     [{ label: 'SERVICES-PRGRPH.', href: '#links' }, { label: 'SOCIALS-PRGRPH.', href: '#links' }],
    'impressum': [{ label: 'IMPRESSUM-PRGRPH.', href: '#impressum' }],
};
