import Html from '@kitajs/html';
import { hrefFor, hrefText, pageFile, ROOT_DEPTH } from '../app/links/layout';
import { VersionSwitcher } from './blocks/VersionSwitcher';
import { IconMoon, IconPalette, IconSearch, IconSun } from './components/Icons';
import { relativeUrl } from './helpers';

export type PageData = {
    readonly documentationMainName: string;
    readonly depth: number;
    readonly context: string;
    readonly name: string;
    readonly filename?: string;
    readonly theme?: string;
    readonly customLogo?: string;
    readonly disableSearch?: boolean;
    readonly disableDependencies?: boolean;
    readonly disableProperties?: boolean;
    readonly hideDarkModeToggle?: boolean;
    readonly maxSearchResults?: number;
    readonly gaID?: string;
    readonly entityIndex?: Record<string, { href: string; kind: string }>;
    /** Multi-version: when true, the version switcher is rendered. */
    readonly multiVersion?: boolean;
    readonly versionLabel?: string;
    readonly maxVersionsShown?: number;
};

type LayoutProps = {
    readonly data: PageData;
    readonly content: string;
    readonly menuHtml: string;
};

const IframeTrackingScript = `
function sendCurrentUrlToParent() {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'compodoc-iframe-navigate',
            url: window.location.pathname + window.location.hash
        }, '*');
    }
}
window.addEventListener('hashchange', sendCurrentUrlToParent, false);
window.addEventListener('popstate', sendCurrentUrlToParent, false);
window.addEventListener('DOMContentLoaded', sendCurrentUrlToParent, false);
`;

/** Root-relative link to the index page; the client router adds the depth prefix. */
const INDEX_HREF = hrefText(hrefFor({ type: 'root', page: 'index' }, ROOT_DEPTH), 'bare');

const PageGlobals = (props: { data: PageData }) => {
    const { data } = props;
    const pageUrl = pageFile('', data.filename || data.name);
    return (
        <script>
            {`
                window.COMPODOC_CURRENT_PAGE_DEPTH = ${data.depth};
                window.COMPODOC_CURRENT_PAGE_CONTEXT = '${data.context}';
                window.COMPODOC_CURRENT_PAGE_URL = '${pageUrl}';
                ${!data.disableSearch ? `window.MAX_SEARCH_RESULTS = ${data.maxSearchResults ?? 15};` : ''}
            `}
        </script>
    );
};

const GoogleAnalytics = (props: { gaID: string }) => (
    <>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${props.gaID}`}></script>
        <script>
            {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${props.gaID}');
        `}
        </script>
    </>
);

const CommandPalette = () =>
    (
        <dialog id="cdx-command-palette" class="cdx-cp" aria-label="Search documentation">
            <div class="cdx-cp-panel">
                <div class="cdx-cp-header">
                    <svg
                        class="cdx-cp-icon"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        class="cdx-cp-input"
                        type="text"
                        placeholder="Search documentation..."
                        autocomplete="off"
                        spellcheck="false"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="cdx-cp-listbox"
                        aria-autocomplete="list"
                    />
                    <button class="cdx-cp-close" aria-label="Close search" type="button">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M18 6 6 18"></path>
                            <path d="m6 6 12 12"></path>
                        </svg>
                    </button>
                </div>
                <section class="cdx-cp-facets" hidden aria-label="Filter results">
                    {/* Populated by command-palette.ts when pagefind.filters()
                          returns at least two values for any dimension. */}
                </section>
                <div class="cdx-cp-body" id="cdx-cp-listbox" role="listbox">
                    <div class="cdx-cp-results"></div>
                    <div class="cdx-cp-empty" hidden aria-live="polite">
                        No results
                    </div>
                    <div class="cdx-cp-loading" hidden aria-live="polite">
                        Loading search...
                    </div>
                </div>
                <div class="cdx-cp-footer">
                    <span>
                        <kbd>Enter</kbd> to select
                    </span>
                    <span>
                        <kbd>Arrow Down</kbd> <kbd>Arrow Up</kbd> to navigate
                    </span>
                    <span>
                        <kbd>Esc</kbd> to close
                    </span>
                </div>
            </div>
        </dialog>
    ) as string;

/** Built-in themes with display name and primary swatch color */
const BUILTIN_THEMES: ReadonlyArray<{
    id: string;
    name: string;
    swatch: string;
}> = [
    { id: 'default', name: 'Default', swatch: 'hsl(0 0% 15%)' },
    { id: 'ocean', name: 'Ocean', swatch: 'hsl(200 60% 42%)' },
    { id: 'ember', name: 'Ember', swatch: 'hsl(24 90% 52%)' },
    { id: 'midnight', name: 'Midnight', swatch: 'hsl(262 68% 58%)' },
    { id: 'neon', name: 'Neon', swatch: 'hsl(180 100% 50%)' },
    { id: 'brutalist', name: 'Brutalist', swatch: 'hsl(0 0% 0%)' },
    { id: 'nord', name: 'Nord', swatch: '#5e81ac' },
    { id: 'rose-pine', name: 'Rose Pine', swatch: '#d7827e' }
];

