import { ts } from 'ts-morph';

import type { INamespaceAlias, INamespaceDep } from '../angular/dependencies.interfaces';

/**
 * Where a declaration sits: inside a namespace (`namespace` is the dotted
 * chain, e.g. `Outer.Inner`) or inside a module augmentation (`augments` is
 * the augmented module, `'global'` for `declare global`). Top-level code has
 * neither.
 */
export interface NamespaceScope {
    readonly namespace?: string;
    readonly augments?: string;
}

/** One namespace a module declaration opens, outermost first. */
export interface OpenedNamespace {
    /** Last segment, e.g. `Inner`. */
    readonly name: string;
    /** Parent chain, absent for a top-level namespace. */
    readonly namespace?: string;
    /** The declaration that names the segment (its JSDoc describes it). */
    readonly node: ts.ModuleDeclaration;
}

export interface EnteredModule {
    readonly scope: NamespaceScope;
    readonly namespaces: readonly OpenedNamespace[];
    readonly body: ts.ModuleBlock | undefined;
}

/** `Ns.Member` inside a namespace, the bare name elsewhere. */
export const qualify = (scope: NamespaceScope, name: string): string =>
    scope.namespace ? `${scope.namespace}.${name}` : name;

const augmentationTarget = (node: ts.ModuleDeclaration): string | undefined => {
    if (node.flags & ts.NodeFlags.GlobalAugmentation) {
        return 'global';
    }
    return ts.isStringLiteral(node.name) ? node.name.text : undefined;
};

/**
 * The scope of a module declaration's body. A string-literal name or
 * `declare global` is an augmentation (its members are not namespaced); an
 * identifier opens a namespace, a dotted declaration (`namespace A.B {}`)
 * opens one per segment.
 */
export const enterModule = (node: ts.ModuleDeclaration, scope: NamespaceScope): EnteredModule => {
    const augments = augmentationTarget(node);
    if (augments !== undefined) {
        const body = node.body && ts.isModuleBlock(node.body) ? node.body : undefined;
        return { scope: { augments }, namespaces: [], body };
    }
    const namespaces: OpenedNamespace[] = [];
    let parent = scope.namespace;
    let current: ts.ModuleDeclaration = node;
    for (;;) {
        namespaces.push({ name: current.name.text, namespace: parent, node: current });
        parent = qualify({ namespace: parent }, current.name.text);
        if (!current.body || !ts.isModuleDeclaration(current.body)) {
            break;
        }
        current = current.body;
    }
    const body = current.body && ts.isModuleBlock(current.body) ? current.body : undefined;
    const inner: NamespaceScope = scope.augments
        ? { namespace: parent, augments: scope.augments }
        : { namespace: parent };
    return { scope: inner, namespaces, body };
};

/** Whether a declaration sits inside a `declare namespace` (members exported implicitly). */
export const inAmbientNamespace = (node: ts.Node): boolean => {
    for (let current = node.parent; current; current = current.parent) {
        if (
            ts.isModuleDeclaration(current) &&
            ts.getCombinedModifierFlags(current) & ts.ModifierFlags.Ambient
        ) {
            return true;
        }
    }
    return false;
};

/** Copies the scope onto an engine object; a no-op at the top level. */
export const withScope = <T>(dep: T, scope: NamespaceScope): T => {
    if (!dep) {
        return dep;
    }
    if (scope.namespace) {
        (dep as { namespace?: string }).namespace = scope.namespace;
    }
    if (scope.augments) {
        (dep as { augments?: string }).augments = scope.augments;
    }
    return dep;
};

interface Member {
    readonly name: string;
    readonly namespace?: string;
}

/**
 * Each namespace with the qualified names of what it declares directly
 * (inner namespaces included), sorted.
 */
export const namespaceMembers = <T extends Member & { members: string[] }>(
    namespaces: readonly T[],
    items: readonly Member[]
): T[] =>
    namespaces.map(entry => {
        const qualified = qualify(entry, entry.name);
        const members = [...items, ...namespaces]
            .filter(item => item.namespace === qualified)
            .map(item => qualify(item, item.name));
        return { ...entry, members: [...new Set(members)].sort() };
    });

/** The namespace chain a declaration sits in (`Outer.Inner`), undefined at the top level. */
const namespaceChainOf = (node: ts.Node): string | undefined => {
    const names: string[] = [];
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isModuleDeclaration(current) && ts.isIdentifier(current.name)) {
            names.unshift(current.name.text);
        }
    }
    return names.length > 0 ? names.join('.') : undefined;
};

/** What an alias points to: the qualified name and file of the target, as written when unresolved. */
export interface AliasTarget {
    readonly target: string;
    readonly targetFile?: string;
}

/**
 * The target of `import X = Ns.Y`, followed through import renames to its
 * declaration. `relativeFile` turns a source file name into the engine's
 * cwd-relative form. Undefined for `import X = require('...')`.
 */
export const aliasTarget = (
    checker: ts.TypeChecker,
    node: ts.ImportEqualsDeclaration,
    relativeFile: (fileName: string) => string
): AliasTarget | undefined => {
    const reference = node.moduleReference;
    if (ts.isExternalModuleReference(reference)) {
        return undefined;
    }
    const written = reference.getText();
    // The alias's own symbol resolves through local import aliases (`import G = Geometry`).
    const own = checker.getSymbolAtLocation(node.name);
    let symbol =
        own && own.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(own)
            : checker.getSymbolAtLocation(reference);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        symbol = checker.getAliasedSymbol(symbol);
    }
    const declaration = symbol?.declarations?.[0];
    if (!symbol || !declaration) {
        return { target: written };
    }
    return {
        target: qualify({ namespace: namespaceChainOf(declaration) }, symbol.name),
        targetFile: relativeFile(declaration.getSourceFile().fileName)
    };
};

/** Each namespace with the aliases it declares (in name order); the others unchanged. */
export const withNamespaceAliases = (
    namespaces: readonly INamespaceDep[],
    aliases: readonly INamespaceAlias[]
): INamespaceDep[] =>
    namespaces.map(entry => {
        const qualified = qualify(entry, entry.name);
        const own = aliases
            .filter(alias => alias.namespace === qualified)
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        return own.length > 0 ? { ...entry, aliases: own } : entry;
    });
