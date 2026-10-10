import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockAccessors } from '../../../../src/templates/blocks/BlockAccessors';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockAccessors', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-accessors section with one row per accessor', () => {
        const html = BlockAccessors({
            depth: 1,
            accessors: {
                value: { getSignature: { returnType: 'number' } }
            },
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-accessors"');
        expect(html).to.include('value');
    });

    it('honours the `block-accessors` custom-template override', () => {
        registerCustomTemplate(
            'block-accessors',
            (data: any) =>
                `<section id="custom-accessors">${Object.keys(data.accessors).join(',')}</section>`
        );
        const html = BlockAccessors({
            depth: 1,
            accessors: {
                a: { getSignature: { returnType: 'number' } },
                b: { setSignature: {} }
            },
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-accessors">a,b</section>');
        expect(html).to.not.include('cdx-io-member');
    });
});
