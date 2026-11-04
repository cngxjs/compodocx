/** A namespace as the content check sees it. */
export interface NamespaceContent {
    readonly name: string;
    /** Dotted chain of the enclosing namespaces. */
    readonly namespace?: string;
    /** Qualified names of what it declares, inner namespaces included. */
    readonly members?: readonly string[];
    readonly aliases?: readonly unknown[];
}

const qualifiedOf = (entry: NamespaceContent): string =>
    entry.namespace ? `${entry.namespace}.${entry.name}` : entry.name;

/**
 * The qualified names of the namespaces with content: an alias, or a member
 * that is not itself a namespace without content. A namespace without
 * content gets no page and no symbol table entry.
 */
export const namespacesWithContent = (
    namespaces: readonly NamespaceContent[]
): ReadonlySet<string> => {
    const byName = new Map(namespaces.map(entry => [qualifiedOf(entry), entry]));
    const known = new Map<string, boolean>();
    const hasContent = (name: string, seen: ReadonlySet<string>): boolean => {
        const cached = known.get(name);
        if (cached !== undefined) {
            return cached;
        }
        const entry = byName.get(name);
        if (!entry || seen.has(name)) {
            return false;
        }
        const inner = new Set([...seen, name]);
        const result =
            (entry.aliases?.length ?? 0) > 0 ||
            (entry.members ?? []).some(member => !byName.has(member) || hasContent(member, inner));
        known.set(name, result);
        return result;
    };
    return new Set([...byName.keys()].filter(name => hasContent(name, new Set())));
};

/** The namespaces with content, in their order. */
export const documentedNamespaces = <T extends NamespaceContent>(
    namespaces: readonly T[] | undefined
): T[] => {
    const list = namespaces ?? [];
    const withContent = namespacesWithContent(list);
    return list.filter(entry => withContent.has(qualifiedOf(entry)));
};
