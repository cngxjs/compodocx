import { HostTree } from '@angular-devkit/schematics';
import { describe, expect, it } from 'vitest';
import { resolveWorkspaceTarget } from '../../../../schematics/ng-add/workspace';

function makeTree(files: { [path: string]: string }): HostTree {
    const tree = new HostTree();
    for (const [path, content] of Object.entries(files)) {
        tree.create(path, content);
    }
    return tree;
}

describe('resolveWorkspaceTarget', () => {
    it('falls back to single-project mode when angular.json is absent', () => {
        const tree = makeTree({ 'package.json': '{}' });
        const result = resolveWorkspaceTarget(tree, '');

        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value).toEqual({
            packageJsonPath: 'package.json',
            tsconfigDocPath: 'tsconfig.doc.json'
        });
    });

    it('uses the single project root when angular.json declares one project', () => {
        const tree = makeTree({
            'package.json': '{}',
            'angular.json': JSON.stringify({
                version: 1,
                projects: {
                    'my-app': { root: '', sourceRoot: 'src', projectType: 'application' }
                }
            })
        });
        const result = resolveWorkspaceTarget(tree, '');

        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value.projectName).toBe('my-app');
        expect(result.value.tsconfigDocPath).toBe('tsconfig.doc.json');
    });

    it('returns the resolved project tsconfig path when --project matches', () => {
        const tree = makeTree({
            'package.json': '{}',
            'angular.json': JSON.stringify({
                version: 1,
                projects: {
                    'app-a': { root: 'projects/a', sourceRoot: 'projects/a/src' },
                    'app-b': { root: 'projects/b', sourceRoot: 'projects/b/src' }
                }
            })
        });
        const result = resolveWorkspaceTarget(tree, 'app-b');

        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value.projectName).toBe('app-b');
        expect(result.value.tsconfigDocPath).toBe('projects/b/tsconfig.doc.json');
    });

    it('errors with the project list when multi-project workspace is missing --project', () => {
        const tree = makeTree({
            'package.json': '{}',
            'angular.json': JSON.stringify({
                version: 1,
                projects: {
                    'app-a': { root: 'projects/a' },
                    'app-b': { root: 'projects/b' }
                }
            })
        });
        const result = resolveWorkspaceTarget(tree, '');

        expect(result.ok).toBe(false);
        if (result.ok === true) {
            return;
        }
        expect(result.message).toContain('Multiple Angular projects');
        expect(result.message).toContain('app-a');
        expect(result.message).toContain('app-b');
        expect(result.message).toContain('--project');
    });

    it('errors when --project does not match any project', () => {
        const tree = makeTree({
            'package.json': '{}',
            'angular.json': JSON.stringify({
                version: 1,
                projects: {
                    'app-a': { root: 'projects/a' },
                    'app-b': { root: 'projects/b' }
                }
            })
        });
        const result = resolveWorkspaceTarget(tree, 'unknown-app');

        expect(result.ok).toBe(false);
        if (result.ok === true) {
            return;
        }
        expect(result.message).toContain("Project 'unknown-app' not found");
        expect(result.message).toContain('app-a');
        expect(result.message).toContain('app-b');
    });

    it('errors with a parse message when angular.json is malformed', () => {
        const tree = makeTree({
            'package.json': '{}',
            'angular.json': '{ "version": 1, "projects": {'
        });
        const result = resolveWorkspaceTarget(tree, '');

        expect(result.ok).toBe(false);
        if (result.ok === true) {
            return;
        }
        expect(result.message).toMatch(/Could not parse angular\.json/);
    });
});
