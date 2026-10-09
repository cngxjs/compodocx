import { ts } from 'ts-morph';

import {
    type Declaration,
    declarationIn,
    declarationsBySymbol,
    resolveAlias,
    unwrapExpression
} from './declarations';
import {
    type AngularImports,
    angularImports,
    findContextApiCalls,
    findInjectCalls,
    visitOwnScope
} from './inject-calls';
import {
    compareKeys,
    type DiFacts,
    factKey,
    type InjectionContextVia,
    type SymbolKey,
    type TokenFacts,
    type TokenShape
} from './model';

export interface DiAnalysis {
    /** Keyed by `factKey`. */
    readonly di: ReadonlyMap<string, DiFacts>;
    readonly tokens: ReadonlyMap<string, TokenFacts>;
    readonly counts: {
        readonly providers: number;
        readonly features: number;
        readonly direct: number;
        readonly viaCall: number;
        readonly unresolved: number;
    };
}

type FunctionNode = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
type FunctionDeclarationEntry = Declaration & { readonly fn: FunctionNode };
/** A node whose body is analysed: a function-like declaration or a class. */
type ScopeOwner = ts.FunctionLikeDeclaration | ts.ClassDeclaration;

const PROVIDER_TYPES: ReadonlySet<string> = new Set(['Provider', 'EnvironmentProviders']);
const ARRAY_TYPES: ReadonlySet<string> = new Set(['Array', 'ReadonlyArray']);
const TOKEN_CLASSES: ReadonlySet<string> = new Set(['InjectionToken', 'HttpContextToken']);
const SIGNAL_TYPES: ReadonlySet<string> = new Set(['Signal', 'WritableSignal', 'InputSignal']);

const typeName = (node: ts.TypeReferenceNode): string =>
    ts.isIdentifier(node.typeName) ? node.typeName.text : node.typeName.right.text;

const singleTypeArgument = (node: ts.TypeReferenceNode): ts.TypeNode | undefined =>
    node.typeArguments?.length === 1 ? node.typeArguments[0] : undefined;

/**
 * `Provider`, `EnvironmentProviders`, arrays of them (`T[]`, `readonly T[]`,
 * `Array<T>`), and unions of those. Names are matched as written.
 */
export const isProviderType = (node: ts.TypeNode | undefined): boolean => {
    if (!node) {
        return false;
    }
    if (ts.isParenthesizedTypeNode(node)) {
        return isProviderType(node.type);
    }
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
        return isProviderType(node.type);
    }
    if (ts.isArrayTypeNode(node)) {
        return isProviderType(node.elementType);
    }
    if (ts.isUnionTypeNode(node)) {
        return node.types.every(isProviderType);
    }
    if (!ts.isTypeReferenceNode(node)) {
        return false;
    }
    if (ARRAY_TYPES.has(typeName(node))) {
        return isProviderType(singleTypeArgument(node));
    }
    return PROVIDER_TYPES.has(typeName(node)) && !node.typeArguments;
};

/** Element type `T` of a rest parameter `...name: T[]`, `readonly T[]` or `Array<T>`. */
export const restElementType = (fn: FunctionNode): ts.TypeReferenceNode | undefined => {
    let type = fn.parameters.find(parameter => parameter.dotDotDotToken)?.type;
    if (type && ts.isTypeOperatorNode(type) && type.operator === ts.SyntaxKind.ReadonlyKeyword) {
        type = type.type;
    }
    if (type && ts.isArrayTypeNode(type)) {
        type = type.elementType;
    } else if (type && ts.isTypeReferenceNode(type) && ARRAY_TYPES.has(typeName(type))) {
        type = singleTypeArgument(type);
    } else {
        return undefined;
    }
    return type && ts.isTypeReferenceNode(type) ? type : undefined;
};

const sortedKeys = (keys: Iterable<SymbolKey>): readonly SymbolKey[] => {
    const unique = new Map<string, SymbolKey>();
    for (const key of keys) {
        unique.set(factKey(key), key);
    }
    return [...unique.values()].sort(compareKeys);
};

