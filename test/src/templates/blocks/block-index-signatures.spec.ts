import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockIndexSignatures } from '../../../../src/templates/blocks/BlockIndexSignatures';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockIndexSignatures', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-indexables section with one row per indexable', () => {
        const html = BlockIndexSignatures({
            depth: 1,
            indexables: [
                { name: 'idx', returnType: 'string', args: [{ name: 'key', type: 'string' }] }
            ],
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-indexables"');
    });

    it('honours the `block-index-signatures` custom-template override', () => {
        registerCustomTemplate(
            'block-index-signatures',
            (data: any) => `<section id="custom-idx">${data.indexables.length}</section>`
        );
        const html = BlockIndexSignatures({
            depth: 1,
            indexables: [
                { name: 'a', returnType: 'string', args: [{ name: 'k', type: 'string' }] },
                { name: 'b', returnType: 'number', args: [{ name: 'k', type: 'string' }] }
            ],
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-idx">2</section>');
        expect(html).to.not.include('cdx-io-member');
    });
});
