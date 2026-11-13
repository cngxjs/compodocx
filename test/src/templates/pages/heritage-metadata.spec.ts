import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import Configuration from '../../../../src/app/configuration';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable } from '../../../../src/app/links';
import { ClassPage } from '../../../../src/templates/pages/ClassPage';
import { PipePage } from '../../../../src/templates/pages/PipePage';
import { ServicePage } from '../../../../src/templates/pages/ServicePage';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const F = 'lib/foo.ts';
const heritage = { extends: ['BaseThing'], implements: ['OnDestroy'] };
const pipe = { name: 'FooPipe', ngname: 'foo', pure: true, file: F, ...heritage };
const service = { name: 'FooService', autoProvided: false, file: F, ...heritage };
const klass = { name: 'FooClass', file: F, ...heritage };
const engine = { pipes: [pipe], services: [service], classes: [klass] };

const navTabs = [{ id: 'info', href: '#info', label: 'Info' }];

const clean = (html: string): string => html.replace(/ __(self|source)="[^"]*"/g, '');

const rows = (html: string): string[] =>
    [...clean(html).matchAll(/<dt class="cdx-metadata-label">([^<]*)<\/dt>/g)].map(m => m[1]);

describe('extends and implements in the metadata card', () => {
    const saved = { ...Configuration.mainData };

    beforeEach(() => {
        Object.assign(Configuration.mainData, {
            symbols: buildSymbolTable(engine as never, { cwd: '/' })
        });
    });

    afterEach(() => {
        Object.assign(Configuration.mainData, { symbols: saved.symbols });
    });

    it('keeps them on a pipe page next to the pipe metadata', () => {
        const html = PipePage({ pipe, depth: 1, navTabs });
        expect(rows(html)).toEqual(['Name', 'Pure', 'Extends', 'Implements']);
        expect(clean(html)).toContain('<span class="cdx-chip">BaseThing</span>');
    });

    it('keeps them on a service page next to the service metadata', () => {
        expect(rows(ServicePage({ service, depth: 1, navTabs }))).toEqual([
            'Auto provided',
            'Extends',
            'Implements'
        ]);
    });

    it('renders them as the same chip rows on a class page', () => {
        const html = ClassPage({ class: klass, depth: 1, navTabs });
        expect(rows(html)).toEqual(['Extends', 'Implements']);
        expect(clean(html)).toContain(
            'href="https://angular.dev/api/core/OnDestroy" target="_blank">OnDestroy</a>'
        );
    });
});
