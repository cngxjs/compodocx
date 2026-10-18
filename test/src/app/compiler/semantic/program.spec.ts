import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSemanticProgram } from '../../../../../src/app/compiler/semantic';

let root: string;

const write = (file: string, text: string): string => {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
    return full;
};

const program = (rootFiles: readonly string[], tsconfig = 'tsconfig.json') => {
    const created = createSemanticProgram(path.join(root, tsconfig), rootFiles);
    if (created.ok === false) {
        throw new Error(created.message);
    }
    return created.value;
};

let appFile: string;
let libFile: string;

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-semantic-')));
    write(
        'tsconfig.base.json',
        JSON.stringify({
            compilerOptions: { baseUrl: '.', paths: { '@lib/core': ['lib/core.ts'] } }
        })
    );
    write(
        'tsconfig.json',
        JSON.stringify({ extends: './tsconfig.base.json', include: ['src/**/*.ts'] })
    );
    write('tsconfig.broken.json', '{ "extends": "./missing.json" }');
    libFile = write('lib/core.ts', 'export const core = 1;\n');
    write('node_modules/pkg/package.json', JSON.stringify({ name: 'pkg', types: 'index.d.ts' }));
    write('node_modules/pkg/index.d.ts', 'export declare const pkg: number;\n');
    appFile = write(
        'src/app.ts',
        "import { core } from '@lib/core';\nimport { pkg } from 'pkg';\nexport const app = core + pkg;\n"
    );
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const fileNames = (p: ReturnType<typeof program>): string[] =>
    p.getSourceFiles().map(sf => path.relative(root, sf.fileName));

describe('semantic program', () => {
    it('resolves tsconfig paths from an extended config', () => {
        expect(fileNames(program([appFile]))).toContain(path.join('lib', 'core.ts'));
    });

    it('loads nothing from node_modules', () => {
        expect(fileNames(program([appFile])).some(f => f.includes('node_modules'))).toBe(false);
    });

    it('returns err for a tsconfig that cannot be read', () => {
        const created = createSemanticProgram(path.join(root, 'tsconfig.broken.json'), [appFile]);
        expect(created.ok).toBe(false);
    });

    it('reuses unchanged source files of the previous program', () => {
        const first = program([appFile, libFile]);
        const created = createSemanticProgram(
            path.join(root, 'tsconfig.json'),
            [appFile, libFile],
            first
        );
        expect(created.ok && created.value.getSourceFile(libFile)).toBe(
            first.getSourceFile(libFile)
        );
    });

    it('uses the given files as root files, not the tsconfig include list', () => {
        expect(program([libFile]).getRootFileNames()).toEqual([libFile]);
    });
});

// TypeScript 6 reports these as option diagnostics, not as tsconfig errors.
const DEPRECATED_OPTIONS: Record<string, Record<string, unknown>> = {
    'moduleResolution node': { moduleResolution: 'node' },
    'moduleResolution node10': { moduleResolution: 'node10' },
    'moduleResolution classic': { moduleResolution: 'classic' },
    'target ES5': { target: 'ES5' },
    outFile: { outFile: 'out.js', module: 'system' },
    'module amd': { module: 'amd' },
    'module umd': { module: 'umd' },
    'module system': { module: 'system' },
    'esModuleInterop false': { esModuleInterop: false },
    'allowSyntheticDefaultImports false': { allowSyntheticDefaultImports: false },
    'alwaysStrict false': { alwaysStrict: false },
    downlevelIteration: { downlevelIteration: true }
};

describe('semantic program with deprecated tsconfig options', () => {
    it.each(Object.entries(DEPRECATED_OPTIONS))('keeps the program with %s', (name, options) => {
        const file = `tsconfig.${name.replaceAll(' ', '-')}.json`;
        write(file, JSON.stringify({ extends: './tsconfig.base.json', compilerOptions: options }));
        expect(fileNames(program([appFile], file))).toContain(path.join('lib', 'core.ts'));
    });

    it('keeps the program with baseUrl without paths', () => {
        write('tsconfig.base-url.json', JSON.stringify({ compilerOptions: { baseUrl: '.' } }));
        expect(fileNames(program([appFile], 'tsconfig.base-url.json'))).toContain(
            path.join('src', 'app.ts')
        );
    });
});
