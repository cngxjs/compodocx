// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveHash } from '../../../src/client/hash-router';

// Stub getElementById with minimal fake elements so we can test
// resolveHash without a full DOM.
const makeElement = (
    id: string,
    opts: {
        classes?: string[];
        parent?: ReturnType<typeof makeElement>;
        panelAncestor?: ReturnType<typeof makeElement>;
    } = {}
) => {
    const classes = new Set(opts.classes ?? []);
    const el = {
        id,
        classList: {
            contains: (cls: string) => classes.has(cls)
        },
        closest: (selector: string) => {
            if (selector === '.cdx-tab-panel' && opts.panelAncestor) {
                return opts.panelAncestor;
            }
            return null;
        }
    };
    return el as unknown as HTMLElement;
};

describe('resolveHash', () => {
    let origGetElementById: typeof document.getElementById;

    beforeEach(() => {
        origGetElementById = document.getElementById;
    });

    afterEach(() => {
        document.getElementById = origGetElementById;
    });

    // Helper: stub getElementById to return from a map
    const stubDom = (elements: Record<string, HTMLElement>) => {
        document.getElementById = vi.fn((id: string) => elements[id] ?? null);
    };

    // 1. Empty string
    it('returns null for empty string', () => {
        expect(resolveHash('')).toBeNull();
    });

    // 2. Hash-only
    it('returns null for bare #', () => {
        expect(resolveHash('#')).toBeNull();
    });

    // 3. Direct tab panel — #api
    it('resolves #api to a tab target when element is a cdx-tab-panel', () => {
        const apiPanel = makeElement('api', { classes: ['cdx-tab-panel'] });
        stubDom({ api: apiPanel });

        const result = resolveHash('#api');
        expect(result).toEqual({ kind: 'tab', panel: apiPanel });
    });

    // 4. Direct tab panel — #info
    it('resolves #info to a tab target when element is a cdx-tab-panel', () => {
        const infoPanel = makeElement('info', { classes: ['cdx-tab-panel'] });
        stubDom({ info: infoPanel });

        const result = resolveHash('#info');
        expect(result).toEqual({ kind: 'tab', panel: infoPanel });
    });

    // 5. Element inside a panel — member card
    it('resolves #ngOnInit to an element target inside its panel', () => {
        const apiPanel = makeElement('api', { classes: ['cdx-tab-panel'] });
        const memberCard = makeElement('ngOnInit', { panelAncestor: apiPanel });
        stubDom({ ngOnInit: memberCard });

        const result = resolveHash('#ngOnInit');
        expect(result).toEqual({ kind: 'element', panel: apiPanel, element: memberCard });
    });

    // 6. Section heading inside a panel
    it('resolves #methods to an element target (section heading)', () => {
        const apiPanel = makeElement('api', { classes: ['cdx-tab-panel'] });
        const heading = makeElement('methods', { panelAncestor: apiPanel });
        stubDom({ methods: heading });

        const result = resolveHash('#methods');
        expect(result).toEqual({ kind: 'element', panel: apiPanel, element: heading });
    });

    // 7. Single line — #L121
    it('resolves #L121 to a line target with start=end=121', () => {
        const sourcePanel = makeElement('source', { classes: ['cdx-tab-panel'] });
        stubDom({ source: sourcePanel });

        const result = resolveHash('#L121');
        expect(result).toEqual({ kind: 'line', panel: sourcePanel, start: 121, end: 121 });
    });

    // 8. Line range — #L3-L7
    it('resolves #L3-L7 to a line target with start=3, end=7', () => {
        const sourcePanel = makeElement('source', { classes: ['cdx-tab-panel'] });
        stubDom({ source: sourcePanel });

        const result = resolveHash('#L3-L7');
        expect(result).toEqual({ kind: 'line', panel: sourcePanel, start: 3, end: 7 });
    });

    // 9. Reversed line range — #L7-L3 normalizes
    it('normalizes reversed range #L7-L3 to start=3, end=7', () => {
        const sourcePanel = makeElement('source', { classes: ['cdx-tab-panel'] });
        stubDom({ source: sourcePanel });

        const result = resolveHash('#L7-L3');
        expect(result).toEqual({ kind: 'line', panel: sourcePanel, start: 3, end: 7 });
    });

    // 10. No matching DOM element
    it('returns null when no element matches the hash', () => {
        stubDom({});

        expect(resolveHash('#foo')).toBeNull();
    });

    // 11. Element outside any panel — scroll-only target
    //
    // Collection pages (miscellaneous/functions.html etc.) emit entity-row
    // anchors at the top level without any tab panel wrapper. Returning null
    // here would silently drop the scroll in the SPA router's hash path.
    it('returns a scroll target when element exists but is not inside a cdx-tab-panel', () => {
        const bareAnchor = makeElement('createPausableTimer'); // no panelAncestor
        stubDom({ createPausableTimer: bareAnchor });

        expect(resolveHash('#createPausableTimer')).toEqual({
            kind: 'scroll',
            element: bareAnchor
        });
    });

    // 12. Line-pattern priority over same-named DOM id
    it('line pattern wins over an element with id="L1"', () => {
        const sourcePanel = makeElement('source', { classes: ['cdx-tab-panel'] });
        const bogusElement = makeElement('L1', { classes: ['cdx-tab-panel'] });
        stubDom({ source: sourcePanel, L1: bogusElement });

        const result = resolveHash('#L1');
        // Line branch must win — the element with id="L1" is NOT returned
        expect(result).toEqual({ kind: 'line', panel: sourcePanel, start: 1, end: 1 });
    });

    // Edge: line hash without #source panel
    it('returns null for #L10 when no #source panel exists', () => {
        stubDom({});

        expect(resolveHash('#L10')).toBeNull();
    });
});

describe('resolveHash with a heading named like a tab', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('opens the tab panel, not the panel of a Markdown heading with the same id', () => {
        // `#### Example` in a README renders as <h4 id="example"> before the Example panel.
        document.body.innerHTML = `
            <div class="cdx-tab-content">
                <div class="cdx-tab-panel" id="readme"><h4 id="example">Example</h4></div>
                <div class="cdx-tab-panel" id="example"><iframe></iframe></div>
            </div>`;

        const result = resolveHash('#example');
        expect(result?.kind).toBe('tab');
        expect(result && 'panel' in result ? result.panel.id : '').toBe('example');
        expect(result && 'panel' in result ? result.panel.tagName : '').toBe('DIV');
    });

    it('still reaches a heading that names no tab', () => {
        document.body.innerHTML = `
            <div class="cdx-tab-content">
                <div class="cdx-tab-panel" id="readme"><h4 id="usage">Usage</h4></div>
            </div>`;

        const result = resolveHash('#usage');
        expect(result?.kind).toBe('element');
    });
});
