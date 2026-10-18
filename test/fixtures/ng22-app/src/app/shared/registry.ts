/**
 * A project decorator that happens to be called `Service`; it is not Angular's.
 */
export function Service(_name?: string) {
    return (_target: unknown) => {};
}

/**
 * Registered with the project decorator, so it stays a plain class.
 */
@Service('registry')
export class Registry {
    /** Registered names. */
    readonly names: string[] = [];
}
