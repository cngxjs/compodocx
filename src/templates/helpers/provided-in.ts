const PROVIDED_IN_LITERALS = new Set(['root', 'platform', 'any']);

/**
 * Render a stored `providedIn` value as it reads in source: the string
 * literals `root` / `platform` / `any` in single quotes, class or module
 * references as-is.
 */
export const formatProvidedIn = (value: string): string =>
    PROVIDED_IN_LITERALS.has(value) ? `'${value}'` : value;
