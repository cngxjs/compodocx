/** A visited method with whether its declaration has a body. */
export type MethodDeclaration<M> = { readonly method: M; readonly hasBody: boolean };

/**
 * One entry per method name. The overload signatures of a name become one
 * entry: the first signature, with the others in `overloads`. The
 * implementation signature of an overloaded method is dropped, as TypeScript
 * does not expose it to callers. In an interface every signature counts. Pure.
 */
export const mergeOverloads = <M extends { readonly name: string }>(
    declarations: readonly MethodDeclaration<M>[]
): (M & { overloads?: M[] })[] => {
    const byName = new Map<string, MethodDeclaration<M>[]>();
    for (const declaration of declarations) {
        const group = byName.get(declaration.method.name) ?? [];
        group.push(declaration);
        byName.set(declaration.method.name, group);
    }
    return [...byName.values()].map(group => {
        const hasOverloads = group.some(d => d.hasBody) && group.some(d => !d.hasBody);
        const signatures = (hasOverloads ? group.filter(d => !d.hasBody) : group).map(
            d => d.method
        );
        const [first, ...rest] = signatures;
        return rest.length > 0 ? { ...first, overloads: rest } : first;
    });
};
