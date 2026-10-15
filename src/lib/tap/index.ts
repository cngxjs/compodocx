/**
 * Run a side-effect on a piped value and pass it through unchanged.
 * Useful for logging, metrics, or guard-style assertions inside a `pipe`.
 */
export const tap =
    <T>(fn: (value: T) => void) =>
    (value: T): T => {
        fn(value);
        return value;
    };

/**
 * Async variant: awaits the side-effect before returning the value.
 * Rejections propagate - a rejected side-effect aborts the pipe.
 */
export const tapAsync =
    <T>(fn: (value: T) => void | Promise<void>) =>
    async (value: T): Promise<T> => {
        await fn(value);
        return value;
    };
