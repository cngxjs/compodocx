import { afterEach, describe, expect, it } from 'vitest';
import Configuration, { pageOutputPath } from '../../../src/app/configuration';
import { pageFile } from '../../../src/app/links/layout';

describe('Configuration pages', () => {
    afterEach(() => {
        Configuration.resetPages();
    });

    it('writes a page to its folder and file name, or its name without one', () => {
        expect(pageOutputPath({ name: 'Foo', path: 'components' } as never)).toBe(
            pageFile('components', 'Foo')
        );
        expect(
            pageOutputPath({ name: 'Foo', path: 'components', filename: 'Foo-2' } as never)
        ).toBe(pageFile('components', 'Foo-2'));
        expect(pageOutputPath({ name: 'index' } as never)).toBe(pageFile('', 'index'));
    });

    it('keeps two pages of one name in different folders', () => {
        Configuration.addPage({ name: 'Foo', path: 'components', context: 'component' } as never);
        Configuration.addPage({ name: 'Foo', path: 'interfaces', context: 'interface' } as never);
        expect(Configuration.pages.map(pageOutputPath)).toEqual([
            pageFile('components', 'Foo'),
            pageFile('interfaces', 'Foo')
        ]);
    });

    it('queues one page per output file', () => {
        Configuration.addPage({ name: 'dependencies', context: 'package-dependencies' } as never);
        Configuration.addPage({ name: 'dependencies', context: 'package-dependencies' } as never);
        expect(Configuration.pages).toHaveLength(1);
        expect(Configuration.hasPage(pageFile('', 'dependencies'))).toBe(true);
        expect(Configuration.hasPage(pageFile('', 'other'))).toBe(false);
    });
});
