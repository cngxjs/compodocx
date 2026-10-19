import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasStderrError, shell } from '../helpers';

/**
 * `compodocx` invocations for multi-version behavior. Uses an isolated tmp
 * dir per spec to avoid pollution and parallel-run interference.
 */
function runCli(args: string[]) {
    return shell('node', ['./bin/index-cli.js', ...args]);
}

function isolatedDir() {
    return mkdtempSync(join(tmpdir(), 'compodocx-mv-'));
}

const TSCONFIG = './test/fixtures/sample-files/tsconfig.simple.json';

describe('CLI multi-version', () => {
    it('default builds under <output>/<versionLabel>/ and writes versions.json next to it', () => {
        const outRoot = isolatedDir();
        const out = join(outRoot, 'docs');
        try {
            const ls = runCli(['-p', TSCONFIG, '-d', out, '--versionLabel', 'v9.9.9']);
            if (hasStderrError(ls.stderr.toString())) {
                console.error(ls.stderr.toString());
                throw new Error('CLI error');
            }
            expect(existsSync(join(out, 'v9.9.9', 'index.html'))).toBe(true);
            // versions.json lives inside the user's `-d` folder so that
            // folder is the natural deploy root.
            expect(existsSync(join(out, 'versions.json'))).toBe(true);
            const manifest = JSON.parse(readFileSync(join(out, 'versions.json'), 'utf8'));
            expect(manifest.schemaVersion).toBe(1);
            expect(manifest.versions[0].label).toBe('v9.9.9');
            expect(manifest.versions[0].path).toBe('v9.9.9/');
        } finally {
            rmSync(outRoot, { recursive: true, force: true });
        }
    });

    it('a second build with a different label appends to versions.json', () => {
        const outRoot = isolatedDir();
        const out = join(outRoot, 'docs');
        try {
            const a = runCli(['-p', TSCONFIG, '-d', out, '--versionLabel', 'v1.0.0']);
            if (hasStderrError(a.stderr.toString())) {
                console.error(a.stderr.toString());
                throw new Error('CLI error v1');
            }
            const b = runCli(['-p', TSCONFIG, '-d', out, '--versionLabel', 'v2.0.0']);
            if (hasStderrError(b.stderr.toString())) {
                console.error(b.stderr.toString());
                throw new Error('CLI error v2');
            }
            const manifest = JSON.parse(readFileSync(join(out, 'versions.json'), 'utf8'));
            expect(manifest.versions.map(v => v.label)).toEqual(['v2.0.0', 'v1.0.0']);
            // The root index opens the newest version.
            const rootIndex = readFileSync(join(out, 'index.html'), 'utf8');
            expect(rootIndex).toContain('content="compodocx-versions-root"');
            expect(rootIndex).toContain('url=v2.0.0/index.html');
        } finally {
            rmSync(outRoot, { recursive: true, force: true });
        }
    });

    it('--no-multiVersion restores the flat output layout', () => {
        const outRoot = isolatedDir();
        const out = join(outRoot, 'docs');
        try {
            const ls = runCli(['-p', TSCONFIG, '-d', out, '--no-multiVersion']);
            if (hasStderrError(ls.stderr.toString())) {
                console.error(ls.stderr.toString());
                throw new Error('CLI error');
            }
            expect(existsSync(join(out, 'index.html'))).toBe(true);
            expect(readFileSync(join(out, 'index.html'), 'utf8')).not.toContain(
                'compodocx-versions-root'
            );
            // When opting out, no version subfolder should appear next to docs.
            expect(existsSync(join(out, 'v0.2.0'))).toBe(false);
            // versions.json must NOT be written in flat mode.
            expect(existsSync(join(out, 'versions.json'))).toBe(false);
        } finally {
            rmSync(outRoot, { recursive: true, force: true });
        }
    });

    it('keeps a landing page of its own in the versions root', () => {
        const outRoot = isolatedDir();
        const out = join(outRoot, 'docs');
        try {
            mkdirSync(out, { recursive: true });
            writeFileSync(join(out, 'index.html'), '<h1>Landing</h1>');
            const ls = runCli(['-p', TSCONFIG, '-d', out, '--versionLabel', 'v1.0.0']);
            if (hasStderrError(ls.stderr.toString())) {
                console.error(ls.stderr.toString());
                throw new Error('CLI error');
            }
            expect(existsSync(join(out, 'v1.0.0', 'index.html'))).toBe(true);
            expect(readFileSync(join(out, 'index.html'), 'utf8')).toBe('<h1>Landing</h1>');
        } finally {
            rmSync(outRoot, { recursive: true, force: true });
        }
    });

    it('honours an explicit non-semver --versionLabel (main)', () => {
        const outRoot = isolatedDir();
        const out = join(outRoot, 'docs');
        try {
            const ls = runCli(['-p', TSCONFIG, '-d', out, '--versionLabel', 'main']);
            if (hasStderrError(ls.stderr.toString())) {
                console.error(ls.stderr.toString());
                throw new Error('CLI error');
            }
            expect(existsSync(join(out, 'main', 'index.html'))).toBe(true);
        } finally {
            rmSync(outRoot, { recursive: true, force: true });
        }
    });

    it('exits 2 when no version label can be resolved', () => {
        // Isolated working directory beneath /private/tmp so the resolver's
        // walk-up reaches /private/tmp -> /tmp -> / without ever hitting the
        // compodoc repo's own package.json.
        const outRoot = isolatedDir();
        const out = join(outRoot, 'docs');
        const tsconfigName = 'tsconfig.iso.json';
        try {
            writeFileSync(
                join(outRoot, tsconfigName),
                JSON.stringify({ compilerOptions: { module: 'commonjs' } })
            );
            const cliPath = join(process.cwd(), 'bin', 'index-cli.js');
            const ls = shell('node', [cliPath, '-p', tsconfigName, '-d', out], { cwd: outRoot });
            expect(ls.status).toBe(2);
            const combined = ls.stdout.toString() + ls.stderr.toString();
            expect(combined).toMatch(/Cannot determine version label/);
            expect(combined).toMatch(/--versionLabel/);
            expect(combined).toMatch(/--no-multiVersion/);
        } finally {
            rmSync(outRoot, { recursive: true, force: true });
        }
    });

    it('rejects --maxVersionsShown out of range with a clear message', () => {
        const outRoot = isolatedDir();
        const out = join(outRoot, 'docs');
        try {
            const ls = runCli([
                '-p',
                TSCONFIG,
                '-d',
                out,
                '--versionLabel',
                'v1.0.0',
                '--maxVersionsShown',
                '9999'
            ]);
            const combined = ls.stdout.toString() + ls.stderr.toString();
            expect(combined).toMatch(/--maxVersionsShown.*0 and 1000/);
            expect(ls.status).not.toBe(0);
        } finally {
            rmSync(outRoot, { recursive: true, force: true });
        }
    });
});
