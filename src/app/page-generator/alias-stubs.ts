import Html from '@kitajs/html';

import type { AdditionalAlias } from '../interfaces/main-data.interface';
import { relativePrefix } from '../links/layout';
import type { AliasRedirect, Redirects } from '../links/redirects';

/** The stub markup; `text` is the already escaped title. */
const stubHtml = (href: string, text: string): string => `<!doctype html>
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

const depthOf = (file: string): number => file.split('/').length - 1;

/**
 * Redirect page for an old URL: `target` is the root-relative path of the
 * page it moved to, `depth` the number of folders the stub itself sits in.
 * The target is built from slug segments only, so it needs no escaping.
 */
export const aliasStub = (target: string, depth: number, title: string): string =>
    stubHtml(`${relativePrefix(depth)}${target}`, Html.escapeHtml(title) as string);

const TITLE = /^<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>([^<]*)<\/title>\n/;

/**
 * Whether `content` is exactly the stub compodocx writes at `from` for a
 * redirect to `to`. The escaped title is read back from the file, so any other
 * byte (a hand edit, a real page) makes it false.
 */
export const isAliasStub = (content: string, from: string, to: string): boolean => {
    const title = TITLE.exec(content);
    if (!title) {
        return false;
    }
    return content === stubHtml(`${relativePrefix(depthOf(from))}${to}`, title[1]);
};

/** A root-relative `.html` path without empty, `.` or `..` segments. */
const isSafePagePath = (file: string): boolean =>
    file.endsWith('.html') &&
    file.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');

/**
 * Redirects of an earlier run that pointed from a path below the additional
 * pages `folder` and are no alias any more: candidates for removal of their
 * stub file, which the caller only removes when it is still unchanged.
 */
export const staleAliasStubs = (
    previous: Redirects,
    current: readonly AdditionalAlias[],
    folder: string
): readonly AliasRedirect[] => {
    const kept = new Set(current.map(alias => alias.from));
    return Object.entries(previous)
        .filter(
            ([from, to]) =>
                typeof to === 'string' &&
                from.startsWith(`${folder}/`) &&
                !kept.has(from) &&
                isSafePagePath(from)
        )
        .map(([from, to]) => ({ from, to }));
};

/** Stub file (root-relative path and content) of every alias. */
export const aliasStubFiles = (
    aliases: readonly AdditionalAlias[]
): readonly { readonly file: string; readonly content: string }[] =>
    aliases.map(({ from, to, title }) => ({
        file: from,
        content: aliasStub(to, depthOf(from), title)
    }));
