import { posix } from 'node:path';

/**
 * Flatten any relative `from`/`import` source path so the file can be packed
 * flat under `src/app/`. The StackBlitz workspace is one directory; nested
 * folders in the consumer repo collapse to a single level here.
 *
 * - `from '../shared/util'` → `from './util'`
 * - `from './sibling.ts'`   → `from './sibling'`
 * - `import './polyfill'`   → `import './polyfill'`  (already flat)
 * - `export * from '../x'`  → `export * from './x'`
 * - `from '@angular/core'`  → unchanged                (bare specifier)
 *
 * Trailing `.ts`/`.tsx` is stripped — Angular's bundler resolves extensionless.
 * The quotes must match (backreference): the rewrite writes the specifier back.
 */
const REL_IMPORT_RE = /(\bfrom\b|\bimport\b)(\s+)(['"])(\.\.?\/[^'"]+)\3/g;

const stripTsExtension = (base: string): string => {
    if (base.endsWith('.tsx')) {
        return base.slice(0, -4);
    }
    if (base.endsWith('.ts')) {
        return base.slice(0, -3);
    }
    return base;
};

export function rewriteRelativeImports(source: string): string {
    return source.replace(REL_IMPORT_RE, (_match, kw, ws, quote, path) => {
        const base = stripTsExtension(posix.basename(path));
        return `${kw}${ws}${quote}./${base}${quote}`;
    });
}

/**
 * Rewrite `templateUrl`, `styleUrl`, and `styleUrls` decorator values so they
 * resolve against the flat `src/app/` layout the manifest builder ships.
 * Template literals and computed property names are NOT supported — string
 * literals only. Authors with deep example folders should use string literals.
 */
const TEMPLATE_URL_RE = /(templateUrl\s*:\s*)(['"])(\.\.?\/[^'"]+)\2/g;
const STYLE_URL_RE = /(styleUrl\s*:\s*)(['"])(\.\.?\/[^'"]+)\2/g;
const STYLE_URLS_RE = /(styleUrls\s*:\s*\[)([^\]]+)(\])/g;
const STYLE_URLS_ITEM_RE = /(['"])(\.\.?\/[^'"]+)\1/g;

export function rewriteDecoratorUrls(source: string): string {
    return source
        .replace(TEMPLATE_URL_RE, (_m, prefix, q, p) => `${prefix}${q}./${posix.basename(p)}${q}`)
        .replace(STYLE_URL_RE, (_m, prefix, q, p) => `${prefix}${q}./${posix.basename(p)}${q}`)
        .replace(STYLE_URLS_RE, (_m, prefix, list, suffix) => {
            const rewritten = list.replace(
                STYLE_URLS_ITEM_RE,
                (_m2: string, q: string, p: string) => `${q}./${posix.basename(p)}${q}`
            );
            return `${prefix}${rewritten}${suffix}`;
        });
}
