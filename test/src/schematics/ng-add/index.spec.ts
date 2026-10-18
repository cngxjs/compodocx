import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const COLLECTION_PATH = path.join(REPO_ROOT, 'dist', 'collection.json');

interface ScriptedPackageJson {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

function makeTree(files: { [filePath: string]: string }): Tree {
    const tree = Tree.empty();
    for (const [filePath, content] of Object.entries(files)) {
        tree.create(filePath, content);
    }
    return tree;
}

function readJson<T>(tree: { readContent: (path: string) => string }, filePath: string): T {
    return JSON.parse(tree.readContent(filePath)) as T;
}

describe('ng-add schematic', () => {
    let runner: SchematicTestRunner;

    beforeAll(() => {
        if (!existsSync(COLLECTION_PATH)) {
            execSync('npm run build-schematics', { cwd: REPO_ROOT, stdio: 'inherit' });
        }
    });

    beforeEach(() => {
        runner = new SchematicTestRunner('cngxjs-compodocx', COLLECTION_PATH);
    });

    it('adds compodocx scripts, tsconfig.doc.json, and an install task on a clean tree', async () => {
        const tree = makeTree({ 'package.json': JSON.stringify({ name: 'clean-app' }) });
        const result = await runner.runSchematic('ng-add', {}, tree);

        const pkg = readJson<ScriptedPackageJson>(result, 'package.json');
        expect(pkg.scripts).toEqual({
            'compodocx:build': 'compodocx -p tsconfig.doc.json',
            'compodocx:build-and-serve': 'compodocx -p tsconfig.doc.json -s',
            'compodocx:serve': 'compodocx -s'
        });
        expect(result.exists('tsconfig.doc.json')).toBe(true);
        const installTasks = runner.tasks.filter(t => t.name === 'node-package');
        expect(installTasks).toHaveLength(1);
    });

    it('sets up an Angular 22 workspace on TypeScript 6 without touching its dependencies', async () => {
        const dependencies = { '@angular/core': '^22.2.0', '@angular/common': '^22.2.0' };
        const devDependencies = { '@angular/cli': '^22.2.0', typescript: '~6.0.2' };
        const tree = makeTree({
            'package.json': JSON.stringify({ name: 'app-22', dependencies, devDependencies })
        });
        const result = await runner.runSchematic('ng-add', {}, tree);

        const pkg = readJson<ScriptedPackageJson>(result, 'package.json');
        expect(pkg.dependencies).toEqual(dependencies);
        expect(pkg.devDependencies).toEqual(devDependencies);
        expect(pkg.scripts?.['compodocx:build']).toBe('compodocx -p tsconfig.doc.json');
        // No compiler options: nothing TypeScript 6 deprecates (baseUrl, moduleResolution node).
        expect(readJson<Record<string, unknown>>(result, 'tsconfig.doc.json')).toEqual({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts']
        });
    });

    it('migrates a legacy tree end-to-end', async () => {
        const tree = makeTree({
            'package.json': JSON.stringify({
                name: 'legacy-app',
                devDependencies: { '@compodoc/compodoc': '^1.1.0', typescript: '^5.0.0' },
                scripts: {
                    'compodoc:build': 'compodoc -p tsconfig.doc.json',
                    'compodoc:serve': 'compodoc -s',
                    lint: 'eslint .'
                }
            })
        });
        const result = await runner.runSchematic('ng-add', {}, tree);

        const pkg = readJson<ScriptedPackageJson>(result, 'package.json');
        expect(pkg.devDependencies).toEqual({ typescript: '^5.0.0' });
        expect(pkg.scripts).toMatchObject({
            'compodocx:build': 'compodocx -p tsconfig.doc.json',
            'compodocx:serve': 'compodocx -s',
            lint: 'eslint .'
        });
        expect(pkg.scripts).not.toHaveProperty('compodoc:build');
        expect(pkg.scripts).not.toHaveProperty('compodoc:serve');
    });

    it('--skipMigration leaves legacy artefacts untouched while still adding new scripts', async () => {
        const tree = makeTree({
            'package.json': JSON.stringify({
                name: 'legacy-app',
                devDependencies: { '@compodoc/compodoc': '^1.1.0' },
                scripts: { 'compodoc:build': 'compodoc -p tsconfig.doc.json' }
            })
        });
        const result = await runner.runSchematic('ng-add', { skipMigration: true }, tree);

        const pkg = readJson<ScriptedPackageJson>(result, 'package.json');
        expect(pkg.devDependencies).toEqual({ '@compodoc/compodoc': '^1.1.0' });
        expect(pkg.scripts).toMatchObject({
            'compodoc:build': 'compodoc -p tsconfig.doc.json',
            'compodocx:build': 'compodocx -p tsconfig.doc.json'
        });
    });

    it('honours --project by writing the scoped tsconfig path into the scripts', async () => {
        const tree = makeTree({
            'package.json': JSON.stringify({ name: 'workspace-root' }),
            'angular.json': JSON.stringify({
                version: 1,
                projects: {
                    'app-a': { root: 'projects/a', sourceRoot: 'projects/a/src' },
                    'app-b': { root: 'projects/b', sourceRoot: 'projects/b/src' }
                }
            })
        });
        const result = await runner.runSchematic('ng-add', { project: 'app-b' }, tree);

        const pkg = readJson<ScriptedPackageJson>(result, 'package.json');
        expect(pkg.scripts).toMatchObject({
            'compodocx:build': 'compodocx -p projects/b/tsconfig.doc.json',
            'compodocx:build-and-serve': 'compodocx -p projects/b/tsconfig.doc.json -s'
        });
        expect(result.exists('projects/b/tsconfig.doc.json')).toBe(true);
    });

    it('--scriptPrefix compodoc reproduces the legacy script names without rewriting', async () => {
        const tree = makeTree({ 'package.json': JSON.stringify({ name: 'legacy-prefix-app' }) });
        const result = await runner.runSchematic('ng-add', { scriptPrefix: 'compodoc' }, tree);

        const pkg = readJson<ScriptedPackageJson>(result, 'package.json');
        expect(pkg.scripts).toEqual({
            'compodoc:build': 'compodoc -p tsconfig.doc.json',
            'compodoc:build-and-serve': 'compodoc -p tsconfig.doc.json -s',
            'compodoc:serve': 'compodoc -s'
        });
    });

    it('is idempotent — a second run produces zero diff in the package.json', async () => {
        const tree = makeTree({
            'package.json': JSON.stringify({
                name: 'legacy-app',
                devDependencies: { '@compodoc/compodoc': '^1.1.0' },
                scripts: { 'compodoc:build': 'compodoc -p tsconfig.doc.json' }
            })
        });
        const first = await runner.runSchematic('ng-add', {}, tree);
        const firstPkg = first.readContent('package.json');
        const firstTsconfig = first.readContent('tsconfig.doc.json');

        const second = await runner.runSchematic('ng-add', {}, first);
        expect(second.readContent('package.json')).toBe(firstPkg);
        expect(second.readContent('tsconfig.doc.json')).toBe(firstTsconfig);
    });

    it('throws when a multi-project workspace runs without --project', async () => {
        const tree = makeTree({
            'package.json': JSON.stringify({ name: 'workspace-root' }),
            'angular.json': JSON.stringify({
                version: 1,
                projects: {
                    'app-a': { root: 'projects/a' },
                    'app-b': { root: 'projects/b' }
                }
            })
        });
        await expect(runner.runSchematic('ng-add', {}, tree)).rejects.toThrow(
            /Multiple Angular projects.*app-a.*app-b.*--project/
        );
    });

    it('leaves an existing tsconfig.doc.json intact and only updates scripts', async () => {
        const customTsconfig = '{\n  "include": ["custom/**/*.ts"]\n}\n';
        const tree = makeTree({
            'package.json': JSON.stringify({ name: 'preserve-tsconfig' }),
            'tsconfig.doc.json': customTsconfig
        });
        const result = await runner.runSchematic('ng-add', {}, tree);

        expect(result.readContent('tsconfig.doc.json')).toBe(customTsconfig);
        const pkg = readJson<ScriptedPackageJson>(result, 'package.json');
        expect(pkg.scripts).toMatchObject({
            'compodocx:build': 'compodocx -p tsconfig.doc.json'
        });
    });
});
