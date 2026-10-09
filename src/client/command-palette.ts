/**
 * Command palette (Cmd+K / Ctrl+K).
 * Pagefind-powered search with entity type badges and keyboard navigation.
 */

import { hrefFor, hrefText } from '../app/links/layout';

const DIALOG_ID = 'cdx-command-palette';
const INPUT_SELECTOR = '.cdx-cp-input';
const LIST_SELECTOR = '.cdx-cp-results';
const EMPTY_SELECTOR = '.cdx-cp-empty';
const LOADING_SELECTOR = '.cdx-cp-loading';
const THROTTLE_MS = 150;

/** Entity type extracted from Pagefind page titles (e.g. "component - MyComponent") */
const ENTITY_TYPES = [
    'component',
    'directive',
    'service',
    'injectable',
    'token',
    'pipe',
    'class',
    'interface',
    'guard',
    'interceptor',
    'enum',
    'function',
    'typealias',
    'variable',
    'provider'
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];

/** Map entity types to `cdx-badge--entity-<kind>` CSS class suffixes — kept
 *  in sync with the rules in `src/styles/components/badges.css`. Returns
 *  `'other'` only for non-entity pages (README, CHANGELOG, ...) so they fall
 *  through to the muted "Docs" pill. */
const entityClass = (type: EntityType | 'other'): string => {
    switch (type) {
        case 'provider':
            // Providers and feature functions are functions; share their chip.
            return 'function';
        case 'service':
        case 'injectable':
            // Badge class is `cdx-badge--entity-injectable`, which itself
            // uses `--color-cdx-entity-service` for the fill. Both kinds of
            // search-result point at the same chip.
            return 'injectable';
        case 'component':
        case 'directive':
        case 'pipe':
        case 'token':
        case 'class':
        case 'interface':
        case 'guard':
        case 'interceptor':
        case 'function':
        case 'variable':
        case 'typealias':
        case 'enum':
            return type;
        default:
            return 'other';
    }
};

/** Parse entity type from Pagefind result title.
 *  Titles follow pattern: "EntityName - context - ProjectName" (from Layout.tsx pageTitle()).
 *  Also handles legacy "type - EntityName" format. */
const parseEntityType = (title: string): { type: EntityType | 'other'; name: string } => {
    // Try new format: "EntityName - context - ProjectName"
    const parts = title.split(' - ');
    if (parts.length >= 3) {
        const name = parts[0].trim();
        const context = parts[1].trim().toLowerCase();
        for (const t of ENTITY_TYPES) {
            if (context === t || context === `${t}s` || context.includes(t)) {
                return { type: t, name };
            }
        }
        // Context didn't match a known entity type (e.g. "coverage", "routes")
        return { type: 'other', name };
    }
    // Try legacy format: "type - EntityName"
    const lower = title.toLowerCase();
    for (const t of ENTITY_TYPES) {
        if (lower.startsWith(`${t} - `) || lower.startsWith(`${t}s - `)) {
            const name = title.substring(title.indexOf(' - ') + 3);
            return { type: t, name };
        }
    }
    return { type: 'other', name: title };
};

/** Map the user-facing `data-pagefind-meta-kind` label emitted by entity
 *  heroes back into the internal `EntityType` discriminator used for
 *  result-chip colours and icons. Returns `'other'` for unknown labels so
 *  the existing "Docs" fallback applies. */
const KIND_LABEL_TO_TYPE: Record<string, EntityType> = {
    Component: 'component',
    Directive: 'directive',
    Pipe: 'pipe',
    Injectable: 'injectable',
    Token: 'token',
    Class: 'class',
    Interface: 'interface',
    Guard: 'guard',
    Interceptor: 'interceptor',
    Enumeration: 'enum',
    Function: 'function',
    Variable: 'variable',
    'Type Alias': 'typealias',
    Entity: 'class',
    // A feature type page with its providers and feature functions.
    Cluster: 'provider'
};

