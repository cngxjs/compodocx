import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockMethod } from '../../../../src/templates/blocks/BlockMethod';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('BlockMethod', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it('renders the default block-methods section with one row per method', () => {
        const html = BlockMethod({
            depth: 1,
            methods: [{ name: 'doThing', returnType: 'void' }],
            file: 'foo.ts'
        });
        expect(html).to.include('data-compodoc="block-methods"');
        expect(html).to.include('cdx-io-member--method');
        expect(html).to.include('doThing');
    });

    it('renders an overloaded method once, with a signature per overload', () => {
        const html = BlockMethod({
            depth: 1,
            methods: [
                {
                    name: 'select',
                    description: '<p>Selects by id.</p>',
                    args: [{ name: 'id', type: 'number' }],
                    overloads: [
                        {
                            name: 'select',
                            description: '<p>Selects a row.</p>',
                            args: [{ name: 'row', type: 'Row' }]
                        }
                    ]
                }
            ],
            file: 'foo.ts'
        });
        expect(html.match(/class="cdx-io-member cdx-io-member--method"/g)).toHaveLength(1);
        expect(html.match(/<pre class="cdx-derived-body"/g)).toHaveLength(2);
        expect(html).to.include('Selects by id.');
        expect(html).to.include('Selects a row.');
        const text = html.replace(/<[^>]+>/g, '');
        expect(text).to.include('select(id: number)');
        expect(text).to.include('select(row: Row)');
    });

    it('honours the `block-method` custom-template override', () => {
        registerCustomTemplate(
            'block-method',
            (data: any) => `<section id="custom-methods">${data.methods.length}</section>`
        );
        const html = BlockMethod({
            depth: 1,
            methods: [{ name: 'a' }, { name: 'b' }],
            file: 'foo.ts'
        });
        expect(html).to.equal('<section id="custom-methods">2</section>');
        expect(html).to.not.include('cdx-io-member');
    });
});
