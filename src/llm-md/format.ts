/**
 * Markdown formatting + escaping helpers for the llm-md emitter.
 *
 * Pure functions, no side effects. Output is meant for a model context
 * window - token-density beats visual fidelity, so descriptions collapse to a
 * single line and inline `code` segments are preferred over fenced blocks.
 */

const SOFT_BREAK_PATTERN = /\s*\n\s*/g;
const MULTI_SPACE_PATTERN = /\s{2,}/g;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/gi;
const HTML_ENTITY_PATTERN = /&(amp|lt|gt|quot|#39|nbsp);/gi;
const ENTITY_REPLACEMENTS: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
};
const LINK_TAG_PATTERN = /\{@link\s+([^}]+)\}/g;

/**
 * Strip HTML tags, decode the common HTML entities, and collapse all
 * whitespace runs to single spaces. Handy for descriptions that came out of
 * `marked()` rendering and may contain leftover `<p>` / `<a>` markup.
 */
export const collapseDescription = (input: string | undefined): string => {
    if (!input) {
        return '';
    }
    let out = input.replace(LINK_TAG_PATTERN, (_match, target) => {
        const text = String(target).trim();
        const split = text.split('|');
        return split.length > 1 ? split[1].trim() : split[0];
    });
    out = out.replace(HTML_TAG_PATTERN, ' ');
    out = out.replace(HTML_ENTITY_PATTERN, m => ENTITY_REPLACEMENTS[m.toLowerCase()] ?? m);
    out = out.replace(SOFT_BREAK_PATTERN, ' ');
    out = out.replace(MULTI_SPACE_PATTERN, ' ');
    return out.trim();
};

/**
 * Escape characters that would otherwise break out of a markdown paragraph.
 *
 * The emitter wraps user-provided strings in inline `code` spans where it
 * can; the escapes here cover the cases where that wrapping is not
 * applicable (prose descriptions, plain identifier lists). Targets the
 * minimum set: backticks, asterisks, underscores, square brackets, pipes,
 * angle brackets, leading hash. Anything else passes through.
 */
export const escapeMarkdown = (input: string | undefined): string => {
    if (!input) {
        return '';
    }
    return input
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\|/g, '\\|')
        .replace(/</g, '\\<')
        .replace(/>/g, '\\>')
        .replace(/^#/gm, '\\#');
};

/**
 * Render a string for an inline ``code`` span. Backticks inside the string
 * force a longer fence so the surrounding span stays balanced - matches
 * CommonMark's "use n+1 backticks if the content has runs of n" rule.
 */
export const inlineCode = (input: string | undefined): string => {
    if (!input) {
        return '``';
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return '``';
    }
    let runLen = 1;
    const matches = trimmed.match(/`+/g);
    if (matches) {
        for (const m of matches) {
            if (m.length >= runLen) {
                runLen = m.length + 1;
            }
        }
    }
    const fence = '`'.repeat(runLen);
    const padded = trimmed.startsWith('`') || trimmed.endsWith('`') ? ` ${trimmed} ` : trimmed;
    return `${fence}${padded}${fence}`;
};

/**
 * Format a property signature: `name: type = default` (with `?` when
 * optional). Backticks in user values are not escaped here - the caller wraps
 * the result via `inlineCode()`, which handles fence widening.
 */
export const formatPropertySignature = (
    name: string,
    type: string | undefined,
    optional: boolean | undefined,
    defaultValue: string | undefined
): string => {
    const nameSeg = `${name}${optional ? '?' : ''}`;
    const parts = [nameSeg];
    if (type) {
        parts[0] = `${nameSeg}: ${collapseSignatureWhitespace(type)}`;
    }
    if (defaultValue !== undefined && defaultValue !== '') {
        parts[0] = `${parts[0]} = ${collapseSignatureWhitespace(defaultValue)}`;
    }
    return parts[0];
};

/**
 * Format a method signature: `name(arg1: T, arg2?: U): ReturnType`.
 * Args are passed in as already-rendered `name: type` strings; this helper
 * just joins them and bolts the return type on.
 */
export const formatMethodSignature = (
    name: string,
    args: ReadonlyArray<string>,
    returnType: string | undefined
): string => {
    const argSeg = args.join(', ');
    const ret = returnType ? `: ${collapseSignatureWhitespace(returnType)}` : '';
    return `${name}(${argSeg})${ret}`;
};

/**
 * Hard cap on individual signature values (types, default values, return
 * types). Embedded base64 images, very long string literals, and giant
 * union types would otherwise blow the markdown to multi-megabyte size and
 * waste the LLM's context budget. The cap is intentionally tight - anyone
 * who needs the full value reads the source.
 */
export const SIGNATURE_VALUE_CAP = 160;

/**
 * Collapse intra-signature whitespace runs to single spaces, then truncate at
 * `SIGNATURE_VALUE_CAP` so a single embedded data URL or giant union literal
 * cannot bloat the output. Some upstream fields (numeric enum values, complex
 * types resolved as objects) arrive as non-string primitives or even
 * objects; coerce defensively so the emitter never crashes the export
 * pipeline on a typed-edge case.
 */
export const collapseSignatureWhitespace = (s: unknown): string => {
    const collapsed = String(s ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    if (collapsed.length <= SIGNATURE_VALUE_CAP) {
        return collapsed;
    }
    return `${collapsed.slice(0, SIGNATURE_VALUE_CAP)}…`;
};

/**
 * Render a single deprecated tail like `(deprecated)` or
 * `(deprecated: use X instead)`. Returns the empty string when the entity is
 * not deprecated, so callers can prepend it unconditionally.
 */
export const deprecatedTail = (
    deprecated: boolean | undefined,
    message: string | undefined
): string => {
    if (!deprecated) {
        return '';
    }
    const collapsed = collapseDescription(message);
    return collapsed ? ` (deprecated: ${collapsed})` : ' (deprecated)';
};

/**
 * Join non-empty markdown sections with a blank line between each. Used by
 * the per-entity emitters to assemble a section without sprinkling
 * conditional `\n` everywhere.
 */
export const joinSections = (sections: ReadonlyArray<string>): string =>
    sections.filter(s => s && s.length > 0).join('\n\n');