const SidebarHeader = (props: {
    name: string;
    logo?: string;
    disableSearch?: boolean;
    r: (path: string) => string;
}): string => {
    return (
        <div class="cdx-sidebar-header">
            <div class="cdx-sidebar-header-row">
                {props.logo ? (
                    <a href={INDEX_HREF} data-type="index-link" class="cdx-sidebar-logo">
                        <img src={props.r(`images/${props.logo}`)} alt={props.name} />
                    </a>
                ) : (
                    <a href={INDEX_HREF} data-type="index-link" class="cdx-sidebar-brand">
                        {props.name}
                    </a>
                )}
            </div>
            {!props.disableSearch && (
                <button
                    type="button"
                    class="cdx-search-trigger"
                    data-cdx-search-trigger
                    aria-label="Search documentation"
                >
                    {IconSearch()}
                    <span class="cdx-search-trigger-label">Search...</span>
                    <span class="cdx-search-trigger-hint">
                        <kbd class="cdx-kbd cdx-kbd--mac">&#8984;</kbd>
                        <kbd class="cdx-kbd cdx-kbd--other">Ctrl</kbd>
                        <kbd class="cdx-kbd">K</kbd>
                    </span>
                </button>
            )}
        </div>
    ) as string;
};

/**
 * Right-aligned action strip slotted at the very top of the main content
 * area. Holds the theme picker, dark-mode toggle, and (when multi-version
 * is active) the version-switcher dropdown — exactly the controls that
 * used to live in `cdx-sidebar-actions`. The mobile topbar still carries
 * its own copies; this strip is hidden on viewports where the topbar is
 * shown so we never duplicate visible controls.
 */
