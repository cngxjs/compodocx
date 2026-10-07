import * as path from 'node:path';
import { err, ok, type Result } from '../../lib';
import type { SymbolKey } from '../compiler/semantic';
import type { EntityKind } from '../engines/dependencies.engine';

/**
 * A documented symbol: its kind, declaring file and name. The entry point is
 * not part of the identity, a barrel edit must not rename a symbol.
 */
export interface SymbolRef extends SymbolKey {
    readonly kind: EntityKind;
}

export type SymbolId = string & { readonly __symbolId: true };

const SYMBOL_KINDS: ReadonlySet<string> = new Set<EntityKind>([
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
    'enumeration'
]);

const isEntityKind = (value: string): value is EntityKind => SYMBOL_KINDS.has(value);

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
    if (!isEntityKind(kind)) {
        return err(`Unknown symbol kind in id: ${id}`);
    }
    return ok({ kind, file: id.slice(colon + 1, hash), name: id.slice(hash + 1) });
};

/** The semantic stage's key (file + name) for joining its facts. */
export const toSymbolKey = (ref: SymbolRef): SymbolKey => ({ name: ref.name, file: ref.file });

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
