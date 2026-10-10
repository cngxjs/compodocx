import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockConstructor } from '../../../../src/templates/blocks/BlockConstructor';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockConstructor', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-constructor section', () => {
        const html = BlockConstructor({
            depth: 1,
            constructor: { name: 'constructor', args: [], modifierKind: [] },
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-constructor"');
        expect(html).to.include('id="constructor"');
    });

    it('honours the `block-constructor` custom-template override', () => {
        registerCustomTemplate(
            'block-constructor',
            (data: any) => `<section id="custom-ctor">${data.file}</section>`
        );
        const html = BlockConstructor({
            depth: 1,
            constructor: { name: 'constructor', args: [] },
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-ctor">foo.ts</section>');
        expect(html).to.not.include('cdx-member-card');
    });
});
