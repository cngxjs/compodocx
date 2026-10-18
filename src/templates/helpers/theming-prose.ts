import { markedAcl } from '../../utils/marked.acl';
import { parseDescription } from './parse-description';

/** `{@link --name}` / `{@link $name}`, optionally labelled (`|label` or ` label`). */
const TOKEN_LINK = /\{@link\s+((?:--|\$)[\w-]+)(?:\s*\|\s*|\s+)?([^}]*)\}/g;

/**
 * Markdown of a theming comment (token or mixin description, `@overview`)
 * as HTML. `{@link --token}` links to the token's row on the same page
 * (`anchors` maps token names to row ids; without a row the name renders
 * as code, a label as text); every other `{@link}` resolves through `parseDescription`.
 */
export const themingProse = (
    markdown: string,
    depth: number,
    anchors: ReadonlyMap<string, string>
): string => {
    const html = markedAcl(markdown) as string;
    const withTokens = html.replace(TOKEN_LINK, (_match, name: string, label: string) => {
        // `label` is already HTML (marked escaped it); a token name needs no escaping.
        const text = label.trim() || `<code>${name}</code>`;
        const anchor = anchors.get(name);
        return anchor ? `<a href="#${anchor}">${text}</a>` : text;
    });
    return parseDescription(withTokens, depth);
};
