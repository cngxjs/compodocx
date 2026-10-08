import * as fs from 'node:fs';
import * as path from 'node:path';
import { pageLocation, type UtilityKind } from '../../../src/app/links/layout';

/** Folder of the symbol pages of a kind, e.g. the functions folder. */
const kindFolder = (kind: UtilityKind): string =>
    pageLocation({ type: 'symbol', kind, name: 'x' }).path;

const pagesOf = (dist: string, kind: UtilityKind): string[] => {
    const folder = path.join(dist, kindFolder(kind));
    return fs.existsSync(folder)
        ? fs
              .readdirSync(folder)
              .filter(name => name.endsWith('.html'))
              .sort()
              .map(name => path.join(folder, name))
        : [];
};

/** Whether any symbol of a kind got a page. */
export const hasKindPages = (dist: string, kind: UtilityKind): boolean =>
    pagesOf(dist, kind).length > 0;

/** Every symbol page of a kind, concatenated, for content assertions. */
export const readKindPages = (dist: string, kind: UtilityKind): string =>
    pagesOf(dist, kind)
        .map(file => fs.readFileSync(file, 'utf8'))
        .join('\n');
