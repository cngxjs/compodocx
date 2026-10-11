import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockTypealias } from '../../../../src/templates/blocks/BlockTypealias';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockTypealias', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-typealias section with one card per alias', () => {
        const html = BlockTypealias({
            depth: 1,
            typealias: [{ name: 'Foo', rawtype: 'string | number' }]
        });
        expect(html).to.include('data-compodoc="block-typealias"');
        expect(html).to.include('Foo');
    });

    it('honours the `block-typealias` custom-template override', () => {
        registerCustomTemplate(
            'block-typealias',
            (data: any) => `<section id="custom-ta">${data.typealias.length}</section>`
        );
        const html = BlockTypealias({
            depth: 1,
            typealias: [
                { name: 'A', rawtype: 'string' },
                { name: 'B', rawtype: 'number' }
            ]
        });
        expect(html).to.equal('<section id="custom-ta">2</section>');
        expect(html).to.not.include('cdx-member-card');
    });
});
