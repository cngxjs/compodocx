/** Render an indexable signature: `name[arg: type]` or `[arg: type]`. */
export const indexableSignature = (method: {
    name?: string;
    args: { name: string; type: string }[];
}): string => {
    const args = method.args.map(arg => `${arg.name}: ${arg.type}`).join(', ');
    return method.name ? `${method.name}[${args}]` : `[${args}]`;
};

/**
 * Element id of an index signature, from its parameters: `index-key-string`
 * for `[key: string]`. A string and a number signature get different ids.
 */
export const indexSignatureAnchor = (method: { args: { name: string; type: string }[] }): string =>
    ['index', ...method.args.flatMap(arg => [arg.name, arg.type])]
        .join('-')
        .replace(/[^A-Za-z0-9_$-]/g, '-');
