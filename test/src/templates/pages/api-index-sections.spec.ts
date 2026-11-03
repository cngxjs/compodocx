import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import Configuration from '../../../../src/app/configuration';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { ClassPage } from '../../../../src/templates/pages/ClassPage';
import { ComponentPage } from '../../../../src/templates/pages/ComponentPage';
import { DEFAULT_API_SECTIONS } from '../../../../src/utils/constants';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const NAV_TABS = [
    { id: 'info', href: '#info', label: 'Info' },
    { id: 'api', href: '#api', label: 'API' }
];

const members = {
    file: 'src/pager.ts',
    inputsClass: [{ name: 'pageSize', type: 'number' }],
    outputsClass: [{ name: 'loadMore', type: 'EventEmitter<void>' }],
    propertiesClass: [
        { name: 'busyLabel', type: 'string', signalKind: 'computed' },
        { name: 'endLabel', type: 'string', signalKind: 'linked-signal' },
        { name: 'items', type: 'string[]' }
    ],
    methodsClass: [{ name: 'reset', args: [], returnType: 'void' }]
};

const pages: Record<string, () => string> = {
    ComponentPage: () =>
        ComponentPage({
            component: { name: 'Pager', selector: 'app-pager', ...members },
            depth: 1,
            navTabs: NAV_TABS
        }),
    ClassPage: () =>
        ClassPage({ class: { name: 'Pager', ...members }, depth: 1, navTabs: NAV_TABS })
};

const indexOf = (html: string): string => {
    const start = html.indexOf('data-compodoc="block-index"');
    expect(start).toBeGreaterThan(-1);
    return html.slice(start, html.indexOf('</section>', start));
};

const deadIndexLinks = (html: string): string[] =>
    [...indexOf(html).matchAll(/href="#([^"]+)"/g)]
        .map(m => m[1])
        .filter(anchor => anchor !== 'index')
        .filter(anchor => !html.includes(`id="${anchor}"`));

describe('API index lists only rendered sections', () => {
    afterEach(() => {
        Configuration.mainData.apiTabSections = [];
    });

    for (const [name, render] of Object.entries(pages)) {
        it(`${name}: drops a section hidden by apiTabSections`, () => {
            Configuration.mainData.apiTabSections = DEFAULT_API_SECTIONS.filter(
                id => id !== 'derivedState'
            );
            const index = indexOf(render());
            expect(index).not.toContain('href="#busyLabel"');
            expect(index).not.toContain('href="#endLabel"');
            expect(index).toContain('href="#items"');
            expect(index).toContain('href="#reset"');
        });

        it(`${name}: every index link has a target on the page`, () => {
            Configuration.mainData.apiTabSections = ['index', 'inputs', 'methods'];
            const html = render();
            expect(indexOf(html)).toContain('href="#pageSize"');
            expect(deadIndexLinks(html)).toEqual([]);
        });

        it(`${name}: the default sections keep every entry`, () => {
            const html = render();
            const index = indexOf(html);
            for (const anchor of ['pageSize', 'loadMore', 'busyLabel', 'items', 'reset']) {
                expect(index).toContain(`href="#${anchor}"`);
            }
            expect(deadIndexLinks(html)).toEqual([]);
        });
    }
});
