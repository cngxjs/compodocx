import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
    cleanSourcesForWatch,
    findMainSourceFolder,
    watchedFilePath
} from '../../../src/utils/utils';

describe('watch sources', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'compodocx-watch-'));

    afterAll(() => {
        fs.rmSync(outside, { recursive: true, force: true });
    });

    it('keeps absolute and relative sources that exist and drops the others', () => {
        const absoluteInCwd = path.resolve('test/fixtures');
        const sources = cleanSourcesForWatch([
            'test',
            outside,
            absoluteInCwd,
            'no-such-folder',
            path.join(outside, 'missing')
        ]);

        expect(sources).toEqual(['test', outside, absoluteInCwd]);
    });

    it('keeps the top folder below the cwd for files inside it', () => {
        const files = [
            path.resolve('test/fixtures/todomvc-ng2/src/main.ts'),
            path.resolve('test/fixtures/todomvc-ng2/src/app/app.component.ts')
        ];

        expect(findMainSourceFolder(files)).toBe('test');
    });

    it('returns the common folder of files outside the cwd', () => {
        const files = [
            path.join(outside, 'src', 'main.ts'),
            path.join(outside, 'src', 'app', 'app.component.ts'),
            path.join(outside, 'src', 'app', 'list', 'list.component.ts')
        ];

        expect(findMainSourceFolder(files)).toBe(path.join(outside, 'src'));
    });

    it('resolves a reported file against the cwd only when it is relative', () => {
        const cwd = process.cwd();

        expect(watchedFilePath(cwd, path.join('docs', 'a.md'))).toBe(
            path.join(cwd, 'docs', 'a.md')
        );
        expect(watchedFilePath(cwd, path.join(outside, 'a.md'))).toBe(path.join(outside, 'a.md'));
    });
});
