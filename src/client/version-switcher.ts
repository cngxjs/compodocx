/**
 * Version-switcher widget. Renders the version dropdown at runtime from
 * `<versionsRoot>/versions.json`. Uses HEAD fetch to detect when the same
 * page exists in the target version and falls back to the version's index
 * when it does not. A page that moved between layouts is found through the
 * versions' `redirects.json`: the target's map forward, else the current
 * version's map backward.
 *
 * On `file://`, fetch is uniformly blocked across browsers — render a
 * static hint and disable the trigger rather than ship a half-working
 * dropdown.
 */

import { REDIRECTS_FILE } from '../app/links/layout';

interface ManifestEntry {
    label: string;
    path: string;
    builtAt: string;
}

interface VersionsManifest {
    schemaVersion: number;
    updatedAt: string;
    versions: ManifestEntry[];
}

const SCHEMA_VERSION = 1;

export function initVersionSwitcher(root?: ParentNode): void {
    const scope = root ?? document;
    const widgets = Array.from(
        scope.querySelectorAll<HTMLElement>('[data-compodoc="version-switcher"]')
    );
    if (widgets.length === 0) {
        return;
    }
    for (const widget of widgets) {
        wire(widget);
    }
}

function wire(widget: HTMLElement): void {
    const trigger = widget.querySelector<HTMLButtonElement>('.cdx-version-switcher-trigger');
    const menu = widget.querySelector<HTMLElement>('.cdx-version-switcher-menu');
    if (!trigger || !menu) {
        return;
    }

    if (location.protocol === 'file:') {
        renderFileProtocolHint(menu);
        bindToggle(trigger, menu);
        return;
    }

    // Lazy fetch on first open; cache the result so the menu reopens cheaply.
    let cache: VersionsManifest | null | undefined;
    let pending: Promise<VersionsManifest | null> | null = null;

    const ensure = () => {
        if (cache !== undefined) {
            return Promise.resolve(cache);
        }
        if (!pending) {
            pending = loadManifest(getManifestUrl(widget)).then(m => {
                cache = m;
                return m;
            });
        }
        return pending;
    };

    bindToggle(trigger, menu, async () => {
        if (cache === undefined) {
            renderLoading(menu);
            await ensure();
        }
        const m = cache;
        if (!m) {
            renderUnreachable(menu);
            return;
        }
        const sliced = sliceForCap(m.versions, getCap(widget));
        if (sliced.shown.length <= 1) {
            // Hide entirely — single-version sites don't need a dropdown.
            collapse(trigger, menu);
            widget.dataset.cdxSingleVersion = 'true';
            widget.style.display = 'none';
            return;
        }
        renderMenu(menu, widget, sliced);
    });
}

function bindToggle(
    trigger: HTMLButtonElement,
    menu: HTMLElement,
    onOpen?: () => void | Promise<void>
): void {
    trigger.addEventListener('click', async () => {
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
            collapse(trigger, menu);
            return;
        }
        if (onOpen) {
            await onOpen();
        }
        trigger.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
    });

    document.addEventListener('click', e => {
        if (!trigger.contains(e.target as Node) && !menu.contains(e.target as Node)) {
            collapse(trigger, menu);
        }
    });
}

function collapse(trigger: HTMLButtonElement, menu: HTMLElement): void {
    trigger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
}

async function loadManifest(url: string): Promise<VersionsManifest | null> {
    try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) {
            return null;
        }
        const json = (await r.json()) as VersionsManifest;
        if (json.schemaVersion !== SCHEMA_VERSION || !Array.isArray(json.versions)) {
            return null;
        }
        return json;
    } catch {
        return null;
    }
}

function getManifestUrl(widget: HTMLElement): string {
    return widget.dataset.cdxManifestUrl ?? '../versions.json';
}

function getCap(widget: HTMLElement): number {
    const raw = Number(widget.dataset.cdxMaxShown ?? '10');
    if (!Number.isFinite(raw) || raw < 0) {
        return 10;
    }
    return Math.floor(raw);
}

