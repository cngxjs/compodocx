import * as path from 'node:path';
import { err, ok, type Result } from '../../lib';
import type { SymbolKey } from '../compiler/semantic';
import type { EntityKind } from '../engines/dependencies.engine';

/**
 * A documented symbol: its kind, declaring file and name. The entry point is
 * not part of the identity, a barrel edit must not rename a symbol.
 */
export interface SymbolRef extends SymbolKey {
    readonly kind: TableKind;
}

/**
 * The kind a symbol is documented as: the engine kind, or `guard`,
 * `interceptor` or `resolver` for a function or constant that is one
 * (`functionalKind`). The engine keeps those under miscellaneous.
 */
export type TableKind = EntityKind | 'resolver';

const FUNCTIONAL_KINDS: ReadonlySet<string> = new Set(['guard', 'interceptor', 'resolver']);

export const presentationKind = (kind: EntityKind, item: unknown): TableKind => {
    const functional = (item as { functionalKind?: unknown } | undefined)?.functionalKind;
    const isMisc = kind === 'function' || kind === 'variable';
    return isMisc && typeof functional === 'string' && FUNCTIONAL_KINDS.has(functional)
        ? (functional as TableKind)
        : kind;
};

export type SymbolId = string & { readonly __symbolId: true };

const SYMBOL_KINDS: ReadonlySet<string> = new Set<TableKind>([
    'component',
    'directive',
    'injectable',
    'token',
    'pipe',
    'class',
    'interface',
    'guard',
    'interceptor',
    'entity',
    'function',
    'variable',
    'typealias',
    'enumeration',
    'resolver'
]);

const isTableKind = (value: string): value is TableKind => SYMBOL_KINDS.has(value);

/** `kind:file#name`. Overloads share one id; a const and a type of one name do not. */
export const symbolId = (ref: SymbolRef): SymbolId =>
    `${ref.kind}:${ref.file}#${ref.name}` as SymbolId;

export const parseSymbolId = (id: string): Result<SymbolRef> => {
    const colon = id.indexOf(':');
    const hash = id.lastIndexOf('#');
    if (colon <= 0 || hash <= colon || hash === id.length - 1) {
        return err(`Malformed symbol id: ${id}`);
    }
    const kind = id.slice(0, colon);
    if (!isTableKind(kind)) {
        return err(`Unknown symbol kind in id: ${id}`);
    }
    return ok({ kind, file: id.slice(colon + 1, hash), name: id.slice(hash + 1) });
};

const TYPE_SPACE_KINDS: ReadonlySet<TableKind> = new Set<TableKind>(['interface', 'typealias']);

/** The semantic stage's key (file, name, declaration space) for joining its facts. */
export const toSymbolKey = (ref: SymbolRef): SymbolKey =>
    TYPE_SPACE_KINDS.has(ref.kind)
        ? { name: ref.name, file: ref.file, space: 'type' }
        : { name: ref.name, file: ref.file };

/**
 * The id form of a source file: relative to `cwd`, forward slashes. Accepts
 * both the crawler's form (cwd prefix stripped, absolute outside cwd) and the
 * semantic stage's form (`path.relative`), and maps them to the same string.
 */
export const symbolFile = (file: string, cwd: string): string => {
    if (!file) {
        return '';
    }
    const slashed = file.replaceAll('\\', '/');
    if (path.isAbsolute(file) || /^[A-Za-z]:\//.test(slashed)) {
        return path.relative(cwd, file).split(path.sep).join('/');
    }
    return path.posix.normalize(slashed);
};
