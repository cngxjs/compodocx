import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockInput } from '../../../../src/templates/blocks/BlockInput';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockInput', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-inputs section with one row per input', () => {
        const html = BlockInput({
            depth: 1,
            element: { inputsClass: [{ name: 'value', type: 'string' }], file: 'foo.ts' },
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-inputs"');
        expect(html).to.include('value');
    });

    it('honours the `block-input` custom-template override', () => {
        registerCustomTemplate(
            'block-input',
            (data: any) =>
                `<section id="custom-inputs">${data.element.inputsClass.length}</section>`
        );
        const html = BlockInput({
            depth: 1,
            element: { inputsClass: [{ name: 'a' }, { name: 'b' }], file: 'foo.ts' },
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-inputs">2</section>');
        expect(html).to.not.include('cdx-io-member');
    });
});
