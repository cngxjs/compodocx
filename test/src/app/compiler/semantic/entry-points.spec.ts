import * as path from 'node:path';

import fg from 'fast-glob';
import { beforeAll, describe, expect, it } from 'vitest';

import {
    buildSemanticModel,
    createSemanticProgram,
    type SemanticModel,
    type SymbolFacts
} from '../../../../../src/app/compiler/semantic';

const CWD = process.cwd();
const FIXTURE = path.join(CWD, 'test/fixtures/semantic-library');
const TSCONFIG = path.join(FIXTURE, 'tsconfig.json');
const REL = 'test/fixtures/semantic-library';

let model: SemanticModel;

const facts = (file: string, name: string, space = ''): SymbolFacts | undefined =>
    model.facts.get(`${space}${REL}/${file}#${name}`);

beforeAll(() => {
    const files = fg.sync('projects/**/*.ts', { cwd: FIXTURE, absolute: true }).sort();
    const created = createSemanticProgram(TSCONFIG, files);
    if (!created.ok) {
        throw new Error(created.message);
    }
    model = buildSemanticModel(created.value, TSCONFIG, CWD);
});

describe('semantic entry points', () => {
    it('finds primary and secondary ng-package entry points', () => {
        const ngPackage = model.entryPoints.filter(e => e.source === 'ng-package');
        expect(ngPackage.map(e => [e.importPath, e.file])).toEqual([
            ['@sem/core', `${REL}/projects/core/src/public-api.ts`],
            ['@sem/core/select', `${REL}/projects/core/select/src/public-api.ts`],
            ['@sem/core/tokens', `${REL}/projects/core/tokens/src/public-api.ts`],
            ['@sem/ui', `${REL}/projects/ui/src/public-api.ts`]
        ]);
    });

    it('takes the import path from the nearest package.json', () => {
        const tokens = model.entryPoints.find(e =>
            e.file.endsWith('core/tokens/src/public-api.ts')
        );
        expect(tokens?.importPath).toBe('@sem/core/tokens');
        expect(tokens?.root).toBe(`${REL}/projects/core/tokens`);
    });

    it('adds barrel-shaped tsconfig paths targets without an ng-package.json', () => {
        const paths = model.entryPoints.filter(e => e.source === 'tsconfig-paths');
        expect(paths.map(e => e.importPath)).toEqual(['@sem/testing']);
        expect(facts('projects/testing/harness.ts', 'SemHarness')?.entryPoint).toBe('@sem/testing');
    });

    it('ignores a paths alias to a file that is not a barrel', () => {
        expect(model.entryPoints.map(e => e.importPath)).not.toContain('@sem/env');
    });

    it('assigns a symbol exported by two barrels to the nearest one', () => {
        const normalize = facts('projects/core/tokens/src/tokens.ts', 'normalizeLabel');
        expect(normalize?.exportedBy).toEqual(['@sem/core', '@sem/core/tokens']);
        expect(normalize?.entryPoint).toBe('@sem/core/tokens');
    });

    it('follows export * chains', () => {
        const format = facts('projects/core/src/foo/foo.ts', 'formatFoo');
        expect(format?.exportedBy).toEqual(['@sem/core']);
        expect(format?.entryPoint).toBe('@sem/core');
    });

    it('follows a named re-export through a paths alias', () => {
        expect(
            facts('projects/core/tokens/src/tokens.ts', 'FooConfig', 'type:')?.exportedBy
        ).toEqual(['@sem/core/tokens']);
        expect(facts('projects/ui/src/button/button.ts', 'SemButton')?.entryPoint).toBe('@sem/ui');
    });

    it('flags an exported symbol that reaches no barrel', () => {
        const orphan = facts('projects/core/src/foo/foo-helpers.ts', 'orphanFoo');
        expect(orphan?.notExported).toBe(true);
        expect(orphan?.entryPoint).toBeUndefined();
    });

    it('does not flag an @internal symbol', () => {
        expect(facts('projects/core/src/foo/foo-helpers.ts', 'internalFoo')?.notExported).toBe(
            false
        );
    });

    it('gives a file outside every entry point neither an entry point nor the flag', () => {
        const env = facts('projects/env/environment.ts', 'environment');
        expect(env?.entryPoint).toBeUndefined();
        expect(env?.notExported).toBe(false);
    });
});
