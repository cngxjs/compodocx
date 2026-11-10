// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    computeFallbackUrl,
    computeTargetUrl,
    followRedirect,
    initVersionSwitcher,
    invertRedirect,
    sliceForCap
} from '../../../src/client/version-switcher';
import { pageOf } from '../helpers/pages';

describe('computeTargetUrl — path math', () => {
    it('depth 0: replaces the version segment in the URL', () => {
        const url = computeTargetUrl(
            {
                pathname: '/v0.3.0/index.html',
                href: 'https://docs.example.com/v0.3.0/index.html'
            },
            'v0.3.0',
            'v0.2.0/'
        );
        expect(url).toBe('https://docs.example.com/v0.2.0/index.html');
    });

    it('depth 2: preserves nested page paths', () => {
        const url = computeTargetUrl(
            {
                pathname: `/v0.3.0/${pageOf('component', 'folder/Foo')}`,
                href: `https://docs.example.com/v0.3.0/${pageOf('component', 'folder/Foo')}`
            },
            'v0.3.0',
            'v0.2.0/'
        );
        expect(url).toBe(`https://docs.example.com/v0.2.0/${pageOf('component', 'folder/Foo')}`);
    });

    it('subdirectory deploy: only the matching label segment is rewritten', () => {
        const url = computeTargetUrl(
            {
                pathname: `/myproject/v0.3.0/${pageOf('component', 'Foo')}`,
                href: `https://example.com/myproject/v0.3.0/${pageOf('component', 'Foo')}`
            },
            'v0.3.0',
            'v0.2.0/'
        );
        expect(url).toBe(`https://example.com/myproject/v0.2.0/${pageOf('component', 'Foo')}`);
    });

    it('returns null when the current label is not in the URL', () => {
        const url = computeTargetUrl(
            {
                pathname: `/${pageOf('component', 'Foo')}`,
                href: `https://docs.example.com/${pageOf('component', 'Foo')}`
            },
            'v0.3.0',
            'v0.2.0/'
        );
        expect(url).toBeNull();
    });

    it('rewrites only the LAST occurrence of the label (subdir matches the label)', () => {
        // pathological: /v0.3.0/subdir/v0.3.0/page.html — should keep the
        // outer segment, swap only the inner one
        const url = computeTargetUrl(
            {
                pathname: '/v0.3.0/subdir/v0.3.0/page.html',
                href: 'https://example.com/v0.3.0/subdir/v0.3.0/page.html'
            },
            'v0.3.0',
            'v0.2.0/'
        );
        expect(url).toBe('https://example.com/v0.3.0/subdir/v0.2.0/page.html');
    });
});

describe('computeFallbackUrl', () => {
    it('returns the version root when the page tail is dropped', () => {
        const url = computeFallbackUrl(
            {
                pathname: `/v0.3.0/${pageOf('component', 'Bar')}`,
                href: `https://example.com/v0.3.0/${pageOf('component', 'Bar')}`
            },
            'v0.3.0',
            'v0.2.0/'
        );
        expect(url).toBe('https://example.com/v0.2.0/');
    });

    it('returns null when current label is not in URL', () => {
        const url = computeFallbackUrl(
            {
                pathname: '/Bar.html',
                href: 'https://example.com/Bar.html'
            },
            'v0.3.0',
            'v0.2.0/'
        );
        expect(url).toBeNull();
    });
});

describe('redirect maps between layouts', () => {
    const map = {
        'components/Foo.html': 'forms/select/Foo.html',
        'functions/pick.html': 'core/pick.html',
        'miscellaneous/functions.html#pick': 'core/pick.html',
        'miscellaneous/functions.html': 'utilities.html#functions'
    };

    it('follows the target version map from an old page to its new place', () => {
        expect(followRedirect(map, 'components/Foo.html', '')).toBe('forms/select/Foo.html');
        expect(followRedirect(map, 'miscellaneous/functions.html', '#pick')).toBe('core/pick.html');
        expect(followRedirect(map, 'miscellaneous/functions.html', '#other')).toBe(
            'utilities.html#functions'
        );
    });

    it('inverts the current version map for a target that predates it, plain paths first', () => {
        expect(invertRedirect(map, 'core/pick.html')).toEqual([
            'functions/pick.html',
            'miscellaneous/functions.html#pick'
        ]);
    });

    it('leaves a page no map knows to the same-path try and the version root fallback', () => {
        expect(followRedirect(map, 'overview.html', '')).toBeUndefined();
        expect(invertRedirect(map, 'overview.html')).toEqual([]);
    });
});

