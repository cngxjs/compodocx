/**
 * Documentation coverage gate. Pure: it decides which log lines to print and
 * whether the run stops (and with which exit code), the caller performs the
 * logging and the halt.
 */

export interface CoverageGateFile {
    readonly coveragePercent: number;
    readonly filePath: string;
    readonly name: string;
}

export interface CoverageGateInput {
    readonly count: number;
    readonly files: readonly CoverageGateFile[];
    readonly coverageTest: boolean;
    readonly coverageTestPerFile: boolean;
    readonly coverageTestThreshold: number;
    readonly coverageMinimumPerFile: number;
    readonly coverageTestThresholdFail: boolean;
    readonly coverageTestShowOnlyFailed: boolean;
}

export type CoverageLogLevel = 'info' | 'warn' | 'error';

export interface CoverageLogLine {
    readonly level: CoverageLogLevel;
    readonly text: string;
}

export interface CoverageVerdict {
    readonly lines: readonly CoverageLogLine[];
    /** `null` = no gate configured, continue the run. */
    readonly exitCode: 0 | 1 | null;
}

const info = (text: string): CoverageLogLine => ({ level: 'info', text });

const SEPARATOR = info('-------------------');

const globalOver = (input: CoverageGateInput) =>
    `Documentation coverage (${input.count}%) is over threshold (${input.coverageTestThreshold}%)`;

const globalUnder = (input: CoverageGateInput) =>
    `Documentation coverage (${input.count}%) is not over threshold (${input.coverageTestThreshold}%)`;

const perFileOver = (input: CoverageGateInput) =>
    `Documentation coverage per file is over threshold (${input.coverageMinimumPerFile}%)`;

const perFileUnder = (input: CoverageGateInput) =>
    `Documentation coverage per file is not over threshold (${input.coverageMinimumPerFile}%)`;

/** Failure lines are errors (exit 1) under `coverageTestThresholdFail`, warnings (exit 0) otherwise. */
const failure = (
    input: CoverageGateInput,
    texts: readonly string[],
    trailing: CoverageLogLine[] = []
) =>
    ({
        lines: [
            ...texts.map(text => ({
                level: input.coverageTestThresholdFail ? ('error' as const) : ('warn' as const),
                text
            })),
            ...trailing
        ],
        exitCode: input.coverageTestThresholdFail ? 1 : 0
    }) satisfies CoverageVerdict;

const sortedByPercent = (input: CoverageGateInput) =>
    [...input.files].sort((a, b) => a.coveragePercent - b.coveragePercent);

/** The per-file report block plus whether any file is under the minimum. */
const perFileReport = (input: CoverageGateInput) => {
    const files = sortedByPercent(input);
    const isOver = (f: CoverageGateFile) => f.coveragePercent >= input.coverageMinimumPerFile;
    const overLines = input.coverageTestShowOnlyFailed
        ? []
        : files
              .filter(isOver)
              .map(f =>
                  info(
                      `${f.coveragePercent} % for file ${f.filePath} - ${f.name} - over minimum per file`
                  )
              );
    const underFiles = files.filter(f => !isOver(f));
    const underLines = underFiles.map(f => ({
        level: 'error' as const,
        text: `${f.coveragePercent} % for file ${f.filePath} - ${f.name} - under minimum per file`
    }));
    return {
        lines: [
            info('Process documentation coverage per file'),
            SEPARATOR,
            ...overLines,
            ...underLines,
            SEPARATOR
        ],
        hasUnder: underFiles.length > 0
    };
};

const globalOnly = (input: CoverageGateInput): CoverageVerdict =>
    input.count >= input.coverageTestThreshold
        ? { lines: [info(globalOver(input))], exitCode: 0 }
        : failure(input, [globalUnder(input)]);

const perFileOnly = (input: CoverageGateInput): CoverageVerdict => {
    const report = perFileReport(input);
    const verdict: CoverageVerdict = report.hasUnder
        ? failure(input, [perFileUnder(input)])
        : { lines: [info(perFileOver(input))], exitCode: 0 };
    return { lines: [...report.lines, ...verdict.lines], exitCode: verdict.exitCode };
};

const globalAndPerFile = (input: CoverageGateInput): CoverageVerdict => {
    const report = perFileReport(input);
    const globalPass = input.count >= input.coverageTestThreshold;
    const verdict = ((): CoverageVerdict => {
        if (globalPass && !report.hasUnder) {
            return {
                lines: [info(globalOver(input)), info(perFileOver(input))],
                exitCode: 0
            };
        }
        if (globalPass) {
            const fail = failure(input, [perFileUnder(input)]);
            return { lines: [info(globalOver(input)), ...fail.lines], exitCode: fail.exitCode };
        }
        if (report.hasUnder) {
            return failure(input, [globalUnder(input), perFileUnder(input)]);
        }
        return failure(input, [globalUnder(input)], [info(perFileOver(input))]);
    })();
    return { lines: [...report.lines, ...verdict.lines], exitCode: verdict.exitCode };
};

export const evaluateCoverageGate = (input: CoverageGateInput): CoverageVerdict => {
    if (input.coverageTest && !input.coverageTestPerFile) {
        return globalOnly(input);
    }
    if (!input.coverageTest && input.coverageTestPerFile) {
        return perFileOnly(input);
    }
    if (input.coverageTest && input.coverageTestPerFile) {
        return globalAndPerFile(input);
    }
    return { lines: [], exitCode: null };
};
