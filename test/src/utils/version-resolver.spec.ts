import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveVersion } from '../../../src/utils/version-resolver.util';

let tempRoot: string;

beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'version-resolver-'));
});

afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
});

function writePackageJson(dir: string, version?: string): void {
    mkdirSync(dir, { recursive: true });
    const body = version === undefined ? { name: 'demo' } : { name: 'demo', version };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(body));
}

describe('resolveVersion', () => {
    it('uses the explicit --versionLabel when provided', () => {
        writePackageJson(tempRoot, '1.2.3');
        const result = resolveVersion({
            explicitLabel: 'main',
            outputFolder: join(tempRoot, 'docs'),
            projectRoot: tempRoot
        });
        expect(result).toEqual({
            ok: true,
            value: {
                label: 'main',
                folder: resolve(tempRoot, 'docs', 'main'),
                root: resolve(tempRoot, 'docs')
            }
        });
    });

    it('reads version from the nearest package.json walking up from projectRoot', () => {
        writePackageJson(tempRoot, '1.2.3');
        const nested = join(tempRoot, 'apps', 'docs');
        mkdirSync(nested, { recursive: true });

        const result = resolveVersion({
            outputFolder: join(tempRoot, 'docs'),
            projectRoot: nested
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.label).toBe('v1.2.3');
        }
    });

    it('prefixes a bare semver with v', () => {
        writePackageJson(tempRoot, '0.3.0');
        const result = resolveVersion({
            outputFolder: join(tempRoot, 'docs'),
            projectRoot: tempRoot
        });
        if (result.ok) {
            expect(result.value.label).toBe('v0.3.0');
        }
    });

    it('passes through pre-prefixed labels (v0.3.0)', () => {
        const result = resolveVersion({
            explicitLabel: 'v0.3.0',
            outputFolder: join(tempRoot, 'docs'),
            projectRoot: tempRoot
        });
        if (result.ok) {
            expect(result.value.label).toBe('v0.3.0');
        }
    });

    it('passes through non-semver labels (main, next)', () => {
        const result = resolveVersion({
            explicitLabel: 'main',
            outputFolder: join(tempRoot, 'docs'),
            projectRoot: tempRoot
        });
        if (result.ok) {
            expect(result.value.label).toBe('main');
        }
    });

    it('errors with the opt-out hint when no package.json is found', () => {
        const isolated = join(tempRoot, 'no-package');
        mkdirSync(isolated, { recursive: true });

        const result = resolveVersion({
            outputFolder: join(isolated, 'docs'),
            projectRoot: isolated,
            cwd: isolated
        });
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/Cannot determine version label/);
            expect(result.message).toMatch(/--versionLabel/);
            expect(result.message).toMatch(/--no-multiVersion/);
        }
    });

    it('falls back to cwd when projectRoot has no package.json', () => {
        writePackageJson(tempRoot, '4.5.6');
        const isolated = join(tempRoot, 'project');
        mkdirSync(isolated, { recursive: true });

        const result = resolveVersion({
            outputFolder: join(tempRoot, 'docs'),
            projectRoot: isolated,
            cwd: tempRoot
        });
        if (result.ok) {
            expect(result.value.label).toBe('v4.5.6');
        }
    });

    it('uses --versionsRoot when provided, otherwise the output folder itself', () => {
        const explicitRoot = resolveVersion({
            explicitLabel: 'v1.0.0',
            outputFolder: join(tempRoot, 'a', 'b', 'docs'),
            explicitRoot: join(tempRoot, 'public')
        });
        if (explicitRoot.ok) {
            expect(explicitRoot.value.root).toBe(resolve(tempRoot, 'public'));
        }

        const defaultRoot = resolveVersion({
            explicitLabel: 'v1.0.0',
            outputFolder: join(tempRoot, 'a', 'b', 'docs')
        });
        if (defaultRoot.ok) {
            // versions.json lives next to the version subfolders (inside `-d`),
            // not in the parent — that way the user's `-d` is the deploy root.
            expect(defaultRoot.value.root).toBe(resolve(tempRoot, 'a', 'b', 'docs'));
        }
    });
});