describe('sliceForCap', () => {
    const mk = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            label: `v${count - i}.0.0`,
            path: `v${count - i}.0.0/`,
            builtAt: '2026-01-01T00:00:00.000Z'
        }));

    it('cap=0 means unlimited and never marks the result truncated', () => {
        const r = sliceForCap(mk(20), 0);
        expect(r.shown).toHaveLength(20);
        expect(r.truncated).toBe(false);
    });

    it('cap=4 with manifest of 7 returns the first 4 and marks truncated', () => {
        const r = sliceForCap(mk(7), 4);
        expect(r.shown).toHaveLength(4);
        expect(r.truncated).toBe(true);
        expect(r.total).toBe(7);
    });

    it('cap=10 with manifest of 4 returns all 4 untruncated', () => {
        const r = sliceForCap(mk(4), 10);
        expect(r.shown).toHaveLength(4);
        expect(r.truncated).toBe(false);
    });
});

describe('initVersionSwitcher — DOM behaviour', () => {
    let originalLocation: Location;
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        originalLocation = window.location;
        fetchSpy = vi.spyOn(globalThis, 'fetch') as never;
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            configurable: true,
            writable: true
        });
        fetchSpy.mockRestore();
        document.body.innerHTML = '';
    });

    // The manifest is cached per URL for the page's lifetime; a fresh URL per
    // test keeps one test's manifest out of the next.
    let manifestSeq = 0;

    function widgetMarkup(opts: { manifestUrl: string; cap?: number; label?: string }): string {
        return `
            <div class="cdx-version-switcher"
                 data-compodoc="version-switcher"
                 data-cdx-current-label="${opts.label ?? 'v1.0.0'}"
                 data-cdx-manifest-url="${opts.manifestUrl}"
                 data-cdx-max-shown="${opts.cap ?? 10}">
                <button type="button" class="cdx-version-switcher-trigger"
                        aria-haspopup="listbox"
                        aria-expanded="false">
                    <span class="cdx-version-switcher-label">${opts.label ?? 'v1.0.0'}</span>
                </button>
                <div class="cdx-version-switcher-menu" role="listbox" hidden></div>
            </div>
        `;
    }

    function buildWidget(opts: { manifestUrl?: string; cap?: number; label?: string } = {}) {
        const manifestUrl = opts.manifestUrl ?? `../versions.json?case=${++manifestSeq}`;
        document.body.innerHTML = widgetMarkup({ ...opts, manifestUrl });
        return {
            widget: document.querySelector<HTMLElement>('.cdx-version-switcher')!,
            trigger: document.querySelector<HTMLButtonElement>('.cdx-version-switcher-trigger')!,
            menu: document.querySelector<HTMLElement>('.cdx-version-switcher-menu')!
        };
    }

    function setLocation(href: string, protocol = 'https:'): void {
        const url = new URL(href);
        Object.defineProperty(window, 'location', {
            value: {
                ...originalLocation,
                href,
                pathname: url.pathname,
                protocol
            },
            configurable: true,
            writable: true
        });
    }

    it('no-op when no version-switcher element is present', () => {
        document.body.innerHTML = '<div></div>';
        expect(() => initVersionSwitcher()).not.toThrow();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('on file:// it renders a hint and never calls fetch', async () => {
        const { trigger, menu } = buildWidget();
        setLocation('file:///Users/me/docs/v1.0.0/index.html', 'file:');
        initVersionSwitcher();
        trigger.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(menu.innerHTML).toMatch(/Open over http/);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    const manifestOf = (labels: string[]) =>
        ({
            ok: true,
            json: () =>
                Promise.resolve({
                    schemaVersion: 1,
                    updatedAt: 'x',
                    versions: labels.map(label => ({ label, path: `${label}/`, builtAt: 'x' }))
                })
        }) as Response;

    const settle = () => new Promise(resolve => setTimeout(resolve, 0));

    it.each([
        ['a single version', ['v1.0.0']],
        ['no versions', []]
    ])('with %s it stays visible as a static label', async (_, labels) => {
        const { widget, trigger, menu } = buildWidget({ label: 'v1.0.0' });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockResolvedValueOnce(manifestOf(labels));
        initVersionSwitcher();
        await settle();
        expect(widget.style.display).not.toBe('none');
        expect(widget.dataset.cdxSingleVersion).toBe('true');
        expect(widget.querySelector('.cdx-version-switcher-label')?.textContent).toBe('v1.0.0');
        expect(trigger.disabled).toBe(true);
        expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
        expect(trigger.hasAttribute('aria-expanded')).toBe(false);
        expect(trigger.getAttribute('aria-label')).toContain('v1.0.0');
        trigger.click();
        await settle();
        expect(menu.hidden).toBe(true);
        expect(widget.style.display).not.toBe('none');
    });

    it('a click before the manifest arrives opens nothing for a single version', async () => {
        const { widget, trigger, menu } = buildWidget({ label: 'v1.0.0' });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        let resolve: (r: Response) => void = () => {};
        fetchSpy.mockReturnValueOnce(new Promise<Response>(r => (resolve = r)));
        initVersionSwitcher();
        trigger.click();
        resolve(manifestOf(['v1.0.0']));
        await settle();
        expect(menu.hidden).toBe(true);
        expect(trigger.disabled).toBe(true);
        expect(widget.style.display).not.toBe('none');
    });

    it('loads the manifest on init and not again on click', async () => {
        const { trigger, menu } = buildWidget({ label: 'v1.0.0' });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockResolvedValueOnce(manifestOf(['v2.0.0', 'v1.0.0']));
        initVersionSwitcher();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        await settle();
        trigger.click();
        await settle();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(menu.hidden).toBe(false);
        expect(menu.querySelectorAll('.cdx-version-switcher-item')).toHaveLength(2);
    });

    it('two widgets with the same manifest URL share one fetch', async () => {
        const manifestUrl = `../versions.json?case=${++manifestSeq}`;
        document.body.innerHTML = widgetMarkup({ manifestUrl }) + widgetMarkup({ manifestUrl });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockResolvedValueOnce(manifestOf(['v2.0.0', 'v1.0.0']));
        initVersionSwitcher();
        await settle();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps the dropdown when the cap shows one of several versions', async () => {
        const { widget, trigger, menu } = buildWidget({ cap: 1, label: 'v1.0.0' });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockResolvedValueOnce(manifestOf(['v2.0.0', 'v1.0.0']));
        initVersionSwitcher();
        await settle();
        trigger.click();
        await settle();
        expect(widget.dataset.cdxSingleVersion).toBeUndefined();
        expect(menu.hidden).toBe(false);
        expect(menu.querySelectorAll('.cdx-version-switcher-item')).toHaveLength(1);
        expect(menu.innerHTML).toMatch(/Showing 1 of 2/);
    });

    it('shows "no other versions known" when the manifest fetch fails', async () => {
        const { trigger, menu } = buildWidget();
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockRejectedValueOnce(new Error('network'));
        initVersionSwitcher();
        trigger.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(menu.innerHTML).toMatch(/No other versions/);
    });

    it('marks the current label with aria-current and the current modifier class', async () => {
        const { trigger, menu } = buildWidget({ label: 'v1.0.0' });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    schemaVersion: 1,
                    updatedAt: 'x',
                    versions: [
                        { label: 'v2.0.0', path: 'v2.0.0/', builtAt: 'x' },
                        { label: 'v1.0.0', path: 'v1.0.0/', builtAt: 'x' }
                    ]
                })
        } as Response);
        initVersionSwitcher();
        trigger.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(menu.innerHTML).toContain('aria-current="true"');
        expect(menu.innerHTML).toContain('cdx-version-switcher-item--current');
    });

    it('renders the truncation footer when manifest exceeds the cap', async () => {
        const { trigger, menu } = buildWidget({ cap: 2 });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    schemaVersion: 1,
                    updatedAt: 'x',
                    versions: [
                        { label: 'v3.0.0', path: 'v3.0.0/', builtAt: 'x' },
                        { label: 'v2.0.0', path: 'v2.0.0/', builtAt: 'x' },
                        { label: 'v1.0.0', path: 'v1.0.0/', builtAt: 'x' }
                    ]
                })
        } as Response);
        initVersionSwitcher();
        trigger.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(menu.innerHTML).toMatch(/Showing 2 of 3/);
        expect(menu.innerHTML).toContain('versions.json');
    });

    it('cap=0 renders all versions and emits no truncation footer', async () => {
        const { trigger, menu } = buildWidget({ cap: 0 });
        setLocation('https://docs.example.com/v1.0.0/index.html');
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    schemaVersion: 1,
                    updatedAt: 'x',
                    versions: [
                        { label: 'v3.0.0', path: 'v3.0.0/', builtAt: 'x' },
                        { label: 'v2.0.0', path: 'v2.0.0/', builtAt: 'x' },
                        { label: 'v1.0.0', path: 'v1.0.0/', builtAt: 'x' }
                    ]
                })
        } as Response);
        initVersionSwitcher();
        trigger.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(menu.innerHTML).not.toMatch(/Showing/);
    });
});
