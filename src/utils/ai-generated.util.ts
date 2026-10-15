/**
 * Detects an `@aiGenerated` marker inside an HTML comment at the top of a
 * markdown file. Accepts an optional value (model name, date, etc.) that
 * surfaces in the badge tooltip.
 *
 * Recognised forms:
 *   <!-- @aiGenerated -->
 *   <!-- @aiGenerated claude-opus-4.7 -->
 *   <!-- @aiGenerated 2026-05 -->
 *
 * Returns the trimmed value when found, `true` when the bare marker is
 * present, or `false` when absent. The marker must appear before any
 * non-whitespace, non-comment content.
 */
const AI_GENERATED_MARKER = /^\s*<!--\s*@aiGenerated\s*([^>]*?)\s*-->/i;

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