interface SliceResult {
    shown: ManifestEntry[];
    truncated: boolean;
    total: number;
}

export function sliceForCap(versions: ManifestEntry[], cap: number): SliceResult {
    if (cap === 0) {
        return { shown: versions, truncated: false, total: versions.length };
    }
    return {
        shown: versions.slice(0, cap),
        truncated: versions.length > cap,
        total: versions.length
    };
}

function renderLoading(menu: HTMLElement): void {
    menu.innerHTML = '<div class="cdx-version-switcher-loading">Loading…</div>';
}

function renderUnreachable(menu: HTMLElement): void {
    menu.innerHTML = '<div class="cdx-version-switcher-empty">No other versions known</div>';
}

function renderFileProtocolHint(menu: HTMLElement): void {
    menu.innerHTML =
        '<div class="cdx-version-switcher-hint">' + 'Open over http to switch versions.' + '</div>';
}

function renderMenu(menu: HTMLElement, widget: HTMLElement, sliced: SliceResult): void {
    const currentLabel = widget.dataset.cdxCurrentLabel ?? '';
    const items = sliced.shown
        .map(entry => {
            const isCurrent = entry.label === currentLabel;
            const ariaCurrent = isCurrent ? ' aria-current="true"' : '';
            const cls = isCurrent
                ? 'cdx-version-switcher-item cdx-version-switcher-item--current'
                : 'cdx-version-switcher-item';
            return (
                `<button type="button" role="option" class="${cls}"${ariaCurrent} ` +
                `data-cdx-target-label="${escapeAttr(entry.label)}" ` +
                `data-cdx-target-path="${escapeAttr(entry.path)}">` +
                `<span class="cdx-version-switcher-item-label">${escapeAttr(entry.label)}</span>` +
                '</button>'
            );
        })
        .join('');
    let footer = '';
    if (sliced.truncated) {
        const manifestUrl = getManifestUrl(widget);
        footer =
            '<div class="cdx-version-switcher-footer">' +
            `Showing ${sliced.shown.length} of ${sliced.total} versions — ` +
            `<a href="${escapeAttr(manifestUrl)}">see versions.json</a>` +
            '</div>';
    }
    menu.innerHTML = items + footer;
    bindMenuItems(menu, widget);
}

function bindMenuItems(menu: HTMLElement, widget: HTMLElement): void {
    const items = menu.querySelectorAll<HTMLButtonElement>('.cdx-version-switcher-item');
    for (const item of items) {
        item.addEventListener('click', () => navigateTo(item, widget));
    }
}

async function navigateTo(item: HTMLButtonElement, widget: HTMLElement): Promise<void> {
    const targetPath = item.dataset.cdxTargetPath ?? '';
    const currentLabel = widget.dataset.cdxCurrentLabel ?? '';
    const candidate = computeTargetUrl(location, currentLabel, targetPath);
    const fallback = computeFallbackUrl(location, currentLabel, targetPath);
    if (!candidate || !fallback) {
        if (fallback) {
            location.href = fallback;
        }
        return;
    }
    const currentRoot = computeFallbackUrl(location, currentLabel, `${currentLabel}/`) ?? fallback;
    const tail = decodeTail(candidate.slice(0, candidate.length - location.hash.length), fallback);
    const urls = await redirectCandidates(tail, location.hash, fallback, currentRoot, candidate);
    for (const url of urls) {
        try {
            const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
            if (r.ok) {
                location.href = url;
                return;
            }
        } catch {
            // try the next candidate
        }
    }
    location.href = fallback;
}

/** Old page path (anchor allowed) -> current page path, per version root. */
type Redirects = Readonly<Record<string, string>>;

const redirectMaps = new Map<string, Promise<Redirects | null>>();

