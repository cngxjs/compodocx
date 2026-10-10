/**
 * Where pages lived before they moved under their entry point and feature.
 * The only module besides `layout.ts` that spells out output folders: the
 * ones earlier versions wrote, kept so old URLs can be redirected.
 *
 * Generations covered:
 * - kind folders (`components/X.html`, `functions/x.html`, ...) with `-1`,
 *   `-2` for same-name copies in engine order and names not made safe;
 * - provider and cluster pages in `providers/`;
 * - `miscellaneous/<kind>/<name>.html` pages and `miscellaneous/<kind>.html#<name>`
 *   collection anchors of utility symbols;
 * - feature pages `features/<segments>.html` and bucket pages
 *   `categories/<segments>.html`.
 */

import { KIND_FOLDER, type PageKind, pageFile } from './layout';
import type { SymbolId, TableKind } from './symbol-id';
import type { SymbolEntry, SymbolTable } from './symbol-table';

const MISC_FOLDER = 'miscellaneous';
const FEATURE_PAGES_FOLDER = 'features';
const BUCKET_FOLDER = 'categories';

/** Kinds earlier versions numbered in the table (engine order), not on the engine objects. */
const TABLE_NUMBERED: ReadonlySet<string> = new Set([
    'function',
    'variable',
    'typealias',
    'enumeration',
    'token'
]);

/** Utility kinds and the folder their old miscellaneous pages used. */
const UTILITY_KINDS: ReadonlySet<string> = new Set([
    'function',
    'variable',
    'typealias',
    'enumeration'
]);

type Data = {
    readonly ctype?: unknown;
    readonly subtype?: unknown;
    readonly duplicateName?: unknown;
};

/**
 * The engine list a symbol came from: a guard, interceptor or resolver
 * function or constant sat in the functions or variables list.
 */
const engineKind = (entry: SymbolEntry): TableKind => {
    const data = entry.data as Data;
    if (
        data?.ctype === 'miscellaneous' &&
        (data.subtype === 'function' || data.subtype === 'variable')
    ) {
        return data.subtype;
    }
    if (data?.ctype === 'miscellaneous' && data.subtype === 'enum') {
        return 'enumeration';
    }
    return entry.ref.kind;
};

/**
 * The page name each symbol had in the kind folders: same-name copies of the
 * table-numbered kinds got `-1`, `-2` in engine order, the other kinds kept
 * the engine's own duplicate name.
 */
export const legacyNames = (table: SymbolTable): ReadonlyMap<SymbolId, string> => {
    const names = new Map<SymbolId, string>();
    for (const [name, ids] of table.byName) {
        const seen = new Map<string, SymbolId[]>();
        for (const id of ids) {
            const entry = table.byId.get(id);
            if (!entry) {
                continue;
            }
            const kind = engineKind(entry);
            const group = seen.get(kind) ?? [];
            if (!group.includes(id)) {
                group.push(id);
                seen.set(kind, group);
            }
        }
        for (const [kind, group] of seen) {
            group.forEach((id, i) => {
                const entry = table.byId.get(id);
                const engineName = (entry?.data as Data | undefined)?.duplicateName;
                if (TABLE_NUMBERED.has(kind)) {
                    names.set(id, i === 0 ? name : `${name}-${i}`);
                } else {
                    names.set(id, typeof engineName === 'string' ? engineName : name);
                }
            });
        }
    }
    return names;
};

/** How a symbol is documented now, for its old provider and cluster pages. */
export type LegacyPlacement = 'own' | 'provider' | 'cluster-owner' | 'other';

/** Every root-relative path a symbol's page had in earlier versions (anchors included). */
export const legacyPaths = (
    entry: SymbolEntry,
    oldName: string,
    placement: LegacyPlacement
): readonly string[] => {
    const kind = engineKind(entry);
    const paths = [pageFile(KIND_FOLDER[entry.ref.kind as PageKind], oldName)];
    if (kind !== entry.ref.kind) {
        paths.push(pageFile(KIND_FOLDER[kind as PageKind], oldName));
    }
    if (placement === 'provider' || placement === 'cluster-owner') {
        paths.push(pageFile(KIND_FOLDER.provider, oldName));
    }
    if (UTILITY_KINDS.has(kind)) {
        const folder = KIND_FOLDER[kind as PageKind];
        paths.push(pageFile(`${MISC_FOLDER}/${folder}`, oldName));
        paths.push(`${pageFile(MISC_FOLDER, folder)}#${entry.ref.name}`);
    }
    return paths;
};

/** The old pages of a feature: its feature page and the bucket page of the same segments. */
export const legacyFeaturePaths = (segments: readonly string[]): readonly string[] => {
    const parents = segments.slice(0, -1).join('/');
    const last = segments[segments.length - 1] ?? '';
    return [
        pageFile([FEATURE_PAGES_FOLDER, parents].filter(Boolean).join('/'), last),
        pageFile([BUCKET_FOLDER, parents].filter(Boolean).join('/'), last)
    ];
};

/** The old collection page of each utility kind, by the folder its group anchor uses. */
export const legacyCollectionPaths = (): readonly { path: string; group: string }[] =>
    [...UTILITY_KINDS].map(kind => {
        const folder = KIND_FOLDER[kind as PageKind];
        return { path: pageFile(MISC_FOLDER, folder), group: folder };
    });
