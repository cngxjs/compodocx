/**
 * Single entry point for all hash-based navigation: tab deep-links,
 * member anchors (#ngOnInit), and source line highlights (#L42).
 *
 * Panel activation lives here (not in tabs.ts) so the import graph
 * stays one-way: tabs -> hash-router, code-blocks -> hash-router.
 *
 * Line hashes always target the #source panel - template/style tabs
 * aren't addressable yet. If you add CSS transitions to tab panels,
 * scrollIntoView will need a rAF wait.
 */

export type HashTarget =
    | { kind: 'tab'; panel: HTMLElement }
    | { kind: 'element'; panel: HTMLElement; element: HTMLElement }
    | { kind: 'line'; panel: HTMLElement; start: number; end: number }
    | { kind: 'scroll'; element: HTMLElement };

// Bound at runtime by code-blocks.ts to avoid a circular import.

let lineHandler: ((panel: HTMLElement, start: number, end: number) => void) | null = null;

export const registerLineHandler = (
    fn: (panel: HTMLElement, start: number, end: number) => void
): void => {
    lineHandler = fn;
};

/** Parse a URL hash into a routing target. Line patterns (#L42)
 *  are checked before DOM lookups - intentional, even if an element
 *  happens to have id="L1". */
export const resolveHash = (hash: string): HashTarget | null => {
    if (!hash || hash === '#') {
        return null;
    }
    const clean = hash.startsWith('#') ? hash.slice(1) : hash;

    // Lines don't have real DOM IDs, so check the pattern first.
    const lineMatch = clean.match(/^L(\d+)(?:-L(\d+))?$/);
    if (lineMatch) {
        const panel = document.getElementById('source');
        if (!panel) {
            return null;
        }
        const a = Number.parseInt(lineMatch[1], 10);
        const b = lineMatch[2] ? Number.parseInt(lineMatch[2], 10) : a;
        return { kind: 'line', panel, start: Math.min(a, b), end: Math.max(a, b) };
    }

    // Exact panel match (e.g. #api, #source). A Markdown heading of the same
    // name (`#### Example` -> id="example") comes earlier in the page, so the
    // panels are searched first.
    const tabPanel = Array.from(document.querySelectorAll<HTMLElement>('.cdx-tab-panel')).find(
        panel => panel.id === clean
    );
    if (tabPanel) {
        return { kind: 'tab', panel: tabPanel };
    }
    const direct = document.getElementById(clean);
    if (!direct) {
        return null;
    }
    if (direct.classList.contains('cdx-tab-panel')) {
        return { kind: 'tab', panel: direct };
    }

    // Element nested inside a panel (member card, section heading, etc.).
    const panel = direct.closest<HTMLElement>('.cdx-tab-panel');
    if (panel) {
        return { kind: 'element', panel, element: direct };
    }

    // Element exists but no tab panel - collection pages and other tab-less
    // layouts (miscellaneous functions/variables/typealiases/enumerations).
    // Without this branch `applyHashTarget` returns early and the SPA router's
    // scroll path silently drops the anchor.
    return { kind: 'scroll', element: direct };
};

// Switch to a tab panel and keep the tab bar's ARIA in sync.
export const activatePanel = (panel: HTMLElement): void => {
    const tabContent = panel.parentElement;
    if (tabContent) {
        tabContent.querySelectorAll<HTMLElement>('.cdx-tab-panel').forEach(p => {
            p.classList.remove('active');
        });
    }
    panel.classList.add('active');

    // The tab bar sits right before the panels wrapper in the DOM.
    const tabBar = panel.parentElement?.previousElementSibling as HTMLElement | null;
    if (tabBar?.classList.contains('cdx-tab-bar')) {
        tabBar.querySelectorAll<HTMLElement>('[role="tab"]').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
        });
        const activeTab = document.getElementById(`${panel.id}-tab`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
            activeTab.setAttribute('tabindex', '0');
        }
    }
};

export const applyHashTarget = (target: HashTarget | null): void => {
    if (!target) {
        return;
    }

    if (target.kind === 'scroll') {
        target.element.scrollIntoView({ block: 'start' });
        return;
    }

    activatePanel(target.panel);

    if (target.kind === 'tab') {
        return;
    }

    if (target.kind === 'element') {
        target.element.scrollIntoView({ block: 'start' });
        return;
    }

    // kind === 'line'
    lineHandler?.(target.panel, target.start, target.end);
};

export const updateHash = (hash: string): void => {
    history.replaceState(null, '', hash);
    applyHashTarget(resolveHash(hash));
};

export const initHashRouter = (): void => {
    // Delegated tab clicks - no re-binding needed after SPA swaps.
    document.addEventListener('click', e => {
        const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-cdx-toggle="tab"]');
        if (!tab) {
            return;
        }
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) {
            updateHash(href);
        }
    });

    // Catches hash-only links the SPA router lets through.
    globalThis.addEventListener('hashchange', () => {
        applyHashTarget(resolveHash(location.hash));
    });

    // Apply the hash that's already in the URL on page load.
    if (location.hash) {
        applyHashTarget(resolveHash(location.hash));
    }

    // The <head> script hides content when a hash is present to prevent
    // the default tab from flashing. Safe to reveal now.
    document.documentElement.classList.remove('cdx-hash-pending');
};
