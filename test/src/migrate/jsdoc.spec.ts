import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { memoryFs } from '../../../src/migrate/fs-adapter';
import { migrateJsdoc, stripRemovedJsdocTags } from '../../../src/migrate/jsdoc';

const strip = (source: string) => stripRemovedJsdocTags('x.ts', source);

/** Native paths below a virtual root, so the walker works on every platform. */
const ROOT = path.resolve('/virtual/p');
const at = (rel: string): string => path.join(ROOT, rel);

describe('migrate jsdoc', () => {
    it('removes a single-line tag and keeps the rest of the block', () => {
        const source =
            '/**\n * A toast.\n *\n * @category ui/feedback\n */\nexport class Toast {}\n';
        expect(strip(source)).toEqual({
            file: 'x.ts',
            output: '/**\n * A toast.\n */\nexport class Toast {}\n',
            removed: 1
        });
    });

    it('removes a tag with its continuation lines up to the next tag', () => {
        const source =
            '/**\n * A toast.\n *\n * @category ui/feedback\n *   and more text\n * @since 1.0.0\n */\n';
        expect(strip(source).output).toBe('/**\n * A toast.\n *\n * @since 1.0.0\n */\n');
    });

    it('drops a block that becomes empty, with its line', () => {
        const source = 'export const a = 1;\n/** @docsKind primary */\nexport const b = 2;\n';
        expect(strip(source)).toEqual({
            file: 'x.ts',
            output: 'export const a = 1;\nexport const b = 2;\n',
            removed: 1
        });
        const multi = '/**\n * @category core\n * @docsKind primary\n */\nexport class C {}\n';
        expect(strip(multi)).toEqual({ file: 'x.ts', output: 'export class C {}\n', removed: 2 });
    });

    it('leaves other tags and files without the tags byte-identical', () => {
        const source =
            '/**\n * Toast.\n *\n * @example\n * ```ts\n * toast();\n * ```\n * @deprecated use alert\n */\n// @category in a line comment\n';
        expect(strip(source)).toEqual({ file: 'x.ts', output: source, removed: 0 });
    });

    it('writes nothing on a dry run', () => {
        const before = '/** @category a */\nexport const a = 1;\n';
        const { adapter, state } = memoryFs({ [at('src/a.ts')]: before });
        const result = migrateJsdoc(ROOT, adapter, true);
        expect(result.removed).toBe(1);
        expect(state[at('src/a.ts')]).toBe(before);
    });

    it('reports changed files and removed tags, skipping node_modules, dist and .d.ts', () => {
        const tagged = '/**\n * @category a\n * @docsKind primary\n */\nexport const a = 1;\n';
        const { adapter, state } = memoryFs({
            [at('src/a.ts')]: tagged,
            [at('src/b.ts')]: 'export const b = 2;\n',
            [at('src/c.d.ts')]: tagged,
            [at('node_modules/x/index.ts')]: tagged,
            [at('dist/a.ts')]: tagged
        });
        const result = migrateJsdoc(ROOT, adapter, false);
        expect(result).toMatchObject({ scanned: 2, removed: 2 });
        expect(result.files.map(file => file.file)).toEqual([at('src/a.ts')]);
        expect(state[at('src/a.ts')]).toBe('export const a = 1;\n');
        expect(state[at('src/c.d.ts')]).toBe(tagged);
        expect(state[at('node_modules/x/index.ts')]).toBe(tagged);
    });
});
