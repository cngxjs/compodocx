export interface FileListChange {
    readonly added: readonly string[];
    readonly removed: readonly string[];
}

/** Files of `next` missing from `previous` (added) and the other way round (removed). */
export const fileListChange = (
    previous: readonly string[],
    next: readonly string[]
): FileListChange => {
    const before = new Set(previous);
    const after = new Set(next);
    return {
        added: next.filter(file => !before.has(file)),
        removed: previous.filter(file => !after.has(file))
    };
};

export const isUnchanged = (change: FileListChange): boolean =>
    change.added.length === 0 && change.removed.length === 0;
