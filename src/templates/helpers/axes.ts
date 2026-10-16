import { factKey, type SemanticModel } from '../../app/compiler/semantic/model';
import { toSymbolKey } from '../../app/links/symbol-id';
import type { SymbolEntry } from '../../app/links/symbol-table';

/** A symbol's value on one declared axis. */
export interface EntityAxis {
    readonly name: string;
    readonly label: string;
    readonly value: string;
}

/** The axis values of a table entry, in declaration order; empty without axes. */
export const axisValuesOf = (
    semantic: SemanticModel | undefined,
    entry: SymbolEntry | undefined
): readonly EntityAxis[] => {
    const model = semantic?.axes;
    if (!model || !entry) {
        return [];
    }
    const values = model.valuesOf.get(factKey(toSymbolKey(entry.ref)));
    if (!values) {
        return [];
    }
    return model.axes.flatMap(axis => {
        const value = values.get(axis.name);
        return value === undefined ? [] : [{ name: axis.name, label: axis.label, value }];
    });
};
