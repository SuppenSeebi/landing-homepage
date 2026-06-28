export function punchText(text: string): string {
    return text.split('').map(ch => {
        if (ch === ' ') return '<span class="pcf-fh-sp"></span>';
        const e = ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<span class="pcf-fh-ch">${e}</span>`;
    }).join('');
}
