import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockOutput } from '../../../../src/templates/blocks/BlockOutput';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockOutput', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-outputs section with one row per output', () => {
        const html = BlockOutput({
            depth: 1,
            element: {
                outputsClass: [{ name: 'changed', type: 'EventEmitter<string>' }],
                file: 'foo.ts'
            },
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-outputs"');
        expect(html).to.include('changed');
    });

    it('honours the `block-output` custom-template override', () => {
        registerCustomTemplate(
            'block-output',
            (data: any) =>
                `<section id="custom-outputs">${data.element.outputsClass.length}</section>`
        );
        const html = BlockOutput({
            depth: 1,
            element: { outputsClass: [{ name: 'a' }, { name: 'b' }], file: 'foo.ts' },
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-outputs">2</section>');
        expect(html).to.not.include('cdx-io-member');
    });
});
