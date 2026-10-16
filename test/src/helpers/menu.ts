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
