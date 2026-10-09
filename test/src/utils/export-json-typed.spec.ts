import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FeatureModel } from '../../../src/app/compiler/semantic/features';
import {
    factKey,
    type SemanticModel,
    type SymbolFacts
} from '../../../src/app/compiler/semantic/model';
import {
    exportSemantic,
    miscellaneousWithFacts,
    withSemanticFacts
} from '../../../src/app/engines/export-json.engine';
import {
    EXPORT_SCHEMA_VERSION,
    type ExportComponent,
    type ExportData,
    type ExportInjectable,
    type ExportInterface,
    type ExportPipe
} from '../../../src/app/interfaces/export-data.interface';

/**
 * Real-fixture snapshot. We spawn the CLI against test/fixtures/todomvc-ng2
 * once per spec file, then assert the resulting documentation.json against
 * the typed `ExportData` contract.
 *
 * todomvc is the lightest fixture that has non-empty components, pipes and
 * injectables (all standalone, no NgModules), the union of entity types most downstream
 * consumers (sprint 3 API Diff, sprint 4 llm-md export) will be diffing.
 */

const REPO_ROOT = path.resolve(__dirname, '../../..');
const CLI = path.join(REPO_ROOT, 'bin/index-cli.js');
const FIXTURE_TSCONFIG = path.join(REPO_ROOT, 'test/fixtures/todomvc-ng2/src/tsconfig.json');

let outDir: string;
let snapshot: ExportData;

const spawnExport = (extraArgs: string[]): { stdout: string; stderr: string; status: number } => {
    const result = spawnSync(
        process.execPath,
        [
            CLI,
            '-p',
            FIXTURE_TSCONFIG,
            '-d',
            outDir,
            '--exportFormat',
            'json',
            '--disableSearch',
            ...extraArgs
        ],
        { encoding: 'utf8' }
    );
    return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        status: result.status ?? 0
    };
};

