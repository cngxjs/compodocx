import { highlightCode } from '../../app/engines/syntax-highlight.engine';

/** Remove common leading whitespace from all lines (dedent). */
const dedent = (code: string): string => {
    const lines = code.split('\n');
    // Find minimum indentation across non-empty lines (skip first line - often unindented)
    let minIndent = Infinity;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().length === 0) {
            continue;
        }
        const indent = line.search(/\S/);
        if (indent >= 0 && indent < minIndent) {
            minIndent = indent;
        }
    }
    if (minIndent === 0 || minIndent === Infinity) {
        return code;
    }
    return lines.map((line, i) => (i === 0 ? line : line.slice(minIndent))).join('\n');
};

/**
 * Wrap raw code in Shiki-highlighted `<pre>` (multi-line / >80 chars) or
 * highlighted inline `<code>` (short single-line). Accepts **plain text only**
 * - never pass pre-linked HTML through this function.
 */
export const highlightedCodeWrap = (raw: unknown, lang = 'typescript'): string => {
    const str = String(raw ?? '');
    if (!str) {
        return '';
    }
    const cleaned = str.includes('\n') ? dedent(str) : str;
    if (cleaned.includes('\n') || cleaned.length > 80) {
        return highlightCode(cleaned, { lang, mode: 'snippet' });
    }
    // Short single-line: highlight as snippet, Shiki wraps in <pre><code>
    // but we only want inline <code>, so extract the inner content.
    const highlighted = highlightCode(cleaned, { lang, mode: 'snippet' });
    const innerMatch = /<code>([\s\S]*?)<\/code>/.exec(highlighted);
    if (innerMatch) {
        return `<code class="cdx-shiki-inline">${innerMatch[1]}</code>`;
    }
    return `<code>${cleaned}</code>`;
};
