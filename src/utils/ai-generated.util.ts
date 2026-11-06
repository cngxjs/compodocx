/** Tag names that mark AI-assisted content; `@aiGenerated` is the documented form. */
export const AI_GENERATED_TAG_NAMES = ['aiGenerated', 'aigen', 'ai'] as const;

const TAG_NAMES = new Set(AI_GENERATED_TAG_NAMES.map(name => name.toLowerCase()));

/** True for `aiGenerated` and its synonyms `aigen` and `ai`, in any case. */
export const isAiGeneratedTagName = (name: string | undefined): boolean =>
    name !== undefined && TAG_NAMES.has(name.toLowerCase());

/**
 * Detects an `@aiGenerated` marker (or a synonym) inside an HTML comment at
 * the top of a markdown file. Accepts an optional value (model name, date,
 * `model=... date=...`) shown in the visible note.
 *
 * Recognised forms:
 *   <!-- @aiGenerated -->
 *   <!-- @aiGenerated example-model -->
 *   <!-- @ai 2026-05 -->
 *   <!-- @aigen model=example-model date=2026-05 -->
 *
 * Returns the trimmed value when found, `true` when the bare marker is
 * present, or `false` when absent. The marker must appear before any
 * non-whitespace, non-comment content.
 */
const AI_GENERATED_MARKER = new RegExp(
    `^\\s*<!--\\s*@(?:${AI_GENERATED_TAG_NAMES.join('|')})(?:\\s+([^>]*?))?\\s*-->`,
    'i'
);

export const detectAiGeneratedMarker = (
    markdown: string | undefined | null
): string | true | false => {
    if (!markdown) {
        return false;
    }
    const match = markdown.match(AI_GENERATED_MARKER);
    if (!match) {
        return false;
    }
    const value = match[1]?.trim();
    return value ? value : true;
};
