/** Re-exported by name from the barrel. */
export function pub(): string {
    return 'pub';
}

/** Exported from its file, never re-exported: not public. */
export function hiddenFn(): string {
    return 'hidden';
}

/** Re-exported constant. */
export const PUB_CONST = 1;
