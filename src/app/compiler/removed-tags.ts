/**
 * JSDoc tags compodocx no longer reads: a build notice lists where they are
 * still written so `compodocx migrate jsdoc` can strip them.
 */

export type RemovedTag = 'category' | 'docsKind';

export interface RemovedTagFinding {
    /** Relative to the cwd, forward slashes. */
    readonly file: string;
    /** 1-based line of the tag. */
    readonly line: number;
    readonly tag: RemovedTag;
}

const JSDOC_BLOCK = /\/\*\*[\s\S]*?\*\//g;
const TAG = /(?:^|\s)@(category|docsKind)\b/g;

/** Every `@category` / `@docsKind` tag inside a JSDoc block of `text`. */
export const findRemovedTags = (file: string, text: string): readonly RemovedTagFinding[] => {
    const findings: RemovedTagFinding[] = [];
    for (const block of text.matchAll(JSDOC_BLOCK)) {
        const start = block.index ?? 0;
        for (const tag of block[0].matchAll(TAG)) {
            const offset = start + (tag.index ?? 0) + tag[0].indexOf('@');
            const line = text.slice(0, offset).split('\n').length;
            findings.push({ file, line, tag: tag[1] as RemovedTag });
        }
    }
    return findings;
};

/** The build notice: a count line, then one `file:line @tag` per finding. Empty without findings. */
export const formatRemovedTagNotice = (
    findings: readonly RemovedTagFinding[]
): readonly string[] => {
    if (findings.length === 0) {
        return [];
    }
    const noun = findings.length === 1 ? 'tag is' : 'tags are';
    return [
        `${findings.length} @category / @docsKind ${noun} ignored; run \`compodocx migrate jsdoc <dir>\` to remove them`,
        ...findings.map(finding => `  ${finding.file}:${finding.line} @${finding.tag}`)
    ];
};
