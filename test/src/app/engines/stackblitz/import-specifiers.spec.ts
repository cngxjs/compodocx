import { describe, expect, it } from 'vitest';
import { extractBareSpecifiers } from '../../../../../src/app/engines/stackblitz/build-playground-manifest';
import { resolvePackageRoot } from '../../../../../src/app/engines/stackblitz/import-specifiers';
import { extractRawBareSpecifiers } from '../../../../../src/app/engines/stackblitz/vendor';

/**
 * The manifest builder and the vendor pruner share one bare-specifier
 * scanner: the builder keeps package roots, the pruner keeps subpaths.
 */
describe('shared bare-specifier scanner', () => {
    const source = [
        "import { A } from '@scope/kit/button';",
        "import B from 'lodash-es/cloneDeep';",
        "import 'zone.js';",
        "export { C } from '@scope/kit';",
        "export * from './local';",
        "import { D } from '../up';"
    ].join('\n');

    it('gives the same specifiers to both scanners, roots in one and subpaths in the other', () => {
        const raw = extractRawBareSpecifiers(source);
        expect(raw).toEqual(['@scope/kit/button', 'lodash-es/cloneDeep', 'zone.js', '@scope/kit']);
        expect([...extractBareSpecifiers(source)]).toEqual([
            ...new Set(raw.map(resolvePackageRoot))
        ]);
    });

    it.each([
        ['@scope/kit/button', '@scope/kit'],
        ['@scope', '@scope'],
        ['lodash-es/cloneDeep', 'lodash-es'],
        ['rxjs', 'rxjs']
    ])('resolves %s to the package root %s', (spec, root) => {
        expect(resolvePackageRoot(spec)).toBe(root);
    });
});
