import { describe, expect, it } from 'vitest';
import {
    type CoverageGateInput,
    evaluateCoverageGate
} from '../../../../src/app/run/coverage-gate';

const FILES = [
    { coveragePercent: 100, filePath: 'src/b.ts', name: 'B' },
    { coveragePercent: 20, filePath: 'src/a.ts', name: 'A' },
    { coveragePercent: 60, filePath: 'src/c.ts', name: 'C' }
];

const input = (overrides: Partial<CoverageGateInput>): CoverageGateInput => ({
    count: 80,
    files: FILES,
    coverageTest: false,
    coverageTestPerFile: false,
    coverageTestThreshold: 70,
    coverageMinimumPerFile: 0,
    coverageTestThresholdFail: true,
    coverageTestShowOnlyFailed: false,
    ...overrides
});

const GLOBAL_OVER = 'Documentation coverage (80%) is over threshold (70%)';
const GLOBAL_UNDER = 'Documentation coverage (80%) is not over threshold (90%)';

const PER_FILE_OVER_0 = 'Documentation coverage per file is over threshold (0%)';
const PER_FILE_UNDER_50 = 'Documentation coverage per file is not over threshold (50%)';

const perFileBlock = (minimum: number, showOnlyFailed = false) => {
    const sorted = [...FILES].sort((a, b) => a.coveragePercent - b.coveragePercent);
    const over = sorted
        .filter(f => f.coveragePercent >= minimum)
        .map(f => ({
            level: 'info',
            text: `${f.coveragePercent} % for file ${f.filePath} - ${f.name} - over minimum per file`
        }));
    const under = sorted
        .filter(f => f.coveragePercent < minimum)
        .map(f => ({
            level: 'error',
            text: `${f.coveragePercent} % for file ${f.filePath} - ${f.name} - under minimum per file`
        }));
    return [
        { level: 'info', text: 'Process documentation coverage per file' },
        { level: 'info', text: '-------------------' },
        ...(showOnlyFailed ? [] : over),
        ...under,
        { level: 'info', text: '-------------------' }
    ];
};

