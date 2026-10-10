import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockHostListener } from '../../../../src/templates/blocks/BlockHostListener';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockHostListener', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-host-listener section with one card per method', () => {
        const html = BlockHostListener({
            depth: 1,
            methods: [{ name: 'onClick', returnType: 'void' }],
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-host-listener"');
        expect(html).to.include('onClick');
    });

    it('honours the `block-host-listener` custom-template override', () => {
        registerCustomTemplate(
            'block-host-listener',
            (data: any) => `<section id="custom-host-listener">${data.methods.length}</section>`
        );
        const html = BlockHostListener({
            depth: 1,
            methods: [{ name: 'a' }, { name: 'b' }],
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-host-listener">2</section>');
        expect(html).to.not.include('cdx-member-card');
    });
});
