import * as fs from 'node:fs';
import * as path from 'node:path';
import type { UtilityKind } from '../../../src/app/links/layout';

const htmlFiles = (dir: string): string[] =>
    fs.existsSync(dir)
        ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                  return htmlFiles(full);
              }
              return entry.name.endsWith('.html') ? [full] : [];
          })
        : [];

/** Symbol pages of a kind anywhere in the tree (pages live in their feature folder). */
const pagesOf = (dist: string, kind: UtilityKind): string[] =>
    htmlFiles(dist)
        .filter(file =>
            fs.readFileSync(file, 'utf8').includes(`COMPODOC_CURRENT_PAGE_CONTEXT = '${kind}'`)
        )
        .sort();

/** Whether any symbol of a kind got a page. */
export const hasKindPages = (dist: string, kind: UtilityKind): boolean =>
    pagesOf(dist, kind).length > 0;

/** Every symbol page of a kind, concatenated, for content assertions. */
export const readKindPages = (dist: string, kind: UtilityKind): string =>
    pagesOf(dist, kind)
        .map(file => fs.readFileSync(file, 'utf8'))
        .join('\n');