/** Capitalize first letter */
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Type label for display -- shows entity type like angular.dev */
const typeLabel = (type: EntityType | 'other'): string => {
    if (type === 'other') {
        return 'Docs';
    }
    return cap(type === 'typealias' ? 'Type Alias' : type);
};

/** SVG icon per entity type (matches sidebar Icons.tsx) */
const icon = (paths: string): string =>
    `<svg class="cdx-cp-result-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const RESULT_ICONS: Record<string, string> = {
    component: icon(
        '<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z"/><path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"/><path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z"/><path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z"/>'
    ),
    directive: icon('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    pipe: icon('<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>'),
    class: icon(
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>'
    ),
    injectable: icon(
        '<path d="m18 2 4 4-4 4"/><path d="m6 22-4-4 4-4"/><path d="M22 6H10a4 4 0 0 0-4 4v4"/><path d="M2 18h12a4 4 0 0 0 4-4v-4"/>'
    ),
    service: icon(
        '<path d="m18 2 4 4-4 4"/><path d="m6 22-4-4 4-4"/><path d="M22 6H10a4 4 0 0 0-4 4v4"/><path d="M2 18h12a4 4 0 0 0 4-4v-4"/>'
    ),
    token: icon(
        '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'
    ),
    interface: icon(
        '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>'
    ),
    guard: icon(
        '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
    ),
    interceptor: icon(
        '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>'
    ),
    enum: icon(
        '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'
    ),
    function: icon(
        '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2H12"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>'
    ),
    variable: icon(
        '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>'
    ),
    typealias: icon('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>')
};

const resultIcon = (type: EntityType | 'other'): string =>
    RESULT_ICONS[type] ??
    icon(
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
    );

/** Highlight matched query terms in text */
const highlightMatch = (text: string, query: string): string => {
    if (!query.trim()) {
        return escapeHtml(text);
    }
    const escaped = escapeHtml(text);
    const terms = query
        .trim()
        .split(/\s+/)
        .filter(t => t.length > 1);
    if (terms.length === 0) {
        return escaped;
    }

    const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(`(${pattern})`, 'gi');
    return escaped.replace(re, '<mark class="cdx-cp-highlight">$1</mark>');
};

/**
 * One palette row per provider or feature section of a feature type page:
 * Pagefind returns a sub-result per heading with an id, and member
 * headings carry `<featureType>--<member>` ids.
 */
const MEMBER_ANCHOR = /#[^#]+?--([^#]+)$/;

const clusterMembers = (d: any): SearchResult[] =>
    (Array.isArray(d.sub_results) ? d.sub_results : [])
        .filter((sub: any) => typeof sub?.url === 'string' && MEMBER_ANCHOR.test(sub.url))
        .map((sub: any) => ({
            title: String(sub.title ?? ''),
            url: sub.url,
            type: 'provider' as const,
            // The heading text runs the name into its badges and permalink; the anchor holds it alone.
            name: decodeURIComponent(MEMBER_ANCHOR.exec(sub.url)?.[1] ?? ''),
            excerpt: typeof sub.excerpt === 'string' ? sub.excerpt : undefined
        }));

interface SearchResult {
    readonly title: string;
    readonly url: string;
    readonly type: EntityType | 'other';
    readonly name: string;
    readonly category?: string;
    /** First-sentence fallback from `data-pagefind-meta="description"`. */
    readonly description?: string;
    /** Pagefind's match-context snippet (HTML pre-marked with `<mark>` tags). */
    readonly excerpt?: string;
}

/** Facet dimensions surfaced in the dropdown. `tier` distinguishes
 *  Features (primary) from References (reference) so users can narrow to
 *  curated entry points. Order matches the visual layout. */
const FACET_DIMS = ['kind', 'lib', 'tier', 'wcag'] as const;
type FacetDim = (typeof FACET_DIMS)[number];

const FACET_LABELS: Record<FacetDim, string> = {
    kind: 'Kind',
    lib: 'Library',
    tier: 'Tier',
    wcag: 'WCAG'
};

const FACET_VALUE_LABELS: Record<FacetDim, Record<string, string>> = {
    kind: {},
    lib: {},
    tier: { primary: 'Primary', reference: 'Reference' },
    wcag: {}
};

/** Active filter state — per dimension, multi-select within (OR), AND
 *  across dimensions. Mirrors Pagefind's filter API. */
const activeFilters: Record<FacetDim, Set<string>> = {
    kind: new Set(),
    lib: new Set(),
    tier: new Set(),
    wcag: new Set()
};

let pagefind: any = null;
let activeIndex = -1;
let lastQuery = '';
let throttleTimer: ReturnType<typeof setTimeout> | undefined;
/** Index-wide filter counts cached from `pagefind.filters()` at warmup
 *  time. Drives the empty-palette state: when the user opens the
 *  dialog with no query and no active filters, the facet rail shows
 *  these global counts so they can scope by clicking a chip without
 *  ever typing. `null` until Pagefind initialises (or stays `null` for
 *  indexes without filters / `file://` mode). */
