export class PrivateConstructor {
    /**
     * @ignore
     */
    private myproperty: string;

    /**
     * A documented property
     */
    public shown: string;

    /**
     * @ignore
     */
    public yo() {
        return 'yo';
    }

    /**
     * @ignore
     */
    private constructor() {}
}
