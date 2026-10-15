import Html from '@kitajs/html';

/**
 * Lucide-based inline SVG icons.
 * 16x16, stroke-width 1.5, currentColor. All decorative: aria-hidden="true".
 * Replaces Ionicons icon font.
 */

const svg = (paths: string, cls?: string): string =>
    (
        <svg
            class={cls ? `cdx-icon ${cls}` : 'cdx-icon'}
            width="16"
            height="16"
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

// --- Navigation / UI ---
export const IconHome = () =>
    svg(
        '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
    );
const IconChevronDown = (cls?: string) => svg('<path d="m6 9 6 6 6-6"/>', cls);
const IconChevronUp = (cls?: string) => svg('<path d="m18 15-6-6-6 6"/>', cls);
export const IconChevronRight = (cls?: string) => svg('<path d="m9 18 6-6-6-6"/>', cls);
const IconLink = () =>
    svg(
        '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
    );
export const IconExternalLink = () =>
    svg(
        '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
    );
export const IconGithub = () =>
    svg(
        '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>'
    );
export const IconFigma = () =>
    svg(
        '<path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"/><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"/><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"/>'
    );
export const IconStorybook = () =>
    svg(
        '<path d="M4 2h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M9 7c0-1 1-2 3-2s3 1 3 2"/><path d="M9 12c.5-.5 1.5-1 3-1s2.5.5 3 1"/>'
    );
export const IconSearch = () => svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>');
export const IconSun = (cls?: string) =>
    svg(
        '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        cls
    );
export const IconMoon = (cls?: string) =>
    svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', cls);
export const IconPalette = (cls?: string) =>
    svg(
        '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z"/>',
        cls
    );
export const IconX = () => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

// --- Entity type icons (sidebar) ---
export const IconComponent = () =>
    svg(
        '<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z"/><path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"/><path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z"/><path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z"/>'
    ); // connected diamonds
export const IconDirective = () =>
    svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'); // code
export const IconPipe = () => svg('<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>'); // filter/funnel lines
export const IconModule = () =>
    svg(
        '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'
    ); // layers
export const IconClass = () =>
    svg(
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>'
    ); // file-code
export const IconInjectable = () =>
    svg(
        '<path d="m18 2 4 4-4 4"/><path d="m6 22-4-4 4-4"/><path d="M22 6H10a4 4 0 0 0-4 4v4"/><path d="M2 18h12a4 4 0 0 0 4-4v-4"/>'
    ); // plug/inject
export const IconToken = () =>
    svg(
        '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'
    ); // key — DI-key idiom
export const IconInterceptor = () =>
    svg(
        '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>'
    ); // arrow-left-right
export const IconGuard = () =>
    svg(
        '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
    ); // lock
export const IconInterface = () =>
    svg(
        '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>'
    ); // braces { }
export const IconEntity = () =>
    svg(
        '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'
    ); // grid/apps

// --- File icon (14x14 for hero file path) ---
export const IconFile = () =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';

// --- Language-specific file icons (14x14 for source-viewer tab header) ---
// TypeScript / JavaScript — file outline + angle-brackets glyph inside.
export const IconFileTs = () =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 13 2 2-2 2"/></svg>';

// HTML / template — file outline + explicit `<>` glyph.
export const IconFileHtml = () =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 14-2 2 2 2"/><path d="m15 14 2 2-2 2"/></svg>';

// SCSS / CSS — file outline + hash glyph (CSS selector hint).
export const IconFileCss = () =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><line x1="9" y1="13" x2="9" y2="19"/><line x1="14" y1="13" x2="14" y2="19"/><line x1="7" y1="15" x2="16" y2="15"/><line x1="7" y1="17" x2="16" y2="17"/></svg>';

// Copy icon for the source-viewer toolbar (right side of the tab header).
export const IconCopy = () =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

// --- Section icons ---
export const IconBook = () =>
    svg(
        '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>'
    );
export const IconSettings = () =>
    svg(
        '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
    );
export const IconCube = () =>
    svg('<path d="m21 16-9 5-9-5V8l9-5 9 5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v9"/>'); // box/cube
export const IconFolder = () =>
    svg(
        '<path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 9.93 3z"/>'
    ); // feature folder chapter header
export const IconGitBranch = () =>
    svg(
        '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'
    );
export const IconBarChart = () =>
    svg(
        '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>'
    ); // stats
export const IconPodium = () =>
    svg('<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>'); // podium/bar-chart-3
export const IconList = () =>
    svg(
        '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'
    );
export const IconGrid = () =>
    svg(
        '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'
    );

// --- Actions ---
const IconMaximize = () =>
    svg(
        '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'
    );
export const IconArrowLeft = () => svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>');
export const IconArrowRight = () => svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');

// --- App config provider icons ---
const IconCloud = () => svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>');
const IconFilm = () =>
    svg(
        '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>'
    );
export const IconZap = () =>
    svg(
        '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'
    );
const IconArchive = () =>
    svg(
        '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'
    );

// --- Miscellaneous kind icons ---
export const IconFunction = () =>
    svg(
        '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>'
    ); // link/chain — standalone function
export const IconVariable = () =>
    svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M8 8h8"/>');
// box with lines — variable/constant
export const IconTypealias = () =>
    svg(
        '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>'
    );
// T-shape — type alias
export const IconEnum = () =>
    svg(
        '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>'
    );
// hash # — enumeration (named constants)
export const IconProject = () =>
    svg(
        '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7-7H4a2 2 0 0 0-2 2z"/><path d="M14 2v7h7"/><path d="M12 18v-6"/><path d="M8 18v-1"/><path d="M16 18v-3"/>'
    );
// file-bar-chart — project dashboard overview

/**
 * Map legacy Ionicon class names to Lucide icon functions.
 * Used during migration; call iconFor('ion-ios-home') to get the SVG string.
 */
const ICON_MAP: Record<string, () => string> = {
    'ion-ios-home': IconHome,
    'ion-ios-keypad': IconGrid,
    'ion-ios-paper': IconClass,
    'ion-ios-list': IconList,
    'ion-ios-apps': IconEntity,
    'ion-ios-settings': IconSettings,
    'ion-ios-book': IconBook,
    'ion-ios-archive': IconModule,
    'ion-ios-cube': IconCube,
    'ion-ios-git-branch': IconGitBranch,
    'ion-ios-stats': IconBarChart,
    'ion-ios-podium': IconPodium,
    'ion-ios-swap': IconInterceptor,
    'ion-ios-lock': IconGuard,
    'ion-ios-link': IconLink,
    'ion-ios-arrow-down': () => IconChevronDown(),
    'ion-ios-arrow-up': () => IconChevronUp(),
    'ion-ios-arrow-back': IconArrowLeft,
    'ion-ios-arrow-forward': IconArrowRight,
    'ion-ios-information-circle-outline': IconInterface,
    'ion-ios-resize': IconMaximize,
    'ion-ios-cloud': IconCloud,
    'ion-ios-film': IconFilm,
    'ion-ios-flash': IconZap,
    'ion-ios-filing': IconArchive,
    'ion-ios-open': IconExternalLink,
    'ion-md-cog': IconComponent,
    'ion-md-code-working': IconDirective,
    'ion-md-arrow-round-down': IconInjectable,
    'ion-md-add': IconPipe,
    'ion-md-close': IconX,
    'ion-md-information-circle-outline': IconInterface,
    'ion-md-swap': IconInterceptor
};

export const iconFor = (ionClass: string): string => ICON_MAP[ionClass]?.() ?? '';