let globalFilterCounts: Record<string, Record<string, number>> | null = null;

const getDialog = (): HTMLDialogElement | null =>
    document.getElementById(DIALOG_ID) as HTMLDialogElement | null;

const getInput = (): HTMLInputElement | null => getDialog()?.querySelector(INPUT_SELECTOR) ?? null;

const getList = (): HTMLElement | null => getDialog()?.querySelector(LIST_SELECTOR) ?? null;

const getEmpty = (): HTMLElement | null => getDialog()?.querySelector(EMPTY_SELECTOR) ?? null;

const getLoading = (): HTMLElement | null => getDialog()?.querySelector(LOADING_SELECTOR) ?? null;

const getFacets = (): HTMLElement | null => getDialog()?.querySelector('.cdx-cp-facets') ?? null;

/** Pagefind expects `filters: { kind: 'Component' | ['Component', 'Pipe'] }` —
 *  single string when one value is selected in a dimension, array otherwise.
 *  Empty dimensions are omitted entirely so they don't constrain the query. */
const buildFiltersObj = (): Record<string, string | string[]> | undefined => {
    const out: Record<string, string | string[]> = {};
    let any = false;
    for (const dim of FACET_DIMS) {
        const values = Array.from(activeFilters[dim]);
        if (values.length === 1) {
            out[dim] = values[0];
            any = true;
        } else if (values.length > 1) {
            out[dim] = values;
            any = true;
        }
    }
    return any ? out : undefined;
};

/** Serialize active filters + query into `?q=&kind=&lib=&tier=&wcag=`. Each
 *  multi-value dimension uses comma-separated values (URL-encoded). Empty
 *  dimensions omitted so the URL stays short. */
