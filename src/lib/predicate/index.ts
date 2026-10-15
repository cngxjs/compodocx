/**
 * Narrows to `T` when used as an `Array.prototype.filter` callback.
 * `[1, null, 2].filter(isNonNull)` becomes `number[]` at compile time.
 */
export const isNonNull = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined;

/**
 * Deduplicates an array via `Array.prototype.filter`. First occurrence wins.
 * Uses strict equality (`indexOf`) so it works for primitives and identity-
 * compared references. For deep equality, project the value first.
 */
export const isUnique = <T>(value: T, index: number, array: readonly T[]): boolean =>
    array.indexOf(value) === index;

/**
 * Curried own-property guard. `hasProp('foo')(obj)` narrows `obj` to
 * `obj & Record<'foo', unknown>`. Uses `Object.prototype.hasOwnProperty.call`
 * (not `in`) so inherited properties are excluded - matches how
 * structured-data parsers treat plain JSON objects.
 */
export const hasProp =
    <K extends string>(key: K) =>
    <T extends object>(obj: T): obj is T & Record<K, unknown> =>
        Object.hasOwn(obj, key);
