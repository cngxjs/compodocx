import {
    type AxisClassification,
    type AxisConfig,
    classifyAxes,
    type SemanticModel
} from '../compiler/semantic';
import type { SymbolTable } from '../links';
import { documentedSymbols } from './features';

/** The declared axes applied to the documented symbols. */
export const deriveAxes = (
    model: SemanticModel,
    symbols: SymbolTable,
    axes: Readonly<Record<string, AxisConfig>>
): AxisClassification =>
    classifyAxes(
        documentedSymbols(symbols, model).map(({ key, entry, facts }) => ({
            key,
            file: entry.ref.file,
            name: entry.ref.name,
            kind: entry.ref.kind,
            tags: facts?.axisTags
        })),
        axes
    );
