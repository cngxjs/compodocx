import { Foo } from './foo';

/**
 * A function with labelled links in its tags.
 *
 * @param pipe the {@link Foo|pipe foo} value
 * @param space the {@link Foo space foo} value
 * @param bracket the [bracket foo]{@link Foo} value
 * @param url see {@link https://angular.dev|Angular}
 * @param missing the {@link Missing|missing foo} value
 * @param site see {@link https://angular.dev Angular site}
 * @param path the {@link /src/app/foo.ts foo source} value
 * @returns the {@link Foo|returned foo}
 */
export function labelled(
    pipe: Foo,
    space: Foo,
    bracket: Foo,
    url: string,
    missing?: Foo,
    site?: string,
    path?: string
): Foo {
    return url || site || path ? pipe : (missing ?? space ?? bracket);
}

/**
 * A class with labelled links in a method's tags.
 */
export class Labeller {
    /**
     * Labels a foo.
     *
     * @param foo the {@link Foo|method foo} value
     * @returns the {@link Foo|labelled foo}
     */
    label(foo: Foo): Foo {
        return foo;
    }
}
