/**
 * Escapes text for HTML element content and double-quoted attributes:
 * `&`, `<`, `>` and `"` (as `&quot;`). The one escaper for generated
 * markup; the few that differ say why where they are defined.
 */
export const escapeHtmlText = (str: string): string =>
    String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
