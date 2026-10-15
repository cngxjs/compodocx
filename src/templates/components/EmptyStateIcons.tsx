import Html from '@kitajs/html';

/**
 * Empty state SVG icons - line-art style, thin stroke, monochrome.
 * Size controlled by parent CSS (.cdx-empty-state-icon).
 * viewBox 24x24, no fixed width/height. stroke-width 1.5, currentColor.
 */

const esSvg = (paths: string): string =>
    (
        <svg
            class="cdx-empty-state-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            {paths}
        </svg>
    ) as string;

/** Paint palette without dots - no styles */
export const EmptyIconPalette = () =>
    esSvg(
        '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.7-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5-4.5-9-10-9z" stroke-dasharray="4 2"/>'
    );

/** HTML brackets </> - no template */
export const EmptyIconHtml = () =>
    esSvg(
        '<path d="m7 8-4 4 4 4" stroke-dasharray="4 2"/>' +
            '<path d="m17 8 4 4-4 4" stroke-dasharray="4 2"/>' +
            '<line x1="14" y1="4" x2="10" y2="20" stroke-dasharray="3 2"/>'
    );

/** Tree nodes disconnected - no DOM tree */
export const EmptyIconTree = () =>
    esSvg(
        '<circle cx="12" cy="4" r="2" stroke-dasharray="3 2"/>' +
            '<circle cx="6" cy="14" r="2" stroke-dasharray="3 2"/>' +
            '<circle cx="18" cy="14" r="2" stroke-dasharray="3 2"/>' +
            '<path d="M12 6v2" stroke-dasharray="2 2"/>' +
            '<path d="M10 10 7 12" stroke-dasharray="2 2"/>' +
            '<path d="M14 10l3 2" stroke-dasharray="2 2"/>'
    );

/** File with no content - no source */
export const EmptyIconFile = () =>
    esSvg(
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke-dasharray="4 2"/>' +
            '<path d="M14 2v6h6"/>'
    );

/** Document with magnifying glass - bare entity page */
export const EmptyIconDocument = () =>
    esSvg(
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>' +
            '<path d="M14 2v6h6"/>' +
            '<circle cx="11" cy="15" r="3" stroke-dasharray="3 2"/>' +
            '<path d="m13.5 17.5 2 2"/>'
    );

/** Empty pie chart - coverage 0% */
export const EmptyIconChart = () =>
    esSvg('<circle cx="12" cy="12" r="10" stroke-dasharray="4 2"/>' + '<path d="M12 2v10l8.5 5"/>');

/** Dashboard grid with dashed cells - overview no data */
export const EmptyIconDashboard = () =>
    esSvg(
        '<rect x="3" y="3" width="8" height="8" rx="1" stroke-dasharray="4 2"/>' +
            '<rect x="13" y="3" width="8" height="8" rx="1" stroke-dasharray="4 2"/>' +
            '<rect x="3" y="13" width="8" height="8" rx="1" stroke-dasharray="4 2"/>' +
            '<rect x="13" y="13" width="8" height="8" rx="1" stroke-dasharray="4 2"/>'
    );

/** Lightning bolt dashed - no examples */
export const EmptyIconBolt = () =>
    esSvg('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke-dasharray="4 2"/>');

/** Open book with blank pages - no README */
export const EmptyIconBook = () =>
    esSvg(
        '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke-dasharray="4 2"/>' +
            '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke-dasharray="4 2"/>'
    );