/** The `redirects.json` of a version root, fetched once; null when it has none. */
function redirectsOf(root: string): Promise<Redirects | null> {
    let pending = redirectMaps.get(root);
    if (!pending) {
        pending = fetch(new URL(REDIRECTS_FILE, root).toString(), { cache: 'no-cache' })
            .then(r => (r.ok ? r.json() : null))
            .then(json =>
                json && json.schemaVersion === 1 && typeof json.redirects === 'object'
                    ? (json.redirects as Redirects)
                    : null
            )
            .catch(() => null);
        redirectMaps.set(root, pending);
    }
    return pending;
}

/** The page path below the version root of a mirrored URL (no hash), decoded. */
function decodeTail(url: string, root: string): string {
    const raw = url.startsWith(root) ? url.slice(root.length) : '';
    try {
        return decodeURIComponent(raw.split('?')[0]);
    } catch {
        return raw.split('?')[0];
    }
}

/**
 * Where a page path of one layout lives in another, by a redirect map:
 * forward when `map` is the target's (old path -> its path), the old paths
 * when it is the current version's and the target predates it. Anchors in
 * keys and values are kept; a hit on `tail#hash` wins over `tail`.
 */
export function followRedirect(map: Redirects, tail: string, hash: string): string | undefined {
    const anchor = hash.replace(/^#/, '');
    return (anchor && map[`${tail}#${anchor}`]) || map[tail];
}

export function invertRedirect(map: Redirects, tail: string): string[] {
    const keys = Object.keys(map).filter(key => map[key].split('#')[0] === tail);
    return [...keys.filter(key => !key.includes('#')), ...keys.filter(key => key.includes('#'))];
}

/** URLs to try in the target version, best first; the existing HEAD check picks one. */
async function redirectCandidates(
    tail: string,
    hash: string,
    targetRoot: string,
    currentRoot: string,
    same: string
): Promise<string[]> {
    const at = (path: string) => {
        const [file, anchor] = path.split('#');
        const url = new URL(encodeURI(file), targetRoot).toString();
        return anchor ? `${url}#${anchor}` : `${url}${anchor === undefined ? hash : ''}`;
    };
    const target = await redirectsOf(targetRoot);
    if (target) {
        const moved = followRedirect(target, tail, hash);
        return moved ? [at(moved), same] : [same];
    }
    const current = await redirectsOf(currentRoot);
    return [same, ...(current ? invertRedirect(current, tail) : []).map(at)];
}

/**
 * Compute the URL that mirrors the current page in the target version.
 *
 * Example: location = `https://docs.example.com/v0.3.0/forms/Foo.html`,
 * currentLabel = `v0.3.0`, targetPath = `v0.2.0/` →
 * `https://docs.example.com/v0.2.0/forms/Foo.html`.
 *
 * If the current label is not in the URL (sub-directory misconfiguration,
 * stale switcher script, etc.), returns null and the caller falls back to
 * the target's root.
 */
export function computeTargetUrl(
    loc: { pathname: string; href: string },
    currentLabel: string,
    targetPath: string
): string | null {
    const segments = loc.pathname.split('/');
    const idx = segments.lastIndexOf(currentLabel);
    if (idx === -1) {
        return null;
    }
    const before = segments.slice(0, idx).join('/');
    const after = segments.slice(idx + 1).join('/');
    const targetTrimmed = targetPath.endsWith('/') ? targetPath.slice(0, -1) : targetPath;
    const url = new URL(loc.href);
    url.pathname = `${before}/${targetTrimmed}/${after}`.replace(/\/{2,}/g, '/');
    return url.toString();
}

export function computeFallbackUrl(
    loc: { pathname: string; href: string },
    currentLabel: string,
    targetPath: string
): string | null {
    const segments = loc.pathname.split('/');
    const idx = segments.lastIndexOf(currentLabel);
    if (idx === -1) {
        return null;
    }
    const before = segments.slice(0, idx).join('/');
    const targetTrimmed = targetPath.endsWith('/') ? targetPath.slice(0, -1) : targetPath;
    const url = new URL(loc.href);
    url.pathname = `${before}/${targetTrimmed}/`.replace(/\/{2,}/g, '/');
    return url.toString();
}

function escapeAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