const isStatic = (member: ts.ClassElement): boolean =>
    (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0;

/** Analysed scopes: a function body, or a class's instance initializers, constructor and instance methods. */
const scopesOf = (owner: ScopeOwner): readonly ts.Node[] => {
    if (!ts.isClassDeclaration(owner)) {
        return owner.body ? [owner.body] : [];
    }
    return owner.members.flatMap<ts.Node>(member => {
        if (ts.isPropertyDeclaration(member) && member.initializer && !isStatic(member)) {
            return [member.initializer];
        }
        if (ts.isConstructorDeclaration(member) && member.body) {
            return [member.body];
        }
        if (ts.isMethodDeclaration(member) && member.body && !isStatic(member)) {
            return [member.body];
        }
        return [];
    });
};

interface DirectScan {
    /** `inject()` or a context API needing an injection context. */
    readonly hit: boolean;
    readonly tokens: readonly ts.Expression[];
    /** Callee expressions of other calls and `new` expressions. */
    readonly callees: readonly ts.Expression[];
}

const scanScopes = (owner: ScopeOwner, imports: AngularImports): DirectScan => {
    const tokens: ts.Expression[] = [];
    const callees: ts.Expression[] = [];
    let hit = false;
    for (const scope of scopesOf(owner)) {
        const injects = findInjectCalls(scope, imports);
        tokens.push(...injects.map(call => call.token));
        hit = hit || injects.length > 0 || findContextApiCalls(scope, imports).length > 0;
        const handled = new Set(injects.map(call => call.node));
        visitOwnScope(scope, imports, node => {
            if (ts.isCallExpression(node) && !handled.has(node)) {
                callees.push(node.expression);
            } else if (ts.isNewExpression(node)) {
                callees.push(node.expression);
            }
        });
    }
    return { hit, tokens, callees };
};

const functionInitializer = (initializer: ts.Expression | undefined): FunctionNode | undefined => {
    const value = initializer && unwrapExpression(initializer);
    return value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
        ? value
        : undefined;
};

/** The declaration a callee resolves to, when it has a body this run analyses. */
const calleeOwner = (
    declaration: ts.Declaration,
    isRootFile: (sourceFile: ts.SourceFile) => boolean
): ScopeOwner | undefined => {
    if (!isRootFile(declaration.getSourceFile())) {
        return undefined;
    }
    if (
        (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) &&
        declaration.body
    ) {
        return declaration;
    }
    if (ts.isClassDeclaration(declaration)) {
        return declaration;
    }
    if (
        ts.isVariableDeclaration(declaration) ||
        ts.isPropertyAssignment(declaration) ||
        ts.isPropertyDeclaration(declaration)
    ) {
        return functionInitializer(declaration.initializer);
    }
    return undefined;
};

/** Facts of the provider/feature/token analysis over the declarations of one run. */
export const analyzeDi = (
    declarations: readonly Declaration[],
    checker: ts.TypeChecker,
    isRootFile: (sourceFile: ts.SourceFile) => boolean
): DiAnalysis => {
    const bySymbol = declarationsBySymbol(declarations);
    const importsCache = new Map<ts.SourceFile, AngularImports>();
    const importsOf = (node: ts.Node): AngularImports => {
        const sourceFile = node.getSourceFile();
        const cached = importsCache.get(sourceFile) ?? angularImports(sourceFile);
        importsCache.set(sourceFile, cached);
        return cached;
    };
    const symbolOf = (expression: ts.Expression): ts.Symbol | undefined =>
        resolveAlias(
            checker,
            checker.getSymbolAtLocation(
                ts.isPropertyAccessExpression(expression) ? expression.name : expression
            )
        );
    const keyOfExpression = (expression: ts.Expression): SymbolKey | undefined => {
        const symbol = symbolOf(expression);
        return symbol ? declarationIn(bySymbol.get(symbol), 'value')?.key : undefined;
    };
    const keyOfType = (node: ts.TypeReferenceNode): SymbolKey | undefined => {
        const symbol = resolveAlias(checker, checker.getSymbolAtLocation(node.typeName));
        return symbol ? declarationIn(bySymbol.get(symbol), 'type')?.key : undefined;
    };

    // Direct scans and one-level callee resolution.
    const scans = new Map<ScopeOwner, DirectScan>();
    const scan = (owner: ScopeOwner): DirectScan => {
        const cached = scans.get(owner) ?? scanScopes(owner, importsOf(owner));
        scans.set(owner, cached);
        return cached;
    };
    const calleeOwners = new Map<ScopeOwner, readonly ScopeOwner[]>();
    const calleesOf = (owner: ScopeOwner): readonly ScopeOwner[] => {
        const cached = calleeOwners.get(owner);
        if (cached) {
            return cached;
        }
        const owners = scan(owner)
            .callees.map(callee => symbolOf(callee)?.declarations ?? [])
            .map(declarationsOfCallee =>
                declarationsOfCallee
                    .map(d => calleeOwner(d, isRootFile))
                    .find((o): o is ScopeOwner => o !== undefined)
            )
            .filter((o): o is ScopeOwner => o !== undefined && o !== owner);
        calleeOwners.set(owner, owners);
        return owners;
    };
    const tokenKeys = (owner: ScopeOwner): readonly SymbolKey[] =>
        scan(owner)
            .tokens.map(keyOfExpression)
            .filter((k): k is SymbolKey => k !== undefined);

    const contextOf = (
        owner: ScopeOwner
    ): { via?: InjectionContextVia; unresolved: boolean; reads: readonly SymbolKey[] } => {
        if (scan(owner).hit) {
            return { via: 'direct', unresolved: false, reads: tokenKeys(owner) };
        }
        const callees = calleesOf(owner);
        const direct = callees.filter(callee => scan(callee).hit);
        if (direct.length > 0) {
            return { via: 'call', unresolved: false, reads: direct.flatMap(tokenKeys) };
        }
        const unresolved = callees.some(callee => calleesOf(callee).some(c => scan(c).hit));
        return { unresolved, reads: [] };
    };

    // Providers and features.
    const exportedFunctions = declarations.filter(
        (d): d is FunctionDeclarationEntry => d.exported && d.fn !== undefined
    );
    const providers = exportedFunctions.filter(d => isProviderType(d.fn.type));
    const providerSet = new Set(providers);
    const featureTypeOf = new Map<Declaration, SymbolKey>();
    const acceptedFeatures = new Map<string, string>(); // feature type key -> type name as written
    for (const provider of providers) {
        const rest = restElementType(provider.fn);
        const key = rest && keyOfType(rest);
        if (rest && key) {
            featureTypeOf.set(provider, key);
            acceptedFeatures.set(factKey(key), typeName(rest));
        }
    }
    for (const fn of exportedFunctions) {
        const returned = fn.fn.type;
        if (providerSet.has(fn) || !returned || !ts.isTypeReferenceNode(returned)) {
            continue;
        }
        const key = keyOfType(returned);
        if (key && acceptedFeatures.get(factKey(key)) === typeName(returned)) {
            featureTypeOf.set(fn, key);
        }
    }
    const features = new Set(
        exportedFunctions.filter(d => !providerSet.has(d) && featureTypeOf.has(d))
    );

    // Tokens a provider provides: `provide: X` in its body, plus those of providers it calls.
    const ownProvided = (provider: FunctionDeclarationEntry): readonly SymbolKey[] => {
        const keys: SymbolKey[] = [];
        const walk = (node: ts.Node): void => {
            if (ts.isPropertyAssignment(node) && node.name.getText() === 'provide') {
                const key = keyOfExpression(node.initializer);
                if (key) {
                    keys.push(key);
                }
            }
            ts.forEachChild(node, walk);
        };
        if (provider.fn.body) {
            walk(provider.fn.body);
        }
        return keys;
    };
    const providerByNode = new Map<ts.Node, FunctionDeclarationEntry>(
        providers.map(p => [p.fn, p])
    );
    const providedTokens = (provider: FunctionDeclarationEntry): readonly SymbolKey[] => {
        const called: SymbolKey[] = [];
        const walk = (node: ts.Node): void => {
            if (ts.isCallExpression(node)) {
                const callee = (symbolOf(node.expression)?.declarations ?? [])
                    .map(d => calleeOwner(d, isRootFile))
                    .map(o => (o ? providerByNode.get(o) : undefined))
                    .find(p => p !== undefined && p !== provider);
                if (callee) {
                    called.push(...ownProvided(callee));
                }
            }
            ts.forEachChild(node, walk);
        };
        if (provider.fn.body) {
            walk(provider.fn.body);
        }
        return sortedKeys([...ownProvided(provider), ...called]);
    };

    // Per-declaration facts.
    const di = new Map<string, DiFacts>();
    const counts = {
        providers: providers.length,
        features: features.size,
        direct: 0,
        viaCall: 0,
        unresolved: 0
    };
    const roleOf = (declaration: Declaration): DiFacts['role'] => {
        if (declaration.fn && providerByNode.has(declaration.fn)) {
            return 'provider';
        }
        return features.has(declaration as FunctionDeclarationEntry) ? 'feature' : undefined;
    };
    const analysed = new Set<string>();
    for (const declaration of declarations) {
        const key = factKey(declaration.key);
        if (analysed.has(key)) {
            continue;
        }
        analysed.add(key);
        const owner: ScopeOwner | undefined = declaration.fn ?? declaration.cls;
        const context = owner ? contextOf(owner) : { unresolved: false, reads: [] };
        if (context.via === 'direct') {
            counts.direct++;
        } else if (context.via === 'call') {
            counts.viaCall++;
        } else if (context.unresolved) {
            counts.unresolved++;
        }
        const provider = declaration.fn && providerByNode.get(declaration.fn);
        const facts: DiFacts = {
            role: roleOf(declaration),
            featureType: featureTypeOf.get(declaration),
            providesTokens: provider ? providedTokens(provider) : [],
            readsTokens: sortedKeys(context.reads),
            usesInjectionContext: context.via
        };
        const hasFacts =
            facts.role !== undefined ||
            facts.featureType !== undefined ||
            facts.providesTokens.length > 0 ||
            facts.readsTokens.length > 0 ||
            facts.usesInjectionContext !== undefined;
        if (hasFacts) {
            di.set(key, facts);
        }
    }

    // Token declarations.
    const tokens = new Map<string, TokenFacts>();
    const shapeOf = (node: ts.TypeNode | undefined): TokenShape => tokenShape(node, checker);
    for (const declaration of declarations) {
        const value = declaration.initializer;
        if (
            !value ||
            !ts.isNewExpression(value) ||
            !ts.isIdentifier(value.expression) ||
            !TOKEN_CLASSES.has(value.expression.text)
        ) {
            continue;
        }
        const key = factKey(declaration.key);
        const matches = (keys: readonly SymbolKey[]) => keys.some(k => factKey(k) === key);
        const providedBy = [...di]
            .filter(([, f]) => matches(f.providesTokens))
            .map(([k]) => keyFromFactKey(k));
        const injectedBy = [...di]
            .filter(([, f]) => matches(f.readsTokens))
            .map(([k]) => keyFromFactKey(k));
        tokens.set(key, {
            shape: shapeOf(value.typeArguments?.[0]),
            providedBy: sortedKeys(providedBy),
            injectedBy: sortedKeys(injectedBy)
        });
    }

    return { di, tokens, counts };
};

const keyFromFactKey = (key: string): SymbolKey => {
    const isType = key.startsWith('type:');
    const rest = isType ? key.slice('type:'.length) : key;
    const at = rest.lastIndexOf('#');
    const base = { file: rest.slice(0, at), name: rest.slice(at + 1) };
    return isType ? { ...base, space: 'type' } : base;
};

const isPrimitive = (node: ts.TypeNode): boolean =>
    node.kind === ts.SyntaxKind.StringKeyword ||
    node.kind === ts.SyntaxKind.NumberKeyword ||
    node.kind === ts.SyntaxKind.BooleanKeyword ||
    ts.isLiteralTypeNode(node);

/** Shape of a token's type argument. */
export const tokenShape = (node: ts.TypeNode | undefined, checker: ts.TypeChecker): TokenShape => {
    if (!node) {
        return 'other';
    }
    if (ts.isParenthesizedTypeNode(node)) {
        return tokenShape(node.type, checker);
    }
    if (ts.isFunctionTypeNode(node)) {
        return 'function';
    }
    if (ts.isUnionTypeNode(node)) {
        return 'union';
    }
    if (isPrimitive(node)) {
        return 'primitive';
    }
    if (!ts.isTypeReferenceNode(node)) {
        return 'other';
    }
    if (SIGNAL_TYPES.has(typeName(node))) {
        return 'signal';
    }
    const declaration = resolveAlias(checker, checker.getSymbolAtLocation(node.typeName))
        ?.declarations?.[0];
    if (declaration && ts.isInterfaceDeclaration(declaration)) {
        return 'interface';
    }
    if (
        declaration &&
        ts.isTypeAliasDeclaration(declaration) &&
        ts.isFunctionTypeNode(declaration.type)
    ) {
        return 'function';
    }
    return 'other';
};
