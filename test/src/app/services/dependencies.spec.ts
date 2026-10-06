import { beforeEach, describe, expect, it, vi } from 'vitest';

type CtorCall = { files: string[]; options: { tsconfigDirectory: string } };

const ctorCalls: CtorCall[] = [];
const getDependenciesReturn = {
    aliases: {},
    components: [],
    entities: [],
    injectables: [],
    interceptors: [],
    guards: [],
    pipes: [],
    directives: [],
    routes: [],
    classes: [],
    interfaces: [],
    typescriptImports: [],
    miscellaneous: { variables: [], functions: [], typealiases: [], enumerations: [] },
    routesTree: undefined,
    appConfig: []
};

vi.mock('../../../../src/app/compiler/angular-dependencies', () => ({
    AngularDependencies: class {
        constructor(files: string[], options: { tsconfigDirectory: string }) {
            ctorCalls.push({ files, options });
        }
        getDependencies() {
            return getDependenciesReturn;
        }
    }
}));

import {
    crawlDependencies,
    crawlMicroDependencies
} from '../../../../src/app/services/dependencies';

describe('dependencies service', () => {
    beforeEach(() => {
        ctorCalls.length = 0;
    });

    describe('crawlDependencies', () => {
        it('constructs AngularDependencies with the given files and tsconfig directory', () => {
            crawlDependencies(['a.ts', 'b.ts'], { tsconfigDirectory: '/proj' });
            expect(ctorCalls).toHaveLength(1);
            expect(ctorCalls[0].files).toEqual(['a.ts', 'b.ts']);
            expect(ctorCalls[0].options).toEqual({ tsconfigDirectory: '/proj' });
        });

        it('returns the value of getDependencies() verbatim', () => {
            const result = crawlDependencies([], { tsconfigDirectory: '/proj' });
            expect(result).toBe(getDependenciesReturn);
        });

        it('accepts a ReadonlyArray<string> input and copies it into a mutable array', () => {
            const readonlyFiles: ReadonlyArray<string> = ['x.ts'];
            crawlDependencies(readonlyFiles, { tsconfigDirectory: '/proj' });
            // Mutating the constructor-received array does not affect the input
            ctorCalls[0].files.push('y.ts');
            expect(readonlyFiles).toEqual(['x.ts']);
        });

        it('passes the shared source file lookup to the crawler', () => {
            const sharedSourceFile = () => undefined;
            crawlDependencies(['a.ts'], { tsconfigDirectory: '/proj', sharedSourceFile });
            expect(ctorCalls[0].options).toEqual({ tsconfigDirectory: '/proj', sharedSourceFile });
        });

        it('handles an empty files array', () => {
            crawlDependencies([], { tsconfigDirectory: '/proj' });
            expect(ctorCalls[0].files).toEqual([]);
        });
    });

    describe('crawlMicroDependencies', () => {
        it('constructs AngularDependencies with the updated files and tsconfig directory', () => {
            crawlMicroDependencies(['changed.ts'], { tsconfigDirectory: '/proj' });
            expect(ctorCalls).toHaveLength(1);
            expect(ctorCalls[0].files).toEqual(['changed.ts']);
            expect(ctorCalls[0].options).toEqual({ tsconfigDirectory: '/proj' });
        });

        it('returns the value of getDependencies() verbatim', () => {
            const result = crawlMicroDependencies(['changed.ts'], { tsconfigDirectory: '/proj' });
            expect(result).toBe(getDependenciesReturn);
        });

        it('parity with crawlDependencies — same crawler call shape for the same input', () => {
            crawlMicroDependencies(['a.ts'], { tsconfigDirectory: '/proj' });
            const microCall = ctorCalls[0];
            ctorCalls.length = 0;
            crawlDependencies(['a.ts'], { tsconfigDirectory: '/proj' });
            expect(ctorCalls[0]).toEqual(microCall);
        });
    });
});
