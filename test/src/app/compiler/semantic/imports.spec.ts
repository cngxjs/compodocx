import * as path from 'node:path';

import fg from 'fast-glob';
import { beforeAll, describe, expect, it } from 'vitest';

import {
    buildImportGraph,
    createSemanticProgram,
    type ImportGraph
} from '../../../../../src/app/compiler/semantic';

const CWD = process.cwd();
const FIXTURE = path.join(CWD, 'test/fixtures/semantic-library');
const TSCONFIG = path.join(FIXTURE, 'tsconfig.json');
const REL = 'test/fixtures/semantic-library/projects';

let graph: ImportGraph;

const importsOf = (file: string): readonly string[] | undefined =>
    graph.edges.get(`${REL}/${file}`)?.map(target => target.slice(REL.length + 1));

beforeAll(() => {
    const files = fg.sync('projects/**/*.ts', { cwd: FIXTURE, absolute: true }).sort();
    const created = createSemanticProgram(TSCONFIG, files);
    if (!created.ok) {
        throw new Error(created.message);
    }
    graph = buildImportGraph(created.value, files, CWD);
});

describe('semantic import graph', () => {
    it('follows relative imports, type-only ones included', () => {
        expect(importsOf('core/select/src/listbox/listbox.ts')).toEqual([
            'core/select/src/shared/select-state.ts'
        ]);
        expect(importsOf('core/tokens/src/di-tokens.ts')).toEqual(['core/tokens/src/tokens.ts']);
    });

    it('resolves path-mapped specifiers to the mapped file', () => {
        expect(importsOf('ui/src/button/button.ts')).toEqual(['core/src/public-api.ts']);
        expect(importsOf('ui/src/select-field/select-field.ts')).toEqual([
            'core/select/src/public-api.ts'
        ]);
    });

    it('counts export ... from declarations', () => {
        expect(importsOf('core/src/public-api.ts')).toEqual([
            'core/src/di/foo.inject.ts',
            'core/src/di/foo.providers.ts',
            'core/src/foo/foo.ts',
            'core/src/routes/foo.routes.ts',
            'core/tokens/src/public-api.ts'
        ]);
    });

    it('drops packages outside the project', () => {
        expect(importsOf('ui/src/foo-panel/foo-panel.ts')).toEqual(['core/src/public-api.ts']);
        const targets = [...graph.edges.values()].flat();
        expect(targets.some(target => target.includes('node_modules'))).toBe(false);
        expect(targets.every(target => target.startsWith(`${REL}/`))).toBe(true);
    });
});