const updateUrlFromState = () => {
    const params = new URLSearchParams();
    if (lastQuery) {
        params.set('q', lastQuery);
    }
    for (const dim of FACET_DIMS) {
        const values = Array.from(activeFilters[dim]);
        if (values.length > 0) {
            params.set(dim, values.join(','));
        }
    }
    const query = params.toString();
    const url = `${globalThis.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    history.replaceState(history.state, '', url);
};

/** Hydrate active filters + initial query from the current URL — called on
 *  every `openCommandPalette()` so a user navigating into a deep-linked
 *  search URL sees the same state. */
const hydrateStateFromUrl = (): string => {
    const params = new URLSearchParams(globalThis.location.search);
    for (const dim of FACET_DIMS) {
        activeFilters[dim].clear();
        const raw = params.get(dim);
        if (raw) {
            for (const value of raw
                .split(',')
                .map(v => v.trim())
                .filter(Boolean)) {
                activeFilters[dim].add(value);
            }
        }
    }
    return params.get('q') ?? '';
};

/** Render the facet rail. Dimensions with 0 or 1 distinct value are
 *  hidden — there's nothing to choose. Active chips stay visible even
 *  when their count drops to 0 (so users can unselect from an empty
 *  intersection). Non-active 0-count chips are filtered out so a
 *  narrow query doesn't drown the dropdown in dead values; remaining
 *  chips are sorted by count descending so the most populated lands
 *  closest to the dimension label. */
const renderFacets = (counts: Record<string, Record<string, number>>) => {
    const root = getFacets();
    if (!root) {
        return;
    }
    const groups: string[] = [];
    for (const dim of FACET_DIMS) {
        const dimCounts = counts[dim] ?? {};
        const active = activeFilters[dim];
        const values = new Set<string>([...Object.keys(dimCounts), ...active]);
        if (values.size <= 1 && active.size === 0) {
            continue;
        }
        const visible = [...values]
            .filter(value => (dimCounts[value] ?? 0) > 0 || active.has(value))
            .sort((a, b) => (dimCounts[b] ?? 0) - (dimCounts[a] ?? 0) || a.localeCompare(b));
        if (visible.length === 0) {
            continue;
        }
        const chips: string[] = [];
        for (const value of visible) {
            const count = dimCounts[value] ?? 0;
            const isActive = active.has(value);
            const label = FACET_VALUE_LABELS[dim][value] ?? value;
            chips.push(
                `<button type="button" class="cdx-cp-facet-chip" data-dim="${escapeAttr(dim)}" data-value="${escapeAttr(value)}" data-active="${isActive}" aria-pressed="${isActive}">${escapeHtml(label)} <span class="cdx-cp-facet-count">${count}</span></button>`
            );
        }
        groups.push(
            `<div class="cdx-cp-facet-group"><span class="cdx-cp-facet-label">${escapeHtml(FACET_LABELS[dim])}</span>${chips.join('')}</div>`
        );
    }
    const anyActive = FACET_DIMS.some(d => activeFilters[d].size > 0);
    if (groups.length === 0) {
        root.hidden = true;
        root.innerHTML = '';
        return;
    }
    root.hidden = false;
    root.innerHTML =
        groups.join('') +
        (anyActive
            ? `<button type="button" class="cdx-cp-facet-reset">Reset filters</button>`
            : '');
};

/** Load Pagefind lazily */
const loadPagefind = async (): Promise<any> => {
    if (pagefind) {
        return pagefind;
    }
    if (window.location.protocol === 'file:') {
        return null;
    }

    // Build absolute URL to pagefind based on page location (not module location)
    const depth = (window as any).COMPODOC_CURRENT_PAGE_DEPTH ?? 0;
    const pagefindHref = hrefFor({ type: 'asset', path: 'pagefind/pagefind.js' }, depth);
    const pagefindUrl = new URL(hrefText(pagefindHref, 'bare'), window.location.href).href;

    const loading = getLoading();
    if (loading) {
        loading.hidden = false;
    }

    try {
        pagefind = await import(/* @vite-ignore */ pagefindUrl);
        await pagefind.init();
        // Pagefind 1.x lazy-loads its filter index — the first `search()`
        // call after `init()` returns `filters: {}` until something
        // touches `filters()`. Warm it up here so the facet rail
        // populates on the very first query instead of staying empty
        // until the user types a second character. Cache the
        // index-wide result for the empty-palette state — no query, no
        // active filter → render these global counts so the rail
        // doubles as a "browse the API" affordance.
        try {
            globalFilterCounts = (await pagefind.filters()) as Record<
                string,
                Record<string, number>
            >;
        } catch {
            // Indexes built without any filters throw here — silently
            // ignore so search still works in that case.
            globalFilterCounts = null;
        }
        if (loading) {
            loading.hidden = true;
        }
        return pagefind;
    } catch (e) {
        console.warn('Search unavailable:', (e as Error).message);
        if (loading) {
            loading.hidden = true;
        }
        return null;
    }
};

/** Perform search and render results */
const search = async (query: string) => {
    const list = getList();
    const empty = getEmpty();
    if (!list || !empty) {
        return;
    }

    const hasFilters = FACET_DIMS.some(d => activeFilters[d].size > 0);

    if (!query.trim() && !hasFilters) {
        list.innerHTML = '';
        empty.hidden = false;
        empty.textContent = 'Start typing to see results';
        // Surface the global filter counts so an empty palette is a
        // valid "browse the API" entry point — clicking Interface
        // narrows to all interfaces without ever typing. Falls back to
        // a hidden rail when no global counts are available (Pagefind
        // still loading, `file://` mode, or an index built without
        // filters).
        if (globalFilterCounts) {
            renderFacets(globalFilterCounts);
        } else {
            const facetsRoot = getFacets();
            if (facetsRoot) {
                facetsRoot.hidden = true;
                facetsRoot.innerHTML = '';
            }
        }
        activeIndex = -1;
        updateUrlFromState();
        return;
    }

    const pf = await loadPagefind();
    if (!pf) {
        empty.hidden = false;
        empty.textContent = 'Search unavailable (requires HTTP server)';
        return;
    }

    const maxResults = (window as any).MAX_SEARCH_RESULTS ?? 15;
    const filtersObj = buildFiltersObj();
    // Pagefind 1.0+ accepts `{ filters }` as the second argument; passing
    // `undefined` is the same as omitting the option, so the unfiltered
    // path stays cache-friendly.
    const searchOptions = filtersObj ? { filters: filtersObj } : undefined;
    // Empty query + active filters → Pagefind supports `null` for the
    // query in filter-only mode; falls back to listing all matching pages.
    const queryArg = query.trim() ? query : null;
    const results = await pf.search(queryArg, searchOptions);
    renderFacets((results?.filters ?? {}) as Record<string, Record<string, number>>);
    const sliced = (results?.results ?? []).slice(0, maxResults);
    const data = await Promise.all(sliced.map((r: any) => r.data()));

    const mapped: SearchResult[] = data.flatMap((d: any) => {
        const meta = d.meta || {};
        const parsed = parseEntityType(meta.title || '');
        // Prefer the explicit `data-pagefind-meta="kind:..."` value emitted by
        // entity heroes (v0.6.0+) — robust against title-format drift. Fall
        // back to title parsing for pages that predate the meta block
        // (custom templates, README/CHANGELOG without a kind, etc.).
        const metaType = typeof meta.kind === 'string' ? KIND_LABEL_TO_TYPE[meta.kind] : undefined;
        const page: SearchResult = {
            title: meta.title || '',
            url: d.url,
            type: metaType ?? parsed.type,
            name: parsed.name,
            category: typeof meta.category === 'string' ? meta.category : undefined,
            description: typeof meta.description === 'string' ? meta.description : undefined,
            excerpt: typeof d.excerpt === 'string' ? d.excerpt : undefined
        };
        return meta.kind === 'Cluster' ? [page, ...clusterMembers(d)] : [page];
    });

    if (mapped.length === 0) {
        list.innerHTML = '';
        empty.hidden = false;
        empty.textContent = `No results for "${query}"`;
        activeIndex = -1;
        return;
    }

    empty.hidden = true;
    const searchQuery = lastQuery;
    list.innerHTML = mapped
        .map((r, i) => {
            const meta: string[] = [];
            if (r.category) {
                meta.push(`<span class="cdx-cp-category">${escapeHtml(r.category)}</span>`);
            }
            // Prefer Pagefind's match-context snippet (already HTML with
            // `<mark>` highlights around hit terms) — that's the whole point
            // of the search result. Fall back to the cleaned first-sentence
            // description meta when no excerpt is available (Pagefind has no
            // context, e.g. score-driven hits on the title alone).
            if (r.excerpt) {
                meta.push(`<span class="cdx-cp-desc">${r.excerpt}</span>`);
            } else if (r.description) {
                meta.push(
                    `<span class="cdx-cp-desc">${highlightMatch(r.description, searchQuery)}</span>`
                );
            }
            const metaBlock =
                meta.length > 0 ? `<div class="cdx-cp-meta">${meta.join('')}</div>` : '';
            return (
                `<a href="${escapeAttr(r.url)}" class="cdx-cp-item${i === 0 ? ' cdx-cp-active' : ''}" role="option" aria-selected="${i === 0}" data-index="${i}" style="--i:${i}">` +
                resultIcon(r.type) +
                '<div class="cdx-cp-body">' +
                `<span class="cdx-cp-name">${highlightMatch(r.name, searchQuery)}</span>` +
                metaBlock +
                '</div>' +
                `<span class="${entityClass(r.type) !== 'other' ? `cdx-badge cdx-badge--entity-${entityClass(r.type)} ` : ''}cdx-cp-kind">` +
                typeLabel(r.type) +
                '</span>' +
                '</a>'
            );
        })
        .join('');

    activeIndex = 0;
};

