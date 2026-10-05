/**
 * The tidi class
 *
 * @deprecated This class is deprecated
 */
export class Tidi {
    /**
     * @deprecated This property is deprecated
     */
    completed: boolean;

    afunc(a: string, b: string): { passwordMismatch: boolean } | null {
        return a === b ? null : { passwordMismatch: true };
    }
}