const ContentActions = (props: {
    hideDarkModeToggle?: boolean;
    lockedTheme?: string;
    multiVersion?: boolean;
    versionLabel?: string;
    maxVersionsShown?: number;
    depth: number;
}): string => {
    const isDefaultTheme =
        !props.lockedTheme || props.lockedTheme === 'default' || props.lockedTheme === 'gitbook';
    const showThemePicker = isDefaultTheme;
    const activeTheme = isDefaultTheme ? 'default' : props.lockedTheme!;

    return (
        <div class="cdx-content-actions">
            {showThemePicker && (
                <div class="cdx-theme-picker" data-cdx-theme-picker>
                    <button
                        type="button"
                        class="cdx-sidebar-action"
                        aria-label="Switch theme"
                        aria-haspopup="listbox"
                        aria-expanded="false"
                    >
                        {IconPalette()}
                    </button>
                    <ul class="cdx-theme-picker-menu" aria-label="Theme" hidden>
                        {BUILTIN_THEMES.map(t => (
                            <li
                                data-cdx-theme={t.id}
                                aria-current={t.id === activeTheme ? 'true' : undefined}
                            >
                                <span
                                    class="cdx-theme-swatch"
                                    style={`--swatch: ${t.swatch}`}
                                ></span>
                                {t.name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {!props.hideDarkModeToggle && (
                <button
                    type="button"
                    class="cdx-sidebar-action cdx-dark-toggle"
                    aria-label="Toggle dark mode"
                    aria-pressed="false"
                >
                    {IconMoon('icon-moon')}
                    {IconSun('icon-sun')}
                </button>
            )}
            {props.multiVersion && props.versionLabel && (
                <VersionSwitcher
                    currentLabel={props.versionLabel}
                    depth={props.depth}
                    maxVersionsShown={props.maxVersionsShown ?? 10}
                />
            )}
        </div>
    ) as string;
};

/** Build a descriptive page title for browser tab + Pagefind indexing */
const pageTitle = (data: PageData): string => {
    const base = data.documentationMainName;
    if (!data.context || data.context === 'readme' || data.context === 'getting-started') {
        return base;
    }
    const name = data.name || data.filename || '';
    if (!name) {
        return base;
    }
    const ctx = data.context.replaceAll('-', ' ');
    return `${name} - ${ctx} - ${base}`;
};

export const Layout = (props: LayoutProps): string => {
    const { data, content, menuHtml } = props;
    const r = (path: string) => relativeUrl(data.depth, path);

    return ('<!doctype html>\n' +
    (
        <html class="no-js" lang="en">
            <head>
                <meta charset="utf-8" />
                <meta http-equiv="x-ua-compatible" content="ie=edge" />
                <title>{pageTitle(data)}</title>
                <meta name="description" content="" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" type="image/svg+xml" href={r('images/favicon.svg')} />
                <script>{`(function(){try{var d=localStorage.getItem('compodocx_darkmode-state')||localStorage.getItem('compodoc_darkmode-state');var dark=d!==null?d==='true':window.matchMedia('(prefers-color-scheme:dark)').matches;if(dark)document.documentElement.classList.add('dark');if(/Mac|iPhone|iPad/.test(navigator.platform||''))document.documentElement.classList.add('cdx-mac');if(location.hash&&location.hash!=='#')document.documentElement.classList.add('cdx-hash-pending')}catch(e){}}())`}</script>
                <style>{`
                    .menu .collapse.in { display: block !important; visibility: visible !important; }
                    .menu .collapse:not(.in) { display: none !important; }
                `}</style>
                <link rel="stylesheet" href={r('styles/compodocx.css')} />
                <link
                    id="cdx-theme-link"
                    rel="stylesheet"
                    href={
                        data.theme && !['default', 'gitbook'].includes(data.theme)
                            ? r(`styles/${data.theme}.css`)
                            : ''
                    }
                    data-base={r('')}
                />
                <script>{`(function(){try{var t=localStorage.getItem('compodocx-theme')||localStorage.getItem('compodoc-theme');if(t&&t!=='default'){var l=document.getElementById('cdx-theme-link');if(l)l.href=l.getAttribute('data-base')+'styles/'+t+'.css'}}catch(e){}}())`}</script>
            </head>
            <body>
                <script type="module" src={r('js/compodocx.js')}></script>
                <script>{IframeTrackingScript}</script>
                {data.entityIndex && (
                    <script>{`window.__CDX_ENTITIES__=${JSON.stringify(data.entityIndex)};`}</script>
                )}

                <a href="#main-content" class="cdx-skip-link">
                    Skip to main content
                </a>
                <div class="cdx-progress">
                    <div class="cdx-progress-bar"></div>
                </div>

                {/* Mobile top bar */}
                <header class="cdx-topbar">
                    <a href={r('')} class="cdx-topbar-brand">
                        {data.documentationMainName}
                    </a>
                    <div class="cdx-topbar-actions">
                        {!data.disableSearch && (
                            <button
                                type="button"
                                class="cdx-sidebar-action"
                                data-cdx-search-trigger
                                aria-label="Search documentation (Ctrl+K)"
                            >
                                {IconSearch()}
                            </button>
                        )}
                        {!data.theme || ['default', 'gitbook'].includes(data.theme) ? (
                            <div class="cdx-theme-picker" data-cdx-theme-picker>
                                <button
                                    type="button"
                                    class="cdx-sidebar-action"
                                    aria-label="Switch theme"
                                    aria-haspopup="listbox"
                                    aria-expanded="false"
                                >
                                    {IconPalette()}
                                </button>
                                <ul class="cdx-theme-picker-menu" aria-label="Theme" hidden>
                                    {BUILTIN_THEMES.map(t => (
                                        <li
                                            data-cdx-theme={t.id}
                                            aria-current={t.id === 'default' ? 'true' : undefined}
                                        >
                                            <span
                                                class="cdx-theme-swatch"
                                                style={`--swatch: ${t.swatch}`}
                                            ></span>
                                            {t.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            ''
                        )}
                        {!data.hideDarkModeToggle && (
                            <button
                                type="button"
                                class="cdx-sidebar-action cdx-dark-toggle"
                                aria-label="Toggle dark mode"
                                aria-pressed="false"
                            >
                                {IconMoon('icon-moon')}
                                {IconSun('icon-sun')}
                            </button>
                        )}
                        {data.multiVersion && data.versionLabel && (
                            <VersionSwitcher
                                currentLabel={data.versionLabel}
                                depth={data.depth}
                                maxVersionsShown={data.maxVersionsShown ?? 10}
                            />
                        )}
                        <button
                            type="button"
                            class="cdx-mobile-toggle"
                            aria-label="Open navigation"
                            aria-expanded="false"
                            data-cdx-mobile-toggle="#sidebar"
                        >
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                            >
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Sidebar backdrop (mobile) */}
                <div class="cdx-backdrop" aria-hidden="true"></div>

                {/* Sidebar */}
                <nav class="cdx-sidebar menu" id="sidebar" aria-label="Documentation">
                    <button class="cdx-sidebar-close" type="button" aria-label="Close navigation">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M18 6 6 18"></path>
                            <path d="m6 6 12 12"></path>
                        </svg>
                    </button>
                    {SidebarHeader({
                        name: data.documentationMainName,
                        logo: data.customLogo,
                        disableSearch: data.disableSearch,
                        r
                    })}
                    {menuHtml}
                </nav>

                {/* Main content */}
                <main id="main-content" class={`content ${data.context}`} tabindex="-1">
                    {ContentActions({
                        hideDarkModeToggle: data.hideDarkModeToggle,
                        lockedTheme: data.theme,
                        multiVersion: data.multiVersion,
                        versionLabel: data.versionLabel,
                        maxVersionsShown: data.maxVersionsShown,
                        depth: data.depth
                    })}
                    <div class="content-data">{content}</div>
                </main>

                {!data.disableSearch && <CommandPalette />}

                <PageGlobals data={data} />

                {data.gaID && <GoogleAnalytics gaID={data.gaID} />}
            </body>
        </html>
    )) as string;
};
