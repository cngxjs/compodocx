/**
 * @ignore
 */
export function LogMethod(target: unknown, key: string) {
    console.log('LogMethod: ' + key);
}

/**
 * A documented function
 */
export function LogClass(target: unknown) {
    return target;
}
