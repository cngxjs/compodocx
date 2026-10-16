import { type DiView, placementOf } from '../../app/di/model';
import type { SymbolEntry } from '../../app/links/symbol-table';

/** Members of a feature by the section that lists them. */
export interface FeatureMembers {
    readonly components: readonly SymbolEntry[];
    readonly directives: readonly SymbolEntry[];
    readonly pipes: readonly SymbolEntry[];
    readonly services: readonly SymbolEntry[];
    /** Tokens, providers, feature functions and feature types. */
    readonly configuration: readonly SymbolEntry[];
    readonly utilities: readonly SymbolEntry[];
    readonly constants: readonly SymbolEntry[];
    readonly types: readonly SymbolEntry[];
    readonly classes: readonly SymbolEntry[];
}

export type FeatureSection = keyof FeatureMembers;

/**
 * The section of a feature member, from its kind and its place in the DI
 * view. Hidden symbols and style files have none. Shared by the feature page
 * and the sidebar.
 */
export const sectionOf = (
    entry: SymbolEntry,
    view: DiView | undefined
): FeatureSection | undefined => {
    const placement = placementOf(view, entry.id).type;
    if (placement === 'hidden' || entry.ref.kind === 'style') {
        return undefined;
    }
    if (placement !== 'own' || entry.ref.kind === 'token') {
        return 'configuration';
    }
    switch (entry.ref.kind) {
        case 'component':
            return 'components';
        case 'directive':
            return 'directives';
        case 'pipe':
            return 'pipes';
        case 'injectable':
            return 'services';
        case 'variable':
            return 'constants';
        case 'interface':
        case 'typealias':
        case 'enumeration':
            return 'types';
        case 'class':
        case 'entity':
            return 'classes';
        default:
            return 'utilities';
    }
};
