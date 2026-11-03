import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { discoverSourceFiles, discoveryPlan } from '../../../../src/app/cli/discover-files';
import { EXCLUDE_PATTERNS, INCLUDE_PATTERNS } from '../../../../src/utils/utils';

describe('discoveryPlan', () => {
    const projectDir = path.join(path.sep, 'project');

    it('uses the default patterns without any include', () => {
        const plan = discoveryPlan({ projectDir, config: {}, tsconfig: {} });

        expect(plan).toEqual({
            seeded: [],
            patterns: INCLUDE_PATTERNS,
            ignore: EXCLUDE_PATTERNS,
            cwd: projectDir
        });
    });

    it('adds the tsconfig selection to the config one; config exclude replaces the defaults', () => {
        const plan = discoveryPlan({
            projectDir,
            config: { include: ['lib/**/*.ts'], exclude: ['**/legacy/**'] },
            tsconfig: { include: ['src/**/*.ts'], exclude: ['**/*.stories.ts'] }
        });

        expect(plan.patterns).toEqual(['lib/**/*.ts', 'src/**/*.ts']);
        expect(plan.ignore).toEqual(['**/legacy/**', '**/*.stories.ts']);
    });

    it('resolves tsconfig files against the tsconfig folder and replaces config files', () => {
        const plan = discoveryPlan({
            projectDir,
            config: { files: ['other.ts'] },
            tsconfig: { files: ['src/main.ts'], include: ['src/**/*.ts'] }
        });
        const main = projectDir + path.sep + 'src/main.ts';

        expect(plan.seeded).toEqual([main]);
        expect(plan.patterns).toEqual(['src/**/*.ts', main]);
    });

    it('keeps config files when the tsconfig has none', () => {
        const plan = discoveryPlan({ projectDir, config: { files: ['a.ts'] }, tsconfig: {} });

        expect(plan.seeded).toEqual(['a.ts']);
        expect(plan.patterns).toEqual(['a.ts']);
    });

    it('globs in the source folder when one is given', () => {
        const plan = discoveryPlan({ projectDir, sourceFolder: 'src', config: {}, tsconfig: {} });

        expect(plan.cwd).toBe('src');
    });
});

describe('discoverSourceFiles', () => {
    let dir = '';

    const write = (file: string) => {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), '');
    };

    beforeAll(() => {
        dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'compodocx-discover-')));
        for (const file of [
            'src/b.ts',
            'src/a.tsx',
            'src/a.spec.ts',
            'src/types.d.ts',
            'src/skip/c.ts',
            'src/notes.md'
        ]) {
            write(file);
        }
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('returns the selected .ts and .tsx files sorted, without the excluded ones', async () => {
        const files = await discoverSourceFiles({
            projectDir: dir,
            config: {},
            tsconfig: { include: ['src/**/*'], exclude: ['src/skip/**'] }
        });

        expect(files).toEqual([path.join(dir, 'src/a.tsx'), path.join(dir, 'src/b.ts')]);
    });

    it('sees a file created after an earlier scan', async () => {
        const input = { projectDir: dir, config: {}, tsconfig: { include: ['src/*.ts'] } };
        const before = await discoverSourceFiles(input);
        write('src/added.ts');

        const after = await discoverSourceFiles(input);

        expect(after).toEqual([...before, path.join(dir, 'src/added.ts')].sort());
    });
});