/** Escape HTML entities */
const escapeHtml = (s: string): string =>
    s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

/** Escape for HTML attributes */
const escapeAttr = (s: string): string =>
    s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** Update active item highlighting */
const updateActive = (newIndex: number) => {
    const list = getList();
    if (!list) {
        return;
    }
    const items = list.querySelectorAll<HTMLElement>('.cdx-cp-item');
    if (items.length === 0) {
        return;
    }

    const clamped = Math.max(0, Math.min(newIndex, items.length - 1));
    items.forEach((item, i) => {
        const isActive = i === clamped;
        item.classList.toggle('cdx-cp-active', isActive);
        item.setAttribute('aria-selected', String(isActive));
    });
    activeIndex = clamped;

    // Scroll active item into view
    items[clamped]?.scrollIntoView({ block: 'nearest' });
};

/** Navigate to the currently active result */
const navigateToActive = () => {
    const list = getList();
    if (!list) {
        return;
    }
    const active = list.querySelector<HTMLAnchorElement>('.cdx-cp-active');
    if (active?.href) {
        closePalette();
        // Use SPA router click simulation
        active.click();
    }
};

/** Open the command palette */
export const openCommandPalette = () => {
    const dialog = getDialog();
    if (!dialog) {
        return;
    }
    dialog.showModal();
    // Hydrate filters + initial query from the current URL — supports
    // deep links of the form `?q=toast&kind=Component`.
    const initialQuery = hydrateStateFromUrl();
    const input = getInput();
    if (input) {
        input.value = initialQuery;
        input.focus();
    }
    const list = getList();
    const empty = getEmpty();
    if (list) {
        list.innerHTML = '';
    }
    if (empty) {
        empty.hidden = false;
        empty.textContent = 'Start typing to see results';
    }
    activeIndex = -1;
    lastQuery = initialQuery;

    // Lazy-load Pagefind on first open. After warmup, either run the
    // hydrated search (deep link / re-open with existing filters) or
    // surface the empty-palette state with the cached global counts
    // so the user sees facet chips immediately.
    loadPagefind().then(() => {
        const hasFilters = FACET_DIMS.some(d => activeFilters[d].size > 0);
        if (initialQuery || hasFilters) {
            search(initialQuery);
        } else {
            search('');
        }
    });
};

