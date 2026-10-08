import { factKey, type SemanticModel, type SymbolFacts } from '../../app/compiler/semantic/model';
import type { DiView } from '../../app/di/model';
import type { EntityKind } from '../../app/engines/dependencies.engine';
import { presentationKind, type TableKind, toSymbolKey } from '../../app/links/symbol-id';
import { entryInFile, type SymbolEntry, type SymbolTable } from '../../app/links/symbol-table';

export interface FactsContext {
    readonly symbols?: SymbolTable;
    readonly semantic?: SemanticModel;
    readonly di?: DiView;
}

/** The table entry of an engine object of `kind` (its `name`, read from its `file`). */
export const ownEntry = (
    data: FactsContext,
    kind: EntityKind | TableKind,
    item: { readonly name?: unknown; readonly file?: unknown } | undefined
): SymbolEntry | undefined => {
    if (!data.symbols || typeof item?.name !== 'string') {
        return undefined;
    }
    const file = typeof item.file === 'string' ? item.file : undefined;
    return entryInFile(data.symbols, presentationKind(kind as EntityKind, item), item.name, file);
};

/** The semantic facts of a table entry; undefined without the semantic stage. */
export const entryFacts = (
    semantic: SemanticModel | undefined,
    entry: SymbolEntry | undefined
): SymbolFacts | undefined => entry && semantic?.facts.get(factKey(toSymbolKey(entry.ref)));

/** The semantic facts of an engine object of `kind`. */
export const symbolFacts = (
    data: FactsContext,
    kind: EntityKind | TableKind,
    item: { readonly name?: unknown; readonly file?: unknown } | undefined
): SymbolFacts | undefined => entryFacts(data.semantic, ownEntry(data, kind, item));
