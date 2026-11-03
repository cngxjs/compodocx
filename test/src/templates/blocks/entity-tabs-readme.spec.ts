import { beforeAll, describe, expect, it } from 'vitest';

import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { EntityTabs } from '../../../../src/templates/blocks/EntityTabs';
import { ClassPage } from '../../../../src/templates/pages/ClassPage';
import { ComponentPage } from '../../../../src/templates/pages/ComponentPage';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const tab = (id: string) => ({ id, href: `#${id}`, label: id });
const README = '<h1>Store</h1><p>Usage notes.</p>';

/** The README panel of a rendered page, up to the next panel. */
const readmePanel = (html: string): string => {
    const start = html.indexOf('id="readme"');
    expect(start).toBeGreaterThan(-1);
    const next = html.indexOf('class="cdx-tab-panel', start);
    return html.slice(start, next === -1 ? undefined : next);
};

const tabs = (readmeAiGenerated?: string | true) =>
    EntityTabs({
        navTabs: [tab('info'), tab('readme')],
        infoContent: '<p>info</p>',
        readme: README,
        readmeAiGenerated
    });

const componentPage = (symbolReadmeAiGenerated?: string | true, extra = {}) =>
    ComponentPage({
        ...extra,
        component: { name: 'Card', file: 'src/card.ts', selector: 'app-card', readme: README },
        depth: 1,
        navTabs: [tab('info'), tab('readme')],
        symbolReadmeAiGenerated
    });

const classPage = (symbolReadmeAiGenerated?: string | true, extra = {}) =>
    ClassPage({
        ...extra,
        class: { name: 'Helper', file: 'src/helper.ts', readme: README },
        depth: 1,
        navTabs: [tab('info'), tab('readme')],
        symbolReadmeAiGenerated
    });

describe('README tab - @aiGenerated banner', () => {
    it('shows chip and note above the README in EntityTabs', () => {
        const panel = readmePanel(tabs('2026-11'));
        expect(panel).toContain('cdx-ai-generated-banner');
        expect(panel).toContain('cdx-badge--ai-generated');
        expect(panel).toContain('Drafted with AI assistance (2026-11).');
        expect(panel.indexOf('cdx-ai-generated-banner')).toBeLessThan(panel.indexOf('<h1>Store'));
    });

    it('shows the plain note for the bare marker', () => {
        expect(readmePanel(tabs(true))).toContain('Drafted with AI assistance.');
    });

    it('renders no banner without the marker', () => {
        const panel = readmePanel(tabs());
        expect(panel).toContain('<h1>Store</h1>');
        expect(panel).not.toContain('cdx-ai-generated-banner');
    });

    it('shows the banner in the README tab of a component page', () => {
        const panel = readmePanel(componentPage('2026-11'));
        expect(panel).toContain('cdx-ai-generated-banner');
        expect(panel).toContain('Drafted with AI assistance (2026-11).');
    });

    it('leaves the component README tab unchanged without the marker', () => {
        expect(readmePanel(componentPage())).not.toContain('cdx-ai-generated-banner');
    });

    it('shows the banner in the README tab of a class page', () => {
        expect(readmePanel(classPage('2026-11'))).toContain(
            'Drafted with AI assistance (2026-11).'
        );
    });

    it('ignores the marker of the root README in the page data', () => {
        // Page data is laid over the main data, which carries the root README marker.
        const rootMarker = { readmeAiGenerated: '2026-11' };
        expect(readmePanel(componentPage(undefined, rootMarker))).not.toContain(
            'cdx-ai-generated-banner'
        );
        expect(readmePanel(classPage(undefined, rootMarker))).not.toContain(
            'cdx-ai-generated-banner'
        );
    });
});