/** Reset every piece of in-memory facet state so a subsequent open
 *  shows a clean global-counts view rather than the previous query's
 *  residue: chip counts that read "Component 9" from a "card" query,
 *  an active filter the user thought they had dismissed, or a
 *  still-populated input value. The URL is also rolled back to a bare
 *  path so the back/forward buttons stay sane. Wired to the dialog's
 *  native `close` event so it fires for every close path — Esc,
 *  programmatic `close()`, X-button click, and backdrop click — not
 *  just the paths that route through `closePalette()`.
 */
const resetState = () => {
    for (const dim of FACET_DIMS) {
        activeFilters[dim].clear();
    }
    lastQuery = '';
    activeIndex = -1;
    const input = getInput();
    if (input) {
        input.value = '';
    }
    const facetsRoot = getFacets();
    if (facetsRoot) {
        facetsRoot.hidden = true;
        facetsRoot.innerHTML = '';
    }
    const list = getList();
    if (list) {
        list.innerHTML = '';
    }
    updateUrlFromState();
};

/** Close the command palette. The `close` event listener wired in
 *  `initCommandPalette` does the actual state cleanup so the same
 *  path runs for Esc, backdrop click, and programmatic closes.
 */
const closePalette = () => {
    const dialog = getDialog();
    if (!dialog) {
        return;
    }
    dialog.close();
};