describe('evaluateCoverageGate', () => {
    it('continues with no lines when no coverage test is configured', () => {
        expect(evaluateCoverageGate(input({}))).toEqual({ lines: [], exitCode: null });
    });

    it('passes the global test with an info line and exit 0', () => {
        expect(evaluateCoverageGate(input({ coverageTest: true }))).toEqual({
            lines: [{ level: 'info', text: GLOBAL_OVER }],
            exitCode: 0
        });
    });

    it('fails the global test with an error line and exit 1 under thresholdFail', () => {
        expect(
            evaluateCoverageGate(input({ coverageTest: true, coverageTestThreshold: 90 }))
        ).toEqual({ lines: [{ level: 'error', text: GLOBAL_UNDER }], exitCode: 1 });
    });

    it('fails the global test with a warn line and exit 0 without thresholdFail', () => {
        expect(
            evaluateCoverageGate(
                input({
                    coverageTest: true,
                    coverageTestThreshold: 90,
                    coverageTestThresholdFail: false
                })
            )
        ).toEqual({ lines: [{ level: 'warn', text: GLOBAL_UNDER }], exitCode: 0 });
    });

    it('passes the per-file test after the per-file block', () => {
        expect(evaluateCoverageGate(input({ coverageTestPerFile: true }))).toEqual({
            lines: [...perFileBlock(0), { level: 'info', text: PER_FILE_OVER_0 }],
            exitCode: 0
        });
    });

    it('fails the per-file test with an error line and exit 1 under thresholdFail', () => {
        expect(
            evaluateCoverageGate(input({ coverageTestPerFile: true, coverageMinimumPerFile: 50 }))
        ).toEqual({
            lines: [...perFileBlock(50), { level: 'error', text: PER_FILE_UNDER_50 }],
            exitCode: 1
        });
    });

    it('fails the per-file test with a warn line and exit 0 without thresholdFail', () => {
        expect(
            evaluateCoverageGate(
                input({
                    coverageTestPerFile: true,
                    coverageMinimumPerFile: 50,
                    coverageTestThresholdFail: false
                })
            )
        ).toEqual({
            lines: [...perFileBlock(50), { level: 'warn', text: PER_FILE_UNDER_50 }],
            exitCode: 0
        });
    });

    it('passes both tests with two info lines', () => {
        expect(
            evaluateCoverageGate(input({ coverageTest: true, coverageTestPerFile: true }))
        ).toEqual({
            lines: [
                ...perFileBlock(0),
                { level: 'info', text: GLOBAL_OVER },
                { level: 'info', text: PER_FILE_OVER_0 }
            ],
            exitCode: 0
        });
    });

    it('reports a global pass and a per-file failure', () => {
        expect(
            evaluateCoverageGate(
                input({ coverageTest: true, coverageTestPerFile: true, coverageMinimumPerFile: 50 })
            )
        ).toEqual({
            lines: [
                ...perFileBlock(50),
                { level: 'info', text: GLOBAL_OVER },
                { level: 'error', text: PER_FILE_UNDER_50 }
            ],
            exitCode: 1
        });
    });

    it('reports both failures, levelled by thresholdFail', () => {
        const both = {
            coverageTest: true,
            coverageTestPerFile: true,
            coverageTestThreshold: 90,
            coverageMinimumPerFile: 50
        };
        expect(evaluateCoverageGate(input(both))).toEqual({
            lines: [
                ...perFileBlock(50),
                { level: 'error', text: GLOBAL_UNDER },
                { level: 'error', text: PER_FILE_UNDER_50 }
            ],
            exitCode: 1
        });
        expect(evaluateCoverageGate(input({ ...both, coverageTestThresholdFail: false }))).toEqual({
            lines: [
                ...perFileBlock(50),
                { level: 'warn', text: GLOBAL_UNDER },
                { level: 'warn', text: PER_FILE_UNDER_50 }
            ],
            exitCode: 0
        });
    });

    it('reports a global failure with a per-file pass as failure plus info', () => {
        const globalFail = {
            coverageTest: true,
            coverageTestPerFile: true,
            coverageTestThreshold: 90
        };
        expect(evaluateCoverageGate(input(globalFail))).toEqual({
            lines: [
                ...perFileBlock(0),
                { level: 'error', text: GLOBAL_UNDER },
                { level: 'info', text: PER_FILE_OVER_0 }
            ],
            exitCode: 1
        });
        expect(
            evaluateCoverageGate(input({ ...globalFail, coverageTestThresholdFail: false }))
        ).toEqual({
            lines: [
                ...perFileBlock(0),
                { level: 'warn', text: GLOBAL_UNDER },
                { level: 'info', text: PER_FILE_OVER_0 }
            ],
            exitCode: 0
        });
    });

    it('orders the per-file block by percent and hides passing files with showOnlyFailed', () => {
        const verdict = evaluateCoverageGate(
            input({
                coverageTestPerFile: true,
                coverageMinimumPerFile: 50,
                coverageTestShowOnlyFailed: true
            })
        );
        expect(verdict.lines.map(l => l.text)).toEqual([
            'Process documentation coverage per file',
            '-------------------',
            '20 % for file src/a.ts - A - under minimum per file',
            '-------------------',
            PER_FILE_UNDER_50
        ]);

        const all = evaluateCoverageGate(
            input({ coverageTestPerFile: true, coverageMinimumPerFile: 50 })
        );
        expect(all.lines.slice(2, 5).map(l => l.text)).toEqual([
            '60 % for file src/c.ts - C - over minimum per file',
            '100 % for file src/b.ts - B - over minimum per file',
            '20 % for file src/a.ts - A - under minimum per file'
        ]);
    });
});
