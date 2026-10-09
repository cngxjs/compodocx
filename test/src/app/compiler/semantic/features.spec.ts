import { describe, expect, it } from 'vitest';

import {
    DEFAULT_FEATURE_CONTAINERS,
    DEFAULT_FEATURE_UTILITY_FOLDERS,
    detectFeatures,
    type EntryPoint,
    type FeatureConfig,
    type FeatureInput
} from '../../../../../src/app/compiler/semantic';

const lib = (importPath: string, root: string): EntryPoint => ({
    importPath,
    file: `${root}/src/public-api.ts`,
    root,
    source: 'ng-package'
});

const CONFIG: FeatureConfig = {
    features: {},
    containers: DEFAULT_FEATURE_CONTAINERS,
    utilityFolders: DEFAULT_FEATURE_UTILITY_FOLDERS
};

interface Case {
    readonly files: readonly string[];
    readonly entryPoints?: readonly EntryPoint[];
    readonly edges?: Readonly<Record<string, readonly string[]>>;
    readonly tags?: Readonly<Record<string, string>>;
    readonly config?: Partial<FeatureConfig>;
    readonly dirs?: readonly string[];
}

/** One symbol per file, named after the file. */
const detect = (c: Case) => {
    const input: FeatureInput = {
        symbols: c.files.map(file => ({ key: `${file}#S`, file, tag: c.tags?.[file] })),
        files: c.files,
        entryPoints: c.entryPoints ?? [],
        imports: { edges: new Map(Object.entries(c.edges ?? {})) },
        config: { ...CONFIG, ...c.config },
        fs: {
            isDirectory: dir => (c.dirs ?? []).includes(dir),
            isFile: () => false,
            packageName: () => undefined
        }
    };
    const result = detectFeatures(input);
    const of = (file: string) => result.model.featureOf.get(`${file}#S`);
    return { ...result, of };
};

const P = 'p/select';
const SELECT = lib('@x/select', P);
const f = (folder: string, name = 'a') => `${P}/src/${folder}/${name}.ts`;

describe('feature detection', () => {
    it('lets the config map win over a tag', () => {
        const r = detect({
            files: [f('one')],
            entryPoints: [SELECT],
            tags: { [f('one')]: 'tagged' },
            config: { features: { 'p/select/src/one/**': 'configured' } }
        });
        expect(r.of(f('one'))).toBe('@x/select#configured');
        expect(r.model.features[0].detector).toBe('config');
    });

    it('lets a tag win over the cohesion rule', () => {
        const r = detect({
            files: [f('one'), f('two')],
            entryPoints: [SELECT],
            tags: { [f('one')]: 'picked' }
        });
        expect(r.of(f('one'))).toBe('@x/select#picked');
        expect(r.of(f('two'))).toBe('@x/select#two');
    });

    it('warns about an invalid key and falls through to the next detector', () => {
        const r = detect({
            files: [f('one'), f('two')],
            entryPoints: [SELECT],
            tags: { [f('one')]: 'Not Valid' },
            config: { features: { 'p/select/src/two/**': 'Bad_Key' } }
        });
        expect(r.of(f('one'))).toBe('@x/select#one');
        expect(r.of(f('two'))).toBe('@x/select#two');
        expect(r.warnings).toHaveLength(2);
        expect(r.warnings[0]).toContain('"Not Valid"');
    });

    it('glues an entry point into one feature when a folder is imported by half of the others', () => {
        const files = [f('shared'), f('listbox'), f('trigger'), f('panel'), f('chips')];
        const edges = Object.fromEntries(files.slice(1).map(file => [file, [f('shared')]]));
        const r = detect({ files, entryPoints: [SELECT], edges });
        expect(new Set(files.map(r.of))).toEqual(new Set(['@x/select#']));
        expect(r.model.features).toHaveLength(1);
        expect(r.model.features[0]).toMatchObject({
            key: '',
            label: 'select',
            detector: 'entry-point'
        });
    });

    it('joins folders on mutual edges or edges from two file pairs', () => {
        const r = detect({
            files: [f('menu'), f('menu-item'), f('tree'), f('tree-node'), f('tree-node', 'b')],
            entryPoints: [SELECT],
            edges: {
                [f('menu')]: [f('menu-item')],
                [f('menu-item')]: [f('menu')],
                [f('tree-node')]: [f('tree')],
                [f('tree-node', 'b')]: [f('tree')]
            }
        });
        expect(r.of(f('menu-item'))).toBe('@x/select#menu');
        expect(r.of(f('tree-node', 'b'))).toBe('@x/select#tree');
        expect(r.model.features.map(x => x.key)).toEqual(['menu', 'tree']);
    });

    it('does not join folders on a single one-way edge', () => {
        const r = detect({
            files: [f('copy'), f('ripple')],
            entryPoints: [SELECT],
            edges: { [f('copy')]: [f('ripple')] }
        });
        expect(r.model.features.map(x => x.key)).toEqual(['copy', 'ripple']);
        expect(r.model.features.every(x => x.detector === 'cohesion')).toBe(true);
    });

    it('folds utility folders and root files into the root feature', () => {
        const r = detect({
            files: [f('utils'), f('i18n'), `${P}/src/version.ts`, f('slider')],
            entryPoints: [SELECT]
        });
        expect(r.of(f('utils'))).toBe('@x/select#');
        expect(r.of(f('i18n'))).toBe('@x/select#');
        expect(r.of(`${P}/src/version.ts`)).toBe('@x/select#');
        expect(r.of(f('slider'))).toBe('@x/select#slider');
    });

    it('never treats a nested entry point as a folder of its parent', () => {
        const core = lib('@x/core', 'p/core');
        const tokens = lib('@x/core/tokens', 'p/core/tokens');
        const r = detect({
            files: ['p/core/src/di/a.ts', 'p/core/src/foo/a.ts', 'p/core/tokens/src/tokens.ts'],
            entryPoints: [core, tokens]
        });
        expect(r.of('p/core/tokens/src/tokens.ts')).toBe('@x/core/tokens#');
        expect(r.model.features.map(x => x.id)).toEqual([
            '@x/core#di',
            '@x/core#foo',
            '@x/core/tokens#'
        ]);
    });

    it('takes app features from the first folder below src/app, descending into containers', () => {
        const r = detect({
            files: [
                'app/src/app/app.ts',
                'app/src/app/core/auth.ts',
                'app/src/app/features/admin/panel.ts',
                'app/src/app/features/users/list/list.ts',
                'app/src/main.ts'
            ],
            dirs: ['app/src/app']
        });
        expect(r.of('app/src/app/app.ts')).toBe('#');
        expect(r.of('app/src/app/core/auth.ts')).toBe('#core');
        expect(r.of('app/src/app/features/admin/panel.ts')).toBe('#admin');
        expect(r.of('app/src/app/features/users/list/list.ts')).toBe('#users');
        expect(r.of('app/src/main.ts')).toBe('#');
        expect(r.model.features.find(x => x.key === '')?.label).toBe('app');
        expect(r.model.features.every(x => x.detector === 'folder')).toBe(true);
    });

    it('groups library files outside every entry point by their folder', () => {
        const ui = lib('@x/ui', 'w/ui/button');
        const r = detect({
            files: ['w/ui/button/src/button.ts', 'w/ui/src/lib/version.ts', 'w/env/environment.ts'],
            entryPoints: [ui]
        });
        expect(r.of('w/ui/src/lib/version.ts')).toBe('#ui');
        expect(r.of('w/env/environment.ts')).toBe('#env');
        expect(r.model.features.find(x => x.id === '#env')?.entryPoint).toBeUndefined();
    });
});