export const initCommandPalette = () => {
    const dialog = getDialog();
    if (!dialog) {
        return;
    }

    // Cmd+K / Ctrl+K to open
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            if (dialog.open) {
                closePalette();
            } else {
                openCommandPalette();
            }
        }
    });

    // Close on backdrop click
    dialog.addEventListener('click', e => {
        if (e.target === dialog) {
            closePalette();
        }
    });

    // X-button close
    dialog.querySelector('.cdx-cp-close')?.addEventListener('click', () => closePalette());

    // The `<dialog>` element fires `close` for every close path —
    // native Esc, programmatic `close()`, X click, backdrop click —
    // so resetting state here covers all of them in one place.
    dialog.addEventListener('close', () => {
        resetState();
    });

    // Search input handling
    const input = getInput();
    if (input) {
        input.addEventListener('input', () => {
            const q = input.value;
            if (q === lastQuery) {
                return;
            }
            lastQuery = q;
            updateUrlFromState();

            clearTimeout(throttleTimer);
            throttleTimer = setTimeout(() => search(q), THROTTLE_MS);
        });

        input.addEventListener('keydown', e => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    updateActive(activeIndex + 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    updateActive(activeIndex - 1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    navigateToActive();
                    break;
                case 'Escape':
                    // Let native dialog handle it
                    break;
            }
        });
    }

    // Facet chip + reset interactions
    const facets = getFacets();
    if (facets) {
        facets.addEventListener('click', e => {
            const reset = (e.target as HTMLElement).closest<HTMLButtonElement>(
                '.cdx-cp-facet-reset'
            );
            if (reset) {
                e.preventDefault();
                for (const dim of FACET_DIMS) {
                    activeFilters[dim].clear();
                }
                updateUrlFromState();
                search(lastQuery);
                return;
            }
            const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.cdx-cp-facet-chip');
            if (!chip) {
                return;
            }
            e.preventDefault();
            const dim = chip.dataset.dim as FacetDim | undefined;
            const value = chip.dataset.value;
            if (!dim || !value || !(dim in activeFilters)) {
                return;
            }
            if (activeFilters[dim].has(value)) {
                activeFilters[dim].delete(value);
            } else {
                activeFilters[dim].add(value);
            }
            updateUrlFromState();
            search(lastQuery);
        });
    }

    // Click on result items
    const list = getList();
    if (list) {
        list.addEventListener('click', e => {
            const item = (e.target as HTMLElement).closest<HTMLAnchorElement>('.cdx-cp-item');
            if (item) {
                e.preventDefault();
                const idx = parseInt(item.dataset.index ?? '0', 10);
                updateActive(idx);
                navigateToActive();
            }
        });

        // Mouse hover updates active state
        list.addEventListener('mousemove', e => {
            const item = (e.target as HTMLElement).closest<HTMLElement>('.cdx-cp-item');
            if (item && item.dataset.index !== undefined) {
                updateActive(parseInt(item.dataset.index, 10));
            }
        });
    }

    // Sidebar search input click opens command palette (legacy)
    document.querySelectorAll('#book-search-input input').forEach(el => {
        el.addEventListener('focus', e => {
            e.preventDefault();
            (el as HTMLInputElement).blur();
            openCommandPalette();
        });
    });

    // Search trigger button in sidebar header
    document.querySelectorAll<HTMLElement>('[data-cdx-search-trigger]').forEach(btn => {
        btn.addEventListener('click', () => openCommandPalette());
    });
};
