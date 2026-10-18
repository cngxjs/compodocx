import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/app/engines/file.engine', () => ({
    default: {
        existsSync: vi.fn(() => false),
        getSync: vi.fn(() => null)
    }
}));

vi.mock('../../../../src/utils/angular-version.util', () => ({
    default: {
        cleanVersion: vi.fn((v: string) => v.replace(/^[~^]/, ''))
    }
}));

vi.mock('os-name', () => ({
    default: vi.fn(() => 'macOS Test-OS')
}));

vi.mock('ts-morph', () => ({
    ts: { version: '5.9.99' }
}));

import { printBanner } from '../../../../src/app/cli/banner';
import FileEngine from '../../../../src/app/engines/file.engine';

const captureLines = () => {
    const lines: string[] = [];
    return { log: (line: string) => lines.push(line), lines };
};

describe('printBanner', () => {
    const ctx = { pkgVersion: '9.9.9', cwd: '/tmp/banner-test' };

    beforeEach(() => {
        vi.mocked(FileEngine.existsSync).mockReturnValue(false);
        vi.mocked(FileEngine.getSync).mockReturnValue(null);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('emits nothing when isWatching is true', () => {
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: true, isWatching: true, isLlmMdStdoutMode: false }, log);
        expect(lines).toEqual([]);
    });

    it('emits nothing when isLlmMdStdoutMode is true', () => {
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: true, isWatching: false, isLlmMdStdoutMode: true }, log);
        expect(lines).toEqual([]);
    });

    it('emits the one-liner when loggerSilent is false (verbose path)', () => {
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: false, isWatching: false, isLlmMdStdoutMode: false }, log);
        expect(lines).toEqual(['compodocx v9.9.9']);
    });

    it('emits the full banner block when loggerSilent is true (default state)', () => {
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: true, isWatching: false, isLlmMdStdoutMode: false }, log);
        // First line is the ASCII banner text (or '' if banner file missing on
        // this disk). What matters is the version + TS + Node + OS lines.
        expect(lines).toContain('9.9.9');
        expect(lines).toContain('TypeScript version used by compodocx : 5.9.99');
        expect(lines).toContain(`Node.js version : ${process.version}`);
        expect(lines).toContain('Operating system : macOS Test-OS');
        // No project-typescript line because FileEngine.existsSync is mocked false.
        expect(lines.some(l => l.includes('TypeScript version of current project'))).toBe(false);
    });

    it('emits the project-TypeScript line when package.json has devDependencies.typescript', () => {
        vi.mocked(FileEngine.existsSync).mockReturnValue(true);
        vi.mocked(FileEngine.getSync).mockReturnValue(
            JSON.stringify({ devDependencies: { typescript: '~5.3.2' } })
        );
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: true, isWatching: false, isLlmMdStdoutMode: false }, log);
        expect(lines).toContain('TypeScript version of current project : 5.3.2');
    });

    it('skips the project-TypeScript line when devDependencies.typescript is absent', () => {
        vi.mocked(FileEngine.existsSync).mockReturnValue(true);
        vi.mocked(FileEngine.getSync).mockReturnValue(JSON.stringify({ devDependencies: {} }));
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: true, isWatching: false, isLlmMdStdoutMode: false }, log);
        expect(lines.some(l => l.includes('TypeScript version of current project'))).toBe(false);
    });

    it('emits blank-line separators between version sections', () => {
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: true, isWatching: false, isLlmMdStdoutMode: false }, log);
        // Each version section ends with a blank line; the banner block emits
        // at minimum 4 blank lines (one after version, ts, node, os).
        const blanks = lines.filter(l => l === '').length;
        expect(blanks).toBeGreaterThanOrEqual(4);
    });

    it('isWatching wins over loggerSilent', () => {
        const { log, lines } = captureLines();
        printBanner(ctx, { loggerSilent: false, isWatching: true, isLlmMdStdoutMode: false }, log);
        expect(lines).toEqual([]);
    });
});