describe('export-json typed snapshot — todomvc fixture', () => {
    beforeAll(() => {
        outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compodocx-typed-export-'));
        const result = spawnExport([]);
        if (result.status !== 0) {
            throw new Error(
                `CLI exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
            );
        }
        const raw = fs.readFileSync(path.join(outDir, 'documentation.json'), 'utf8');
        snapshot = JSON.parse(raw) as ExportData;
    }, 120_000);

    afterAll(() => {
        if (outDir && fs.existsSync(outDir)) {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });

    it('writes schemaVersion = EXPORT_SCHEMA_VERSION', () => {
        expect(snapshot.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    });

    it('writes no category or docsKind field on any entry or member (schema 4)', () => {
        expect(EXPORT_SCHEMA_VERSION).toBe(4);
        const keys: string[] = [];
        const walk = (value: unknown): void => {
            if (Array.isArray(value)) {
                value.forEach(walk);
            } else if (value && typeof value === 'object') {
                for (const [key, child] of Object.entries(value)) {
                    // Raw JSDoc nodes keep their tag names; only compodocx fields count.
                    if (key !== 'jsdoctags') {
                        keys.push(key);
                        walk(child);
                    }
                }
            }
        };
        walk(snapshot);
        expect(keys).not.toContain('category');
        expect(keys).not.toContain('docsKind');
    });

    it('writes a valid ISO 8601 generatedAt timestamp', () => {
        expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(Number.isFinite(Date.parse(snapshot.generatedAt))).toBe(true);
    });

    it('writes a non-empty compodocxVersion', () => {
        expect(typeof snapshot.compodocxVersion).toBe('string');
        expect(snapshot.compodocxVersion.length).toBeGreaterThan(0);
    });

    it('produces non-empty components, pipes, injectables, interfaces and no modules', () => {
        expect(Array.isArray(snapshot.components) && snapshot.components.length).toBeGreaterThan(0);
        // Schema 3 has no modules bucket.
        expect(snapshot).not.toHaveProperty('modules');
        expect(Array.isArray(snapshot.pipes) && snapshot.pipes.length).toBeGreaterThan(0);
        expect(Array.isArray(snapshot.injectables) && snapshot.injectables.length).toBeGreaterThan(
            0
        );
        expect(Array.isArray(snapshot.interfaces) && snapshot.interfaces.length).toBeGreaterThan(0);
    });

    it('components reference shared style sources by key', () => {
        const styleSources = snapshot.styleSources ?? {};
        const keyed = (snapshot.components ?? []).filter(c => c.themeStyleSources?.length);
        expect(keyed.length).toBeGreaterThan(0);
        for (const component of keyed) {
            for (const key of component.themeStyleSources ?? []) {
                expect(typeof key).toBe('string');
                expect(styleSources[key]?.content).toEqual(expect.any(String));
                if (key.includes('#inline-')) {
                    expect(key.startsWith(`${component.file}#inline-`)).toBe(true);
                }
            }
        }
    });

    it('first component has the ExportComponent core fields', () => {
        const c = (snapshot.components ?? [])[0] as ExportComponent;
        expect(typeof c.name).toBe('string');
        expect(typeof c.file).toBe('string');
        expect(c.name.length).toBeGreaterThan(0);
        // Optional fields must hold their expected types when present.
        if (c.encapsulation !== undefined) {
            expect(Array.isArray(c.encapsulation)).toBe(true);
        }
        if (c.standalone !== undefined) {
            expect(typeof c.standalone).toBe('boolean');
        }
        if (c.providers !== undefined) {
            expect(Array.isArray(c.providers)).toBe(true);
        }
    });

    it('standalone component has structured imports', () => {
        const c = (snapshot.components ?? []).find(
            component => component.name === 'TodoComponent'
        ) as ExportComponent;
        expect(Array.isArray(c.imports)).toBe(true);
        const imports = (c.imports ?? []) as ReadonlyArray<{ name: string; type?: string }>;
        for (const el of imports) {
            expect(typeof el.name).toBe('string');
        }
        expect(imports).toContainEqual({ name: 'DoNothingDirective', type: 'directive' });
        expect(imports).toContainEqual({ name: 'FirstUpperPipe', type: 'pipe' });
    });

    it('first pipe has the ExportPipe core fields', () => {
        const p = (snapshot.pipes ?? [])[0] as ExportPipe;
        expect(typeof p.name).toBe('string');
        if (p.standalone !== undefined) {
            expect(typeof p.standalone).toBe('boolean');
        }
    });

    it('first injectable has the ExportInjectable core fields', () => {
        const i = (snapshot.injectables ?? [])[0] as ExportInjectable;
        expect(typeof i.name).toBe('string');
        expect(typeof i.file).toBe('string');
    });

    it('first interface has the ExportInterface core fields', () => {
        const it = (snapshot.interfaces ?? [])[0] as ExportInterface;
        expect(typeof it.name).toBe('string');
    });

    it('default export has indent 0 (single line — no leading whitespace per line)', () => {
        const raw = fs.readFileSync(path.join(outDir, 'documentation.json'), 'utf8');
        const lines = raw.split(/\r?\n/);
        // Single-line JSON.stringify always emits exactly one line.
        expect(lines.length).toBeLessThanOrEqual(2);
        expect(lines[0].startsWith('{')).toBe(true);
    });

    it('--jsonIndent 2 yields a multi-line file with two-space indentation', () => {
        const indentedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compodocx-typed-export-i2-'));
        try {
            const result = spawnSync(
                process.execPath,
                [
                    CLI,
                    '-p',
                    FIXTURE_TSCONFIG,
                    '-d',
                    indentedDir,
                    '--exportFormat',
                    'json',
                    '--jsonIndent',
                    '2',
                    '--disableSearch'
                ],
                { encoding: 'utf8' }
            );
            expect(result.status).toBe(0);
            const file = path.join(indentedDir, 'documentation.json');
            const raw = fs.readFileSync(file, 'utf8');
            const lines = raw.split(/\r?\n/);
            expect(lines.length).toBeGreaterThan(10);
            // schemaVersion sits at the top; the first child line starts with two spaces.
            expect(lines[1].startsWith('  ')).toBe(true);
            expect(lines[1].startsWith('   ')).toBe(false);
        } finally {
            fs.rmSync(indentedDir, { recursive: true, force: true });
        }
    }, 120_000);

    it('--jsonIndent 9 (out of range) exits non-zero and produces no output', () => {
        const failDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compodocx-typed-export-fail-'));
        try {
            const result = spawnSync(
                process.execPath,
                [
                    CLI,
                    '-p',
                    FIXTURE_TSCONFIG,
                    '-d',
                    failDir,
                    '--exportFormat',
                    'json',
                    '--jsonIndent',
                    '9',
                    '--disableSearch'
                ],
                { encoding: 'utf8' }
            );
            expect(result.status).not.toBe(0);
            const errOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;
            expect(errOutput).toMatch(/--jsonIndent.*0 and 8/);
            expect(fs.existsSync(path.join(failDir, 'documentation.json'))).toBe(false);
        } finally {
            fs.rmSync(failDir, { recursive: true, force: true });
        }
    }, 60_000);
});

