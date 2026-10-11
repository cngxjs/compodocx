import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockProperty } from '../../../../src/templates/blocks/BlockProperty';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockProperty', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-properties section with one row per property', () => {
        const html = BlockProperty({
            depth: 1,
            properties: [{ name: 'count', type: 'number' }],
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-properties"');
        expect(html).to.include('cdx-io-member--property');
        expect(html).to.include('count');
    });

    it('honours the `block-property` custom-template override', () => {
        registerCustomTemplate(
            'block-property',
            (data: any) => `<section id="custom-props">${data.properties.length}</section>`
        );
        const html = BlockProperty({
            depth: 1,
            properties: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-props">3</section>');
        expect(html).to.not.include('cdx-io-member');
    });
});
