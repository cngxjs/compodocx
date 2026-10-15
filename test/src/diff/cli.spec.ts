import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDiffCli } from '../../../src/diff/index';

/**
 * CLI behavior-contract pattern (F11) — route the diff CLI through its
 * dispatcher and capture stdout/stderr writes. Verifies wiring across
 * commander flags, the parse → compare → classify → format chain, and exit
 * code semantics. Specifically picks up the `--no-warnings` commander gotcha
 * (F1) where `opts.warnings === false` (NOT `opts.noWarnings === true`).
 */

const FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/diff-fixtures');
const V1 = path.join(FIXTURE_DIR, 'v1.json');
const V2 = path.join(FIXTURE_DIR, 'v2.json');

const captureStreams = async (
    work: () => Promise<number>
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];
    const origStdout = process.stdout.write.bind(process.stdout);
    const origStderr = process.stderr.write.bind(process.stderr);
    process.stdout.write = ((chunk: unknown) => {
        stdoutWrites.push(String(chunk));
        return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => {
        stderrWrites.push(String(chunk));
        return true;
    }) as typeof process.stderr.write;
    let exitCode = 0;
    try {
        exitCode = await work();
    } finally {
        process.stdout.write = origStdout;
        process.stderr.write = origStderr;
    }
    return { stdout: stdoutWrites.join(''), stderr: stderrWrites.join(''), exitCode };
};

describe('diff/cli — runDiffCli behavior contract', () => {
    it('exits 2 when --old has no schemaVersion', async () => {
        const { stderr, exitCode } = await captureStreams(() =>
            runDiffCli(['--old', '/tmp/this-does-not-exist-xyz.json', '--new', V2])
        );
        expect(exitCode).toBe(2);
        expect(stderr).toMatch(/file not found/);
    });

    it('exits 2 with the re-export hint when a schema 5 export meets a schema 6 one', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-diff-schema-'));
        const old5 = path.join(dir, 'old-5.json');
        fs.writeFileSync(
            old5,
            JSON.stringify({ ...JSON.parse(fs.readFileSync(V1, 'utf8')), schemaVersion: 5 })
        );
        try {
            const { stderr, exitCode } = await captureStreams(() =>
                runDiffCli(['--old', old5, '--new', V2])
            );
            expect(exitCode).toBe(2);
            expect(stderr).toContain(
                'schemaVersion 5 does not match supported 6 - re-export it with this compodocx version'
            );
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('exits 2 when the diff contains a breaking change', async () => {
        const { stdout, exitCode } = await captureStreams(() =>
            runDiffCli(['--old', V1, '--new', V2])
        );
        expect(exitCode).toBe(2);
        expect(stdout).toMatch(/\[BREAKING\]/);
    });

    it('--json exits 2 and emits valid JSON for breaking changes', async () => {
        const { stdout, exitCode } = await captureStreams(() =>
            runDiffCli(['--old', V1, '--new', V2, '--json'])
        );
        expect(exitCode).toBe(2);
        expect(() => JSON.parse(stdout)).not.toThrow();
        const parsed = JSON.parse(stdout);
        expect(parsed.summary.breaking).toBeGreaterThan(0);
    });

    it('--md emits a markdown section with severity headings', async () => {
        const { stdout, exitCode } = await captureStreams(() =>
            runDiffCli(['--old', V1, '--new', V2, '--md'])
        );
        expect(exitCode).toBe(2);
        expect(stdout).toMatch(/## API changes/);
        expect(stdout).toMatch(/### Breaking changes/);
    });

    it('exits 0 when comparing a snapshot to itself', async () => {
        const { stdout, exitCode } = await captureStreams(() =>
            runDiffCli(['--old', V1, '--new', V1])
        );
        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/Summary:.*0 breaking/);
    });

    it('--no-warnings suppresses non-breaking entries but keeps breaking ones', async () => {
        const { stdout } = await captureStreams(() =>
            runDiffCli(['--old', V1, '--new', V2, '--no-warnings'])
        );
        expect(stdout).toMatch(/\[BREAKING\]/);
        expect(stdout).not.toMatch(/\[ADDITIVE\]/);
        expect(stdout).not.toMatch(/\[DOCS\]/);
    });

    it('exits 1 when only additive changes are present', async () => {
        // Build a v3 from v1 that only adds a new component.
        const fs = await import('node:fs');
        const os = await import('node:os');
        const v1Raw = JSON.parse(fs.readFileSync(V1, 'utf8'));
        const v3 = {
            ...v1Raw,
            components: [
                ...v1Raw.components,
                { name: 'NewComponent', file: 'src/new.component.ts', selector: 'app-new' }
            ]
        };
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-cli-'));
        const v3Path = path.join(tmp, 'v3.json');
        fs.writeFileSync(v3Path, JSON.stringify(v3));
        try {
            const { exitCode } = await captureStreams(() =>
                runDiffCli(['--old', V1, '--new', v3Path])
            );
            expect(exitCode).toBe(1);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
