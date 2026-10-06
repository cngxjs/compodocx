/**
 * Facts about the documented symbols that need the whole project: which
 * barrel exports a symbol, its dependency injection role, the tokens it
 * provides or reads, and who uses it. Data only; nothing here is rendered.
 */

/** A top-level declaration. `file` is relative to the process cwd, with forward slashes. */
export interface SymbolKey {
    readonly name: string;
    readonly file: string;
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
    /** Keyed by `${file}#${name}`. */
    readonly facts: ReadonlyMap<string, SymbolFacts>;
    readonly summary: SemanticSummary;
}

export const factKey = (key: SymbolKey): string => `${key.file}#${key.name}`;

export const compareKeys = (a: SymbolKey, b: SymbolKey): number =>
    a.file === b.file ? compareText(a.name, b.name) : compareText(a.file, b.file);

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
