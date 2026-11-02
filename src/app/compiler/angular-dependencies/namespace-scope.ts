import { ts } from 'ts-morph';

/**
 * Where a declaration sits: inside a namespace (`namespace` is the dotted
 * chain, e.g. `Outer.Inner`). Top-level code has none.
 */
export interface NamespaceScope {
    readonly namespace?: string;
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

/**
 * The scope of a module declaration's body. An identifier opens a namespace,
 * a dotted declaration (`namespace A.B {}`) opens one per segment; a
 * string-literal name or `declare global` keeps the scope.
 */
export const enterModule = (node: ts.ModuleDeclaration, scope: NamespaceScope): EnteredModule => {
    if (!ts.isIdentifier(node.name) || node.flags & ts.NodeFlags.GlobalAugmentation) {
        const body = node.body && ts.isModuleBlock(node.body) ? node.body : undefined;
        return { scope, namespaces: [], body };
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
    return { scope: { namespace: parent }, namespaces, body };
};

/** Copies the scope onto an engine object; a no-op at the top level. */
export const withScope = <T>(dep: T, scope: NamespaceScope): T => {
    if (!dep) {
        return dep;
    }
    if (scope.namespace) {
        (dep as { namespace?: string }).namespace = scope.namespace;
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
