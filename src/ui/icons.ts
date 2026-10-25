// Original pixel icons. All geometry sits on the same 16 × 16 grid.
const paths: Record<string, string> = {
    ember: 'M7 0h2v3h2v3h2v5h-2v3H5v-2H3V7h2V4h2z M7 8v4h2V8z',
    heart: 'M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2z',
    boot: 'M4 1h6v8h4v2h2v4H2V9h2z',
    blade: 'M12 0h4v4h-2v2h-2v2h-2v2H8v2H6v-2H4V8h2V6h2V4h2V2h2z M0 12h4v4H0z',
    rapid: 'M0 3h3v2h3v2h2v2H6v2H3v2H0l5-5z M8 3h3v2h3v2h2v2h-2v2h-3v2H8l5-5z',
    shield: 'M2 1h12v9h-2v2h-2v2H6v-2H4v-2H2z M7 3v8h2V3z',
    split: 'M7 8h2v8H7z M2 2h4v2H4v4H2z M10 2h4v6h-2V4h-2z M4 7h2v2h2v2H6V9H4z M10 7h2v2h-2v2H8V9h2z',
    potion: 'M5 0h6v2h-1v3l3 3v6h-2v2H5v-2H3V8l3-3V2H5z M6 8v5h4V8z',
    range: 'M1 7h10V4h2v2h2v4h-2v2h-2V9H1z',
    dash: 'M8 0h6L9 6h5L4 16l3-8H2z',
    crown: 'M1 2h2v3h3V1h4v4h3V2h2v11H1z M3 14h10v2H3z',
    eye: 'M4 3h8v2h2v2h2v2h-2v2h-2v2H4v-2H2V9H0V7h2V5h2z M6 5v6h4V5z',
    skull: 'M4 1h8v2h2v8h-3v4H5v-4H2V3h2z M4 5v3h3V5z M9 5v3h3V5z',
    stairs: 'M1 2h14v2H3v2h10v2H5v2h6v2H7v2h2v2H1z',
};
export const upgradeIcons = ['heart', 'boot', 'blade', 'rapid', 'shield', 'split', 'potion', 'range', 'dash', 'ember', 'range', 'ember', 'dash', 'blade', 'heart', 'eye', 'crown', 'ember'];
export function icon(name: string, cls = '') {
    return `<svg class="pixel-icon ${cls}" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${paths[name] ?? paths.ember}"/></svg>`;
}
