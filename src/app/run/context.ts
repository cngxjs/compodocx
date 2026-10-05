/**
 * A run stopped on purpose. `runCompodocx` reports it as a `halted` outcome;
 * only the CLI boundary turns it into a process exit code.
 */
export interface Halt {
    readonly exitCode: 0 | 1 | 2;
    readonly reason:
        | 'coverage-gate'
        | 'markdown'
        | 'prepare'
        | 'resources'
        | 'versions-manifest'
        | 'no-sources';
}

export const halt = (exitCode: Halt['exitCode'], reason: Halt['reason']): Halt => ({
    exitCode,
    reason
});
