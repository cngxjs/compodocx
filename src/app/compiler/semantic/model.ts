/**
 * Facts about the documented symbols that need the whole project: which
 * barrel exports a symbol, its dependency injection role, the tokens it
 * provides or reads, and who uses it. Data only; nothing here is rendered.
 */

/** Interfaces and type aliases live in the type space, everything else in the value space. */
export type DeclarationSpace = 'value' | 'type';

/**
 * A top-level declaration. `file` is relative to the process cwd, with
 * forward slashes. `space` tells a const and a type of one name apart; an
 * absent space means `value`.
 */
export interface SymbolKey {
    readonly name: string;
    readonly file: string;
    readonly space?: DeclarationSpace;
}

export interface EntryPoint {
    /** `@scope/pkg/sub`, or the entry file when no import path is known. */
    readonly importPath: string;
    /** Entry file, relative to the process cwd. */
    readonly file: string;
    /** Directory the entry point owns, relative to the process cwd. */
    readonly root: string;
    readonly source: 'ng-package' | 'tsconfig-paths';
}

export type TokenShape = 'interface' | 'signal' | 'function' | 'primitive' | 'union' | 'other';

export type InjectionContextVia = 'direct' | 'call';

export interface DiFacts {
    readonly role?: 'provider' | 'feature';
    /** The feature type a provider accepts or a feature function returns. */
    readonly featureType?: SymbolKey;
    readonly providesTokens: readonly SymbolKey[];
    readonly readsTokens: readonly SymbolKey[];
    readonly usesInjectionContext?: InjectionContextVia;
}

export interface TokenFacts {
    readonly shape: TokenShape;
    readonly providedBy: readonly SymbolKey[];
    readonly injectedBy: readonly SymbolKey[];
}

export interface SymbolFacts {
    readonly key: SymbolKey;
    /** 1-based line of the declaration. */
    readonly line?: number;
    /** Import path of the nearest exporting barrel. */
    readonly entryPoint?: string;
    /** Import paths of every barrel that exports the symbol, sorted. */
    readonly exportedBy: readonly string[];
    readonly notExported: boolean;
    readonly di?: DiFacts;
    readonly token?: TokenFacts;
    readonly usedBy: readonly SymbolKey[];
}

export interface SemanticSummary {
    readonly entryPoints: number;
    readonly providers: number;
    readonly features: number;
    readonly injectionContext: {
        readonly direct: number;
        readonly viaCall: number;
        readonly unresolved: number;
    };
    readonly notExported: number;
}

export interface SemanticModel {
    readonly entryPoints: readonly EntryPoint[];
    /** Keyed by `factKey`. */
    readonly facts: ReadonlyMap<string, SymbolFacts>;
    readonly summary: SemanticSummary;
}

/** The one-line build log summary of the semantic stage. */
export const formatSemanticSummary = (summary: SemanticSummary): string => {
    const { direct, viaCall, unresolved } = summary.injectionContext;
    return (
        `Semantic analysis: ${summary.entryPoints} entry points, ${summary.providers} providers, ` +
        `${summary.features} feature functions, ${direct}+${viaCall} use the injection context ` +
        `(${unresolved} unresolved), ${summary.notExported} exported symbols reach no entry point`
    );
};

/** `${file}#${name}` for values, `type:${file}#${name}` for types. */
export const factKey = (key: SymbolKey): string =>
    `${key.space === 'type' ? 'type:' : ''}${key.file}#${key.name}`;

export const compareKeys = (a: SymbolKey, b: SymbolKey): number => {
    if (a.file !== b.file) {
        return compareText(a.file, b.file);
    }
    return a.name === b.name
        ? compareText(a.space ?? 'value', b.space ?? 'value')
        : compareText(a.name, b.name);
};

/** Code-unit order, independent of the locale, so output stays byte-stable. */
export const compareText = (a: string, b: string): number => {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
};

export const emptyModel = (): SemanticModel => ({
    entryPoints: [],
    facts: new Map(),
    summary: {
        entryPoints: 0,
        providers: 0,
        features: 0,
        injectionContext: { direct: 0, viaCall: 0, unresolved: 0 },
        notExported: 0
    }
});
