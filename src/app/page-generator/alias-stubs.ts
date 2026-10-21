import Html from '@kitajs/html';

import { relativePrefix } from '../links/layout';

/** An old additional-page path (root-relative, with `.html`), the page it moved to and that page's title. */
export interface AliasStub {
    readonly from: string;
    readonly to: string;
    readonly title: string;
}

/**
 * Redirect page for an old URL: `target` is the root-relative path of the
 * page it moved to, `depth` the number of folders the stub itself sits in.
 * The target is built from slug segments only, so it needs no escaping.
 */
export const aliasStub = (target: string, depth: number, title: string): string => {
    const href = `${relativePrefix(depth)}${target}`;
    const text = Html.escapeHtml(title) as string;
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${text}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${href}">
<meta http-equiv="refresh" content="0; url=${href}">
</head>
<body><a href="${href}">${text}</a></body>
</html>
`;
};

/** Stub file (root-relative path and content) of every alias. */
export const aliasStubFiles = (
    aliases: readonly AliasStub[]
): readonly { readonly file: string; readonly content: string }[] =>
    aliases.map(({ from, to, title }) => ({
        file: from,
        content: aliasStub(to, from.split('/').length - 1, title)
    }));
