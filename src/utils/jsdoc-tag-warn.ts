import { logger } from './logger';

/**
 * Per-result warn dedup. The two JSDoc-tag extractors
 * (`angular-dependencies/jsdoc-tags.ts` and
 * `class-helper/jsdoc-extractor.ts`) both run on the same `result`
 * container for some kinds, so naive `logger.warn()` calls fire twice
 * for the same source occurrence. `warnOnce` keys the warning by a
 * stable `kind` string against a WeakMap entry for the result object —
 * the second extractor's warn is a no-op.
 *
 * `kind` should be a discriminator string that uniquely identifies the
 * warn category (e.g. `'wcag:invalid'`, `'github:invalid'`).
 */
const warned = new WeakMap<object, Set<string>>();

export function warnOnce(result: object, kind: string, message: string): void {
    let set = warned.get(result);
    if (!set) {
        set = new Set();
        warned.set(result, set);
    }
    if (set.has(kind)) {
        return;
    }
    set.add(kind);
    logger.warn(message);
}
