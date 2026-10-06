/** Exported, but no barrel reaches it. */
export function orphanFoo(): string {
    return 'orphan';
}

/**
 * Exported for the tests only.
 *
 * @internal
 */
export function internalFoo(): string {
    return 'internal';
}
