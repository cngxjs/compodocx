import { describe, expect, it } from 'vitest';
import { detectLegacyArtefacts, type PackageJsonLike } from '../../../../schematics/ng-add/detect';
import { migrateLegacyArtefacts } from '../../../../schematics/ng-add/migrate';

const PREFIX = 'compodocx';

function migrate(pkg: PackageJsonLike, hasTsconfig = false, prefix = PREFIX) {
    const finding = detectLegacyArtefacts(pkg, hasTsconfig);
    return migrateLegacyArtefacts(pkg, finding, prefix);
}

describe('migrateLegacyArtefacts', () => {
    it('removes @compodoc/compodoc from devDependencies', () => {
        const pkg: PackageJsonLike = {
            devDependencies: { '@compodoc/compodoc': '^1.1.0', typescript: '^5.0.0' }
        };
        const result = migrate(pkg);

        expect(result.removedDeps).toEqual(['@compodoc/compodoc']);
        expect(result.packageJson.devDependencies).toEqual({ typescript: '^5.0.0' });
    });

    it('renames legacy compodoc:* keys to compodocx:* and rewrites their values', () => {
        const pkg: PackageJsonLike = {
            scripts: {
                'compodoc:build': 'compodoc -p tsconfig.doc.json',
                'compodoc:serve': 'compodoc -s'
            }
        };
        const result = migrate(pkg);

        expect(result.renamedScripts.sort((a, b) => a.from.localeCompare(b.from))).toEqual([
            { from: 'compodoc:build', to: 'compodocx:build' },
            { from: 'compodoc:serve', to: 'compodocx:serve' }
        ]);
        expect(result.rewrittenScripts.sort()).toEqual(['compodocx:build', 'compodocx:serve']);
        expect(result.packageJson.scripts).toEqual({
            'compodocx:build': 'compodocx -p tsconfig.doc.json',
            'compodocx:serve': 'compodocx -s'
        });
    });

    it('rewrites bin invocations on scripts that do not use the compodoc:* prefix', () => {
        const pkg: PackageJsonLike = {
            scripts: {
                'docs:build': 'npx compodoc -p tsconfig.doc.json',
                'docs:dev': 'node_modules/.bin/compodoc -s'
            }
        };
        const result = migrate(pkg);

        expect(result.renamedScripts).toEqual([]);
        expect(result.rewrittenScripts.sort()).toEqual(['docs:build', 'docs:dev']);
        expect(result.packageJson.scripts).toEqual({
            'docs:build': 'npx compodocx -p tsconfig.doc.json',
            'docs:dev': 'node_modules/.bin/compodocx -s'
        });
    });

    it('falls back to <key>-legacy when the renamed target collides with an existing key', () => {
        const pkg: PackageJsonLike = {
            scripts: {
                'compodoc:build': 'compodoc -p old.json',
                'compodocx:build': 'compodocx -p new.json'
            }
        };
        const result = migrate(pkg);

        expect(result.renamedScripts).toEqual([
            { from: 'compodoc:build', to: 'compodoc:build-legacy' }
        ]);
        expect(result.packageJson.scripts).toMatchObject({
            'compodoc:build-legacy': 'compodocx -p old.json',
            'compodocx:build': 'compodocx -p new.json'
        });
    });

    it('leaves unrelated scripts untouched', () => {
        const pkg: PackageJsonLike = {
            scripts: {
                'compodoc:build': 'compodoc -p tsconfig.doc.json',
                lint: 'eslint .',
                test: 'vitest run'
            }
        };
        const result = migrate(pkg);

        expect(result.packageJson.scripts).toMatchObject({
            lint: 'eslint .',
            test: 'vitest run'
        });
    });

    it('is idempotent: a second invocation produces zero diff', () => {
        const pkg: PackageJsonLike = {
            devDependencies: { '@compodoc/compodoc': '^1.1.0', typescript: '^5.0.0' },
            scripts: { 'compodoc:build': 'compodoc -p tsconfig.doc.json' }
        };
        const first = migrate(pkg);
        const second = migrate(first.packageJson);

        expect(second.removedDeps).toEqual([]);
        expect(second.renamedScripts).toEqual([]);
        expect(second.rewrittenScripts).toEqual([]);
        expect(second.packageJson).toEqual(first.packageJson);
    });

    it('preserves devDependency ordering when removing the legacy entry', () => {
        const pkg: PackageJsonLike = {
            devDependencies: {
                'first-pkg': '1.0.0',
                '@compodoc/compodoc': '^1.1.0',
                'last-pkg': '2.0.0'
            }
        };
        const result = migrate(pkg);

        expect(Object.keys(result.packageJson.devDependencies ?? {})).toEqual([
            'first-pkg',
            'last-pkg'
        ]);
    });

    it('honours a custom scriptPrefix when renaming and rewriting', () => {
        const pkg: PackageJsonLike = {
            scripts: { 'compodoc:build': 'compodoc -p tsconfig.doc.json' }
        };
        const result = migrate(pkg, false, 'docs');

        expect(result.renamedScripts).toEqual([{ from: 'compodoc:build', to: 'docs:build' }]);
        expect(result.packageJson.scripts).toEqual({
            'docs:build': 'compodocx -p tsconfig.doc.json'
        });
    });

    it('rewrites the binary only in command position, never inside a path', () => {
        const pkg: PackageJsonLike = {
            scripts: {
                'compodoc:build': 'compodoc -p tsconfig.doc.json -d docs/compodoc',
                docs: 'npm run lint && npx compodoc -d ./compodoc-out; compodoc -s'
            }
        };
        const result = migrate(pkg);

        expect(result.packageJson.scripts).toEqual({
            'compodocx:build': 'compodocx -p tsconfig.doc.json -d docs/compodoc',
            docs: 'npm run lint && npx compodocx -d ./compodoc-out; compodocx -s'
        });
    });
});
