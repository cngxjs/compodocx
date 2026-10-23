import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The sidebar menu of a generated site. Pages no longer carry it inline: it
 * is written once to `js/menu.js` as a string literal that the script inserts
 * into `#sidebar`; this returns that markup, unescaped.
 */
export const menuOf = (siteRoot: string): string => {
    const script = readFileSync(join(siteRoot, 'js/menu.js'), 'utf8');
    const literal = /insertAdjacentHTML\('beforeend', ("(?:[^"\\]|\\.)*")\);/.exec(script)?.[1];
    if (literal === undefined) {
        throw new Error(`no menu markup in ${siteRoot}/js/menu.js`);
    }
    return JSON.parse(literal) as string;
};

/**
 * How many lists below the additional pages list the link `href` sits in:
 * 0 for a top-level page, 1 for its child, and so on; -1 when it is missing.
 */
export const additionalDepthOf = (menu: string, href: string): number => {
    const link = menu.indexOf(`href="${href}"`);
    const start = menu.indexOf('id="additional-pages"');
    if (link === -1 || start === -1) {
        return -1;
    }
    const before = menu.slice(start, link);
    return (before.match(/<ul\b/g) ?? []).length - (before.match(/<\/ul>/g) ?? []).length;
};
