import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockEnum } from '../../../../src/templates/blocks/BlockEnum';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockEnum', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-enums section with one card per enum', () => {
        const html = BlockEnum({
            depth: 1,
            enums: [{ name: 'Color', childs: [{ name: 'Red', value: '0' }] }]
        });
        expect(html).to.include('data-compodoc="block-enums"');
        expect(html).to.include('Color');
        expect(html).to.include('Red');
    });

    it('escapes member values', () => {
        const html = BlockEnum({
            depth: 1,
            enums: [{ name: 'Markup', childs: [{ name: 'Bold', value: '<b>' }] }]
        });
        expect(html).to.include('<code>&lt;b></code>');
        expect(html).to.not.include('<code><b></code>');
    });

    it('honours the `block-enum` custom-template override', () => {
        registerCustomTemplate(
            'block-enum',
            (data: any) => `<section id="custom-enum">${data.enums.length}</section>`
        );
        const html = BlockEnum({
            depth: 1,
            enums: [{ name: 'A' }, { name: 'B' }]
        });
        expect(html).to.equal('<section id="custom-enum">2</section>');
        expect(html).to.not.include('cdx-member-card');
    });
});