describe('export-json semantic facts', () => {
    const facts = (overrides: Partial<SymbolFacts>): SymbolFacts => ({
        key: { name: 'provideFoo', file: 'src/foo.ts' },
        exportedBy: [],
        notExported: false,
        usedBy: [],
        ...overrides
    });
    const model = (entries: SymbolFacts[]): SemanticModel => ({
        entryPoints: [],
        facts: new Map(entries.map(f => [factKey(f.key), f])),
        summary: {
            entryPoints: 0,
            providers: 0,
            features: 0,
            injectionContext: { direct: 0, viaCall: 0, unresolved: 0 },
            notExported: 0
        }
    });
    const entry = { name: 'provideFoo', file: 'src/foo.ts', description: 'Provides foo.' };

    it('appends the facts of a symbol joined by file and name', () => {
        const withFacts = withSemanticFacts(
            entry,
            model([
                facts({
                    entryPoint: '@lib/foo',
                    exportedBy: ['@lib/foo'],
                    usedBy: [{ name: 'bar', file: 'src/bar.ts' }],
                    di: {
                        role: 'provider',
                        providesTokens: [{ name: 'FOO', file: 'src/tokens.ts' }],
                        readsTokens: []
                    }
                })
            ])
        );
        expect(withFacts).toEqual({
            ...entry,
            entryPoint: '@lib/foo',
            exportedBy: ['@lib/foo'],
            usedBy: [{ name: 'bar', file: 'src/bar.ts' }],
            di: { role: 'provider', providesTokens: [{ name: 'FOO', file: 'src/tokens.ts' }] }
        });
        expect(entry).not.toHaveProperty('di');
    });

    it('returns the entry itself when the symbol has no facts', () => {
        expect(withSemanticFacts(entry, model([]))).toBe(entry);
        expect(withSemanticFacts(entry, model([facts({})]))).toBe(entry);
    });

    it('keeps the sorted order of the model lists', () => {
        const usedBy = [
            { name: 'a', file: 'src/a.ts' },
            { name: 'b', file: 'src/a.ts' },
            { name: 'a', file: 'src/b.ts' }
        ];
        const result = withSemanticFacts(entry, model([facts({ usedBy })])) as { usedBy?: unknown };
        expect(result.usedBy).toEqual(usedBy);
    });

    it('writes no false flags and no empty lists, also in grouped lists', () => {
        const misc = miscellaneousWithFacts(
            { functions: [entry], groupedFunctions: { 'src/foo.ts': [entry] } },
            model([facts({ notExported: true, di: { providesTokens: [], readsTokens: [] } })])
        ) as { functions: object[]; groupedFunctions: Record<string, object[]> };
        expect(misc.functions[0]).toEqual({ ...entry, notExported: true });
        expect(misc.groupedFunctions['src/foo.ts'][0]).toEqual({ ...entry, notExported: true });
    });

    it('joins a const and a type of one name to their own facts by list kind', () => {
        const pair = { name: 'Mode', file: 'src/mode.ts' };
        const both = model([
            facts({ key: pair, usedBy: [{ name: 'value', file: 'src/a.ts' }] }),
            facts({ key: { ...pair, space: 'type' }, usedBy: [{ name: 'type', file: 'src/a.ts' }] })
        ]);
        const misc = miscellaneousWithFacts({ variables: [pair], typealiases: [pair] }, both) as {
            variables: { usedBy: object[] }[];
            typealiases: { usedBy: object[] }[];
        };
        expect(misc.variables[0].usedBy).toEqual([{ name: 'value', file: 'src/a.ts' }]);
        expect(misc.typealiases[0].usedBy).toEqual([{ name: 'type', file: 'src/a.ts' }]);
    });

    const features: FeatureModel = {
        features: [
            {
                id: '@lib/foo#',
                entryPoint: '@lib/foo',
                key: '',
                label: 'foo',
                root: 'src',
                detector: 'entry-point',
                readme: 'src/README.md'
            },
            {
                id: '@lib/ui#panel',
                entryPoint: '@lib/ui',
                key: 'panel',
                label: 'panel',
                root: 'ui/panel',
                detector: 'cohesion'
            },
            { id: '#app', key: 'app', label: 'app', root: 'app', detector: 'folder' }
        ],
        featureOf: new Map([['src/foo.ts#provideFoo', '@lib/foo#']]),
        families: [{ from: '@lib/ui#panel', to: '@lib/foo#', reason: 'wraps', edges: 3 }]
    };

    it('writes the feature of a symbol next to its other facts', () => {
        const withFeatures = { ...model([facts({ entryPoint: '@lib/foo' })]), features };
        expect(withSemanticFacts(entry, withFeatures)).toEqual({
            ...entry,
            entryPoint: '@lib/foo',
            feature: { entryPoint: '@lib/foo', key: '' }
        });
    });

    it('lists every feature with its builds on and extended by links', () => {
        const semantic = exportSemantic({ ...model([]), features });
        expect(semantic.features).toEqual([
            {
                id: '@lib/foo#',
                entryPoint: '@lib/foo',
                key: '',
                label: 'foo',
                detector: 'entry-point',
                readme: 'src/README.md',
                buildsOn: [],
                extendedBy: ['@lib/ui#panel']
            },
            {
                id: '@lib/ui#panel',
                entryPoint: '@lib/ui',
                key: 'panel',
                label: 'panel',
                detector: 'cohesion',
                buildsOn: ['@lib/foo#'],
                extendedBy: []
            },
            {
                id: '#app',
                key: 'app',
                label: 'app',
                detector: 'folder',
                buildsOn: [],
                extendedBy: []
            }
        ]);
        expect(exportSemantic(model([]))).not.toHaveProperty('features');
    });
});
